import React, { useState } from 'react';
import { X, Copy, Check, Eye, Edit2, AlertCircle, QrCode } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardCode: string;
  editKey: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, boardCode, editKey }) => {
  const [activeTab, setActiveTab] = useState<'viewer' | 'editor'>('viewer');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Derive Base URLs
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  const viewerLink = `${baseUrl}?code=${boardCode}&role=viewer`;
  const editorLink = `${baseUrl}?code=${boardCode}&role=editor&key=${editKey}`;

  const currentLink = activeTab === 'viewer' ? viewerLink : editorLink;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Generate QR code URL using online API
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(currentLink)}`;

  return (
    <div className="fixed inset-0 z-200 bg-[#1a1512]/40 backdrop-blur-xs flex items-center justify-center p-4" id="share-modal-overlay">
      <div className="bg-[#faf7f2] border border-neutral-200 w-full max-w-md shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-200" id="share-modal-box">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between" id="share-modal-hdr">
          <h3 className="font-serif font-bold text-lg flex items-center gap-2">
            Compartir tablero
          </h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors" id="share-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selectors */}
        <div className="grid grid-cols-2 border-b border-neutral-200" id="share-modal-tabs">
          <button
            onClick={() => { setActiveTab('viewer'); setCopied(false); }}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'viewer'
                ? 'border-b-2 border-[#1a1512] text-[#1a1512]'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}
            id="share-tab-viewer"
          >
            <Eye className="w-4 h-4" /> Solo lectura
          </button>
          <button
            onClick={() => { setActiveTab('editor'); setCopied(false); }}
            className={`py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'editor'
                ? 'border-b-2 border-[#1a1512] text-[#1a1512]'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}
            id="share-tab-editor"
          >
            <Edit2 className="w-4 h-4" /> Editor
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5" id="share-modal-body">
          {/* Large Code Badge */}
          <div className="bg-neutral-100 border border-neutral-200 rounded-lg p-4 text-center mb-4 select-all" id="share-modal-codebadge">
            <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest block mb-1">Código del tablero</span>
            <span className="font-mono font-bold text-3xl leading-none text-[#1a1512] tracking-widest">{boardCode}</span>
            <span className="text-[11px] text-neutral-400 block mt-2">Introduce este código en la pantalla de inicio para unirse.</span>
          </div>

          {/* Warning Banner */}
          <div className={`p-3 border rounded-lg flex items-start gap-2 text-xs mb-4 ${
            activeTab === 'editor'
              ? 'bg-amber-50 border-amber-200 text-amber-850'
              : 'bg-emerald-50 border-emerald-200 text-emerald-850'
          }`} id="share-modal-alert">
            <AlertCircle className={`w-4 h-4 shrink-0 mt-0.5 ${activeTab === 'editor' ? 'text-amber-600' : 'text-emerald-600'}`} />
            <div>
              {activeTab === 'editor' ? (
                <span>
                  <strong>Cuidado:</strong> El enlace de editor otorga permisos completos para publicar, mover, editar y eliminar cualquier nota del tablero.
                </span>
              ) : (
                <span>
                  Los visitantes con este enlace podrán ver las notas, comentarlas y darles likes en tiempo real, pero no podrán añadir o modificar tarjetas.
                </span>
              )}
            </div>
          </div>

          {/* QR Container */}
          <div className="bg-white border border-neutral-200 p-4 rounded-lg flex flex-col items-center justify-center gap-2 mb-4" id="share-modal-qr-wrap">
            <div className="w-[140px] h-[140px] bg-neutral-50 flex items-center justify-center border border-neutral-100 rounded-md" id="share-modal-qr-img-box">
              <img
                src={qrCodeUrl}
                alt="QR Code"
                className="w-full h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <span className="text-[10px] font-mono tracking-wider font-semibold uppercase text-neutral-400 flex items-center gap-1.5 mt-1">
              <QrCode className="w-3.5 h-3.5" /> Escanear para unirse
            </span>
          </div>

          {/* Copyable Field */}
          <div className="flex flex-col gap-1.5" id="share-modal-copyflow">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
              {activeTab === 'editor' ? 'Enlace de edición' : 'Enlace de lectura'}
            </label>
            <div className="flex gap-2" id="share-modal-copyrow">
              <input
                type="text"
                readOnly
                value={currentLink}
                className="flex-1 rounded-md border border-neutral-300 bg-neutral-100 px-3 py-2 text-xs font-mono select-all outline-hidden text-neutral-700 truncate"
                id="share-link-input"
              />
              <button
                onClick={handleCopy}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-md flex items-center justify-center gap-1.5 transition-all text-white focus:outline-hidden ${
                  copied
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-[#1a1512] hover:bg-orange-600 hover:shadow-md'
                }`}
                id="share-copy-btn"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
