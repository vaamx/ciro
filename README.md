# Ciro Chat Application

A chat application with PDF upload, processing, and querying capabilities.

## Features

- User authentication
- PDF document upload and processing
- Text extraction from PDFs
- Vector-based document indexing
- Natural language querying of document content
- Chat interface for interacting with documents

## Project Structure

- **server/**: Backend server code
- **dashboard/**: Frontend application
- **tests/**: Test files and resources

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- PostgreSQL database
- Qdrant vector database (or other supported vector store)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ciro-chat.git
   cd ciro-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Initialize the database:
   ```bash
   npm run db:init
   ```

5. Start the development server:
   ```bash
   # Start the backend
   cd server
   npm run dev
   
   # In a separate terminal, start the frontend
   cd dashboard
   npm run dev
   ```

6. Access the application at http://localhost:3001

## Testing

### Manual Testing

The project includes resources for manual testing of key features:

1. **PDF Upload Test**: A comprehensive test for the PDF upload, processing, and querying functionality.

To perform manual tests:

```bash
# Generate a test PDF document
node tests/manual/create-test-pdf.js

# Follow the instructions in the test document
# See tests/manual/pdf-upload-test.md for details
```

For more information about manual testing, see [Manual Testing README](tests/manual/README.md).

## Development

### Backend

The backend is built with:
- Node.js
- Express
- PostgreSQL
- Qdrant (vector database)

### Frontend

The frontend is built with:
- React
- TypeScript
- Material-UI (or your UI framework)

## License

[MIT License](LICENSE) 