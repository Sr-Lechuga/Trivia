import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import routes from './routes';
import { setupSockets } from './sockets';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Montar las rutas REST
app.use('/api', routes);

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Crear el servidor HTTP y vincular Socket.IO
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // Permitir conexiones desde cualquier origen para desarrollo
    methods: ['GET', 'POST']
  }
});

// Configurar WebSockets
setupSockets(io);

httpServer.listen(PORT, () => {
  console.log(`[Server] Corriendo en http://localhost:${PORT}`);
});
