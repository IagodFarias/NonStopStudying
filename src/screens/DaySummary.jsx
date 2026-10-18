import { CircleCheck, Clock, Sun, Zap } from 'lucide-react';
import { COLORS, LABEL, PRIMARY_BTN, SECONDARY_BTN } from '../theme.js';
import { addDays, formatDayLabel, formatDuration } from '../lib/time.js';
import { Modal, ProgressBar, StatTile } from '../components/ui.jsx';

// Fechamento do dia no estilo Super Productivity: o que foi feito, quanto tempo e em quais matérias.
export function DaySummaryModal({ dayStart, summary, subjectsById, tasks, taskSeconds, onFinish, onClose }) {
  const dayEnd = addDays(dayStart, 1);
  const completed = tasks.filter((t) => t.doneAt && t.doneAt >= dayStart && t.doneAt < dayEnd).sort((a, b) => a.doneAt - b.doneAt);
  const plannedToday = tasks.filter((t) => !t.parentId && t.inToday && !t.archived);
  const pending = plannedToday.filter((t) => !t.done);
  const doneInToday = plannedToday.length - pending.length;
  const bySubject = Object.entries(summary.bySubject)
    .map(([id, seconds]) => ({ id, seconds, subject: subjectsById[id] }))
    .sort((a, b) => b.seconds - a.seconds);

  return (
    <Modal title="Resumo do dia" subtitle={formatDayLabel(dayStart)} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2.5">
        <StatTile icon={Clock} label="Tempo focado" value={formatDuration(summary.total)} hint={`${summary.count} ${summary.count === 1 ? 'sessão' : 'sessões'}`} accent />
        <StatTile icon={CircleCheck} label="Concluídas" value={completed.length} hint="tarefas e subtarefas" />
        <StatTile icon={Zap} label="Maior foco" value={formatDuration(summary.longest)} hint="foco contínuo" />
        <StatTile icon={Sun} label="Para amanhã" value={pending.length} hint="seguem planejadas" />
      </div>

      <section className="mt-5">
        <p className={LABEL}>Divisão por matéria</p>
        {bySubject.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-5 text-center text-xs text-muted">Nenhum tempo registrado hoje.</p>
        ) : (
          <ul className="space-y-2.5">
            {bySubject.map(({ id, seconds, subject }) => (
              <li key={id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-1.5 text-fg/90">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: subject?.color ?? COLORS.muted }} />
                    <span className="truncate">{subject?.name ?? 'Matéria removida'}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatDuration(seconds)} · {Math.round((seconds / summary.total) * 100)}%
                  </span>
                </div>
                <ProgressBar value={seconds / summary.total} color={subject?.color ?? COLORS.muted} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-5">
        <p className={LABEL}>Concluídas hoje</p>
        {completed.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line py-5 text-center text-xs text-muted">Nenhuma tarefa concluída hoje.</p>
        ) : (
          <ul className="space-y-1.5">
            {completed.map((task) => (
              <li key={task.id} className="flex items-center gap-2.5 rounded-xl bg-card px-3 py-2 text-sm">
                <CircleCheck size={16} className="shrink-0 text-online" />
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subjectsById[task.subjectId]?.color ?? COLORS.muted }} />
                <span className="min-w-0 flex-1 truncate text-fg/90">{task.title}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(taskSeconds[task.id] ?? 0)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-5 text-xs text-muted">
        Ao encerrar, {doneInToday === 1 ? 'a tarefa concluída sai de "Hoje" e vai' : `as ${doneInToday} tarefas concluídas saem de "Hoje" e vão`} para o arquivo. As pendentes continuam planejadas.
      </p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className={`${SECONDARY_BTN} flex-1`}>
          Voltar
        </button>
        <button type="button" onClick={onFinish} className={`${PRIMARY_BTN} flex-1`}>
          Encerrar o dia
        </button>
      </div>
    </Modal>
  );
}
