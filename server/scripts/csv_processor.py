#!/usr/bin/env python3
import os
import sys
import json
import argparse
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
import logging
import time
import psycopg2
from psycopg2.extras import Json, DictCursor
import openai
import requests
from tqdm import tqdm

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('csv_processor')

class QdrantClient:
    """Simple Qdrant client to upsert vectors."""
    
    def __init__(self, host: str = "localhost", port: int = 6333):
        self.host = host
        self.port = port
        self.base_url = f"http://{host}:{port}"
        logger.info(f"Initialized Qdrant client with URL: {self.base_url}")
    
    def collection_exists(self, collection_name: str) -> bool:
        """Check if a collection exists in Qdrant."""
        try:
            response = requests.get(f"{self.base_url}/collections/{collection_name}")
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error checking collection existence: {str(e)}")
            return False
    
    def create_collection(self, collection_name: str, vector_size: int = 1536) -> bool:
        """Create a new collection in Qdrant."""
        try:
            payload = {
                "vectors": {
                    "size": vector_size,
                    "distance": "Cosine"
                }
            }
            response = requests.put(
                f"{self.base_url}/collections/{collection_name}", 
                json=payload
            )
            if response.status_code == 200:
                logger.info(f"Created collection: {collection_name}")
                return True
            else:
                logger.error(f"Failed to create collection: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error creating collection: {str(e)}")
            return False
    
    def upsert_vectors(self, collection_name: str, vectors: List[Dict[str, Any]]) -> bool:
        """Upsert vectors into a Qdrant collection."""
        try:
            payload = {"points": vectors}
            response = requests.put(
                f"{self.base_url}/collections/{collection_name}/points", 
                json=payload
            )
            if response.status_code == 200:
                logger.info(f"Upserted {len(vectors)} vectors into collection: {collection_name}")
                return True
            else:
                logger.error(f"Failed to upsert vectors: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Error upserting vectors: {str(e)}")
            return False


