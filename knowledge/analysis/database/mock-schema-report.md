# Mock Database Schema Analysis Report

*Generated on: 2025-04-10T02:28:30.039Z*

## Tables Overview

Total tables: 7

| Table Name | Row Count | Total Size | Index Size |
|------------|-----------|------------|------------|
| data_sources | 15 | 128 kB | 64 kB |
| documents | 2500 | 2.5 MB | 1.2 MB |
| embeddings | 10000 | 50 MB | 25 MB |
| collections | 8 | 64 kB | 32 kB |
| chunks | 7500 | 15 MB | 7.5 MB |
| users | 50 | 256 kB | 128 kB |
| settings | 25 | 128 kB | 64 kB |

## Detailed Table Schemas

### data_sources

**Statistics:**
- Row Count: 15
- Total Size: 128 kB
- Index Size: 64 kB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| name | varchar | NO | NULL |
| type | varchar | NO | NULL |
| created_at | timestamp | NO | now() |

### documents

**Statistics:**
- Row Count: 2500
- Total Size: 2.5 MB
- Index Size: 1.2 MB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| data_source_id | uuid | NO | NULL |
| content | text | NO | NULL |

**Foreign Keys:**

| Column | References | Constraint Name |
|--------|------------|----------------|
| data_source_id | data_sources(id) | fk_documents_data_source |

### embeddings

**Statistics:**
- Row Count: 10000
- Total Size: 50 MB
- Index Size: 25 MB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|
| id | uuid | NO | uuid_generate_v4() |
| document_id | uuid | NO | NULL |
| embedding | vector | NO | NULL |

**Foreign Keys:**

| Column | References | Constraint Name |
|--------|------------|----------------|
| document_id | documents(id) | fk_embeddings_document |

### collections

**Statistics:**
- Row Count: 8
- Total Size: 64 kB
- Index Size: 32 kB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|

### chunks

**Statistics:**
- Row Count: 7500
- Total Size: 15 MB
- Index Size: 7.5 MB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|

### users

**Statistics:**
- Row Count: 50
- Total Size: 256 kB
- Index Size: 128 kB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|

### settings

**Statistics:**
- Row Count: 25
- Total Size: 128 kB
- Index Size: 64 kB

**Columns:**

| Column Name | Data Type | Nullable | Default |
|-------------|-----------|----------|----------|

## RAG System Tables

The following tables are part of the RAG system:

- data_sources
- documents
- embeddings
- collections
- chunks
