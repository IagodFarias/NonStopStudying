import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crown, Flame, Loader2, Pause, Play, X } from 'lucide-react';
import { CARD, COLORS, ICON_BTN, MEDAL_COLORS } from '../theme.js';
import { clamp, initialsOf, makeId, withAlpha } from '../lib/misc.js';

/* ---------------------------------- Hooks --------------------------------- */

const escapeStack = [];

// Fecha a camada aberta mais acima (usado pelo "voltar" do Android). Devolve false se não havia nenhuma.
export function closeTopLayer() {
  const top = escapeStack[escapeStack.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

// Esc fecha apenas a camada do topo (modal sobre modal, Modo Estudo etc.).
export function useEscapeKey(onEscape) {
  const handlerRef = useRef(onEscape);
  handlerRef.current = onEscape;
  useEffect(() => {
    const entry = { close: () => handlerRef.current() };
    escapeStack.push(entry);
    const onKey = (event) => {
      if (event.key !== 'Escape' || escapeStack[escapeStack.length - 1] !== entry) return;
      event.preventDefault();
      entry.close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      const index = escapeStack.indexOf(entry);
      if (index !== -1) escapeStack.splice(index, 1);
    };
  }, []);
}

export function useBodyScrollLock() {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
}

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = useCallback((text, tone = 'default') => {
    const id = makeId('toast');
    setToasts((list) => [...list.slice(-2), { id, text, tone }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), 3800);
  }, []);
  return [toasts, push];
}

// Só liga depois de `delay` ms seguidos com valor verdadeiro (evita piscar avisos de conexão).
export function useDelayedFlag(value, delay) {
  const [flag, setFlag] = useState(false);
  useEffect(() => {
    if (!value) {
      setFlag(false);
      return undefined;
    }
    const id = window.setTimeout(() => setFlag(true), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return flag;
}

/* --------------------------------- Camadas -------------------------------- */

const MODAL_LAYERS = { base: 'z-[60]', elevated: 'z-[70]', focus: 'z-[85]' };

export function Modal({ title, subtitle, onClose, layer = 'base', children }) {
  useEscapeKey(onClose);
  useBodyScrollLock();
  return (
    <div className={`fixed inset-0 flex items-end justify-center sm:items-center sm:p-6 ${MODAL_LAYERS[layer]}`}>
      <div className="ypt-fade-in absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="ypt-sheet relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-line bg-surface px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-fg">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className={ICON_BTN}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', tone = 'danger', onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel} layer="elevated">
      <p className="text-sm leading-relaxed text-fg/80">{message}</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-fg/85 transition hover:bg-raised">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm();
            onCancel();
          }}
          className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition hover:brightness-110 ${tone === 'danger' ? 'bg-danger' : 'bg-primary'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

const TOAST_PLACEMENT = {
  bottom: 'bottom-[calc(5.5rem_+_env(safe-area-inset-bottom))]',
  chat: 'bottom-[calc(9.5rem_+_env(safe-area-inset-bottom))]',
  top: 'top-[max(1rem,env(safe-area-inset-top))]',
  focus: 'bottom-[max(1.5rem,env(safe-area-inset-bottom))]', // no Modo Estudo, longe do cronômetro grande
};

const TOAST_TONES = {
  default: 'border-line bg-card/95 text-fg',
  gold: 'border-amber/40 bg-[#2A2110]/95 text-[#FDE68A]',
  error: 'border-danger/40 bg-[#2A1220]/95 text-rose-200',
};

export function Toasts({ toasts, placement }) {
  return (
    <div aria-live="polite" className={`pointer-events-none fixed inset-x-0 z-[90] flex flex-col items-center gap-2 px-4 ${TOAST_PLACEMENT[placement]}`}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`ypt-toast max-w-sm rounded-xl border px-4 py-2.5 text-center text-xs font-medium shadow-2xl backdrop-blur ${TOAST_TONES[toast.tone] ?? TOAST_TONES.default}`}
        >
          {toast.text}
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- Básicos -------------------------------- */

export function ProgressBar({ value, color = COLORS.primary, className = '', thick = false }) {
  return (
    <div className={`${thick ? 'h-2' : 'h-1.5'} w-full overflow-hidden rounded-full bg-shell ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${clamp(value, 0, 1) * 100}%`, background: color }} />
    </div>
  );
}

export function Segmented({ value, onChange, options, compact = false }) {
  return (
    <div className="grid rounded-xl bg-shell p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`truncate rounded-lg font-semibold transition ${compact ? 'px-2 py-1.5 text-[11px]' : 'px-3 py-2 text-xs'} ${
            value === option.value ? 'bg-primary text-white shadow' : 'text-muted hover:text-fg'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-primary' : 'bg-line'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function ColorPicker({ palette, value, onChange, small = false }) {
  return (
    <div className="flex flex-wrap gap-2">
      {palette.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-label={`Cor ${color}`}
          aria-pressed={value === color}
          className={`grid place-items-center rounded-full transition ${small ? 'h-6 w-6' : 'h-8 w-8'} ${
            value === color ? 'ring-2 ring-white ring-offset-2 ring-offset-surface' : 'hover:scale-110'
          }`}
          style={{ background: color }}
        >
          {value === color && <Check size={small ? 12 : 14} strokeWidth={3} className="text-white" />}
        </button>
      ))}
    </div>
  );
}

export function PlayButton({ active, onClick, label, size = 'md', color = COLORS.primary }) {
  const dims = { sm: 'h-8 w-8', md: 'h-11 w-11', lg: 'h-14 w-14' }[size];
  const icon = { sm: 14, md: 18, lg: 24 }[size];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`relative grid ${dims} shrink-0 place-items-center rounded-full transition active:scale-95`}
      style={active ? { background: COLORS.flame, color: '#FFFFFF' } : { background: withAlpha(color, 0.16), color }}
    >
      {active && <span className="absolute inset-0 animate-ping rounded-full bg-flame opacity-25" />}
      {active ? <Pause size={icon} fill="currentColor" className="relative" /> : <Play size={icon} fill="currentColor" className="relative ml-0.5" />}
    </button>
  );
}

export function CheckButton({ checked, onClick, label, color = COLORS.primary, small = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={checked}
      className={`grid shrink-0 place-items-center rounded-full border-2 transition ${small ? 'h-[18px] w-[18px]' : 'h-[22px] w-[22px]'}`}
      style={checked ? { background: color, borderColor: color } : { borderColor: withAlpha(COLORS.muted, 0.7) }}
    >
      {checked && <Check size={small ? 11 : 13} strokeWidth={3.5} className="text-white" />}
    </button>
  );
}

export function StatTile({ icon: Icon, label, value, hint, accent = false }) {
  return (
    <div className={`${CARD} p-3`}>
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
        <Icon size={12} className={accent ? 'text-flame' : ''} />
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold leading-tight tabular-nums ${accent ? 'text-flame' : 'text-fg'}`}>{value}</p>
      {hint && <p className="truncate text-[10px] text-muted/80">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, hint, children }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="flex shrink-0 items-center gap-2 text-base font-bold text-fg">
        <Icon size={17} className="text-primary" />
        {title}
      </h2>
      {hint && <p className="truncate text-[11px] text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export function Avatar({ name, color, size = 32 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.38, background: withAlpha(color, 0.18), color }}
    >
      {initialsOf(name)}
    </span>
  );
}

export function SquadBadge({ squad, size = 40 }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-xl font-black text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: `linear-gradient(135deg, ${squad.color}, ${withAlpha(squad.color, 0.55)})`,
        boxShadow: `0 6px 18px -6px ${withAlpha(squad.color, 0.7)}`,
      }}
    >
      {initialsOf(squad.name)}
    </span>
  );
}

export function ActiveBadge({ active, total }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        active > 0 ? 'bg-flame/15 text-flame' : 'bg-shell text-muted'
      }`}
    >
      <Flame size={12} className={active > 0 ? 'ypt-flicker' : ''} fill={active > 0 ? 'currentColor' : 'none'} />
      {active}/{total} ativos
    </span>
  );
}

export function FlameStatus({ active }) {
  if (!active) {
    return (
      <span className="grid h-9 w-9 place-items-center rounded-full bg-shell" title="Não está estudando">
        <Flame size={18} className="text-muted/50" />
      </span>
    );
  }
  return (
    <span className="relative grid h-9 w-9 place-items-center rounded-full bg-flame/15" title="Estudando agora">
      <span className="absolute inset-1 rounded-full bg-flame/30 blur-md" />
      <Flame size={18} className="ypt-flicker relative text-flame" fill={COLORS.amber} fillOpacity={0.6} />
    </span>
  );
}

export function RankMedal({ rank }) {
  const color = MEDAL_COLORS[rank];
  return (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black"
      style={{ background: color ? withAlpha(color, 0.16) : COLORS.shell, color: color ?? COLORS.muted }}
      aria-label={`${rank}º lugar`}
    >
      {rank === 1 ? <Crown size={16} /> : `${rank}º`}
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-online/15 px-2.5 py-1 text-[10px] font-black tracking-wider text-online">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-online opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-online" />
      </span>
      AO VIVO
    </span>
  );
}

export function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-shell/95 px-3 py-2 text-xs shadow-xl">
      {label !== undefined && label !== '' && <p className="mb-1 font-semibold text-fg">{label}</p>}
      {payload.map((item) => (
        <p key={`${item.dataKey}-${item.name}`} className="flex items-center gap-2 text-fg/80">
          <span className="h-2 w-2 rounded-full" style={{ background: item.payload?.color ?? item.color ?? item.fill ?? COLORS.primary }} />
          {item.name}: <span className="font-semibold tabular-nums text-fg">{format(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function LoadingBlock({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted">
      <Loader2 size={24} className="animate-spin text-primary" />
      {label}
    </div>
  );
}