class CSVProcessor:
    """Process CSV files, generate embeddings, and store in Qdrant."""
    
    def __init__(
        self, 
        db_host: str = "localhost",
        db_port: int = 5432,
        db_name: str = "***REMOVED***", 
        db_user: str = "***REMOVED***",
        db_password: str = "***REMOVED***",
        openai_api_key: Optional[str] = None,
        qdrant_host: str = "localhost",
        qdrant_port: int = 6333
    ):
        # Initialize database connection
        self.db_config = {
            "host": db_host,
            "port": db_port,
            "dbname": db_name,
            "user": db_user,
            "password": db_password
        }
        
        # Set OpenAI API key
        if openai_api_key:
            openai.api_key = openai_api_key
        elif 'OPENAI_API_KEY' in os.environ:
            openai.api_key = os.environ['OPENAI_API_KEY']
        else:
            logger.warning("No OpenAI API key provided. Embeddings generation will fail.")
        
        # Initialize Qdrant client
        self.qdrant = QdrantClient(host=qdrant_host, port=qdrant_port)
        
        logger.info("CSVProcessor initialized successfully")
    
    def connect_to_db(self):
        """Connect to the PostgreSQL database."""
        try:
            conn = psycopg2.connect(**self.db_config)
            logger.info("Connected to the database successfully")
            return conn
        except Exception as e:
            logger.error(f"Database connection error: {str(e)}")
            raise
    
    def update_data_source_progress(self, conn, data_source_id: str, progress: int, processed: int, total: int):
        """Update the data source progress in the database."""
        try:
            with conn.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE data_sources
                    SET status = 'processing',
                        metadata = jsonb_set(
                            jsonb_set(
                                COALESCE(metadata::jsonb, '{}'::jsonb),
                                '{progress}',
                                %s::jsonb
                            ),
                            '{processedRecords}',
                            %s::jsonb
                        )
                    WHERE id = %s
                    """,
                    (Json(str(progress)), Json(str(processed)), data_source_id)
                )
                conn.commit()
                logger.info(f"Updated progress for data source {data_source_id}: {progress}% ({processed}/{total})")
        except Exception as e:
            logger.error(f"Error updating data source progress: {str(e)}")
            conn.rollback()
    
    def update_data_source_completion(self, conn, data_source_id: str, record_count: int, chunk_count: int):
        """Update the data source completion status in the database."""
        try:
            with conn.cursor() as cursor:
                # Update metrics
                cursor.execute(
                    """
                    UPDATE data_sources
                    SET status = 'connected',
                        last_sync = NOW(),
                        metrics = jsonb_set(
                            COALESCE(metrics::jsonb, '{}'::jsonb),
                            '{records}',
                            %s::jsonb
                        )
                    WHERE id = %s
                    """,
                    (Json(str(record_count)), data_source_id)
                )
                
                # Update metadata
                cursor.execute(
                    """
                    UPDATE data_sources
                    SET metadata = jsonb_set(
                        jsonb_set(
                            COALESCE(metadata::jsonb, '{}'::jsonb),
                            '{records}',
                            %s::jsonb
                        ),
                        '{processedAt}',
                        %s::jsonb
                    )
                    WHERE id = %s
                    """,
                    (Json(str(record_count)), Json(time.strftime("%Y-%m-%dT%H:%M:%S.%fZ", time.gmtime())), data_source_id)
                )
                conn.commit()
                logger.info(f"Updated completion status for data source {data_source_id}: {record_count} records, {chunk_count} chunks")
        except Exception as e:
            logger.error(f"Error updating data source completion: {str(e)}")
            conn.rollback()
    
    def get_data_source(self, conn, data_source_id: str) -> Optional[Dict]:
        """Get data source information from the database."""
        try:
            with conn.cursor(cursor_factory=DictCursor) as cursor:
                cursor.execute(
                    "SELECT * FROM data_sources WHERE id = %s",
                    (data_source_id,)
                )
                result = cursor.fetchone()
                if result:
                    return dict(result)
                else:
                    logger.warning(f"Data source not found: {data_source_id}")
                    return None
        except Exception as e:
            logger.error(f"Error getting data source: {str(e)}")
            return None
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for a list of texts using OpenAI API."""
        try:
            response = openai.embeddings.create(
                model="text-embedding-3-small",
                input=texts
            )
            return [item.embedding for item in response.data]
        except Exception as e:
            logger.error(f"Error generating embeddings: {str(e)}")
            raise
    
    def format_record_as_text(self, record: Dict[str, Any]) -> str:
        """Format a CSV record as text for embedding."""
        text_parts = []
        for key, value in record.items():
            if value is not None and value != "":
                text_parts.append(f"{key}: {value}")
        return "\n".join(text_parts)
    
    def process_csv_file(self, filepath: str, data_source_id: str, batch_size: int = 50) -> Dict[str, Any]:
        """Process a CSV file, generate embeddings, and store in Qdrant."""
        try:
            start_time = time.time()
            
            # Check if file exists
            if not os.path.exists(filepath):
                logger.error(f"File not found: {filepath}")
                return {"success": False, "message": f"File not found: {filepath}"}
            
            logger.info(f"Processing CSV file: {filepath}")
            
            # Read CSV file
            df = pd.read_csv(filepath)
            total_records = len(df)
            logger.info(f"Read {total_records} records from CSV file")
            
            # Connect to the database
            conn = self.connect_to_db()
            
            # Get data source info
            data_source = self.get_data_source(conn, data_source_id)
            if not data_source:
                return {"success": False, "message": f"Data source not found: {data_source_id}"}
            
            # Prepare Qdrant collection
            collection_name = f"datasource_{data_source_id}"
            
            if not self.qdrant.collection_exists(collection_name):
                logger.info(f"Creating Qdrant collection: {collection_name}")
                if not self.qdrant.create_collection(collection_name):
                    return {"success": False, "message": f"Failed to create Qdrant collection: {collection_name}"}
            
            # Process records in batches
            records_processed = 0
            chunks_stored = 0
            
            # Convert DataFrame to list of dictionaries
            records = df.replace({np.nan: None}).to_dict(orient='records')
            
            for i in range(0, total_records, batch_size):
                batch = records[i:i+batch_size]
                
                # Update progress
                progress = int((i / total_records) * 100)
                self.update_data_source_progress(conn, data_source_id, progress, records_processed, total_records)
                
                # Prepare text for embeddings
                texts = [self.format_record_as_text(record) for record in batch]
                
                try:
                    # Generate embeddings
                    embeddings = self.generate_embeddings(texts)
                    
                    # Prepare vectors for Qdrant
                    vectors = []
                    for j, (record, embedding, text) in enumerate(zip(batch, embeddings, texts)):
                        vector_id = f"{data_source_id}_record_{i + j}"
                        vectors.append({
                            "id": vector_id,
                            "vector": embedding,
                            "payload": {
                                "text": text,
                                "metadata": {
                                    "source": "csv_processor",
                                    "data_source_id": data_source_id,
                                    "record_index": i + j,
                                    "original_data": record
                                }
                            }
                        })
                    
                    # Upsert vectors to Qdrant
                    if self.qdrant.upsert_vectors(collection_name, vectors):
                        records_processed += len(batch)
                        chunks_stored += len(vectors)
                        logger.info(f"Processed batch {i//batch_size + 1}/{(total_records + batch_size - 1)//batch_size}: {len(vectors)} vectors")
                    else:
                        logger.error(f"Failed to upsert vectors for batch {i//batch_size + 1}")
                except Exception as e:
                    logger.error(f"Error processing batch: {str(e)}")
                    # Continue with the next batch
            
            # Update completion status
            self.update_data_source_completion(conn, data_source_id, records_processed, chunks_stored)
            
            # Close database connection
            conn.close()
            
            elapsed_time = time.time() - start_time
            logger.info(f"Processing completed in {elapsed_time:.2f} seconds")
            logger.info(f"Processed {records_processed} records, stored {chunks_stored} chunks")
            
            return {
                "success": True,
                "message": f"Successfully processed {records_processed} records and stored {chunks_stored} vectors",
                "recordCount": records_processed,
                "chunkCount": chunks_stored,
                "processingTime": elapsed_time
            }
            
        except Exception as e:
            logger.error(f"Error processing CSV file: {str(e)}")
            return {
                "success": False,
                "message": f"Error processing CSV file: {str(e)}",
                "error": str(e)
            }


