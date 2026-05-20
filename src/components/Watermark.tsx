import React from 'react';

interface WatermarkProps {
  darkBg?: boolean;
}

export const Watermark: React.FC<WatermarkProps> = ({ darkBg = false }) => {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: 700,
        fontStyle: 'italic',
        fontSize: 'clamp(2rem, 5vw, 4rem)',
        color: darkBg ? 'rgba(255, 255, 255, 0.05)' : 'rgba(26, 21, 18, 0.04)',
        zIndex: 0,
        pointerEvents: 'none',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
      id="board-watermark"
    >
      GmedranoTIC
    </div>
  );
};
