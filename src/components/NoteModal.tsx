import React, { useState, useEffect, useRef } from 'react';
import { X, Image as ImageIcon, Camera, UploadCloud, Check, Sparkles } from 'lucide-react';
import { ColorOption, Note } from '../types';
import { NOTE_COLORS } from '../constants';

interface NoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit: Note | null;
  onSave: (noteData: {
    username: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    color: ColorOption;
  }) => void;
  defaultNickname: string;
}

export const NoteModal: React.FC<NoteModalProps> = ({
  isOpen,
  onClose,
  cardToEdit,
  onSave,
  defaultNickname
}) => {
  const [username, setUsername] = useState(defaultNickname || '');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedColor, setSelectedColor] = useState<ColorOption>(NOTE_COLORS[0]);
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [compressing, setCompressing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load editing card properties
  useEffect(() => {
    if (cardToEdit) {
      setUsername(cardToEdit.username);
      setTitle(cardToEdit.title || '');
      setContent(cardToEdit.content || '');
      setSelectedColor(cardToEdit.color);
      setImageUrl(cardToEdit.imageUrl);
    } else {
      setUsername(defaultNickname || '');
      setTitle('');
      setContent('');
      setSelectedColor(NOTE_COLORS[0]);
      setImageUrl(undefined);
    }
  }, [cardToEdit, isOpen, defaultNickname]);

  if (!isOpen) return null;

  // Process / Compress selected image file
  const compressAndSetImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecciona un archivo de imagen válido.');
      return;
    }

    setCompressing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Enforce maximum dimensions: 640px wide or high
        const maxDim = 640;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Compress to lightweight JPEG base64 (approx 30kb-80kb)
          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.72);
          setImageUrl(base64Jpeg);
        }
        setCompressing(false);
      };
      img.onerror = () => {
        setCompressing(false);
        alert('No se pudo procesar la imagen elegida.');
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      setCompressing(false);
      alert('Error al leer el archivo.');
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) compressAndSetImage(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) compressAndSetImage(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && !imageUrl) {
      alert('Debes escribir un mensaje o subir una imagen en la nota.');
      return;
    }

    onSave({
      username: username.trim() || 'Anónimo',
      title: title.trim() || undefined,
      content: content.trim() || undefined,
      imageUrl,
      color: selectedColor
    });
  };

  return (
    <div className="fixed inset-0 z-200 bg-[#1a1512]/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" id="note-modal-overlay">
      <div className="bg-[#faf7f2] border border-neutral-200 w-full max-w-lg shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-150 rounded-lg overflow-hidden flex flex-col max-h-[92vh]" id="note-modal-box">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-[#faf7f2] shrink-0" id="note-modal-hdr">
          <h3 className="font-serif font-bold text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-600" />
            {cardToEdit ? 'Editar nota colaborativa' : 'Añadir nueva nota'}
          </h3>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-900 transition-colors" id="note-modal-close">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4" id="note-modal-form">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="note-modal-toprow">
            {/* Nickname input */}
            <div className="flex flex-col gap-1" id="nick-group">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Tu nombre / Apodo
              </label>
              <input
                type="text"
                required
                maxLength={25}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ej. Delfín Creativo"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs outline-hidden focus:border-[#1a1512] transition-colors font-sans text-neutral-800"
                id="pf-username"
              />
            </div>

            {/* Note title */}
            <div className="flex flex-col gap-1" id="title-group">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                Título (Opcional)
              </label>
              <input
                type="text"
                maxLength={45}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Idea para el proyecto"
                className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs outline-hidden focus:border-[#1a1512] transition-colors font-sans text-neutral-800"
                id="pf-title"
              />
            </div>
          </div>

          {/* Note content textarea */}
          <div className="flex flex-col gap-1" id="content-group">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Mensaje de la nota
            </label>
            <textarea
              maxLength={1000}
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Escribe libremente aquí..."
              className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs outline-hidden focus:border-[#1a1512] transition-colors resize-none font-sans text-neutral-800"
              id="pf-content"
            />
            <div className="flex justify-between items-center text-[9px] font-mono opacity-50 mt-1" id="char-validator">
              <span>* Se requiere texto o imagen</span>
              <span>{content.length}/1000</span>
            </div>
          </div>

          {/* Color palette selector */}
          <div className="flex flex-col gap-1.5" id="color-group">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Color de fondo de la tarjeta
            </label>
            <div className="flex flex-wrap gap-2" id="color-picker">
              {NOTE_COLORS.map((colOption) => (
                <button
                  key={colOption.name}
                  type="button"
                  onClick={() => setSelectedColor(colOption)}
                  className={`w-7 h-7 rounded-full border relative flex items-center justify-center transition-all ${
                    selectedColor.name === colOption.name
                      ? 'ring-2 ring-offset-1 ring-neutral-900 border-neutral-900 scale-105'
                      : 'border-black/[0.08] hover:scale-105'
                  }`}
                  style={{ backgroundColor: colOption.bg }}
                  title={colOption.name}
                  id={`color-swatch-${colOption.name}`}
                >
                  {selectedColor.name === colOption.name && (
                    <Check className={`w-3.5 h-3.5 ${colOption.isDark ? 'text-white' : 'text-neutral-900'}`} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Image Upload box */}
          <div className="flex flex-col gap-1" id="image-upload-group">
            <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
              Imagen de la nota (Opcional)
            </label>

            {compressing ? (
              <div className="border-2 border-dashed border-neutral-200 rounded-lg p-6 bg-white flex flex-col items-center justify-center gap-2" id="box-compressing">
                <div className="w-6 h-6 border-2 border-[#1a1512] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold text-neutral-600">Optimizando y reduciendo peso para P2P...</span>
              </div>
            ) : imageUrl ? (
              <div className="relative rounded-lg border border-neutral-200 overflow-hidden bg-neutral-100 max-h-44 flex items-center justify-center" id="box-preview">
                <img
                  src={imageUrl}
                  alt="Vista previa"
                  className="max-h-44 w-full object-contain"
                  referrerPolicy="no-referrer"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl(undefined)}
                  className="absolute top-2.5 right-2.5 bg-[#1a1512] hover:bg-rose-600 text-white rounded-full p-1.5 shadow-md transition-colors"
                  title="Eliminar imagen"
                  id="rm-img-btn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all bg-white select-none ${
                  dragOver
                    ? 'border-orange-500 bg-orange-50/10'
                    : 'border-neutral-200 hover:border-[#1a1512]'
                }`}
                id="drop-zone"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                  id="drop-file-input"
                />
                <UploadCloud className="w-8 h-8 mx-auto mb-2 text-neutral-400 opacity-60" />
                <p className="text-xs font-semibold text-neutral-700">
                  Haz clic o arrastra un archivo de imagen aquí
                </p>
                <p className="text-[10px] text-neutral-400 mt-1 uppercase font-mono">
                  Soporta cámara de fotos en dispositivos mviles
                </p>
              </div>
            )}
          </div>

          {/* Action buttons footer */}
          <div className="pt-3 border-t border-neutral-200 flex justify-end gap-2 shrink-0" id="note-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 hover:border-neutral-800 rounded-md text-xs font-bold uppercase tracking-wider text-neutral-700 hover:text-neutral-900 transition-all focus:outline-hidden"
              id="post-cancel"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={compressing}
              className={`px-4 py-2 bg-[#1a1512] hover:bg-orange-600 hover:shadow-md text-white rounded-md text-xs font-bold uppercase tracking-wider transition-all focus:outline-hidden ${
                compressing ? 'opacity-55 cursor-not-allowed' : ''
              }`}
              id="post-submit"
            >
              {cardToEdit ? 'Guardar cambios' : 'Publicar tarjeta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
