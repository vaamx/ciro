import uvicorn
import os
import sys
import traceback
import io
import contextlib
import json
import glob
import time
from typing import Dict, Any, List, Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


class CodeExecutionRequest(BaseModel):
    code: str
    timeout: Optional[int] = 30


class FileInfo(BaseModel):
    name: str
    type: str
    size: int
    path: str


class ExecutionResult(BaseModel):
    stdout: str
    stderr: str
    success: bool
    execution_time: float
    files: List[FileInfo]
    error: Optional[str] = None


# FastAPI app
app = FastAPI(title="Sandbox Code Executor", version="1.0.0")

# Global session state - this persists across requests within the same container
session_globals = {}
scratch_dir = Path("/scratch")

# Ensure scratch directory exists
scratch_dir.mkdir(exist_ok=True)


def capture_matplotlib_figures():
    """Capture any matplotlib figures and save them to scratch directory"""
    try:
        import matplotlib.pyplot as plt
        
        figures = []
        for i in plt.get_fignums():
            fig = plt.figure(i)
            if fig.axes:  # Only save if figure has content
                filename = f"plot_{i}_{int(time.time())}.png"
                filepath = scratch_dir / filename
                fig.savefig(filepath, dpi=100, bbox_inches='tight')
                figures.append(str(filepath))
        
        # Clear all figures to free memory
        plt.close('all')
        return figures
    except Exception as e:
        print(f"Error capturing matplotlib figures: {e}")
        return []


def setup_plotting_environment():
    """Configure matplotlib for headless operation"""
    try:
        import matplotlib
        matplotlib.use('Agg')  # Use non-interactive backend
        
        import matplotlib.pyplot as plt
        plt.ioff()  # Turn off interactive mode
        
        # Set default style
        plt.style.use('default')
    except ImportError:
        pass


def get_scratch_files() -> List[FileInfo]:
    """Get list of files in scratch directory"""
    files = []
    try:
        for file_path in scratch_dir.glob("*"):
            if file_path.is_file():
                stat = file_path.stat()
                files.append(FileInfo(
                    name=file_path.name,
                    type=file_path.suffix.lower() or 'unknown',
                    size=stat.st_size,
                    path=str(file_path)
                ))
    except Exception as e:
        print(f"Error listing files: {e}")
    
    return files


@app.on_event("startup")
async def startup_event():
    """Initialize the sandbox environment"""
    setup_plotting_environment()
    
    # Add common imports to session globals
    exec("""
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import plotly.express as px
import plotly.graph_objects as go
from sklearn import *
import scipy
import os

# Set up plotting
plt.style.use('default')
sns.set_theme()

# Helper function to save plots
def save_plot(filename=None, format='png'):
    if filename is None:
        filename = f'plot_{int(time.time())}.{format}'
    
    filepath = f'/scratch/{filename}'
    plt.savefig(filepath, dpi=100, bbox_inches='tight')
    print(f'Plot saved to: {filename}')
    return filepath
""", session_globals)


@app.get("/healthz")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": time.time()}


@app.get("/status")
async def get_status():
    """Get current session status"""
    files = get_scratch_files()
    return {
        "session_variables": list(session_globals.keys()),
        "scratch_files": len(files),
        "files": files
    }


@app.get("/files")
async def list_files():
    """List all files in scratch directory"""
    return {"files": get_scratch_files()}


@app.delete("/files")
async def clear_files():
    """Clear all files in scratch directory"""
    try:
        for file_path in scratch_dir.glob("*"):
            if file_path.is_file():
                file_path.unlink()
        return {"message": "All files cleared", "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing files: {str(e)}")


@app.post("/execute")
async def execute_code(request: CodeExecutionRequest) -> ExecutionResult:
    """Execute Python code in the persistent session"""
    start_time = time.time()
    
    # Capture stdout and stderr
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    
    success = False
    error_msg = None
    
    try:
        # Setup environment for this execution
        session_globals['__scratch_dir__'] = str(scratch_dir)
        
        # Execute code with captured output
        with contextlib.redirect_stdout(stdout_capture), \
             contextlib.redirect_stderr(stderr_capture):
            
            # Execute the user's code in our persistent session
            exec(request.code, session_globals)
            
        # Capture any matplotlib figures
        capture_matplotlib_figures()
        
        success = True
        
    except Exception as e:
        error_msg = str(e)
        # Also capture the full traceback
        stderr_capture.write(traceback.format_exc())
    
    execution_time = time.time() - start_time
    
    # Get updated file list
    files = get_scratch_files()
    
    return ExecutionResult(
        stdout=stdout_capture.getvalue(),
        stderr=stderr_capture.getvalue(),
        success=success,
        execution_time=execution_time,
        files=files,
        error=error_msg
    )


@app.delete("/session")
async def reset_session():
    """Reset the session state"""
    global session_globals
    session_globals.clear()
    
    # Re-initialize with common imports
    await startup_event()
    
    return {"message": "Session reset", "success": True}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    ) 