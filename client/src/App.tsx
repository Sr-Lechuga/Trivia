import { useState, useEffect, useRef } from 'react'
import { socket } from './socket'
import { QRCodeSVG } from 'qrcode.react'
import type { 
  Question, 
  TriviaConfig, 
  LobbyUpdatePayload, 
  PlayerJoinPayload,
  ReconnectResponsePayload,
  RoundStartPayload,
  AnswersRevealPayload,
  ScoreboardUpdatePayload,
  GameFinishedPayload
} from '../../shared/types'

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: '1',
    text: '¿Cuál es la única fuente de verdad en la arquitectura de esta Trivia?',
    options: ['La base de datos', 'El cliente del Host', 'El servidor', 'El LocalStorage'],
    correctOptionIndex: 2
  },
  {
    id: '2',
    text: '¿Qué biblioteca se usa para la comunicación en tiempo real?',
    options: ['HTTP Polling', 'WebRTC', 'Socket.IO', 'gRPC'],
    correctOptionIndex: 2
  },
  {
    id: '3',
    text: '¿En qué almacenamiento local persistimos el UUID de reconexión?',
    options: ['Cookies', 'SessionStorage', 'IndexedDB', 'LocalStorage'],
    correctOptionIndex: 3
  }
]

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback si no está en Contexto Seguro (HTTPS)
    }
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function App() {
  const [role, setRole] = useState<'HOST' | 'PLAYER' | null>(null)
  const [screen, setScreen] = useState<'INITIAL' | 'HOST_CONFIG' | 'PLAYER_JOIN' | 'LOBBY' | 'GAME'>('INITIAL')
  const [gamePhase, setGamePhase] = useState<'READING' | 'ANSWERING' | 'REVEALING' | 'FINISHED'>('READING')

  // Estado del juego
  const [sessionId, setSessionId] = useState<string>('')
  const [players, setPlayers] = useState<{ name: string; isConnected: boolean }[]>([])
  const [errorMsg, setErrorMsg] = useState<string>('')

  // Configuración de la Trivia (Host)
  const [config, setConfig] = useState<TriviaConfig>({
    maxScore: 1000,
    readTime: 5,
    answerTime: 20,
    revealTime: 5,
    randomizeQuestions: false
  })
  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS)

  // Estados para el editor de preguntas
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)
  const [draftQuestion, setDraftQuestion] = useState<Question>({
    id: '',
    text: '',
    imageUrl: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0
  })

  const handleOpenAddQuestion = () => {
    setEditingQuestionIndex(null)
    setDraftQuestion({
      id: generateUUID(),
      text: '',
      imageUrl: '',
      options: ['', '', '', ''],
      correctOptionIndex: 0
    })
    setIsQuestionModalOpen(true)
  }

  const handleOpenEditQuestion = (index: number) => {
    setEditingQuestionIndex(index)
    setDraftQuestion(JSON.parse(JSON.stringify(questions[index])))
    setIsQuestionModalOpen(true)
  }

  const handleDeleteQuestion = (index: number) => {
    if (questions.length <= 1) {
      setErrorMsg('Debe haber al menos 1 pregunta en la trivia.')
      return
    }
    setErrorMsg('')
    setQuestions(questions.filter((_, i) => i !== index))
  }

  const handleSaveDraftQuestion = () => {
    if (!draftQuestion.text.trim()) {
      setErrorMsg('El texto de la pregunta no puede estar vacío.')
      return
    }
    if (draftQuestion.options.some(opt => !opt.trim())) {
      setErrorMsg('Las 4 opciones de respuesta deben estar completas.')
      return
    }

    setErrorMsg('')
    if (editingQuestionIndex !== null) {
      const updated = [...questions]
      updated[editingQuestionIndex] = draftQuestion
      setQuestions(updated)
    } else {
      setQuestions([...questions, draftQuestion])
    }
    setIsQuestionModalOpen(false)
  }

  // Descarga de plantillas JSON y CSV
  const handleDownloadJSONTemplate = () => {
    const templateData = [
      {
        text: "¿Cuál es la fuente de verdad en esta arquitectura?",
        imageUrl: "https://ejemplo.com/diagrama.jpg",
        options: ["La base de datos", "El cliente del Host", "El servidor en memoria", "El LocalStorage"],
        correctOptionIndex: 2
      },
      {
        text: "¿Qué biblioteca se utiliza para tiempo real?",
        imageUrl: "",
        options: ["HTTP Long Polling", "WebRTC", "Socket.IO", "FTP"],
        correctOptionIndex: 2
      }
    ];
    const blob = new Blob([JSON.stringify(templateData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_preguntas.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSVTemplate = () => {
    const csvContent =
      "text,imageUrl,optionA,optionB,optionC,optionD,correctOptionIndex\n" +
      '"¿Cuál es la fuente de verdad en esta arquitectura?","https://ejemplo.com/diagrama.jpg","La base de datos","El cliente del Host","El servidor en memoria","El LocalStorage",2\n' +
      '"¿Qué biblioteca se utiliza para tiempo real?","","HTTP Long Polling","WebRTC","Socket.IO","FTP",2\n';
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_preguntas.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Parser CSV helper
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  // Cargar archivo JSON o CSV
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        if (fileName.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) throw new Error('El JSON debe contener un array de preguntas.');

          const validQuestions: Question[] = parsed.map((item, idx) => {
            if (!item.text || !Array.isArray(item.options) || item.options.length !== 4) {
              throw new Error(`La pregunta #${idx + 1} no tiene texto o exactamente 4 opciones.`);
            }
            const correctIndex = typeof item.correctOptionIndex === 'number' ? item.correctOptionIndex : 0;
            return {
              id: generateUUID(),
              text: String(item.text),
              imageUrl: item.imageUrl ? String(item.imageUrl) : '',
              options: [String(item.options[0]), String(item.options[1]), String(item.options[2]), String(item.options[3])],
              correctOptionIndex: Math.min(3, Math.max(0, correctIndex))
            };
          });

          setQuestions(validQuestions);
          setErrorMsg('');
        } else if (fileName.endsWith('.csv')) {
          const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
          if (lines.length <= 1) throw new Error('El CSV está vacío o solo contiene la cabecera.');

          const hasHeader = lines[0].toLowerCase().includes('text') || lines[0].toLowerCase().includes('option');
          const dataLines = hasHeader ? lines.slice(1) : lines;

          const validQuestions: Question[] = dataLines.map((line, idx) => {
            const cols = parseCSVLine(line);
            if (cols.length < 7) {
              throw new Error(`La línea #${idx + (hasHeader ? 2 : 1)} del CSV debe contener 7 columnas.`);
            }
            const text = cols[0];
            const imageUrl = cols[1];
            const options: [string, string, string, string] = [cols[2], cols[3], cols[4], cols[5]];
            const correctOptionIndex = parseInt(cols[6], 10);

            return {
              id: generateUUID(),
              text,
              imageUrl: imageUrl || '',
              options,
              correctOptionIndex: isNaN(correctOptionIndex) ? 0 : Math.min(3, Math.max(0, correctOptionIndex))
            };
          });

          setQuestions(validQuestions);
          setErrorMsg('');
        } else {
          throw new Error('Formato no soportado. Seleccioná un archivo .json o .csv');
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error al procesar el archivo.');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Datos del jugador
  const [playerName, setPlayerName] = useState<string>('')
  const [playerUuid, setPlayerUuid] = useState<string>('')

  // Datos en tiempo de juego
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string;
    text: string;
    imageUrl?: string;
    options: [string, string, string, string];
  } | null>(null)
  const [currentQuestionNumber, setCurrentQuestionNumber] = useState(0)
  const [totalQuestions, setTotalQuestions] = useState(0)

  // Temporizadores
  const [timeLeft, setTimeLeft] = useState(0)
  const phaseStartTimestamp = useRef<number>(0)

  // Respuestas y Resultados
  const [hasAnswered, setHasAnswered] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [correctIndex, setCorrectIndex] = useState<number | null>(null)
  const [answerStats, setAnswerStats] = useState<[number, number, number, number] | null>(null)
  const [scoreboard, setScoreboard] = useState<ScoreboardUpdatePayload['players']>([])
  const [podium, setPodium] = useState<GameFinishedPayload['podium']>([])

  // Generar UUID único del jugador si no existe en localStorage + auto-reconexión
  useEffect(() => {
    let uuid = localStorage.getItem('trivia_player_uuid')
    if (!uuid) {
      uuid = generateUUID()
      localStorage.setItem('trivia_player_uuid', uuid)
    }
    setPlayerUuid(uuid)

    // Detección de parámetro QR ?session=CODIGO
    const searchParams = new URLSearchParams(window.location.search);
    const sessionParam = searchParams.get('session');

    if (sessionParam) {
      const cleanSessionId = sessionParam.trim().toUpperCase();
      setSessionId(cleanSessionId);
      setRole('PLAYER');
      setScreen('PLAYER_JOIN');
    } else {
      // Intentar reconexión automática si hay una sesión guardada previamente
      const savedSessionId = localStorage.getItem('trivia_session_id')
      const savedName = localStorage.getItem('trivia_player_name')
      if (savedSessionId && savedName && uuid) {
        socket.connect()
        socket.emit(
          'player:reconnect',
          { sessionId: savedSessionId, localUuid: uuid },
          (res: ReconnectResponsePayload) => {
            if (!res.success) {
              // Sesión expirada o jugador no encontrado, limpiar storage
              localStorage.removeItem('trivia_session_id')
              localStorage.removeItem('trivia_player_name')
              socket.disconnect()
              return
            }

            setRole('PLAYER')
            setSessionId(savedSessionId)
            setPlayerName(res.playerName || savedName)

            if (res.sessionStatus === 'LOBBY') {
              setScreen('LOBBY')
            } else if (res.sessionStatus === 'FINISHED') {
              setScreen('INITIAL')
              localStorage.removeItem('trivia_session_id')
              localStorage.removeItem('trivia_player_name')
              socket.disconnect()
            } else if (res.currentQuestion && res.sessionStatus) {
              // En medio de una ronda: restaurar estado de juego
              setCurrentQuestion(res.currentQuestion)
              setCurrentQuestionNumber(res.currentQuestionIndex || 0)
              setTotalQuestions(res.totalQuestions || 0)
              setHasAnswered(res.hasAnsweredCurrentQuestion || false)

              const elapsed = res.timeElapsedSeconds || 0
              const duration = res.phaseDurationSeconds || 0
              setTimeLeft(Math.max(0, duration - elapsed))

              if (res.sessionStatus === 'REVEALING' && res.correctOptionIndex !== undefined) {
                setGamePhase('REVEALING')
                setCorrectIndex(res.correctOptionIndex)
              } else {
                setGamePhase(res.sessionStatus as 'READING' | 'ANSWERING')
                if (res.sessionStatus === 'ANSWERING') {
                  phaseStartTimestamp.current = Date.now() - elapsed * 1000
                }
              }
              setScreen('GAME')
            }
          }
        )
      }
    }
  }, [])

  // Temporizador regresivo en UI
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft])

  // Sincronizar eventos socket
  useEffect(() => {
    socket.on('lobby:update', (payload: LobbyUpdatePayload) => {
      if (payload.sessionId.toUpperCase() === sessionId.toUpperCase()) {
        setPlayers(payload.players)
      }
    });

    socket.on('round:start', (payload: RoundStartPayload) => {
      setScreen('GAME')
      setGamePhase(payload.status)
      setCurrentQuestion(payload.question)
      setCurrentQuestionNumber(payload.currentQuestionIndex)
      setTotalQuestions(payload.totalQuestions)
      setTimeLeft(payload.durationSeconds)
      
      if (payload.status === 'READING') {
        setHasAnswered(false)
        setSelectedOption(null)
        setCorrectIndex(null)
        setAnswerStats(null)
      } else if (payload.status === 'ANSWERING') {
        phaseStartTimestamp.current = Date.now()
      }
    });

    socket.on('answers:reveal', (payload: AnswersRevealPayload) => {
      setGamePhase('REVEALING')
      setCorrectIndex(payload.correctOptionIndex)
      setAnswerStats(payload.stats.optionCounts)
      setTimeLeft(config.revealTime)
    });

    socket.on('scoreboard:update', (payload: ScoreboardUpdatePayload) => {
      setScoreboard(payload.players)
    });

    socket.on('game:finished', (payload: GameFinishedPayload) => {
      setGamePhase('FINISHED')
      setPodium(payload.podium)
    });

    socket.on('connect_error', () => {
      setErrorMsg('Error al conectar con el servidor.')
    })

    socket.on('error:join', (err: { message: string }) => {
      setErrorMsg(err.message)
    })

    return () => {
      socket.off('lobby:update')
      socket.off('round:start')
      socket.off('answers:reveal')
      socket.off('scoreboard:update')
      socket.off('game:finished')
      socket.off('connect_error')
      socket.off('error:join')
    }
  }, [sessionId, config.revealTime])

  // Helper para URL dinámica del servidor (Desarrollo / Producción)
  const getApiUrl = () => {
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL;
    }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    return `http://${host}:3001`;
  };

  // Crear la sesión en el Backend
  const handleCreateSession = async () => {
    try {
      setErrorMsg('')
      const response = await fetch(`${getApiUrl()}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config, questions })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'No se pudo crear la sesión.')
      }

      const session = await response.json()
      setSessionId(session.id)
      
      socket.connect()
      socket.emit('host:joinSession', { sessionId: session.id })
      setScreen('LOBBY')
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de red al intentar crear la sesión.')
    }
  }

  // Unirse a la sesión
  const handleJoinSession = () => {
    if (!sessionId.trim() || !playerName.trim()) {
      setErrorMsg('Completá el código y tu apodo.')
      return;
    }
    setErrorMsg('')
    socket.connect()
    
    const joinPayload: PlayerJoinPayload = {
      sessionId: sessionId.trim().toUpperCase(),
      name: playerName.trim(),
      localUuid: playerUuid
    }

    socket.emit('player:join', joinPayload, (res: { success: boolean; error?: string }) => {
      if (res.success) {
        // Persistir sesión y nombre para reconexión automática
        localStorage.setItem('trivia_session_id', sessionId.trim().toUpperCase())
        localStorage.setItem('trivia_player_name', playerName.trim())
        setScreen('LOBBY')
      } else if (res.error) {
        setErrorMsg(res.error)
        socket.disconnect()
      }
    })
  }

  // Iniciar el juego (Host)
  const handleStartGame = () => {
    socket.emit('host:startGame', { sessionId })
  }

  // Enviar respuesta (Jugador)
  const handleSelectOption = (index: number) => {
    if (hasAnswered || gamePhase !== 'ANSWERING') return;

    setSelectedOption(index)
    setHasAnswered(true)

    const responseTimeMs = Date.now() - phaseStartTimestamp.current;

    socket.emit('player:answer', {
      sessionId,
      questionId: currentQuestion?.id || '',
      selectedOptionIndex: index,
      responseTimeMs
    })
  }

  const resetAll = () => {
    socket.disconnect()
    localStorage.removeItem('trivia_session_id')
    localStorage.removeItem('trivia_player_name')
    setRole(null)
    setScreen('INITIAL')
    setSessionId('')
    setPlayers([])
    setErrorMsg('')
    setPlayerName('')
    setCurrentQuestion(null)
    setHasAnswered(false)
    setSelectedOption(null)
    setCorrectIndex(null)
    setAnswerStats(null)
    setScoreboard([])
    setPodium([])
  }

  // Colores premium para botones
  const optionColors = [
    'from-red-500 to-rose-600 shadow-red-500/25 hover:from-red-600 hover:to-rose-700',
    'from-blue-500 to-indigo-600 shadow-blue-500/25 hover:from-blue-600 hover:to-indigo-700',
    'from-yellow-500 to-amber-600 shadow-yellow-500/25 hover:from-yellow-600 hover:to-amber-700',
    'from-green-500 to-emerald-600 shadow-green-500/25 hover:from-green-600 hover:to-emerald-700'
  ]

  const optionLetters = ['▲ A', '◆ B', '● C', '■ D']

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-900 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 py-4 px-6 flex justify-between items-center bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="flex items-center gap-2 cursor-pointer" onClick={resetAll}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
            T
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Trivia realtime
          </span>
        </div>
        <div>
          {role && (
            <button 
              onClick={resetAll}
              className="text-xs py-1 px-3 rounded border border-slate-700 text-slate-400 hover:bg-slate-800 transition-colors"
            >
              Salir
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
        
        {errorMsg && (
          <div className="w-full max-w-md mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-center text-sm font-medium">
            {errorMsg}
          </div>
        )}

        {/* 1. INITIAL SCREEN */}
        {screen === 'INITIAL' && (
          <div className="w-full max-w-3xl flex flex-col items-center">
            <div className="text-center space-y-6 mb-12">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                Partidas interactivas en tiempo real
              </h1>
              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto">
                Creá trivias al estilo Kahoot, compartí el código con tus amigos y competí para ver quién responde más rápido.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 w-full">
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/40 transition-all duration-300 flex flex-col justify-between group shadow-xl">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 3m0-3a2 2 0 110 3m-9 8h10M3 5h10M9 3v2m1.248 11.248a6 6 0 11-8.486 0M3 9h.01M9 9h.01M3 12h.01M9 12h.01M3 15h.01M9 15h.01M3 18h.01M9 18h.01" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Crear Partida</h2>
                  <p className="text-slate-400 mb-6 text-sm">
                    Configurá los tiempos, cargá las preguntas y administrá el juego en vivo como Host.
                  </p>
                </div>
                <button 
                  onClick={() => { setRole('HOST'); setScreen('HOST_CONFIG'); }}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 font-semibold text-white transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                >
                  Configurar Trivia
                </button>
              </div>

              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 hover:border-violet-500/40 transition-all duration-300 flex flex-col justify-between group shadow-xl">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Unirse a Partida</h2>
                  <p className="text-slate-400 mb-6 text-sm">
                    Ingresá el código PIN de la partida y registrate con tu apodo para competir.
                  </p>
                </div>
                <button 
                  onClick={() => { setRole('PLAYER'); setScreen('PLAYER_JOIN'); }}
                  className="w-full py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold text-white transition-all active:scale-95"
                >
                  Unirse a un Lobby
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. HOST CONFIGURATION SCREEN */}
        {screen === 'HOST_CONFIG' && (
          <div className="w-full max-w-2xl bg-slate-800/40 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-extrabold text-white mb-6 bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Configuración de Trivia
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Puntaje Máximo</label>
                  <input 
                    type="number" 
                    value={config.maxScore}
                    onChange={(e) => setConfig({ ...config, maxScore: parseInt(e.target.value) || 1000 })}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tiempo de Lectura (s)</label>
                  <input 
                    type="number" 
                    value={config.readTime}
                    onChange={(e) => setConfig({ ...config, readTime: parseInt(e.target.value) || 5 })}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tiempo de Respuesta (s)</label>
                  <input 
                    type="number" 
                    value={config.answerTime}
                    onChange={(e) => setConfig({ ...config, answerTime: parseInt(e.target.value) || 20 })}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tiempo de Revelado (s)</label>
                  <input 
                    type="number" 
                    value={config.revealTime}
                    onChange={(e) => setConfig({ ...config, revealTime: parseInt(e.target.value) || 5 })}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white"
                  />
                </div>
              </div>

              <div>
                <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
                  <h3 className="text-lg font-bold text-white">Preguntas ({questions.length})</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadJSONTemplate}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-all"
                      title="Descargar plantilla JSON de ejemplo"
                    >
                      📥 Plantilla JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-950/60 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-all"
                      title="Descargar plantilla CSV de ejemplo"
                    >
                      📥 Plantilla CSV
                    </button>

                    <label className="py-1.5 px-3 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-semibold text-violet-300 cursor-pointer transition-all active:scale-95 flex items-center gap-1">
                      <span>📂</span> Importar
                      <input
                        type="file"
                        accept=".json,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={handleOpenAddQuestion}
                      className="py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition-all active:scale-95 flex items-center gap-1 shadow-md shadow-indigo-500/20"
                    >
                      <span>+</span> Agregar
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-3 pr-2">
                  {questions.map((q, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between gap-3">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-semibold text-slate-100 text-sm">{idx + 1}. {q.text}</p>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleOpenEditQuestion(idx)}
                              className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(idx)}
                              className="text-xs px-2.5 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>

                        {q.imageUrl && (
                          <p className="text-xs text-slate-500 truncate mt-1">🖼️ {q.imageUrl}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        {q.options.map((opt, oIdx) => (
                          <div 
                            key={oIdx} 
                            className={`px-2.5 py-1.5 rounded border ${
                              oIdx === q.correctOptionIndex 
                                ? 'bg-green-500/10 border-green-500/40 text-green-300 font-bold' 
                                : 'bg-slate-900/60 border-slate-800 text-slate-400'
                            }`}
                          >
                            <span className="opacity-60 mr-1">{['A', 'B', 'C', 'D'][oIdx]}:</span> {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setScreen('INITIAL')}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition-all active:scale-95"
                >
                  Atrás
                </button>
                <button 
                  onClick={handleCreateSession}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 font-semibold text-white transition-all shadow-lg shadow-indigo-500/25 active:scale-95"
                >
                  Crear Partida
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDICIÓN / CREACIÓN DE PREGUNTA */}
        {isQuestionModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-xl shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-xl font-bold text-white">
                  {editingQuestionIndex !== null ? `Editar Pregunta #${editingQuestionIndex + 1}` : 'Nueva Pregunta'}
                </h3>
                <button 
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Texto de la Pregunta *</label>
                  <input
                    type="text"
                    value={draftQuestion.text}
                    onChange={(e) => setDraftQuestion({ ...draftQuestion, text: e.target.value })}
                    placeholder="Ej. ¿En qué año se lanzó JavaScript?"
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">URL de Imagen (Opcional)</label>
                  <input
                    type="text"
                    value={draftQuestion.imageUrl || ''}
                    onChange={(e) => setDraftQuestion({ ...draftQuestion, imageUrl: e.target.value })}
                    placeholder="https://ejemplo.com/imagen.jpg"
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-700 focus:outline-none focus:border-indigo-500 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Opciones de Respuesta (Marcá la Correcta) *
                  </label>
                  <div className="space-y-2.5">
                    {draftQuestion.options.map((opt, oIdx) => {
                      const isCorrect = draftQuestion.correctOptionIndex === oIdx;
                      return (
                        <div key={oIdx} className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setDraftQuestion({ ...draftQuestion, correctOptionIndex: oIdx })}
                            className={`w-7 h-7 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 transition-all ${
                              isCorrect 
                                ? 'bg-green-500 border-green-400 text-white shadow-lg shadow-green-500/30' 
                                : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'
                            }`}
                          >
                            {isCorrect ? '✓' : ['A', 'B', 'C', 'D'][oIdx]}
                          </button>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...draftQuestion.options] as [string, string, string, string];
                              newOpts[oIdx] = e.target.value;
                              setDraftQuestion({ ...draftQuestion, options: newOpts });
                            }}
                            placeholder={`Opción ${['A', 'B', 'C', 'D'][oIdx]}`}
                            className={`w-full py-2 px-3 rounded-lg bg-slate-950 border text-sm text-white focus:outline-none ${
                              isCorrect ? 'border-green-500/50 bg-green-500/5' : 'border-slate-800 focus:border-indigo-500'
                            }`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuestionModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 text-sm transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraftQuestion}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 font-semibold text-white text-sm transition-all shadow-md shadow-indigo-500/25"
                >
                  Guardar Pregunta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 3. PLAYER JOIN SCREEN */}
        {screen === 'PLAYER_JOIN' && (
          <div className="w-full max-w-md bg-slate-800/40 border border-slate-800 rounded-2xl p-8 shadow-xl">
            <h2 className="text-3xl font-extrabold text-white mb-6 text-center bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Ingresar a Partida
            </h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Código de Partida</label>
                <input 
                  type="text" 
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                  placeholder="Ej. ABCXYZ" 
                  maxLength={6}
                  className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-center tracking-widest text-lg font-mono placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-violet-500 text-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tu Apodo</label>
                <input 
                  type="text" 
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Ej. Goku99" 
                  className="w-full py-3 px-4 rounded-xl bg-slate-950 border border-slate-700 text-center focus:outline-none focus:border-violet-500 text-white"
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setScreen('INITIAL')}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 font-semibold hover:bg-slate-800 transition-all active:scale-95"
                >
                  Atrás
                </button>
                <button 
                  onClick={handleJoinSession}
                  className="flex-1 py-3 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 font-semibold text-white transition-all active:scale-95"
                >
                  Unirse
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. LOBBY SCREEN */}
        {screen === 'LOBBY' && (
          <div className="w-full max-w-xl bg-slate-800/40 border border-slate-800 rounded-2xl p-8 shadow-xl text-center space-y-8">
            <div>
              <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider block mb-1">
                Lobby de Partida
              </span>
              <h2 className="text-5xl font-mono font-bold text-white tracking-wider">
                {sessionId}
              </h2>
              <p className="text-xs text-slate-500 mt-2 mb-4">
                Escaneá el QR o ingresá el código de 6 caracteres para unirte.
              </p>

              {role === 'HOST' && (
                <div className="flex justify-center p-3 bg-white rounded-2xl w-fit mx-auto shadow-lg border border-slate-700">
                  <QRCodeSVG 
                    value={`${window.location.origin}?session=${sessionId}`} 
                    size={140}
                    level="H"
                  />
                </div>
              )}
            </div>

            {/* Players Connected */}
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/40">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 text-left">
                Jugadores en el lobby ({players.length})
              </h3>
              {players.length === 0 ? (
                <p className="text-sm text-slate-500 py-6">Esperando a que se conecten jugadores...</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {players.map((p, idx) => (
                    <div 
                      key={idx} 
                      className={`flex items-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium ${
                        p.isConnected 
                          ? 'bg-slate-900 border-indigo-500/20 text-slate-200' 
                          : 'bg-slate-900/40 border-slate-800 text-slate-600'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${p.isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons depending on Role */}
            <div>
              {role === 'HOST' ? (
                <button 
                  onClick={handleStartGame}
                  disabled={players.length === 0}
                  className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 font-bold text-white transition-all shadow-lg shadow-indigo-500/25 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                >
                  Iniciar Partida
                </button>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                  <div className="w-5 h-5 border-2 border-t-transparent border-violet-500 rounded-full animate-spin" />
                  <p className="text-sm text-slate-400 font-medium">
                    Esperando que el Host inicie el juego...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. GAME SCREEN */}
        {screen === 'GAME' && currentQuestion && (
          <div className="w-full max-w-2xl space-y-6">
            
            {/* Header info */}
            <div className="flex justify-between items-center text-sm font-semibold uppercase tracking-wider text-slate-400">
              <div>Pregunta {currentQuestionNumber} de {totalQuestions}</div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                Fase: {gamePhase}
              </div>
            </div>

            {/* Timers & Questions */}
            {gamePhase !== 'FINISHED' && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl text-center space-y-6 relative overflow-hidden">
                {/* Visual Timer bar */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-950">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000 ease-linear"
                    style={{ 
                      width: `${(timeLeft / (gamePhase === 'READING' ? config.readTime : gamePhase === 'ANSWERING' ? config.answerTime : config.revealTime)) * 100}%` 
                    }}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <div className="w-12 h-12 rounded-full border-2 border-slate-700 flex items-center justify-center font-bold text-lg text-slate-300">
                    {timeLeft}s
                  </div>
                  {gamePhase === 'READING' && (
                    <span className="text-sm px-3 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold animate-pulse">
                      ¡LEÉ LA PREGUNTA!
                    </span>
                  )}
                  {gamePhase === 'ANSWERING' && (
                    <span className="text-sm px-3 py-1 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-semibold">
                      ¡RESPONDÉ AHORA!
                    </span>
                  )}
                  {gamePhase === 'REVEALING' && (
                    <span className="text-sm px-3 py-1 rounded bg-green-500/10 text-green-400 border border-green-500/20 font-semibold">
                      RESULTADOS
                    </span>
                  )}
                </div>

                <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-tight">
                  {currentQuestion.text}
                </h2>
              </div>
            )}

            {/* HOST VIEW */}
            {role === 'HOST' && gamePhase !== 'FINISHED' && (
              <div className="space-y-6">
                {/* Shuffled Options displayed on Host Screen (Read-Only) */}
                <div className="grid grid-cols-2 gap-4">
                  {currentQuestion.options.map((opt, idx) => {
                    const isCorrect = gamePhase === 'REVEALING' && idx === correctIndex;
                    const totalVotes = answerStats ? answerStats.reduce((a, b) => a + b, 0) : 0;
                    const voteCount = answerStats ? answerStats[idx] : 0;
                    const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;

                    return (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                          isCorrect 
                            ? 'bg-green-500/10 border-green-500 text-green-300 font-bold' 
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {/* Background Percentage Bar */}
                        {gamePhase === 'REVEALING' && (
                          <div 
                            className={`absolute bottom-0 left-0 top-0 opacity-15 transition-all duration-1000 ${
                              isCorrect ? 'bg-green-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        )}

                        <div className="flex justify-between items-center z-10">
                          <div>
                            <span className="text-xs font-semibold text-slate-500 mr-2">{optionLetters[idx]}</span>
                            {opt}
                          </div>
                          {answerStats && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-slate-400">{percentage}%</span>
                              <span className="bg-slate-800 text-slate-300 font-mono text-xs px-2.5 py-1 rounded-md">
                                {voteCount}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Scoreboard displayed on Host Screen during Reveal */}
                {gamePhase === 'REVEALING' && (
                  <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-6 shadow-xl">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                      Tabla de Posiciones
                    </h3>
                    <div className="space-y-2">
                      {scoreboard.map((p, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 border-b border-slate-800 last:border-0">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-slate-500 text-sm">#{p.rank}</span>
                            <span className="font-bold text-slate-200">{p.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            {p.lastRoundPoints > 0 && (
                              <span className="text-xs text-green-400 font-bold">+{p.lastRoundPoints}</span>
                            )}
                            <span className="font-bold text-indigo-400">{p.score} pts</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* PLAYER VIEW */}
            {role === 'PLAYER' && gamePhase !== 'FINISHED' && (
              <div className="space-y-6">
                {/* Options clickable only in ANSWERING phase */}
                <div className="grid grid-cols-2 gap-4">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = gamePhase === 'REVEALING' && idx === correctIndex;
                    const isWrongSelection = gamePhase === 'REVEALING' && isSelected && !isCorrect;

                    let btnClass = `relative overflow-hidden py-6 px-4 rounded-2xl font-bold text-lg text-white shadow-lg transition-all duration-200 active:scale-95 flex flex-col items-center justify-center gap-2 border bg-gradient-to-r ${optionColors[idx]}`;
                    
                    if (gamePhase === 'READING') {
                      btnClass = 'bg-slate-800/50 border-slate-800 text-slate-500 cursor-not-allowed py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2';
                    } else if (hasAnswered && gamePhase === 'ANSWERING') {
                      btnClass = isSelected 
                        ? 'bg-indigo-600 border-indigo-400 text-white py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 animate-pulse' 
                        : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2';
                    } else if (gamePhase === 'REVEALING') {
                      if (isCorrect) {
                        btnClass = 'bg-green-600 border-green-400 text-white py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2 font-extrabold';
                      } else if (isWrongSelection) {
                        btnClass = 'bg-red-600 border-red-400 text-white py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2';
                      } else {
                        btnClass = 'bg-slate-900 border-slate-800 text-slate-700 py-6 px-4 rounded-2xl flex flex-col items-center justify-center gap-2';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSelectOption(idx)}
                        disabled={hasAnswered || gamePhase !== 'ANSWERING'}
                        className={btnClass}
                      >
                        <span className="text-xs uppercase tracking-wider opacity-60">{optionLetters[idx]}</span>
                        <span>{opt}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Display answer status during reveal */}
                {gamePhase === 'REVEALING' && (
                  <div className="text-center p-6 rounded-2xl border bg-slate-950/40 border-slate-800">
                    {selectedOption === null ? (
                      <p className="text-yellow-500 font-bold text-lg">⚠️ ¡Se te acabó el tiempo!</p>
                    ) : selectedOption === correctIndex ? (
                      <div>
                        <p className="text-green-500 font-extrabold text-2xl">🎉 ¡CORRECTO!</p>
                        <p className="text-slate-400 text-sm mt-1">Sumaste puntos en esta ronda.</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-red-500 font-extrabold text-2xl">❌ INCORRECTO</p>
                        <p className="text-slate-400 text-sm mt-1">La respuesta correcta era: {currentQuestion.options[correctIndex!]}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* FINISHED / PODIUM SCREEN (Both Host & Player see final podium) */}
            {gamePhase === 'FINISHED' && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-8 max-w-md mx-auto">
                <div>
                  <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider block mb-1">
                    Juego Finalizado
                  </span>
                  <h2 className="text-4xl font-extrabold text-white">
                    🏆 PODIO 🏆
                  </h2>
                </div>

                {/* Podium visualization */}
                <div className="flex items-end justify-center gap-4 py-8">
                  {/* 2nd Place */}
                  {podium[1] && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-slate-400 font-bold mb-1">{podium[1].name}</span>
                      <div className="w-20 bg-gradient-to-t from-slate-700 to-slate-500 h-24 rounded-t-xl flex items-center justify-center text-white font-bold text-xl relative shadow-lg">
                        2
                        <span className="absolute bottom-2 text-xs font-mono">{podium[1].score}</span>
                      </div>
                    </div>
                  )}
                  {/* 1st Place */}
                  {podium[0] && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-yellow-400 font-bold mb-1">{podium[0].name}</span>
                      <div className="w-24 bg-gradient-to-t from-amber-600 to-yellow-400 h-32 rounded-t-xl flex items-center justify-center text-white font-black text-2xl relative shadow-xl border-t border-yellow-300">
                        👑 1
                        <span className="absolute bottom-2 text-xs font-mono">{podium[0].score}</span>
                      </div>
                    </div>
                  )}
                  {/* 3rd Place */}
                  {podium[2] && (
                    <div className="flex flex-col items-center">
                      <span className="text-xs text-amber-600 font-bold mb-1">{podium[2].name}</span>
                      <div className="w-20 bg-gradient-to-t from-amber-800 to-amber-700 h-16 rounded-t-xl flex items-center justify-center text-white font-bold text-lg relative shadow-lg">
                        3
                        <span className="absolute bottom-2 text-xs font-mono">{podium[2].score}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Podio list details */}
                <div className="text-left space-y-2 max-h-40 overflow-y-auto border-t border-slate-800 pt-4">
                  {podium.slice(3).map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-500">#{p.rank}</span>
                        <span className="text-slate-300">{p.name}</span>
                      </div>
                      <span className="font-bold text-indigo-400">{p.score} pts</span>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={resetAll}
                  className="w-full py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 font-bold text-white transition-colors"
                >
                  Volver al Menú Principal
                </button>
              </div>
            )}

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Trivia Realtime MVP. Todos los derechos reservados.
      </footer>
    </div>
  )
}

export default App
