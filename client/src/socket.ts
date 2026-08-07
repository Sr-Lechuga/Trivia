import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  // Soporte para variable de entorno en producción (Vercel / Render / Railway)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: false,
});
