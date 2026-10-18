// Identidade "Obsidian Dark". As mesmas cores existem como tokens do Tailwind em index.css
// (bg-ink, bg-shell, bg-surface, bg-card, text-muted, bg-primary…); aqui ficam as versões em JS
// para estilos inline, gráficos e SVG.
export const COLORS = {
  ink: '#06080D',
  shell: '#0B0F19',
  surface: '#101624',
  card: '#182135',
  raised: '#1F2A44',
  line: '#26324D',
  primary: '#2480F0',
  online: '#10B981',
  flame: '#FF6B00',
  amber: '#F59E0B',
  fg: '#FFFFFF',
  muted: '#8A9CAE',
  danger: '#F43F5E',
};

export const SUBJECT_PALETTE = ['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4', '#84CC16', '#F43F5E'];
export const SQUAD_PALETTE = ['#3B82F6', '#22C55E', '#A855F7', '#F59E0B', '#EC4899', '#06B6D4'];
export const MEDAL_COLORS = { 1: '#FCD34D', 2: '#CBD5E1', 3: '#D97706' };

export const CARD = 'rounded-2xl border border-line bg-card';
export const PANEL = 'rounded-2xl border border-line bg-shell';
export const INPUT_BASE =
  'w-full rounded-xl border border-line bg-card px-3 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-primary';
export const INPUT = `${INPUT_BASE} py-2.5`;
// input dentro de um card: um degrau mais escuro para não sumir no fundo
export const INSET_INPUT =
  'w-full rounded-xl border border-line bg-shell px-3 py-2 text-sm text-fg placeholder:text-muted/70 outline-none transition focus:border-primary';
export const LABEL = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted';
export const ICON_BTN =
  'grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-white/5 hover:text-fg disabled:pointer-events-none disabled:opacity-30';
export const PRIMARY_BTN =
  'flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-40';
export const SECONDARY_BTN =
  'flex items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-fg/85 transition hover:bg-raised disabled:opacity-40';
