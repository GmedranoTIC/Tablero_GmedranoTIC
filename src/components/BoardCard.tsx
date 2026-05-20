import React, { useState, useEffect, useRef } from 'react';
import { Heart, MessageSquare, Trash2, Edit, Send, Clock, ZoomIn } from 'lucide-react';
import { Note, CommentItem, LayoutMode } from '../types';

interface BoardCardProps {
  card: Note;
  layoutMode: LayoutMode;
  isEditor: boolean;
  onLike: (id: string) => void;
  onComment: (id: string, comment: CommentItem) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onDrag: (id: string, x: number, y: number, zIndex?: number) => void;
  onDragEnd: (id: string) => void;
  userNickname: string;
}

export const BoardCard: React.FC<BoardCardProps> = ({
  card,
  layoutMode,
  isEditor,
  onLike,
  onComment,
  onEdit,
  onDelete,
  onDrag,
  onDragEnd,
  userNickname
}) => {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [timeLeft, setTimeLeft] = useState<string>('');
  const cardRef = useRef<HTMLDivElement>(null);

  // Expiry Timer Calculation
  useEffect(() => {
    const calculateTimeLeft = () => {
      const createdTime = new Date(card.createdAt).getTime();
      const expiryTime = createdTime + 24 * 60 * 60 * 1000;
      const diff = expiryTime - Date.now();

      if (diff <= 0) {
        setTimeLeft('Expirado');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 60000); // refresh every minute
    return () => clearInterval(interval);
  }, [card.createdAt]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (layoutMode !== 'canvas' || !isEditor) return;
    // Prevent trigger if clicking details inside active forms/buttons
    if ((e.target as HTMLElement).closest('button, input, textarea, form, .comment-item, .comments-list')) {
      return;
    }

    const cardEl = cardRef.current;
    if (!cardEl) return;

    const parentEl = cardEl.parentElement;
    if (!parentEl) return;

    e.preventDefault();

    const parentRect = parentEl.getBoundingClientRect();
    const cardRect = cardEl.getBoundingClientRect();

    const offsetLeft = e.clientX - cardRect.left;
    const offsetTop = e.clientY - cardRect.top;

    // Bring to front
    // Find highest zIndex in peers or increment local state
    const currentMaxZ = Math.max(
      ...Array.from(parentEl.querySelectorAll('.post-card')).map(
        (el) => parseInt((el as HTMLElement).style.zIndex || '10') || 10
      ),
      10
    );
    const targetZ = currentMaxZ + 1;

    // Call callback to bring card on top of P2P network
    onDrag(card.id, card.x, card.y, targetZ);

    const handlePointerMove = (moveEv: PointerEvent) => {
      let xPx = moveEv.clientX - parentRect.left - offsetLeft;
      let yPx = moveEv.clientY - parentRect.top - offsetTop;

      const maxX = parentRect.width - cardRect.width;
      const maxY = parentRect.height - cardRect.height;

      // Constrain inside bounding canvas
      xPx = Math.max(0, Math.min(xPx, maxX));
      yPx = Math.max(0, Math.min(yPx, maxY));

      const xPct = parentRect.width > 0 ? (xPx / parentRect.width) * 100 : 0;
      const yPct = parentRect.height > 0 ? (yPx / parentRect.height) * 100 : 0;

      onDrag(card.id, xPct, yPct, targetZ);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      onDragEnd(card.id);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment: CommentItem = {
      id: `comm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: userNickname.trim() || 'Colaborador',
      content: commentText.trim(),
      createdAt: new Date().toISOString()
    };

    onComment(card.id, newComment);
    setCommentText('');
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: card.color.bg,
    borderColor: card.color.border,
    color: card.color.text,
  };

  return (
    <div
      ref={cardRef}
      onPointerDown={handlePointerDown}
      className={`post-card group flex flex-col border rounded-xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 ${
        layoutMode === 'canvas'
          ? 'absolute w-64 md:w-72 lg:w-80 cursor-grab active:cursor-grabbing select-none'
          : 'w-full'
      }`}
      style={{
        ...cardStyle,
        ...(layoutMode === 'canvas'
          ? {
              left: `${card.x}%`,
              top: `${card.y}%`,
              zIndex: card.zIndex || 10
            }
          : {})
      }}
      data-card-id={card.id}
      id={`card-${card.id}`}
    >
      {/* Top Meta info */}
      <div className="px-3.5 py-2 flex items-center justify-between border-b border-black/5 bg-black/2 select-none" id={`card-hdr-${card.id}`}>
        <span className="text-[10px] font-bold tracking-wider uppercase opacity-60 truncate max-w-[60%]">
          ✍️ {card.username || 'Anónimo'}
        </span>
        <span className="flex items-center gap-1 text-[9px] font-mono font-semibold opacity-50">
          <Clock className="w-3 h-3" />
          {timeLeft}
        </span>
      </div>

      {/* Embedded Optional Image */}
      {card.imageUrl && (
        <div className="relative overflow-hidden group/image border-b border-black/5 bg-black/5 flex justify-center items-center h-48 select-none" id={`card-img-wrap-${card.id}`}>
          <img
            src={card.imageUrl}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover/image:scale-104 pointer-events-none"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/image:opacity-100 flex items-center justify-center transition-opacity duration-200">
            <span className="text-white text-xs font-semibold gap-1.5 flex items-center bg-black/60 px-2.5 py-1.5 rounded-full backdrop-blur-xs shadow-md">
              <ZoomIn className="w-3.5 h-3.5" /> Ampliar imagen
            </span>
          </div>
          {/* Invisible trigger over the whole wrapper that does not block dragging */}
          <button
            type="button"
            className="absolute inset-0 w-full h-full cursor-zoom-in"
            onClick={(e) => {
              e.stopPropagation();
              // Create dynamic global micro zoom event
              window.dispatchEvent(new CustomEvent('zoom-image', { detail: card.imageUrl }));
            }}
          />
        </div>
      )}

      {/* Main text content body */}
      <div className="p-4 flex-1 select-text" id={`card-body-${card.id}`}>
        {card.title && (
          <h4 className="font-serif font-bold text-base leading-tight mb-2 tracking-tight">
            {card.title}
          </h4>
        )}
        {card.content && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words opacity-90 font-sans">
            {card.content}
          </p>
        )}
      </div>

      {/* Action buttons footer */}
      <div className="px-3 py-2 border-t border-black/5 flex items-center justify-between bg-black/[0.01] select-none" id={`card-footer-${card.id}`}>
        <div className="flex items-center gap-1" id={`card-actions-${card.id}`}>
          {/* Like */}
          <button
            onClick={() => onLike(card.id)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-black/5 transition-colors focus:outline-hidden"
            title="Me gusta"
            id={`like-btn-${card.id}`}
          >
            <Heart className={`w-3.5 h-3.5 ${card.likes > 0 ? 'fill-rose-500 text-rose-500' : 'opacity-60'}`} />
            <span className="font-mono font-bold">{card.likes}</span>
          </button>

          {/* Comment Counter */}
          <button
            onClick={() => setShowComments(!showComments)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs hover:bg-black/5 transition-colors focus:outline-hidden ${
              showComments ? 'bg-black/5 font-semibold' : ''
            }`}
            title="Comentarios"
            id={`comment-toggle-btn-${card.id}`}
          >
            <MessageSquare className="w-3.5 h-3.5 opacity-60" />
            <span className="font-mono font-bold">{card.comments.length}</span>
          </button>
        </div>

        {/* Editor controls: Edit & Delete */}
        {isEditor && (
          <div className="flex items-center gap-0.5 opacity-40 hover:opacity-100 transition-opacity" id={`card-editor-btn-set-${card.id}`}>
            <button
              onClick={() => onEdit(card.id)}
              className="p-1.5 rounded-md hover:bg-black/5 hover:text-blue-600 transition-colors"
              title="Editar tarjeta"
              id={`edit-btn-${card.id}`}
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDelete(card.id)}
              className="p-1.5 rounded-md hover:bg-black/5 hover:text-rose-600 transition-colors"
              title="Eliminar tarjeta"
              id={`delete-btn-${card.id}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Expandable Comments Drawer */}
      {showComments && (
        <div className="border-t border-black/5 bg-black/[0.02]" id={`card-comments-pane-${card.id}`}>
          {/* Comment list */}
          <div className="max-h-40 overflow-y-auto px-4 py-2 flex flex-col gap-2 border-b border-black/5" id={`card-comments-list-${card.id}`}>
            {card.comments.length === 0 ? (
              <p className="text-[11px] italic opacity-40 py-2 text-center select-none">Sin comentarios aún.</p>
            ) : (
              card.comments.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-white/70 p-2 rounded-lg border border-black/[0.04] text-xs shadow-xs"
                  id={`comment-${comm.id}`}
                >
                  <div className="flex justify-between items-center text-[9px] font-bold uppercase opacity-50 mb-1" id={`comment-meta-${comm.id}`}>
                    <span>{comm.username}</span>
                    <span>
                      {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="leading-tight text-gray-800 break-words font-sans">{comm.content}</p>
                </div>
              ))
            )}
          </div>

          {/* Comment input form */}
          <form onSubmit={handleCommentSubmit} className="p-2 flex gap-1.5" id={`card-comment-form-${card.id}`}>
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Escribe un comentario..."
              maxLength={200}
              className="flex-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs outline-hidden focus:border-brand-color focus:ring-1 focus:ring-brand-color/25 text-[#1a1512]"
              id={`card-comment-input-${card.id}`}
            />
            <button
              type="submit"
              className="p-1 px-2 bg-[#1a1512] hover:bg-orange-600 text-white rounded-md flex items-center justify-center transition-colors shadow-xs"
              id={`card-comment-submit-${card.id}`}
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
