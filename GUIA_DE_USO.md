# Guía de Uso – Trivia Multijugador Realtime

Este documento contiene las guías de uso tanto a nivel técnico (para desarrolladores y administradores) como a nivel de usuario final (para el Host y los Jugadores).

---

## 1. Guía Técnica (Desarrolladores / DevOps)

### 1.1 Requisitos Previos
- **Node.js**: v18.0.0 o superior.
- **npm**: v9.0.0 o superior.

### 1.2 Estructura del Proyecto
```
Trivia/
├── Documentation/        # PRD y Especificaciones de Requerimientos (SRS)
├── shared/               # Tipos e interfaces de TypeScript compartidas
├── server/               # Backend Express + Socket.IO (TypeScript)
└── client/               # Frontend React + Vite + Tailwind CSS v4 (TypeScript)
```

### 1.3 Instalación y Puesta en Marcha en Desarrollo

#### Paso 1: Levantar el Servidor Backend
```bash
cd server
npm install
npm run dev
```
*El servidor iniciará en `http://localhost:3001`.*

#### Paso 2: Levantar la Aplicación Cliente
En una nueva terminal:
```bash
cd client
npm install
npm run dev
```
*El cliente iniciará en `http://localhost:5173` (o el puerto asignado por Vite).*

### 1.4 Compilación para Producción (Build)

- **Backend:**
  ```bash
  cd server
  npm run build
  npm start
  ```
- **Frontend:**
  ```bash
  cd client
  npm run build
  ```
  *Los archivos estáticos optimizados se generarán en `client/dist`.*

---

## 2. Guía de Usuario Final

### 2.1 Rol: Host (Organizador del Juego)

1. **Creación de la Partida:**
   - Abrí la aplicación en tu navegador.
   - Hacé clic en el botón **"Configurar Trivia"** en la tarjeta de *Crear Partida*.
   - Definí la configuración deseada:
     - **Puntaje Máximo:** Puntos otorgados por responder al instante (ej. 1000).
     - **Tiempo de Respuesta:** Duración de la fase de votación en segundos (ej. 20s).
   - Revisá la lista de preguntas cargadas y presioná **"Crear Partida"**.

2. **Lobby de Espera:**
   - En la pantalla aparecerá un **Código de 6 letras** (ej. `ABCXYZ`) y un **Código QR**.
   - Proyectá tu pantalla o compartí el código / QR con los participantes.
   - Verás aparecer en tiempo real a los jugadores que se van uniendo.
   - Cuando todos estén listos, presioná el botón **"Iniciar Partida"**.

3. **Conducción del Juego:**
   - **Fase de Lectura (5s):** Se mostrará la pregunta en grande para que todos la lean.
   - **Fase de Respuesta (20s):** Los jugadores responderán desde sus teléfonos. Si todos responden antes del tiempo límite, la fase finalizará automáticamente.
   - **Fase de Resultados:** Se revelará la opción correcta, las barras con el porcentaje de votos por opción y la **Tabla de Posiciones** actualizada.
   - **Podio Final:** Al terminar todas las preguntas, se mostrará el podio interactivo con el 1er, 2do y 3er puesto.

---

### 2.2 Rol: Jugador (Participante)

1. **Unirse a una Partida:**
   - Escaneá el código QR que muestra el Host o ingresá a la app y hacé clic en **"Unirse a un Lobby"**.
   - Ingresá el **Código de 6 caracteres** de la partida y elegí tu **Apodo**.
   - Presioná **"Unirse"**. Verás la pantalla de espera en el Lobby hasta que el Host inicie.

2. **Durante la Partida:**
   - **Fase de Lectura:** Preparate y leé la pregunta en la pantalla principal.
   - **Fase de Respuesta:** Presioná rápidamente el botón con la opción que consideres correcta (A, B, C o D). **¡Cuanto más rápido respondas, más puntos sumás!**
   - Una vez seleccionada tu opción, esperá a que finalice la ronda.

3. **Reconexión Automática:**
   - Si tu teléfono pierde señal o sin querer recargás la página, **no te preocupes**: la app te reconectará automáticamente a tu partida sin perder tus puntos acumulados.
