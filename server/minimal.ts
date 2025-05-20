import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const PORT = process.env.PORT || 3001;

// Create a minimal Express server
const app = express();

// Apply middleware
app.use(cors());
app.use(helmet());
app.use(express.json());

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'minimal-server',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Minimal server is running',
    status: 'ok'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Minimal server listening on port ${PORT}`);
}); 