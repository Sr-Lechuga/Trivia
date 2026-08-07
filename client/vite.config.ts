import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    host: true, // Escuchar en 0.0.0.0 para acceso desde la red local
    port: 5173,
    allowedHosts: true, // Permitir dominios de túneles como ngrok / localtunnel
    proxy: {
      // Redirigir peticiones API al servidor Express local
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Redirigir comunicación de WebSockets de Socket.IO
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
