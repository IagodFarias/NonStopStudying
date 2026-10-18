import { Fragment, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, ListChecks, Moon, Sunrise, Zap } from 'lucide-react';
import { CARD, COLORS, ICON_BTN } from '../theme.js';
import { addDays, DAY_START_HOUR, formatClock, formatDayLabel, formatDuration, pad } from '../lib/time.js';
import { BLOCK_MS, BLOCKS_PER_DAY, buildTimeline, summarizeRange } from '../lib/stats.js';
import { ProgressBar, StatTile } from '../components/ui.jsx';

const PLANNER_MAX_OFFSET = 29;

function TimelineGrid({ cells, nowIndex }) {
  const currentHour = Math.floor(nowIndex / 6);
  return (
    <div className="grid grid-cols-[1.35rem_repeat(6,minmax(0,1fr))] items-center gap-[3px]">
      <span />
      {[10, 20, 30, 40, 50, 60].map((minute) => (
        <span key={minute} className="pb-0.5 text-center text-[9px] font-semibold text-muted/60">
          {minute}
        </span>
      ))}
      {Array.from({ length: 24 }, (_, hour) => (
        <Fragment key={hour}>
          <span className={`pr-1 text-right text-[10px] font-semibold tabular-nums ${hour === currentHour ? 'text-primary' : 'text-muted/70'}`}>
            {pad((DAY_START_HOUR + hour) % 24)}
          </span>
          {Array.from({ length: 6 }, (__, column) => {
            const index = hour * 6 + column;
            const future = index > nowIndex;
            return (
              <div
                key={column}
                className={`relative h-[18px] overflow-hidden rounded-[4px] ${future ? 'bg-shell/60' : 'bg-shell'} ${index === nowIndex ? 'ring-1 ring-primary' : ''}`}
              >
                {cells[index].map((segment, k) => (
                  <span
                    key={k}
                    className={`absolute inset-y-0 ${segment.live ? 'animate-pulse' : ''}`}
                    style={{ left: `${segment.left}%`, width: `${segment.width}%`, minWidth: 2, background: segment.color }}
                  />
                ))}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

export function PlannerScreen({ sessions, todayStart, now, subjects, subjectsById, tasks }) {
  const [offset, setOffset] = useState(0);
  const dayStart = addDays(todayStart, -offset);
  const dayEnd = addDays(dayStart, 1);
  const summary = useMemo(() => summarizeRange(sessions, dayStart, dayEnd), [sessions, dayStart, dayEnd]);
  const cells = useMemo(() => buildTimeline(sessions, dayStart, (id) => subjectsById[id]?.color ?? COLORS.muted), [sessions, dayStart, subjectsById]);
  const nowIndex = offset === 0 ? Math.floor((now - dayStart) / BLOCK_MS) : BLOCKS_PER_DAY;
  const planned = tasks.filter((t) => !t.parentId && t.inToday && !t.archived);
  const plannedDone = planned.filter((t) => t.done).length;
  const legend = subjects
    .map((s) => ({ ...s, seconds: summary.bySubject[s.id] ?? 0 }))
    .filter((s) => s.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds);
  const title = offset === 0 ? 'Hoje' : offset === 1 ? 'Ontem' : `${offset} dias atrás`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(PLANNER_MAX_OFFSET, o + 1))}
          disabled={offset >= PLANNER_MAX_OFFSET}
          aria-label="Dia anterior"
          className={ICON_BTN}
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-fg">{title}</p>
          <p className="text-[11px] text-muted">{formatDayLabel(dayStart)} · 05:00 → 04:59</p>
        </div>
        <button type="button" onClick={() => setOffset((o) => Math.max(0, o - 1))} disabled={offset === 0} aria-label="Próximo dia" className={ICON_BTN}>
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-3">
        <div className="space-y-2.5">
          <StatTile icon={Sunrise} label="Início" value={summary.first ? formatClock(summary.first) : '--:--'} hint="1º estudo do dia" />
          <StatTile
            icon={Moon}
            label="Término"
            value={summary.lastLive ? 'Agora' : summary.last ? formatClock(summary.last) : '--:--'}
            hint={summary.lastLive ? 'sessão em andamento' : 'último registro'}
            accent={summary.lastLive}
          />
          <StatTile icon={Zap} label="Maior foco" value={formatDuration(summary.longest)} hint="foco contínuo" accent />
          <StatTile icon={Clock} label="Total" value={formatDuration(summary.total)} hint={`${summary.count} ${summary.count === 1 ? 'sessão' : 'sessões'}`} />
          <div className={`${CARD} p-3`}>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
              <ListChecks size={12} /> Planejado hoje
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-fg">
              {plannedDone}/{planned.length}
            </p>
            <ProgressBar value={planned.length ? plannedDone / planned.length : 0} className="mt-1.5" />
            <ul className="mt-2.5 space-y-1.5">
              {subjects
                .map((s) => ({ ...s, list: planned.filter((t) => t.subjectId === s.id) }))
                .filter((s) => s.list.length)
                .map((s) => (
                  <li key={s.id} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="tabular-nums">
                      {s.list.filter((t) => t.done).length}/{s.list.length}
                    </span>
                  </li>
                ))}
            </ul>
          </div>
          {legend.length > 0 && (
            <div className={`${CARD} p-3`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Matérias do dia</p>
              <ul className="mt-2 space-y-1.5">
                {legend.map((s) => (
                  <li key={s.id} className="flex items-center gap-1.5 text-[11px]">
                    <span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-fg/85">{s.name}</span>
                    <span className="tabular-nums text-muted">{formatDuration(s.seconds)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={`${CARD} self-start p-2.5`}>
          <TimelineGrid cells={cells} nowIndex={nowIndex} />
        </div>
      </div>
    </div>
  );
}
