import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  Sparkles,
  Layers,
  FileDown,
  Maximize2,
  Minimize2,
  Share2,
  ChevronLeft,
  Settings,
  X,
  HelpCircle,
  Plus,
  Compass,
  LayoutGrid,
  Map,
  RotateCcw,
  User,
  Check,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Imports
import { BoardState, Note, CommentItem, LayoutMode, ColorOption, ThemeOption } from './types';
import { NOTE_COLORS, THEM_OPTIONS, EXPIRY_MS } from './constants';
import { Watermark } from './components/Watermark';
import { PeerStatusIndicator } from './components/PeerStatusIndicator';
import { BoardCard } from './components/BoardCard';
import { ShareModal } from './components/ShareModal';
import { NoteModal } from './components/NoteModal';

export default function App() {
  // Navigation / Routing state
  const [boardCode, setBoardCode] = useState<string | null>(null);
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer');
  const [editKey, setEditKey] = useState<string>('');
  const [isLobby, setIsLobby] = useState(true);

  // Lobby Inputs
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createTheme, setCreateTheme] = useState('editorial');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [recents, setRecents] = useState<any[]>([]);

  // User Profile
  const [userNickname, setUserNickname] = useState('');
  const [showNickPrompt, setShowNickPrompt] = useState(false);

  // Active Board State
  const [boardState, setBoardState] = useState<BoardState | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');

  // PeerJS Connections
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'hosting' | 'error' | 'disconnected'>('disconnected');
  const [connectedPeersCount, setConnectedPeersCount] = useState(0);

  // Modal states
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isNoteOpen, setIsNoteOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<Note | null>(null);
  const [zoomImgUrl, setZoomImgUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  // Peer references
  const peerRef = useRef<Peer | null>(null);
  // Key: connection ID, Value: Connection
  const connectionsRef = useRef<Record<string, DataConnection>>({});
  // Reconnection attempts
  const reconnectIntervalRef = useRef<any>(null);

  // Load routing from URL on mount
  useEffect(() => {
    // Read local nick
    const savedNick = localStorage.getItem('board_nick');
    if (savedNick) {
      setUserNickname(savedNick);
    } else {
      // Pick random cute names by default
      const cuteNicks = ['Surfero Creativo', 'Mapache de Datos', 'Búho Tecnológico', 'Zorro Visual', 'Ardilla ágil', 'Acrobata Digital'];
      const picked = cuteNicks[Math.floor(Math.random() * cuteNicks.length)];
      setUserNickname(picked);
      localStorage.setItem('board_nick', picked);
    }

    // Load Recents list
    loadRecents();

    // Check query params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const urlRole = params.get('role');
    const urlKey = params.get('key');

    if (code && code.length === 6) {
      const targetCode = code.toUpperCase();
      setBoardCode(targetCode);
      const chosenRole = urlRole === 'editor' ? 'editor' : 'viewer';
      setRole(chosenRole);
      setEditKey(urlKey || '');
      setIsLobby(false);
    }

    // Capture zoom dispatch from inside cards
    const handleZoomRequest = ((e: CustomEvent) => {
      setZoomImgUrl(e.detail);
    }) as EventListener;

    window.addEventListener('zoom-image', handleZoomRequest);
    return () => {
      window.removeEventListener('zoom-image', handleZoomRequest);
    };
  }, []);

  // Sync Fullscreen browser changes
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Clean-up and initialize PeerJS connection when boardCode shifts
  useEffect(() => {
    if (isLobby || !boardCode) {
      disconnectAll();
      return;
    }

    initializeP2PSystem();

    return () => {
      disconnectAll();
    };
  }, [boardCode, isLobby]);

  // Periodic cards expiration routine
  useEffect(() => {
    if (isLobby || !boardState) return;

    const interval = setInterval(() => {
      // Loop through and prune expired notes helper
      let hasExpiry = false;
      const updatedNotes = { ...boardState.notes };
      const now = Date.now();

      Object.keys(updatedNotes).forEach((id) => {
        const createdMs = new Date(updatedNotes[id].createdAt).getTime();
        const rem = createdMs + EXPIRY_MS - now;
        if (rem <= 0) {
          delete updatedNotes[id];
          hasExpiry = true;
        }
      });

      if (hasExpiry) {
        const nextState = { ...boardState, notes: updatedNotes };
        setBoardState(nextState);
        if (peerStatus === 'hosting') {
          saveToLocalStorage(nextState);
          broadcastState(nextState);
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [boardState, isLobby, peerStatus]);

  const loadRecents = () => {
    const saved = localStorage.getItem('gmt_recents');
    if (saved) {
      try {
        const list = JSON.parse(saved);
        // prune expired list elements
        const activeList = list.filter((b: any) => {
          const created = new Date(b.createdAt).getTime();
          return created + EXPIRY_MS > Date.now();
        });
        setRecents(activeList);
        localStorage.setItem('gmt_recents', JSON.stringify(activeList));
      } catch (err) {
        setRecents([]);
      }
    }
  };

  const addRecentBoard = (code: string, title: string, hasKey: boolean) => {
    const saved = localStorage.getItem('gmt_recents');
    let list = [];
    if (saved) {
      try { list = JSON.parse(saved); } catch (e) { list = []; }
    }
    const filtered = list.filter((b: any) => b.code !== code);
    const newList = [
      { code, title, hasKey, createdAt: new Date().toISOString() },
      ...filtered
    ].slice(0, 8); // max 8 elements
    localStorage.setItem('gmt_recents', JSON.stringify(newList));
    setRecents(newList);
  };

  const saveToLocalStorage = (state: BoardState) => {
    localStorage.setItem(`gmt_state_${state.code}`, JSON.stringify(state));
  };

  // P2P HANDLERS & HANDSHAKING
  const disconnectAll = () => {
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    // Close connections
    Object.values(connectionsRef.current).forEach((conn: any) => {
      conn.close();
    });
    connectionsRef.current = {};
    setConnectedPeersCount(0);

    // Destroy Peer
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setPeerStatus('disconnected');
  };

  const initializeP2PSystem = () => {
    disconnectAll();
    setPeerStatus('connecting');

    // We can use a secure, free default public styling for our peer IDs:
    const hostId = `gmedranotic-host-${boardCode}`;

    // Are we editing / hosting?
    if (role === 'editor') {
      tryToHost(hostId);
    } else {
      tryToJoinAsClient(hostId);
    }
  };

  // HOST INSTANTIATION MODULE
  const tryToHost = (hostId: string) => {
    // Create Peer with designated static Host ID
    const peer = new Peer(hostId, {
      debug: 1
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('Host peer bound successfully:', id);
      setPeerStatus('hosting');

      // Boot state from local storage or create new blank state
      const saved = localStorage.getItem(`gmt_state_${boardCode}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setBoardState(parsed);
          addRecentBoard(boardCode!, parsed.title, true);
        } catch (e) {
          createDefaultEmptyState();
        }
      } else {
        createDefaultEmptyState();
      }
    });

    peer.on('connection', (conn) => {
      console.log('New connection Request landed:', conn.peer);

      conn.on('open', () => {
        // Handshake
        connectionsRef.current[conn.peer] = conn;
        setConnectedPeersCount(Object.keys(connectionsRef.current).length);

        // Send current status right away
        conn.send({
          type: 'INITIAL_STATE',
          payload: boardStateRef.current // Use a ref lookup to prevent closures from seizing stale state
        });
      });

      conn.on('data', (data: any) => {
        handleIncomingDataAsHost(conn, data);
      });

      conn.on('close', () => {
        delete connectionsRef.current[conn.peer];
        setConnectedPeersCount(Object.keys(connectionsRef.current).length);
      });

      conn.on('error', () => {
        delete connectionsRef.current[conn.peer];
        setConnectedPeersCount(Object.keys(connectionsRef.current).length);
      });
    });

    peer.on('error', (err) => {
      console.warn('Host binding failed or already taken:', err.type);
      if (err.type === 'unavailable-id') {
        // Someone is already designated host. Connect as standard editor!
        console.log('Designated Host port taken. Falling back to Participant Editor client.');
        tryToJoinAsClient(hostId);
      } else {
        setPeerStatus('error');
      }
    });
  };

  // State pointer references to prevent callbacks referencing old react states
  const boardStateRef = useRef<BoardState | null>(null);
  useEffect(() => {
    boardStateRef.current = boardState;
  }, [boardState]);

  const createDefaultEmptyState = () => {
    const blank: BoardState = {
      code: boardCode!,
      title: createTitle || 'Tablero de GmedranoTIC',
      description: createDesc || 'Colaboración libre en tiempo real sin servidor central',
      wallpaper: createTheme || 'editorial',
      editKey: editKey || Math.random().toString(36).slice(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
      notes: {}
    };
    setBoardState(blank);
    saveToLocalStorage(blank);
    addRecentBoard(boardCode!, blank.title, true);
  };

  // CLIENT JOIN MODULE
  const tryToJoinAsClient = (targetHostId: string) => {
    const randomClientId = `gmedranotic-client-${boardCode}-${Math.random().toString(36).slice(2, 9)}`;
    const peer = new Peer(randomClientId, {
      debug: 1
    });

    peerRef.current = peer;

    peer.on('open', (id) => {
      console.log('Client Peer ID successfully registered:', id);
      connectToHost(targetHostId);
    });

    peer.on('error', (err) => {
      console.error('Client Peer allocation error:', err);
      setPeerStatus('error');
    });
  };

  const connectToHost = (targetHostId: string) => {
    if (!peerRef.current || peerRef.current.destroyed) return;

    setPeerStatus('connecting');
    const conn = peerRef.current.connect(targetHostId, {
      serialization: 'json'
    });

    conn.on('open', () => {
      console.log('Successfully handshake connected to Host:', targetHostId);
      setPeerStatus('connected');
      connectionsRef.current[targetHostId] = conn;

      // Register context
      conn.send({
        type: 'CONNECT_REQUEST',
        payload: {
          nickname: userNickname,
          role: role
        }
      });
    });

    conn.on('data', (data: any) => {
      handleIncomingDataAsClient(data);
    });

    conn.on('close', () => {
      console.warn('Conexión con Host perdida.');
      handleHostOffline();
    });

    conn.on('error', (err) => {
      console.error('Handshake connection error:', err);
      handleHostOffline();
    });
  };

  const handleHostOffline = () => {
    setPeerStatus('error');
    delete connectionsRef.current[`gmedranotic-host-${boardCode}`];
    setConnectedPeersCount(0);

    // Auto-reconnect flow
    if (!reconnectIntervalRef.current) {
      reconnectIntervalRef.current = setInterval(() => {
        console.log('Intentando re-establecer contacto con el Host...');
        connectToHost(`gmedranotic-host-${boardCode}`);
      }, 7000);
    }
  };

  // DATA ROUTERS
  const handleIncomingDataAsHost = (conn: DataConnection, packet: any) => {
    if (!packet || !boardStateRef.current) return;

    const currentNotes = { ...boardStateRef.current.notes };

    switch (packet.type) {
      case 'CONNECT_REQUEST':
        console.log(`Pares identificados: ${packet.payload.nickname} (${packet.payload.role})`);
        break;

      case 'ACTION_MUTATION':
        const { actionType, payload } = packet.payload;

        if (actionType === 'MUTATE_NOTE') {
          currentNotes[payload.id] = payload;
        } else if (actionType === 'DELETE_NOTE') {
          delete currentNotes[payload.id];
        } else if (actionType === 'LIKE_NOTE') {
          if (currentNotes[payload.id]) {
            currentNotes[payload.id] = {
              ...currentNotes[payload.id],
              likes: (currentNotes[payload.id].likes || 0) + 1
            };
          }
        } else if (actionType === 'ADD_COMMENT') {
          const { cardId, comment } = payload;
          if (currentNotes[cardId]) {
            const comments = [...(currentNotes[cardId].comments || [])];
            comments.push(comment);
            currentNotes[cardId] = {
              ...currentNotes[cardId],
              comments
            };
          }
        } else if (actionType === 'MOVE_NOTE') {
          const { id, x, y, zIndex } = payload;
          if (currentNotes[id]) {
            currentNotes[id] = {
              ...currentNotes[id],
              x,
              y,
              zIndex: zIndex || currentNotes[id].zIndex
            };
          }
        }

        const updatedState = {
          ...boardStateRef.current,
          notes: currentNotes,
          lastModified: new Date().toISOString()
        };

        setBoardState(updatedState);
        saveToLocalStorage(updatedState);
        // Broadcast change to everyone
        broadcastState(updatedState);
        break;

      default:
        break;
    }
  };

  const handleIncomingDataAsClient = (packet: any) => {
    if (!packet) return;

    // Turn off reconnect timer on payload delivery
    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    if (packet.type === 'INITIAL_STATE' || packet.type === 'STATE_UPDATE') {
      const state = packet.payload as BoardState;
      setBoardState(state);
      setPeerStatus('connected');
      addRecentBoard(state.code, state.title, role === 'editor');
    }
  };

  const broadcastState = (state: BoardState) => {
    Object.values(connectionsRef.current).forEach((conn: any) => {
      if (conn.open) {
        conn.send({
          type: 'STATE_UPDATE',
          payload: state
        });
      }
    });
  };

  // MUTATE ACTIONS (COMPATIBLE WITH CLIENT & HOST)
  const dispatchAction = (actionType: string, payload: any) => {
    if (!boardState) return;

    // If hosting, execute locally and then broadcast
    if (peerStatus === 'hosting') {
      const currentNotes = { ...boardState.notes };

      if (actionType === 'MUTATE_NOTE') {
        currentNotes[payload.id] = payload;
      } else if (actionType === 'DELETE_NOTE') {
        delete currentNotes[payload.id];
      } else if (actionType === 'LIKE_NOTE') {
        if (currentNotes[payload.id]) {
          currentNotes[payload.id] = {
            ...currentNotes[payload.id],
            likes: (currentNotes[payload.id].likes || 0) + 1
          };
        }
      } else if (actionType === 'ADD_COMMENT') {
        const { cardId, comment } = payload;
        if (currentNotes[cardId]) {
          const comments = [...(currentNotes[cardId].comments || [])];
          comments.push(comment);
          currentNotes[cardId] = {
            ...currentNotes[cardId],
            comments
          };
        }
      } else if (actionType === 'MOVE_NOTE') {
        const { id, x, y, zIndex } = payload;
        if (currentNotes[id]) {
          currentNotes[id] = {
            ...currentNotes[id],
            x,
            y,
            zIndex: zIndex || currentNotes[id].zIndex
          };
        }
      }

      const updated = {
        ...boardState,
        notes: currentNotes,
        lastModified: new Date().toISOString()
      };

      setBoardState(updated);
      saveToLocalStorage(updated);
      broadcastState(updated);
    } else {
      // If client, send mutation request up to Host
      const conn = connectionsRef.current[`gmedranotic-host-${boardCode}`];
      if (conn && conn.open) {
        conn.send({
          type: 'ACTION_MUTATION',
          payload: {
            actionType,
            payload
          }
        });

        // OPTIMISTICALLY update client local state for gorgeous latency response
        const currentNotes = { ...boardState.notes };
        if (actionType === 'MUTATE_NOTE') {
          currentNotes[payload.id] = payload;
        } else if (actionType === 'LIKE_NOTE') {
          if (currentNotes[payload.id]) {
            currentNotes[payload.id] = {
              ...currentNotes[payload.id],
              likes: (currentNotes[payload.id].likes || 0) + 1
            };
          }
        } else if (actionType === 'ADD_COMMENT') {
          const { cardId, comment } = payload;
          if (currentNotes[cardId]) {
            const comments = [...(currentNotes[cardId].comments || [])];
            comments.push(comment);
            currentNotes[cardId] = {
              ...currentNotes[cardId],
              comments
            };
          }
        } else if (actionType === 'MOVE_NOTE') {
          const { id, x, y, zIndex } = payload;
          if (currentNotes[id]) {
            currentNotes[id] = {
              ...currentNotes[id],
              x,
              y,
              zIndex: zIndex || currentNotes[id].zIndex
            };
          }
        }
        setBoardState({ ...boardState, notes: currentNotes });
      } else {
        alert('Anfitrión desconectado. Los cambios no se pudieron propagar. Intenta reclamar control del tablero si eres Editor.');
      }
    }
  };

  // DRAGS
  const handleCardDrag = (id: string, x: number, y: number, zIndex?: number) => {
    if (!boardState) return;
    // Optimistic fast local translate without broadcasting continuously (avoids choking sockets!)
    const currentNotes = { ...boardState.notes };
    if (currentNotes[id]) {
      currentNotes[id] = {
        ...currentNotes[id],
        x,
        y,
        zIndex: zIndex || currentNotes[id].zIndex
      };
      setBoardState({
        ...boardState,
        notes: currentNotes
      });
    }
  };

  const handleCardDragEnd = (id: string) => {
    if (!boardState) return;
    const card = boardState.notes[id];
    if (card) {
      dispatchAction('MOVE_NOTE', {
        id,
        x: card.x,
        y: card.y,
        zIndex: card.zIndex
      });
    }
  };

  // CHANGE THEME DYNAMIC
  const changeBoardTheme = (themeId: string) => {
    if (!boardState || role !== 'editor') return;

    if (peerStatus === 'hosting') {
      const next = { ...boardState, wallpaper: themeId };
      setBoardState(next);
      saveToLocalStorage(next);
      broadcastState(next);
    } else {
      // Direct update dispatch helper
      alert('Debes ser el anfitrión activo del tablero para editar el fondo.');
    }
    setShowSettingsDropdown(false);
  };

  // EXPORT AS PDF
  const handleExportPdf = async () => {
    const element = document.getElementById('board-content');
    if (!element) return;

    setIsGeneratingPdf(true);

    try {
      // Scroll to top
      window.scrollTo(0, 0);

      // Render crisp canvas
      const canvas = await html2canvas(element, {
        scale: 2, // High DPI capture
        useCORS: true,
        backgroundColor: '#faf7f2',
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
        x: 0,
        y: 0
      });

      const imgData = canvas.toDataURL('image/png');

      // Setup clean landscape formatting fits padlet grids
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Tablero_GmedranoTIC_${boardCode || 'export'}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al generar el PDF. Inténtalo de nuevo.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // TOGGLE BROWSER SCREEN
  const toggleFullscreen = () => {
    const elem = document.getElementById('app-wrapper');
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // LOBBY FLOWS
  const generateRandom6Letter = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  };

  const handleCreateBoard = (e: React.FormEvent) => {
    e.preventDefault();
    const code = generateRandom6Letter();
    const secretKey = `ek-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    // Set state
    setBoardCode(code);
    setEditKey(secretKey);
    setRole('editor');

    // Update URL history parameters
    const nextUrl = `${window.location.origin}${window.location.pathname}?code=${code}&role=editor&key=${secretKey}`;
    window.history.pushState({}, '', nextUrl);

    setIsLobby(false);
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCodeInput.trim().length !== 6) {
      alert('El código debe contener exactamente 6 caracteres.');
      return;
    }

    const target = joinCodeInput.trim().toUpperCase();
    setBoardCode(target);
    setRole('viewer');

    const nextUrl = `${window.location.origin}${window.location.pathname}?code=${target}&role=viewer`;
    window.history.pushState({}, '', nextUrl);

    setIsLobby(false);
  };

  // ASSUME OWNERSHIP RESCUE MODULE
  const handleAssumeControl = () => {
    if (role !== 'editor') {
      alert('Solo los editores con clave de seguridad pueden tomar control administrativo del tablero.');
      return;
    }

    if (confirm('¿Quieres reclamar el control de este tablero como el Anfitrión principal? Esto permitirá continuar agregando tarjetas si el creador se desconectó.')) {
      disconnectAll();
      setPeerStatus('connecting');
      tryToHost(`gmedranotic-host-${boardCode}`);
    }
  };

  const handleNicknameChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userNickname.trim()) return;
    localStorage.setItem('board_nick', userNickname.trim());
    setShowNickPrompt(false);
  };

  // BOARD ACTIONS: CREATE/SAVE/DELETE NOTES
  const handleNoteSave = (noteData: {
    username: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    color: ColorOption;
  }) => {
    if (!boardState) return;

    if (cardToEdit) {
      // Modify
      const updated: Note = {
        ...cardToEdit,
        username: noteData.username,
        title: noteData.title,
        content: noteData.content,
        imageUrl: noteData.imageUrl,
        color: noteData.color
      };
      dispatchAction('MUTATE_NOTE', updated);
    } else {
      // Insert
      const newId = `not-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const newNote: Note = {
        id: newId,
        username: noteData.username,
        title: noteData.title,
        content: noteData.content,
        imageUrl: noteData.imageUrl,
        color: noteData.color,
        likes: 0,
        comments: [],
        x: Math.random() * 40 + 20, // offset positions for free drag canvas
        y: Math.random() * 30 + 15,
        zIndex: 12,
        createdAt: new Date().toISOString()
      };
      dispatchAction('MUTATE_NOTE', newNote);
    }

    setIsNoteOpen(false);
    setCardToEdit(null);
  };

  const handleNoteDelete = (id: string) => {
    if (confirm('¿Estás seguro de que deseas eliminar permanentemente esta tarjeta?')) {
      dispatchAction('DELETE_NOTE', { id });
    }
  };

  const handleNoteLike = (id: string) => {
    dispatchAction('LIKE_NOTE', { id });
  };

  const handleCommentSubmit = (id: string, comment: CommentItem) => {
    dispatchAction('ADD_COMMENT', { cardId: id, comment });
  };

  // Exit App
  const handleExitToLobby = () => {
    disconnectAll();
    setBoardCode(null);
    setBoardState(null);
    setRole('viewer');
    setEditKey('');
    setIsLobby(true);

    // Refresh URL parameters
    const nextUrl = `${window.location.origin}${window.location.pathname}`;
    window.history.pushState({}, '', nextUrl);
  };

  // Active theme bg selection reference
  const currentThemeConfig = boardState
    ? THEM_OPTIONS.find((t) => t.id === boardState.wallpaper) || THEM_OPTIONS[0]
    : THEM_OPTIONS[0];

  return (
    <div className="min-h-screen text-[#1a1512] font-sans antialiased bg-[#faf7f2]" id="app-wrapper">
      <AnimatePresence mode="wait">
        {isLobby ? (
          /* ──────── LOBBY PANEL ──────── */
          <motion.div
            key="lobby"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-screen flex flex-col justify-between py-12 px-4 relative overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(rgba(26,21,18,0.06) 1.5px, transparent 1.5px)',
              backgroundSize: '24px 24px'
            }}
            id="lobby-layout"
          >
            {/* Header info / Logo Branding */}
            <div className="max-w-4xl mx-auto w-full text-center space-y-6 shrink-0 z-10" id="lobby-header">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-white/60 text-[11px] font-bold uppercase tracking-widest text-brand-color select-none shadow-xs" id="lobby-pill animate-in fade-in">
                <Sparkles className="w-3.5 h-3.5" />
                P2P en tiempo real • Sin servidor central
              </div>

              {/* Styled Vector branding */}
              <div className="flex flex-col items-center gap-3 select-none" id="lobby-branding">
                <div className="w-20 h-20 bg-[#1a1512] rounded-2xl flex items-center justify-center shadow-xl border border-black/20" id="logo-icon animate-bounce">
                  <svg viewBox="0 0 80 80" className="w-[84%] h-[84%]" fill="none">
                    <rect x="10" y="14" width="60" height="42" rx="4" fill="#faf7f2" opacity=".95" />
                    <rect x="10" y="14" width="60" height="8" rx="2" fill="#c8541a" />
                    <rect x="14" y="26" width="24" height="15" rx="3" fill="#ea580c" opacity=".9" />
                    <rect x="42" y="26" width="24" height="15" rx="3" fill="#eab308" opacity=".9" />
                    <rect x="14" y="45" width="52" height="6" rx="2.5" fill="#15803d" opacity=".8" />
                    <circle cx="40" cy="14" r="3.5" fill="#faf7f2" />
                    <circle cx="40" cy="14" r="1.5" fill="#c8541a" />
                  </svg>
                </div>
                <h1 className="font-serif font-bold text-4xl sm:text-5xl tracking-tight leading-none mt-2">
                  Tablero de <span className="text-orange-600 italic">GmedranoTIC</span>
                </h1>
                <p className="text-sm text-neutral-500 max-w-md mx-auto leading-relaxed font-sans">
                  El tablero colaborativo temporal e interactivo. Sube texto e imágenes, organiza en mosaico o libre, y comparte instantáneamente.
                </p>
              </div>
            </div>

            {/* Main Interactive Column grid */}
            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 gap-8 my-8 z-10" id="lobby-grid">
              {/* Box 1: Create Board */}
              <div className="bg-white/90 border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between" id="lobby-create-card">
                <div>
                  <h2 className="font-serif font-bold text-xl mb-2 flex items-center gap-2 text-neutral-900 select-none">
                    <Plus className="w-5 h-5 text-orange-600" /> Crear nuevo tablero
                  </h2>
                  <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                    Instancia un tablero visual propio. Recibirás una clave de administrador para añadir y editar notas libremente.
                  </p>
                </div>

                <form onSubmit={handleCreateBoard} className="space-y-4" id="create-board-form">
                  <div className="flex flex-col gap-1" id="cg-title">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Título del espacio</label>
                    <input
                      type="text"
                      required
                      maxLength={40}
                      value={createTitle}
                      onChange={(e) => setCreateTitle(e.target.value)}
                      placeholder="Ej. Clase de Electrotecnia ⚡"
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-hidden focus:border-neutral-900 transition-colors text-neutral-800 font-sans"
                    />
                  </div>

                  <div className="flex flex-col gap-1" id="cg-desc">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Descripción / Meta</label>
                    <input
                      type="text"
                      maxLength={80}
                      value={createDesc}
                      onChange={(e) => setCreateDesc(e.target.value)}
                      placeholder="Ej. Lluvia de ideas tecnológicas"
                      className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-hidden focus:border-neutral-900 transition-colors text-neutral-800 font-sans"
                    />
                  </div>

                  <div className="flex flex-col gap-1" id="cg-theme">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Fondo decorativo</label>
                    <div className="grid grid-cols-3 gap-2" id="lobby-theme-selector">
                      {THEM_OPTIONS.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => setCreateTheme(t.id)}
                          className={`rounded-lg border p-1 text-left relative overflow-hidden transition-all text-xs h-12 flex flex-col justify-end select-none ${
                            createTheme === t.id
                              ? 'ring-2 ring-[#1a1512] border-transparent font-semibold shadow-xs scale-[1.02]'
                              : 'border-neutral-200 hover:border-neutral-400'
                          }`}
                          id={`theme-option-${t.id}`}
                        >
                          <div className={`absolute inset-0 opacity-40 ${t.bgClass}`} />
                          <span className="relative z-10 text-[9px] font-medium bg-white/95 px-1.5 py-0.5 rounded-sm line-clamp-1 border border-black/5 uppercase tracking-wide">
                            {t.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#1a1512] hover:bg-orange-600 hover:shadow-lg transition-all text-white text-xs font-bold uppercase tracking-wider py-3.5 rounded-lg flex items-center justify-center gap-1.5"
                    id="create-board-submit"
                  >
                    Crear mi tablero →
                  </button>
                </form>
              </div>

              {/* Box 2: Join Board */}
              <div className="bg-white/90 border border-neutral-200/90 rounded-2xl p-6 sm:p-8 shadow-xl flex flex-col justify-between" id="lobby-join-card">
                <div>
                  <h2 className="font-serif font-bold text-xl mb-2 flex items-center gap-2 text-neutral-900 select-none">
                    <Compass className="w-5 h-5 text-orange-600" /> Compartido conmigo
                  </h2>
                  <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
                    Escribe el código alfanumérico enviado por el anfitrión para sincronizarte instantáneamente al tablero.
                  </p>
                </div>

                <div className="space-y-6" id="lobby-join-flows">
                  <form onSubmit={handleJoinByCode} className="space-y-3" id="join-board-form">
                    <div className="flex flex-col gap-1" id="jg-code">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Ingresar código de 6 letras</label>
                      <div className="flex gap-2" id="join-row">
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                          placeholder="ABCDEF"
                          className="flex-1 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-center text-lg font-mono font-bold tracking-widest uppercase outline-hidden focus:border-neutral-900 focus:ring-1 focus:ring-neutral-200 text-[#1a1512]"
                          id="jf-code"
                        />
                        <button
                          type="submit"
                          className="bg-[#1a1512] hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-wider px-5 rounded-lg transition-all hover:shadow-md"
                          id="join-board-btn"
                        >
                          Entrar
                        </button>
                      </div>
                    </div>
                  </form>

                  {/* Recents List */}
                  <div className="pt-4 border-t border-neutral-100 select-none" id="lobby-recents">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">Tableros visitados recientemente</label>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto" id="recents-scroll">
                      {recents.length === 0 ? (
                        <p className="text-[11px] italic text-neutral-400 py-3 text-center">No has visitado espacios temporales aún.</p>
                      ) : (
                        recents.map((rec) => (
                          <div
                            key={rec.code}
                            onClick={() => {
                              // Auto navigate to recent
                              setBoardCode(rec.code);
                              setRole(rec.hasKey ? 'editor' : 'viewer');
                              const saved = localStorage.getItem(`gmt_state_${rec.code}`);
                              if (saved) {
                                try {
                                  const parsed = JSON.parse(saved);
                                  setEditKey(parsed.editKey || '');
                                } catch (e) {}
                              }
                              setIsLobby(false);
                              const nextUrl = `${window.location.origin}${window.location.pathname}?code=${rec.code}&role=${rec.hasKey ? 'editor' : 'viewer'}`;
                              window.history.pushState({}, '', nextUrl);
                            }}
                            className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 hover:border-neutral-800 bg-stone-50 hover:bg-white cursor-pointer transition-all"
                            id={`recent-item-${rec.code}`}
                          >
                            <div className="min-w-0" id={`recent-item-meta-${rec.code}`}>
                              <span className="font-serif font-bold text-xs truncate block text-neutral-900">{rec.title}</span>
                              <span className="font-mono text-[9px] uppercase tracking-wider text-neutral-450 block mt-0.5">
                                Cdigo: <strong className="text-neutral-700">{rec.code}</strong>
                              </span>
                            </div>
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 shadow-xs border ${
                              rec.hasKey
                                ? 'bg-orange-50 border-orange-200 text-orange-700'
                                : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                            }`} id={`recent-item-badge-${rec.code}`}>
                              {rec.hasKey ? 'EDITOR' : 'LECTOR'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer context */}
            <div className="text-center font-mono text-[10px] text-neutral-400 mt-6 shrink-0 select-none" id="lobby-footer">
              Tablero de GmedranoTIC © 2026. Diseado con WebRTC de PeerJS.
            </div>
          </motion.div>
        ) : (
          /* ──────── REALTIME BOARD WHITEBOARD ──────── */
          <motion.div
            key="board"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            id="board-layout"
            className="h-screen w-full flex flex-col overflow-hidden relative"
          >
            {/* Top Toolbar Navigation Header */}
            <header className="px-4 py-2 border-b border-neutral-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 z-100 select-none shadow-xs" id="board-header">
              <div className="flex items-center gap-3 min-w-0" id="board-hdr-left">
                <button
                  onClick={handleExitToLobby}
                  className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-neutral-900 transition-colors"
                  title="Salir al lobby"
                  id="back-to-lobby-btn"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                {/* Micro branding */}
                <div className="w-8 h-8 rounded-lg bg-[#1a1512] flex items-center justify-center border border-black/10 shrink-0" id="board-hdr-logo">
                  <svg viewBox="0 0 80 80" className="w-[84%] h-[84%]" fill="none">
                    <rect x="10" y="14" width="60" height="42" rx="4" fill="#faf7f2" />
                    <rect x="10" y="14" width="60" height="8" rx="2" fill="#c8541a" />
                    <rect x="14" y="26" width="24" height="15" rx="3" fill="#ea580c" opacity=".9" />
                    <circle cx="40" cy="14" r="3.5" fill="#faf7f2" />
                    <circle cx="40" cy="14" r="1.5" fill="#c8541a" />
                  </svg>
                </div>

                <div className="min-w-0" id="board-hdr-texts">
                  <h2 className="font-serif font-bold text-sm leading-tight truncate text-neutral-900" id="hdr-board-title">
                    {boardState?.title || 'Mi Tablero'}
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5" id="hdr-board-subtext">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#1a1512] font-semibold bg-orange-100 px-1 py-0.2 rounded-xs">
                      {boardCode}
                    </span>
                    <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm select-none border ${
                      role === 'editor'
                        ? 'bg-orange-50 border-orange-200 text-orange-700'
                        : 'bg-neutral-100 border-neutral-300 text-neutral-600'
                    }`} id="hdr-badge">
                      {role === 'editor' ? '✍️ Editor' : '👁️ Visor'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Header Right Action controls */}
              <div className="flex items-center gap-1.5 md:gap-2 shrink-0" id="board-hdr-right">
                {/* Peer connection status popup */}
                <div className="hidden sm:block" id="hdr-status">
                  <PeerStatusIndicator status={peerStatus} peerCount={connectedPeersCount} role={role} />
                </div>

                {/* Nickname display and click-change */}
                <button
                  onClick={() => setShowNickPrompt(true)}
                  className="px-2 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 rounded-md text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer max-w-[120px] md:max-w-none transition-all"
                  title="Cambiar mi apodo"
                  id="nickname-display-btn"
                >
                  <User className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  <span className="truncate">{userNickname}</span>
                </button>

                {/* Layout Switch: Mosaico vs Libre */}
                <div className="flex items-center border border-neutral-200 rounded-lg p-0.5 bg-neutral-50 shrink-0" id="layout-toggle-cluster">
                  <button
                    onClick={() => setLayoutMode('grid')}
                    className={`p-1.5 rounded-md hover:text-neutral-900 transition-colors ${
                      layoutMode === 'grid'
                        ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                        : 'text-neutral-400'
                    }`}
                    title="Diseño mosaico (automático)"
                    id="layout-grid-btn"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setLayoutMode('canvas');
                      // Help dialog info once on canvas load
                      const alerted = localStorage.getItem('gmt_drag_alert');
                      if (!alerted && role === 'editor') {
                        alert('¡Diseño Libre Activado! En este modo, como editor, puedes arrastrar con el mouse o con el dedo cualquier tarjeta para organizarla libremente por el espacio.');
                        localStorage.setItem('gmt_drag_alert', 'true');
                      }
                    }}
                    className={`p-1.5 rounded-md hover:text-neutral-900 transition-colors ${
                      layoutMode === 'canvas'
                        ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                        : 'text-neutral-400'
                    }`}
                    title="Diseño libre (arrastrable)"
                    id="layout-canvas-btn"
                  >
                    <Map className="w-4 h-4" />
                  </button>
                </div>

                {/* Settings Actions: Background Wallpapers and Administration */}
                <div className="relative" id="hdr-settings-wrap">
                  <button
                    onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                    className={`p-2 rounded-lg border border-neutral-200 hover:border-neutral-800 transition-all focus:outline-hidden ${
                      showSettingsDropdown ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'
                    }`}
                    title="Ajustes de tablero"
                    id="theme-picker-btn"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {showSettingsDropdown && (
                    <div className="absolute right-0 top-full mt-2.5 bg-[#faf7f2] border border-neutral-200 w-52 shadow-2xl rounded-lg p-1 animate-in fade-in slide-in-from-top-1.5 duration-100" id="theme-dropdown">
                      <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest px-3 py-1.5 border-b border-neutral-100 select-none">
                        Estilo visual fondo
                      </div>
                      <div className="py-1" id="settings-theme-list">
                        {THEM_OPTIONS.map((t) => (
                          <button
                            key={t.id}
                            disabled={role !== 'editor'}
                            onClick={() => changeBoardTheme(t.id)}
                            className={`w-full text-left px-3 py-1.5 text-xs rounded-md transition-colors flex items-center justify-between ${
                              boardState?.wallpaper === t.id
                                ? 'bg-[#1a1512] text-white font-semibold'
                                : 'text-neutral-700 hover:bg-neutral-100'
                            } ${role !== 'editor' ? 'opacity-50 cursor-not-allowed' : ''}`}
                            id={`settings-theme-btn-${t.id}`}
                          >
                            <span>{t.name}</span>
                            {boardState?.wallpaper === t.id && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>

                      {role === 'editor' && (
                        <div className="border-t border-neutral-100 mt-1 pt-1" id="settings-admin-zone">
                          <button
                            onClick={() => {
                              setShowSettingsDropdown(false);
                              handleAssumeControl();
                            }}
                            className="w-full text-left px-3 py-2 text-xs text-orange-600 hover:bg-orange-50 rounded-md font-semibold flex items-center gap-1.5 uppercase tracking-wide"
                            id="assume-host-btn"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reclamar Control
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* PDF Export trigger */}
                <button
                  onClick={handleExportPdf}
                  className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-800 transition-all shrink-0"
                  title="Exportar a informe PDF"
                  id="pdf-btn"
                >
                  <FileDown className="w-4 h-4" />
                </button>

                {/* Screen Maximise */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 rounded-lg border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-800 transition-all shrink-0"
                  title="Alternar pantalla completa"
                  id="fs-btn"
                >
                  {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>

                {/* Share Trigger */}
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="px-3.5 py-2 bg-neutral-900 hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm hover:shadow-md transition-all shrink-0"
                  id="share-btn"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Compartir</span>
                </button>
              </div>
            </header>

            {/* Micro warning bar for screens that lost connectivity or search for Host */}
            {peerStatus === 'connecting' && (
              <div className="bg-amber-500 text-white px-4 py-2 text-xs text-center border-b border-amber-600 font-medium flex items-center justify-center gap-2 select-none" id="searching-bar animate-pulse">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Intentando descodificar conexión P2P con el anfitrión principal... Estarás sincronizado enseguida.</span>
              </div>
            )}

            {peerStatus === 'error' && (
              <div className="bg-rose-600 text-white px-4 py-2 text-xs text-center border-b border-rose-700 font-medium flex items-center justify-center gap-4 select-none animate-in slide-in-from-top" id="offline-rescue-bar">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>El anfitrión ha cerrado el espacio. Si eres Editor, puedes asumir la administración para reanudar el flujo.</span>
                </div>
                {role === 'editor' && (
                  <button
                    onClick={handleAssumeControl}
                    className="p-1 px-3 bg-white text-rose-700 rounded-md font-bold uppercase tracking-wider text-[10px] hover:bg-stone-50 transition-colors shadow-xs shrink-0"
                    id="offline-assume-ctl-btn"
                  >
                    Asumir Control
                  </button>
                )}
              </div>
            )}

            {/* MAIN WHITEBOARD STAGE */}
            <main
              id="board-main"
              className={`flex-1 overflow-auto relative p-6 transition-all duration-300 ${currentThemeConfig.bgClass}`}
              onClick={() => {
                setShowSettingsDropdown(false);
              }}
            >
              {/* Overlay WATERMARK */}
              <Watermark darkBg={currentThemeConfig.textTheme === 'light'} />

              {/* Board Cards Content Canvas */}
              <div
                id="board-content"
                className={`w-full ${
                  layoutMode === 'canvas'
                    ? 'min-h-[140vh] md:min-h-[160vh] relative'
                    : 'max-w-7xl mx-auto'
                }`}
              >
                {/* Layout Rendering: Grid vs Canvas list */}
                {Object.keys(boardState?.notes || {}).length === 0 ? (
                  /* EMPTY WORKSPACE STATE */
                  <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 px-4 py-12 select-none" id="empty-workspace">
                    <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/5 select-none text-neutral-400" id="empty-workspace-icon">
                      <HelpCircle className="w-8 h-8 opacity-40 text-neutral-500" />
                    </div>
                    <div>
                      <h3 className={`font-serif font-bold text-2xl mb-1 ${currentThemeConfig.textTheme === 'light' ? 'text-white' : 'text-neutral-900'}`}>
                        Tablero vacío
                      </h3>
                      <p className={`text-xs max-w-sm mx-auto leading-relaxed opacity-60 ${currentThemeConfig.textTheme === 'light' ? 'text-neutral-100' : 'text-neutral-500'}`}>
                        {role === 'editor'
                          ? 'Aún no hay tarjetas en este espacio temporal de 24h. ¡Haz clic en el botón flotante inferior para publicar el primer texto o imagen!'
                          : 'No hay tarjetas cargadas todavía. Espera a que el editor publique algo.'}
                      </p>
                    </div>

                    {role === 'editor' && (
                      <button
                        onClick={() => {
                          setCardToEdit(null);
                          setIsNoteOpen(true);
                        }}
                        className="px-5 py-2.5 bg-[#1a1512] hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 hover:shadow-lg transition-all"
                        id="empty-workspace-add-btn"
                      >
                        <Plus className="w-4 h-4" /> Añadir primera tarjeta
                      </button>
                    )}
                  </div>
                ) : layoutMode === 'canvas' ? (
                  /* FREE DRAGGABLE LAYOUT (CANVAS) */
                  <div className="w-full h-full min-h-[140vh]" id="canvas-view-wrap">
                    {(Object.values(boardState?.notes || {}) as Note[])
                      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                      .map((note) => (
                        <BoardCard
                          key={note.id}
                          card={note}
                          layoutMode={layoutMode}
                          isEditor={role === 'editor'}
                          onLike={handleNoteLike}
                          onComment={handleCommentSubmit}
                          onEdit={(id) => {
                            setCardToEdit(boardState!.notes[id]);
                            setIsNoteOpen(true);
                          }}
                          onDelete={handleNoteDelete}
                          onDrag={handleCardDrag}
                          onDragEnd={handleCardDragEnd}
                          userNickname={userNickname}
                        />
                      ))}
                  </div>
                ) : (
                  /* RESPONSIVE MOSAIC GRID LAYOUT */
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6" id="grid-view-wrap animate-in fade-in">
                    {(Object.values(boardState?.notes || {}) as Note[])
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // latest first in grid mode
                      .map((note) => (
                        <BoardCard
                          key={note.id}
                          card={note}
                          layoutMode={layoutMode}
                          isEditor={role === 'editor'}
                          onLike={handleNoteLike}
                          onComment={handleCommentSubmit}
                          onEdit={(id) => {
                            setCardToEdit(boardState!.notes[id]);
                            setIsNoteOpen(true);
                          }}
                          onDelete={handleNoteDelete}
                          onDrag={handleCardDrag}
                          onDragEnd={handleCardDragEnd}
                          userNickname={userNickname}
                        />
                      ))}
                  </div>
                )}
              </div>
            </main>

            {/* FLOAT ACTION EXPANSION BUTTON (Only for ACTIVE EDITORS) */}
            {role === 'editor' && (
              <button
                onClick={() => {
                  setCardToEdit(null);
                  setIsNoteOpen(true);
                }}
                className="fixed bottom-6 right-6 z-90 h-14 px-6 bg-[#1a1512] hover:bg-orange-600 text-white rounded-full flex items-center justify-center gap-2 shadow-2xl hover:shadow-orange-600/20 active:scale-95 transition-all text-xs font-bold uppercase tracking-wider select-none shrink-0"
                id="fab"
              >
                <Plus className="w-5 h-5 shrink-0" />
                <span>Tarjeta</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* GLOBAL FULLSCREEN ZOOM OVERLAY FOR POST PHOTOS */}
      {zoomImgUrl && (
        <div
          onClick={() => setZoomImgUrl(null)}
          className="fixed inset-0 z-300 bg-black/95 backdrop-blur-md flex items-center justify-center p-6 cursor-zoom-out select-none"
          id="zoom-overlay"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex items-center justify-center" id="zoom-img-box">
            <img
              src={zoomImgUrl}
              alt="Zoom"
              className="max-h-[90vh] max-w-full object-contain shadow-2xl"
              referrerPolicy="no-referrer"
            />
          </div>
          <button
            onClick={() => setZoomImgUrl(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 hover:scale-105 active:scale-95 border border-white/15 text-white rounded-full p-2.5 transition-all shadow-md shrink-0"
            id="zoom-close-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* PDF PRINT LOADING ANIMATION PANEL */}
      {isGeneratingPdf && (
        <div className="fixed inset-0 z-500 bg-[#faf7f2]/90 backdrop-blur-xs flex flex-col items-center justify-center gap-3 select-none" id="pdf-loading">
          <div className="w-10 h-10 border-4 border-[#1a1512] border-t-transparent rounded-full animate-spin shrink-0" />
          <p className="font-serif font-bold text-sm uppercase tracking-widest text-[#1a1512]">Generando PDF de GmedranoTIC...</p>
        </div>
      )}

      {/* EDIT USER NICKNAME FLOATING DIALOG OVERLAY */}
      {showNickPrompt && (
        <div className="fixed inset-0 z-210 bg-[#1a1512]/40 backdrop-blur-xs flex items-center justify-center p-4" id="nick-modal">
          <div className="bg-[#faf7f2] border border-neutral-200 rounded-xl p-5 w-full max-w-sm shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-100" id="nick-modal-box">
            <h3 className="font-serif font-bold text-lg text-neutral-950 flex items-center gap-1.5">
              Cambiar apodo
            </h3>
            <p className="text-xs text-neutral-500 leading-relaxed font-sans">
              Escribe un nombre que tus compañeros de tablero puedan reconocer fácilmente al firmar comentarios o publicaciones.
            </p>
            <form onSubmit={handleNicknameChangeSubmit} className="space-y-3" id="nick-form">
              <input
                type="text"
                required
                maxLength={20}
                value={userNickname}
                onChange={(e) => setUserNickname(e.target.value)}
                placeholder="Ej. Búho Intelectual"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3/5 py-2.5 text-sm outline-hidden focus:border-neutral-900 font-medium text-neutral-805 text-center"
                id="nick-input"
              />
              <div className="flex gap-2 pt-1" id="nick-btn-row">
                <button
                  type="button"
                  onClick={() => setShowNickPrompt(false)}
                  className="flex-1 py-2 border border-neutral-300 hover:border-neutral-800 rounded-lg text-xs font-bold uppercase tracking-wide text-neutral-600 hover:text-neutral-950 transition-colors"
                  id="nick-cancel"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-neutral-950 hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                  id="nick-save"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODAL WRAPPERS */}
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        boardCode={boardCode || ''}
        editKey={boardState?.editKey || ''}
      />

      <NoteModal
        isOpen={isNoteOpen}
        onClose={() => {
          setIsNoteOpen(false);
          setCardToEdit(null);
        }}
        cardToEdit={cardToEdit}
        onSave={handleNoteSave}
        defaultNickname={userNickname}
      />
    </div>
  );
}
