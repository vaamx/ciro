import { createServer } from 'http';
import app from './app';
import { config } from './config';
import { SocketService } from './services/socket.service';

const server = createServer(app);
const port = config.port;

// Initialize WebSocket service
SocketService.getInstance(server);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 