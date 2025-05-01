import { Injectable } from '@nestjs/common';
import { createServiceLogger } from '../../common/utils/logger-factory';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as os from 'os';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Execution result interface
 */
export interface ExecutionResult {
  stdout: string;
  stderr: string;
  executionTime: number;
  visualizations: Array<{
    id: string;
    type: string;
    data: string; // Base64 encoded image data
    mimeType: string;
  }>;
  error?: string;
  success: boolean;
}

/**
 * Python execution options
 */
export interface PythonExecutionOptions {
  timeoutMs?: number; // Max execution time in milliseconds
  memoryLimitMb?: number; // Max memory in MB
  workingDirectory?: string; // Working directory for execution
  environmentVars?: Record<string, string>; // Environment variables
  saveVisualization?: boolean; // Whether to save and return visualization outputs
}

/**
 * Service for executing Python code in a secure, isolated environment
 */
@Injectable()
export class PythonExecutorService {
  private readonly logger = createServiceLogger('PythonExecutorService');
  private readonly tempDir: string;
  private readonly defaultOptions: PythonExecutionOptions = {
    timeoutMs: 30000, // 30 seconds default timeout
    memoryLimitMb: 1024, // 1GB default memory limit
    saveVisualization: true
  };

  constructor() {
    this.logger.info('PythonExecutorService initialized');
    this.tempDir = path.join(os.tmpdir(), 'ciro-code-execution');
    
    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
      this.logger.info(`Created temporary directory: ${this.tempDir}`);
    }
  }

  /**
   * Execute Python code and return the result
   */
  async executeCode(code: string, options: PythonExecutionOptions = {}): Promise<ExecutionResult> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const { timeoutMs, memoryLimitMb, workingDirectory, environmentVars, saveVisualization } = mergedOptions;
    
    // Generate a unique ID for this execution
    const executionId = crypto.randomBytes(16).toString('hex');
    const tempDir = workingDirectory || this.tempDir;
    const scriptPath = path.join(tempDir, `${executionId}.py`);
    const vizOutputDir = path.join(tempDir, `${executionId}_viz`);
    
    // Create visualization output directory if needed
    if (saveVisualization) {
      fs.mkdirSync(vizOutputDir, { recursive: true });
    }
    
    // Generate the wrapper script with visualization handling
    const wrappedCode = this.wrapCodeForExecution(code, vizOutputDir, saveVisualization || false);
    
    // Write the script to a temporary file
    fs.writeFileSync(scriptPath, wrappedCode);
    
    const startTime = Date.now();
    let result: ExecutionResult = {
      stdout: '',
      stderr: '',
      executionTime: 0,
      visualizations: [],
      success: false
    };
    
    try {
      // Prepare environment variables
      const env = { ...process.env, ...environmentVars };
      
      // Set memory limit if supported by the platform
      let memoryLimitCmd = '';
      if (os.platform() === 'linux' && memoryLimitMb) {
        memoryLimitCmd = `ulimit -v ${memoryLimitMb * 1024} && `;
      }
      
      // Execute the Python script
      const { stdout, stderr } = await execPromise(
        `${memoryLimitCmd}python3 ${scriptPath}`, 
        {
          timeout: timeoutMs,
          cwd: tempDir,
          env
        }
      );
      
      result.stdout = stdout;
      result.stderr = stderr;
      result.executionTime = Date.now() - startTime;
      result.success = true;
      
      // Process and collect visualizations if enabled
      if (saveVisualization) {
        result.visualizations = await this.collectVisualizations(vizOutputDir);
      }
    } catch (error: unknown) {
      this.logger.error(`Error executing Python code: ${error}`);
      
      // Cast error to any to safely access properties that might exist
      const err = error as any;
      result.stderr = err.stderr || String(error);
      result.error = String(error);
      result.executionTime = Date.now() - startTime;
    } finally {
      // Clean up temporary files
      this.cleanupTempFiles(scriptPath, vizOutputDir, saveVisualization || false);
    }
    
    return result;
  }

  /**
   * Wrap user code with our execution harness to capture output and visualizations
   */
  private wrapCodeForExecution(code: string, vizOutputDir: string, saveVisualization: boolean): string {
    let wrappedCode = `
import sys
import traceback
import json
import os
import io
import contextlib
import time

# Configure output capturing
execution_result = {
    "stdout": "",
    "stderr": "",
    "error": None,
    "visualization_files": []
}

# Set up visualization output directory
viz_output_dir = "${vizOutputDir.replace(/\\/g, '\\\\')}"
os.environ["VISUALIZATION_OUTPUT_DIR"] = viz_output_dir

# Helper functions for working with data files
def get_data_file_paths():
    """Get all data file paths from environment variables"""
    data_files = {}
    data_files_count = int(os.environ.get("DATA_FILES_COUNT", "0"))
    
    # Get all data files by index
    for i in range(data_files_count):
        file_id = os.environ.get(f"DATA_FILE_INDEX_{i}")
        if file_id:
            file_path = os.environ.get(f"DATA_FILE_{file_id}")
            file_name = os.environ.get(f"DATA_FILE_NAME_{file_id}", "")
            file_type = os.environ.get(f"DATA_FILE_TYPE_{file_id}", "")
            
            if file_path:
                data_files[file_id] = {
                    "path": file_path,
                    "name": file_name,
                    "type": file_type
                }
    
    return data_files

def load_data_file(file_id=None):
    """
    Load a data file using pandas based on its type
    
    Parameters:
    -----------
    file_id : str, optional
        ID of the file to load. If None, loads the first available file.
        
    Returns:
    --------
    pandas.DataFrame
        The loaded data
    """
    import pandas as pd
    
    data_files = get_data_file_paths()
    
    # If no file_id specified, use the first one
    if file_id is None and data_files:
        file_id = list(data_files.keys())[0]
    
    if file_id not in data_files:
        raise ValueError(f"Data file with ID {file_id} not found")
    
    file_info = data_files[file_id]
    file_path = file_info["path"]
    file_type = file_info["type"].lower()
    
    # Load based on file type
    if file_type == "csv":
        return pd.read_csv(file_path)
    elif file_type in ("excel", "xlsx", "xls"):
        return pd.read_excel(file_path)
    elif file_type == "json":
        return pd.read_json(file_path)
    elif file_type == "parquet":
        return pd.read_parquet(file_path)
    else:
        # Default to CSV
        try:
            return pd.read_csv(file_path)
        except:
            try:
                return pd.read_excel(file_path)
            except:
                raise ValueError(f"Unsupported file type: {file_type}")

# Capture stdout and stderr
stdout_capture = io.StringIO()
stderr_capture = io.StringIO()

# Add visualization capturing if needed
`;

    if (saveVisualization) {
      wrappedCode += `
# Override matplotlib show function to save figures
try:
    import matplotlib
    import matplotlib.pyplot as plt
    import uuid
    
    # Use Agg backend for headless environments
    matplotlib.use('Agg')
    
    # Save the original show function
    original_plt_show = plt.show
    
    # Override plt.show to save figures
    def custom_plt_show(*args, **kwargs):
        fig_id = str(uuid.uuid4())
        output_path = os.path.join(viz_output_dir, f"{fig_id}.png")
        plt.savefig(output_path, bbox_inches='tight', dpi=300)
        execution_result["visualization_files"].append(output_path)
        return original_plt_show(*args, **kwargs)
    
    plt.show = custom_plt_show
    
    # Also handle the case where savefig is called directly
    original_plt_savefig = plt.savefig
    
    def custom_plt_savefig(*args, **kwargs):
        if len(args) > 0 and isinstance(args[0], str):
            # User provided a filename, keep track of it
            execution_result["visualization_files"].append(args[0])
        else:
            # Generate a filename
            fig_id = str(uuid.uuid4())
            output_path = os.path.join(viz_output_dir, f"{fig_id}.png")
            args = list(args)
            args.insert(0, output_path)
            execution_result["visualization_files"].append(output_path)
        
        return original_plt_savefig(*args, **kwargs)
    
    plt.savefig = custom_plt_savefig
except ImportError:
    # Matplotlib not available, skip visualization handling
    pass

# Handle plotly if available
try:
    import plotly
    import plotly.io as pio
    import uuid
    
    # Override plotly.io.write_image
    original_write_image = pio.write_image
    
    def custom_write_image(fig, *args, **kwargs):
        if len(args) > 0 and isinstance(args[0], str):
            # User provided a filename
            execution_result["visualization_files"].append(args[0])
        else:
            # Generate a filename
            fig_id = str(uuid.uuid4())
            output_path = os.path.join(viz_output_dir, f"{fig_id}.png")
            args = list(args)
            args.insert(0, output_path)
            execution_result["visualization_files"].append(output_path)
        
        return original_write_image(fig, *args, **kwargs)
    
    pio.write_image = custom_write_image
    
    # Override plotly show function
    original_plotly_show = pio.show
    
    def custom_plotly_show(fig, *args, **kwargs):
        fig_id = str(uuid.uuid4())
        output_path = os.path.join(viz_output_dir, f"{fig_id}.png")
        pio.write_image(fig, output_path)
        execution_result["visualization_files"].append(output_path)
        return original_plotly_show(fig, *args, **kwargs)
    
    pio.show = custom_plotly_show
except ImportError:
    # Plotly not available, skip plotly handling
    pass
`;
    }

    // Add the user's code wrapped in a try-except block
    wrappedCode += `
# Execute the user code with output capture
try:
    with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
        start_time = time.time()
        
        # User code begins here
${code.split('\n').map(line => '        ' + line).join('\n')}
        # User code ends here
        
        execution_time = time.time() - start_time
except Exception as e:
    execution_result["error"] = {
        "type": str(type(e).__name__),
        "message": str(e),
        "traceback": traceback.format_exc()
    }

# Capture output
execution_result["stdout"] = stdout_capture.getvalue()
execution_result["stderr"] = stderr_capture.getvalue()

# Write result to stdout for the parent process to capture
print(json.dumps(execution_result))
`;

    return wrappedCode;
  }

  /**
   * Collect and process generated visualizations
   */
  private async collectVisualizations(vizOutputDir: string): Promise<Array<{
    id: string;
    type: string;
    data: string;
    mimeType: string;
  }>> {
    const visualizations: Array<{
      id: string;
      type: string;
      data: string;
      mimeType: string;
    }> = [];
    
    if (!fs.existsSync(vizOutputDir)) {
      return visualizations;
    }
    
    try {
      const files = fs.readdirSync(vizOutputDir);
      
      for (const file of files) {
        const filePath = path.join(vizOutputDir, file);
        const fileStats = fs.statSync(filePath);
        
        if (fileStats.isFile()) {
          // Read the file content
          const fileContent = fs.readFileSync(filePath);
          
          // Determine MIME type based on extension
          const extension = path.extname(file).toLowerCase();
          let mimeType = 'application/octet-stream';
          
          if (extension === '.png') {
            mimeType = 'image/png';
          } else if (extension === '.jpg' || extension === '.jpeg') {
            mimeType = 'image/jpeg';
          } else if (extension === '.svg') {
            mimeType = 'image/svg+xml';
          } else if (extension === '.html') {
            mimeType = 'text/html';
          } else if (extension === '.json') {
            mimeType = 'application/json';
          }
          
          // Add to the result
          visualizations.push({
            id: path.basename(file, extension),
            type: extension.substring(1), // Remove the dot
            data: fileContent.toString('base64'),
            mimeType
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error collecting visualizations: ${error}`);
    }
    
    return visualizations;
  }

  /**
   * Clean up temporary files after execution
   */
  private cleanupTempFiles(scriptPath: string, vizOutputDir: string, saveVisualization: boolean): void {
    try {
      // Remove the script file
      if (fs.existsSync(scriptPath)) {
        fs.unlinkSync(scriptPath);
      }
      
      // Clean up visualization directory if it exists
      if (saveVisualization && fs.existsSync(vizOutputDir)) {
        const files = fs.readdirSync(vizOutputDir);
        
        for (const file of files) {
          fs.unlinkSync(path.join(vizOutputDir, file));
        }
        
        fs.rmdirSync(vizOutputDir);
      }
    } catch (error) {
      this.logger.error(`Error cleaning up temporary files: ${error}`);
    }
  }
} 