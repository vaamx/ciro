// Use require instead of import to avoid TypeScript issues
const express = require('express');
const cors = require('cors');
import { config } from '../../config';
import { Request, Response } from 'express';

const app = express();

console.log('CORS Configuration:');
console.log(JSON.stringify(config.cors, null, 2));

// Configure CORS
app.use(cors(config.cors));

app.get('/api/test', (req: Request, res: Response) => {
  res.json({ message: 'CORS test successful' });
});

const PORT = 3002;
app.listen(PORT, () => {
  console.log(`CORS test server running on port ${PORT}`);
}); 