def main():
    """Main function to process a CSV file from command line arguments."""
    parser = argparse.ArgumentParser(description="Process CSV files for vector embeddings")
    parser.add_argument("--file", "-f", required=True, help="Path to the CSV file")
    parser.add_argument("--data-source-id", "-d", required=True, help="Data source ID")
    parser.add_argument("--db-host", default="localhost", help="Database host")
    parser.add_argument("--db-port", type=int, default=5432, help="Database port")
    parser.add_argument("--db-name", default="***REMOVED***", help="Database name")
    parser.add_argument("--db-user", default="***REMOVED***", help="Database user")
    parser.add_argument("--db-password", default="***REMOVED***", help="Database password")
    parser.add_argument("--openai-api-key", help="OpenAI API key (optional if set as env var)")
    parser.add_argument("--qdrant-host", default="localhost", help="Qdrant host")
    parser.add_argument("--qdrant-port", type=int, default=6333, help="Qdrant port")
    parser.add_argument("--batch-size", type=int, default=50, help="Batch size for processing")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = CSVProcessor(
        db_host=args.db_host,
        db_port=args.db_port,
        db_name=args.db_name,
        db_user=args.db_user,
        db_password=args.db_password,
        openai_api_key=args.openai_api_key,
        qdrant_host=args.qdrant_host,
        qdrant_port=args.qdrant_port
    )
    
    # Process the CSV file
    result = processor.process_csv_file(
        filepath=args.file,
        data_source_id=args.data_source_id,
        batch_size=args.batch_size
    )
    
    # Print the result
    print(json.dumps(result, indent=2))
    
    # Exit with appropriate code
    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main() 