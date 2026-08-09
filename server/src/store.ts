import { Session, TriviaConfig, Question, Language } from '../../shared/types';

// Almacén de sesiones en memoria
const sessions: Map<string, Session> = new Map();

/**
 * Genera un ID de sesión único y legible de 6 caracteres (letras mayúsculas y números)
 */
function generateSessionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  do {
    id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (sessions.has(id));
  return id;
}

export function createSession(config: TriviaConfig, questions: Question[], language: Language): Session {
  const sessionId = generateSessionId();
  const session: Session = {
    id: sessionId,
    language,
    status: 'LOBBY',
    config,
    questions,
    currentQuestionIndex: 0,
    players: []
  };
  sessions.set(sessionId, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id.toUpperCase());
}

export function getAllSessions(): Session[] {
  return Array.from(sessions.values());
}

export function deleteSession(id: string): boolean {
  return sessions.delete(id.toUpperCase());
}
