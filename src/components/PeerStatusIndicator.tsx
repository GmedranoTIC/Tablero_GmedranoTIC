import React from 'react';
import { Wifi, WifiOff, Users, ShieldAlert } from 'lucide-react';

interface PeerStatusProps {
  status: 'connecting' | 'connected' | 'hosting' | 'error' | 'disconnected';
  peerCount: number;
  role: 'editor' | 'viewer';
}

export const PeerStatusIndicator: React.FC<PeerStatusProps> = ({ status, peerCount, role }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'hosting':
        return {
          icon: <Wifi className="w-4 h-4 text-emerald-500 animate-pulse" />,
          bgColor: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          text: 'Hospedando (P2P Activo)',
          desc: 'Eres el servidor de este tablero. Los cambios se guardan localmente.'
        };
      case 'connected':
        return {
          icon: <Wifi className="w-4 h-4 text-blue-500" />,
          bgColor: 'bg-blue-50 border-blue-200 text-blue-800',
          text: 'Conectado (P2P Cliente)',
          desc: 'Conectado al creador. Sincronización activa en tiempo real.'
        };
      case 'connecting':
        return {
          icon: <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />,
          bgColor: 'bg-amber-50 border-amber-200 text-amber-800',
          text: 'Sincronizando...',
          desc: 'Buscando anfitrión PeerJS para cargar las tarjetas...'
        };
      case 'error':
        return {
          icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
          bgColor: 'bg-rose-50 border-rose-200 text-rose-800',
          text: 'Sin Anfitrión',
          desc: 'No se pudo conectar al creador. Puedes asumir control si eres editor.'
        };
      case 'disconnected':
      default:
        return {
          icon: <WifiOff className="w-4 h-4 text-gray-400" />,
          bgColor: 'bg-gray-100 border-gray-300 text-gray-700',
          text: 'Desconectado',
          desc: 'Buscando de nuevo...'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`p-3 rounded-lg border flex items-start gap-3 shadow-xs ${config.bgColor}`} id="status-bubble">
      <div className="mt-0.5" id="status-bubble-icon">{config.icon}</div>
      <div className="flex-1 min-w-0" id="status-bubble-content">
        <div className="flex items-center gap-2" id="status-bubble-heading">
          <span className="font-semibold text-xs leading-tight uppercase tracking-wider">{config.text}</span>
          {peerCount > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] bg-white/60 px-1.5 py-0.5 rounded-full font-mono font-bold" id="status-bubble-badge">
              <Users className="w-3 h-3" />
              {peerCount} {peerCount === 1 ? 'par' : 'pares'}
            </span>
          )}
        </div>
        <p className="text-[11px] opacity-80 mt-1 leading-normal">{config.desc}</p>
      </div>
    </div>
  );
};
