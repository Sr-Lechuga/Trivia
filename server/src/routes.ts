import { Router, Request, Response } from 'express';
import { createSession, getSession } from './store';
import { HostCreateSessionPayload } from '../../shared/types';

const router = Router();

// Endpoint POST /session para crear una sesión
router.post('/session', (req: Request, res: Response) => {
  const { config, questions, language } = req.body as HostCreateSessionPayload;

  // Validaciones básicas
  if (!config || !questions || !Array.isArray(questions) || (language !== 'es' && language !== 'en')) {
    return res.status(400).json({ error: 'Configuración o preguntas inválidas.' });
  }

  for (const q of questions) {
    if (!q.id || !q.text || !Array.isArray(q.options) || q.options.length !== 4 || typeof q.correctOptionIndex !== 'number') {
      return res.status(400).json({ error: 'Estructura de pregunta inválida. Cada pregunta debe tener texto, exactamente 4 opciones y un índice correcto.' });
    }
  }

  const session = createSession(config, questions, language);
  return res.status(201).json(session);
});

// Endpoint GET /session/:id para obtener los detalles de una sesión
router.get('/session/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = getSession(id);

  if (!session) {
    return res.status(404).json({ error: 'Sesión no encontrada.' });
  }

  // Devolver el estado actual de la sesión
  return res.json(session);
});

export default router;
