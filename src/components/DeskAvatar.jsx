import { useId } from 'react';
import { COLORS } from '../theme.js';

const SKIN = '#E2E8F0';
const DESK = '#2B3B5C';
const DESK_LEG = '#22304D';

// Ilustração da grade ao vivo do Modo Estudo: alguém sentado à mesa com a chama acesa, ou a cadeira vazia.
export function DeskAvatar({ studying, color = COLORS.primary, size = 60 }) {
  const uid = useId().replace(/:/g, '');

  if (!studying) {
    return (
      <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
        {/* mesa apagada, com livro fechado e luminária desligada */}
        <rect x="3" y="36" width="41" height="4.5" rx="2" fill={COLORS.muted} fillOpacity="0.3" />
        <rect x="7" y="40.5" width="3" height="19.5" rx="1.5" fill={COLORS.muted} fillOpacity="0.22" />
        <rect x="37" y="40.5" width="3" height="19.5" rx="1.5" fill={COLORS.muted} fillOpacity="0.22" />
        <rect x="10" y="32.5" width="13" height="3.5" rx="1" fill={COLORS.muted} fillOpacity="0.35" />
        <path d="M33 36v-9l5-4" fill="none" stroke={COLORS.muted} strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
        <path d="M35.5 21.5 41.8 23l-3.2 4.6z" fill={COLORS.muted} fillOpacity="0.35" />
        {/* cadeira vazia, afastada da mesa (vista de lado) */}
        <rect x="55.5" y="20" width="4.5" height="15" rx="2" fill={COLORS.muted} fillOpacity="0.3" />
        <path d="M58 21v23H47M58 44v15M47 44v15" fill="none" stroke={COLORS.muted} strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" overflow="visible">
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={COLORS.flame} stopOpacity="0.55" />
          <stop offset="55%" stopColor={COLORS.amber} stopOpacity="0.18" />
          <stop offset="100%" stopColor={COLORS.amber} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-flame`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={COLORS.flame} />
          <stop offset="70%" stopColor={COLORS.amber} />
          <stop offset="100%" stopColor="#FDE68A" />
        </linearGradient>
      </defs>
      {/* brilho da chama ao redor */}
      <circle className="ypt-glow-svg" cx="32" cy="28" r="31" fill={`url(#${uid}-glow)`} />
      {/* cadeira, corpo e cabeça */}
      <rect x="19" y="22" width="26" height="18" rx="5" fill={COLORS.line} />
      <rect x="21.5" y="28" width="21" height="14" rx="7" fill={color} />
      <circle cx="32" cy="21" r="6.5" fill={SKIN} />
      {/* mesa, livro aberto e mãos */}
      <rect x="6" y="40" width="52" height="5" rx="2" fill={DESK} />
      <rect x="10" y="45" width="3" height="15" rx="1.5" fill={DESK_LEG} />
      <rect x="51" y="45" width="3" height="15" rx="1.5" fill={DESK_LEG} />
      <path d="M23.5 40 32 37.2 40.5 40Z" fill={COLORS.amber} />
      <circle cx="23" cy="39.5" r="2.2" fill={SKIN} />
      <circle cx="41" cy="39.5" r="2.2" fill={SKIN} />
      {/* chama acesa */}
      <path
        className="ypt-flicker-svg"
        d="M51 1c3.4 4 6 6.8 6 10a6 6 0 0 1-12 0c0-2.2 1.2-3.9 2.4-5.3.5 1.5 1.4 2.5 2.5 2.8-.7-2.4-.2-4.9 1.1-7.5z"
        fill={`url(#${uid}-flame)`}
      />
    </svg>
  );
}
