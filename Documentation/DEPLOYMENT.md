# Guía de Despliegue en Producción (Cloud Deployment)

Este documento detalla la arquitectura, opciones y guía paso a paso para desplegar la app de **Trivia Multijugador Realtime** en la nube (Internet pública) con **HTTPS** y **WebSockets (WSS)**, permitiendo que el Host y los jugadores se conecten desde cualquier lugar usando sus datos móviles (4G/5G) o Wi-Fi sin estar en la misma red local.

---

## 1. Arquitectura de Despliegue en la Nube

Para que una aplicación con WebSockets (Socket.IO) funcione en producción accesible desde cualquier celular, se requieren dos componentes desplegados con dominio público y certificado SSL (HTTPS/WSS):

```
                       [ Celular Jugador 4G/5G ] 
                                  │
                                  ▼
                ┌──────────────────────────────────┐
                │        Frontend (React App)      │
                │     Ej: Vercel / Netlify / Cloud │
                └──────────────────────────────────┘
                                  │
                                  ▼ (WebSocket WSS / HTTPS)
                ┌──────────────────────────────────┐
                │      Backend Node.js + Express   │
                │     Ej: Render / Railway / VPS   │
                └──────────────────────────────────┘
```

> **¡Importante sobre WebSockets!**
> Los servicios "serverless" puros (como AWS Lambda o Vercel Serverless Functions) no mantienen conexiones TCP abiertas continuas. Por ello, el **servidor Node.js debe desplegarse en una plataforma que soporte procesos continuos en ejecución** (como Render, Railway, Fly.io o un VPS en DigitalOcean/AWS EC2).

---

## 2. Opciones de Hosting Recomendadas (Gratuitas / Económicas)

### Opción A: Render.com (Recomendada - Nivel Gratuito Disponible)
- **Backend:** Render Web Service (Node.js). Soporta WebSockets de forma nativa.
- **Frontend:** Render Static Site o Vercel.

### Opción B: Railway.app (Excelente rendimiento y facilísima configuración)
- **Backend & Frontend:** Railway soporta desplegar monorepos o múltiples servicios en el mismo proyecto con SSL automático.

### Opción C: Túnel para Pruebas Rápidas (Ngrok / Localtunnel)
- Útil si querés hacer una prueba en vivo **HOY MISMO** desde la PC de tu casa sin subir el código a la nube.

---

## 3. Configuración del Código para Despliegue en la Nube

Para que el cliente React sepa a qué dominio apuntar en producción sin cambiar código manualmente, se utilizan las **Variables de Entorno**.

### 3.1 Adaptar el Cliente (`client/src/socket.ts` y `client/src/App.tsx`)

En producción, el cliente leerá la variable de entorno `VITE_API_URL`:

- Si la variable `VITE_API_URL` está definida (ej: `https://trivia-backend.onrender.com`), usará esa URL.
- Si no está definida (en desarrollo), continuará usando la detección dinámica de IP local (`http://192.168.1.X:3001` o `localhost:3001`).

#### [socket.ts]
```typescript
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
};

export const socket: Socket = io(getSocketUrl(), {
  autoConnect: false,
});
```

#### [App.tsx]
```typescript
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  return `http://${host}:3001`;
};
```

---

## 4. Guía Paso a Paso para Desplegar en Render.com (Gratis)

### Paso 1: Subir tu Código a GitHub
Asegurate de subir el repositorio `Trivia` a tu cuenta de GitHub (público o privado).

### Paso 2: Desplegar el Backend (Servidor Node.js)
1. Entrá a [Render.com](https://render.com) e iniciá sesión con GitHub.
2. Hacé clic en **New +** $\rightarrow$ **Web Service**.
3. Conectá tu repositorio de GitHub.
4. Completa la configuración:
   - **Name:** `trivia-backend` (o el nombre que prefieras).
   - **Root Directory:** `server`
   - **Environment:** `Node`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. Hacé clic en **Create Web Service**.
6. Una vez desplegado, Render te dará la URL pública con HTTPS de tu servidor (ejemplo: `https://trivia-backend.onrender.com`).

### Paso 3: Desplegar el Frontend (React App)
1. En Render, hacé clic en **New +** $\rightarrow$ **Static Site** (o si preferís usá Vercel/Netlify).
2. Conectá el mismo repositorio.
3. Completa la configuración:
   - **Name:** `trivia-frontend`
   - **Root Directory:** `client`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. **Variable de Entorno (Crucial):**
   - Agregá una Environment Variable:
     - **Key:** `VITE_API_URL`
     - **Value:** `https://trivia-backend.onrender.com` (La URL que te dio el paso 2).
5. Hacé clic en **Create Static Site**.

---

## 5. Pruebas de Despliegue Rápido sin Nube (vía Ngrok)

Si querés probar con amigos que están en la calle usando 4G **sin hacer el deploy definitivo**:

1. Descargá e instalá [Ngrok](https://ngrok.com/).
2. En tu terminal, abrí un túnel para el cliente (puerto 5173):
   ```bash
   ngrok http 5173
   ```
3. Abrí otro túnel para el servidor (puerto 3001):
   ```bash
   ngrok http 3001
   ```
4. Pasale la URL pública que genera Ngrok a los participantes y ¡listo!
