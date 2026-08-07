import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  // Soporte para variable de entorno en producción (Vercel / Render / Railway)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // En desarrollo/Ngrok, conectarse de forma relativa (misma origen) usando el proxy de Vite
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: false,
});
