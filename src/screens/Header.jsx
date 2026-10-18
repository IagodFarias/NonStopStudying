import { ChartPie, ChevronDown, LayoutGrid, Maximize2, MessageCircle, Timer, Users } from 'lucide-react';
import { ddayInfo, formatDayLabel, formatHMS, getStudyDayStart, SECOND } from '../lib/time.js';

export const TABS = [
  { id: 'home', label: 'Hoje', icon: Timer },
  { id: 'planner', label: 'Planner', icon: LayoutGrid },
  { id: 'stats', label: 'Estatísticas', icon: ChartPie },
  { id: 'groups', label: 'Grupos', icon: Users },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
];

function statusLine({ activeSubject, activeTask, sessionSeconds, timerMode, pomodoro, now }) {
  const countdown = pomodoro.endsAt ? formatHMS(Math.ceil((pomodoro.endsAt - now) / SECOND)) : null;
  if (activeSubject) {
    return (
      <>
        <span className="font-semibold" style={{ color: activeSubject.color }}>
          {activeTask ? activeTask.title : activeSubject.name}
        </span>
        {timerMode === 'pomodoro' && countdown ? ` · 🍅 ${countdown}` : ` · sessão ${formatHMS(sessionSeconds)}`}
      </>
    );
  }
  if (timerMode === 'pomodoro' && pomodoro.phase === 'break' && countdown) return `☕ Pausa · ${countdown}`;
  return 'Toque ▶ numa tarefa ou matéria para começar';
}

export function Header({ now, totalSeconds, activeSubject, activeTask, sessionSeconds, timerMode, pomodoro, dday, onOpenDday, onOpenFocus }) {
  const info = dday ? ddayInfo(dday.date, now) : null;
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-ink/95 backdrop-blur-md">
      <div className="mx-auto max-w-2xl px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenDday}
            className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-shell py-1 pl-1 pr-3 text-xs transition hover:border-primary/50"
          >
            <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 font-black tracking-wide text-white">{info ? info.label : 'D-?'}</span>
            <span className="truncate font-medium text-fg/85">{dday ? dday.title : 'Definir D-Day'}</span>
            <ChevronDown size={14} className="shrink-0 text-muted" />
          </button>
          <div className="flex shrink-0 items-center gap-2">
            {activeSubject ? (
              <span className="flex items-center gap-1.5 rounded-full bg-online/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-online">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-online opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-online" />
                </span>
                Em foco
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-shell px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                <span className="h-2 w-2 rounded-full bg-muted/50" />
                Pausado
              </span>
            )}
            <button
              type="button"
              onClick={onOpenFocus}
              aria-label="Abrir Modo Estudo"
              title="Modo Estudo (tela cheia)"
              className={`grid h-8 w-8 place-items-center rounded-full transition hover:brightness-110 ${
                activeSubject ? 'bg-primary text-white shadow-[0_0_18px_-4px_rgba(36,128,240,0.9)]' : 'bg-shell text-muted'
              }`}
            >
              <Maximize2 size={15} />
            </button>
          </div>
        </div>
        <div className="mt-2 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-muted">Total de hoje · {formatDayLabel(getStudyDayStart(now))}</p>
          <p className="mt-1 font-mono text-[2.4rem] font-bold leading-none tracking-tight text-fg tabular-nums">{formatHMS(totalSeconds)}</p>
          <p className="mt-1.5 truncate text-xs text-muted">{statusLine({ activeSubject, activeTask, sessionSeconds, timerMode, pomodoro, now })}</p>
        </div>
      </div>
    </header>
  );
}

export function BottomNav({ tab, onChange, studying, studyingNow, unread }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map(({ id, label, icon: Icon }) => {
          const selected = tab === id;
          const badge = id === 'groups' ? studyingNow : id === 'chat' ? unread : 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={selected ? 'page' : undefined}
              aria-label={badge > 0 ? `${label} (${badge})` : label}
              className={`relative flex min-w-0 flex-col items-center gap-1 px-1 pb-2.5 pt-3 text-[10.5px] font-semibold transition ${
                selected ? 'text-primary' : 'text-muted hover:text-fg'
              }`}
            >
              {selected && <span className="absolute top-0 h-0.5 w-9 rounded-full bg-primary" />}
              <span className="relative">
                <Icon size={22} strokeWidth={selected ? 2.4 : 2} />
                {id === 'home' && studying && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-flame ring-2 ring-ink" />}
                {badge > 0 && (
                  <span
                    className={`absolute -right-3 -top-1.5 min-w-4 rounded-full px-1 text-center text-[9px] font-black leading-4 text-white ${
                      id === 'chat' ? 'bg-danger' : 'bg-flame'
                    }`}
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
