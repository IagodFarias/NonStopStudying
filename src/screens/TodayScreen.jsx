import { useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronRight, Coffee, ListChecks, Maximize2, NotebookPen, Pencil, Plus, Settings2, Sun, Timer, Users } from 'lucide-react';
import { CARD, COLORS, INSET_INPUT, PRIMARY_BTN, SECONDARY_BTN } from '../theme.js';
import { formatDuration, formatHMS, SECOND } from '../lib/time.js';
import { byCreated, sum, withAlpha } from '../lib/misc.js';
import { ActiveBadge, CheckButton, PlayButton, ProgressBar, Segmented, SquadBadge } from '../components/ui.jsx';

const SUBJECT_SUGGESTIONS = ['Matemática', 'Português', 'Física', 'Química', 'Biologia', 'História', 'Inglês', 'Redação'];

const progressColor = (ratio, active) => (ratio >= 1 ? COLORS.amber : active ? COLORS.flame : COLORS.primary);

/* ------------------------------ Grupo / squad ----------------------------- */

function SquadStrip({ squad, rank, ranking, mode, onClick }) {
  const leader = ranking[0];
  const isLeader = leader?.id === squad.id;
  const gap = isLeader ? (ranking[1] ? squad.score - ranking[1].score : 0) : leader.score - squad.score;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line p-3 text-left transition hover:border-primary/40"
      style={{ background: `linear-gradient(90deg, ${withAlpha(squad.color, 0.16)}, ${COLORS.card} 55%)` }}
    >
      <SquadBadge squad={squad} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Seu squad · {rank}º lugar</p>
        <p className="truncate text-sm font-semibold text-fg">{squad.name}</p>
        <p className="truncate text-xs text-muted">
          {isLeader ? `Liderando por ${formatHMS(gap)}` : `${formatHMS(gap)} atrás do ${leader.name}`} {mode === 'avg' ? '(média)' : '(total)'}
        </p>
      </div>
      <ActiveBadge active={squad.active} total={squad.members.length} />
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}

function FriendsCta({ text, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD} flex w-full items-center gap-3 p-3 text-left transition hover:border-primary/40`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
        <Users size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-fg">Estude com seus amigos</span>
        <span className="block truncate text-xs text-muted">{text}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted" />
    </button>
  );
}

/* ------------------------- Cronômetro / Pomodoro -------------------------- */

function PomodoroStatus({ pomodoro, settings, now, running, onSkipBreak }) {
  const remaining = pomodoro.endsAt ? Math.max(0, pomodoro.endsAt - now) : (pomodoro.remaining ?? 0);
  const cycle = pomodoro.completed % settings.longEvery;
  let title = 'Pronto para focar';
  let detail = `${settings.focus} min de foco · ${settings.short} min de pausa`;
  if (pomodoro.phase === 'focus') {
    title = running ? 'Foco em andamento' : 'Foco pausado';
    detail = `${formatHMS(Math.ceil(remaining / SECOND))} restantes`;
  } else if (pomodoro.phase === 'break') {
    title = pomodoro.breakKind === 'long' ? 'Pausa longa' : 'Pausa curta';
    detail = `${formatHMS(Math.ceil(remaining / SECOND))} para voltar`;
  }
  const tone = pomodoro.phase === 'break' ? 'bg-online/15 text-online' : pomodoro.phase === 'focus' ? 'bg-flame/15 text-flame' : 'bg-primary/15 text-primary';
  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-shell px-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${tone}`}>
        {pomodoro.phase === 'break' ? <Coffee size={17} /> : <Timer size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">{title}</p>
        <p className="text-xs tabular-nums text-muted">{detail}</p>
      </div>
      <div className="flex gap-1" title={`Ciclo ${cycle + 1} de ${settings.longEvery}`}>
        {Array.from({ length: settings.longEvery }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i < cycle ? 'bg-flame' : 'bg-line'}`} />
        ))}
      </div>
      {pomodoro.phase === 'break' && (
        <button type="button" onClick={onSkipBreak} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-fg/85 hover:bg-raised">
          Pular
        </button>
      )}
    </div>
  );
}

function TimerCard({ timerMode, pomodoro, settings, now, running, onSetMode, onOpenSettings, onOpenFocus, onSkipBreak }) {
  return (
    <section className={`${CARD} p-3`}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <Segmented
            value={timerMode}
            onChange={onSetMode}
            options={[
              { value: 'stopwatch', label: 'Cronômetro' },
              { value: 'pomodoro', label: 'Pomodoro' },
            ]}
          />
        </div>
        <button type="button" onClick={onOpenSettings} aria-label="Configurar cronômetro" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-shell text-muted transition hover:text-fg">
          <Settings2 size={17} />
        </button>
      </div>
      {timerMode === 'pomodoro' ? (
        <PomodoroStatus pomodoro={pomodoro} settings={settings} now={now} running={running} onSkipBreak={onSkipBreak} />
      ) : (
        <p className="mt-2.5 px-1 text-xs text-muted">Contador livre: o tempo corre até você pausar e vai para a tarefa que estiver tocando.</p>
      )}
      <button type="button" onClick={onOpenFocus} className={`${PRIMARY_BTN} mt-3 w-full`}>
        <Maximize2 size={15} /> Abrir Modo Estudo
      </button>
    </section>
  );
}

/* --------------------------------- Tarefas -------------------------------- */

function TimeMeta({ total }) {
  return (
    <span className="tabular-nums">
      {formatDuration(total.spent)}
      {total.estimate > 0 && <span className="text-muted/70"> / {formatDuration(total.estimate)}</span>}
    </span>
  );
}

function SubtaskLine({ task, total, active, onToggleDone, onPlay, onOpen }) {
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      <CheckButton small checked={task.done} onClick={() => onToggleDone(task)} label={task.done ? 'Reabrir subtarefa' : 'Concluir subtarefa'} />
      <button type="button" onClick={onOpen} className={`min-w-0 flex-1 truncate text-left text-[13px] ${task.done ? 'text-muted line-through' : 'text-fg/90'}`}>
        {task.title}
      </button>
      <span className={`shrink-0 text-[11px] ${active ? 'text-flame' : 'text-muted'}`}>
        <TimeMeta total={total} />
      </span>
      {!task.done && <PlayButton size="sm" active={active} onClick={() => onPlay(task)} label={active ? `Pausar ${task.title}` : `Iniciar ${task.title}`} />}
    </li>
  );
}

function TaskRow({ task, subject, subtasks, totals, activeTaskId, onToggleDone, onPlay, onOpen, onToggleToday }) {
  const total = totals.get(task.id);
  const active = activeTaskId === task.id;
  const ratio = total.estimate ? total.spent / total.estimate : 0;
  const runningInside = active || subtasks.some((s) => s.id === activeTaskId);
  return (
    <div
      className={`overflow-hidden rounded-2xl border transition ${
        runningInside ? 'border-flame/60 bg-flame/[0.07] shadow-[0_0_24px_-12px_rgba(255,107,0,0.9)]' : 'border-line bg-card'
      } ${task.done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3 p-3">
        <CheckButton checked={task.done} onClick={() => onToggleDone(task)} label={task.done ? 'Reabrir tarefa' : 'Concluir tarefa'} color={subject?.color ?? COLORS.primary} />
        <button type="button" onClick={() => onOpen(task.id)} className="min-w-0 flex-1 text-left">
          <p className={`truncate text-sm font-semibold ${task.done ? 'text-muted line-through' : 'text-fg'}`}>{task.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
            {subject && (
              <span className="flex min-w-0 items-center gap-1">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: subject.color }} />
                <span className="truncate">{subject.name}</span>
              </span>
            )}
            {total.subtasks > 0 && (
              <span className="flex items-center gap-1">
                <ListChecks size={11} />
                {total.subtasksDone}/{total.subtasks}
              </span>
            )}
            {task.notes && <NotebookPen size={11} aria-label="Tem notas" />}
            <span className={active ? 'text-flame' : ''}>
              <TimeMeta total={total} />
            </span>
          </p>
        </button>
        {onToggleToday && (
          <button
            type="button"
            onClick={() => onToggleToday(task)}
            aria-label={task.inToday ? 'Tirar de hoje' : 'Planejar para hoje'}
            title={task.inToday ? 'Tirar de hoje' : 'Planejar para hoje'}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full transition ${task.inToday ? 'bg-amber/15 text-amber' : 'text-muted hover:bg-white/5 hover:text-amber'}`}
          >
            <Sun size={16} />
          </button>
        )}
        {!task.done && <PlayButton active={active} onClick={() => onPlay(task)} label={active ? `Pausar ${task.title}` : `Iniciar ${task.title}`} />}
      </div>
      {total.estimate > 0 && !task.done && (
        <div className="-mt-1 px-3 pb-3">
          <ProgressBar value={ratio} color={progressColor(ratio, runningInside)} />
        </div>
      )}
      {subtasks.length > 0 && (
        <ul className="border-t border-line/70 bg-shell/40 px-3">
          {subtasks.map((sub) => (
            <SubtaskLine
              key={sub.id}
              task={sub}
              total={totals.get(sub.id)}
              active={activeTaskId === sub.id}
              onToggleDone={onToggleDone}
              onPlay={onPlay}
              onOpen={() => onOpen(task.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AddTaskForm({ subjects, fixedSubjectId, placeholder, onAdd, className = '' }) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '');
  const chosen = fixedSubjectId ?? (subjects.some((s) => s.id === subjectId) ? subjectId : subjects[0]?.id);

  const submit = (event) => {
    event.preventDefault();
    const value = title.trim();
    if (!value || !chosen) return;
    onAdd({ title: value, subjectId: chosen });
    setTitle('');
  };

  return (
    <form onSubmit={submit} className={`flex gap-2 ${className}`}>
      {!fixedSubjectId && (
        <select
          value={chosen}
          onChange={(e) => setSubjectId(e.target.value)}
          aria-label="Matéria da tarefa"
          className={`${INSET_INPUT} w-auto max-w-[38%] shrink-0 bg-card [color-scheme:dark]`}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={placeholder} aria-label={placeholder} className={`${INSET_INPUT} min-w-0 flex-1 ${fixedSubjectId ? '' : 'bg-card'}`} />
      <button
        type="submit"
        disabled={!title.trim()}
        aria-label="Adicionar tarefa"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition hover:brightness-110 disabled:opacity-30"
      >
        <Plus size={18} />
      </button>
    </form>
  );
}

/* --------------------------------- Matérias -------------------------------- */

function SubjectCard({ subject, session, expanded, backlog, doneCount, totals, childrenOf, taskHandlers, onToggleExpanded, onPlay, onEdit, onAddTask }) {
  const subjectLevel = session?.subjectId === subject.id && !session.taskId;
  const running = session?.subjectId === subject.id;
  return (
    <article className={`overflow-hidden rounded-2xl border transition ${running ? 'border-flame/60 bg-flame/[0.06]' : 'border-line bg-card'}`}>
      <div className="flex items-center gap-3 p-3">
        <PlayButton active={subjectLevel} onClick={onPlay} label={subjectLevel ? `Pausar ${subject.name}` : `Iniciar ${subject.name}`} color={subject.color} />
        <button type="button" onClick={onToggleExpanded} aria-expanded={expanded} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.color }} />
            <span className="truncate font-semibold text-fg">{subject.name}</span>
          </span>
          <span className="mt-1 flex items-center gap-1 text-xs text-muted">
            <ListChecks size={12} />
            {backlog.length} no backlog{doneCount ? ` · ${doneCount} concluídas` : ''}
            <ChevronDown size={14} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className={`font-mono text-base font-bold tabular-nums ${running ? 'text-flame' : 'text-fg'}`}>{formatHMS(subject.totalSecondsToday)}</span>
          <button type="button" onClick={onEdit} className="flex items-center gap-1 text-[11px] text-muted transition hover:text-fg">
            <Pencil size={11} /> editar
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-line/70 bg-shell/50 px-3 pb-3 pt-2.5">
          {backlog.length === 0 && <p className="pb-2 text-xs text-muted">Backlog vazio. Adicione tarefas e toque no ☀ para planejar para hoje.</p>}
          <div className="space-y-2">
            {backlog.map((task) => (
              <TaskRow key={task.id} task={task} subject={null} subtasks={childrenOf(task.id)} totals={totals} activeTaskId={session?.taskId ?? null} {...taskHandlers} />
            ))}
          </div>
          <AddTaskForm
            subjects={[subject]}
            fixedSubjectId={subject.id}
            placeholder={`Nova tarefa em ${subject.name}…`}
            onAdd={(values) => onAddTask({ ...values, inToday: false })}
            className="mt-2.5"
          />
        </div>
      )}
    </article>
  );
}

/* ----------------------------------- Tela ---------------------------------- */

export function TodayScreen({
  now,
  subjects,
  tasks,
  taskTotals,
  activeSession,
  timerMode,
  pomodoro,
  pomodoroSettings,
  todaySeconds,
  socialStatus,
  userSquad,
  userRank,
  ranking,
  battleMode,
  onToggleSubject,
  onPlayTask,
  onToggleDone,
  onOpenTask,
  onAddTask,
  onToggleToday,
  onCreateSubject,
  onQuickAdd,
  onEditSubject,
  onSetTimerMode,
  onOpenTimerSettings,
  onOpenFocus,
  onSkipBreak,
  onOpenSummary,
  onOpenGroups,
  onOpenManager,
}) {
  const [expanded, setExpanded] = useState(() => new Set(subjects.length === 1 ? [subjects[0].id] : []));
  const [showDone, setShowDone] = useState(false);
  const activeTaskId = activeSession?.taskId ?? null;
  const subjectsById = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const childrenOf = (id) => tasks.filter((t) => t.parentId === id && !t.archived).sort(byCreated);
  const topLevel = tasks.filter((t) => !t.parentId && !t.archived).sort(byCreated);
  const todayTasks = topLevel.filter((t) => t.inToday);
  const pending = todayTasks.filter((t) => !t.done);
  const done = todayTasks.filter((t) => t.done);
  const estimated = pending.map((t) => taskTotals.get(t.id)).filter((total) => total.estimate > 0);
  const estimate = sum(estimated.map((total) => total.estimate));
  const spentOnPending = sum(estimated.map((total) => Math.min(total.spent, total.estimate)));
  const suggestions = SUBJECT_SUGGESTIONS.filter((name) => !subjects.some((s) => s.name.toLowerCase() === name.toLowerCase()));
  const taskHandlers = { onToggleDone, onPlay: onPlayTask, onOpen: onOpenTask, onToggleToday };

  const toggleExpanded = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-5">
      {socialStatus === 'ready' &&
        (userSquad ? (
          <SquadStrip squad={userSquad} rank={userRank} ranking={ranking} mode={battleMode} onClick={onOpenGroups} />
        ) : (
          <FriendsCta text="Escolha um squad para entrar na batalha" onClick={onOpenManager} />
        ))}
      {socialStatus === 'signed-out' && <FriendsCta text="Crie uma conta e entre num grupo para competir nos squads" onClick={onOpenGroups} />}
      {socialStatus === 'no-group' && <FriendsCta text="Crie um grupo ou entre com um código de convite" onClick={onOpenGroups} />}

      <TimerCard
        timerMode={timerMode}
        pomodoro={pomodoro}
        settings={pomodoroSettings}
        now={now}
        running={Boolean(activeSession)}
        onSetMode={onSetTimerMode}
        onOpenSettings={onOpenTimerSettings}
        onOpenFocus={onOpenFocus}
        onSkipBreak={onSkipBreak}
      />

      <section>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-lg font-bold text-fg">
              <Sun size={18} className="text-amber" /> Planejado para hoje
            </h2>
            <p className="flex flex-wrap gap-x-1.5 text-xs text-muted">
              <span className="whitespace-nowrap">
                {done.length}/{todayTasks.length} concluídas
              </span>
              <span>·</span>
              <span className="whitespace-nowrap">{formatDuration(todaySeconds)} focadas</span>
              {estimate > 0 && (
                <>
                  <span>·</span>
                  <span className="whitespace-nowrap">faltam ~{formatDuration(Math.max(0, estimate - spentOnPending))}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={onOpenSummary} className={`${SECONDARY_BTN} shrink-0 px-3 py-1.5 text-xs`}>
            <CalendarCheck size={14} /> Encerrar o dia
          </button>
        </div>
        {estimate > 0 && <ProgressBar value={spentOnPending / estimate} className="mb-3" />}
        <div className="space-y-2">
          {pending.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              subject={subjectsById[task.subjectId]}
              subtasks={childrenOf(task.id)}
              totals={taskTotals}
              activeTaskId={activeTaskId}
              {...taskHandlers}
              onToggleToday={null}
            />
          ))}
          {pending.length === 0 && (
            <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">
              {subjects.length ? 'Nada pendente para hoje. Adicione tarefas abaixo ou toque no ☀ das tarefas do backlog.' : 'Crie suas matérias abaixo para começar a planejar.'}
            </p>
          )}
        </div>
        {subjects.length > 0 && (
          <AddTaskForm subjects={subjects} placeholder="Nova tarefa para hoje…" onAdd={(values) => onAddTask({ ...values, inToday: true })} className="mt-2.5" />
        )}
        {done.length > 0 && (
          <div className="mt-3">
            <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-fg">
              <ChevronDown size={14} className={`transition-transform ${showDone ? 'rotate-180' : ''}`} />
              Concluídas hoje ({done.length})
            </button>
            {showDone && (
              <div className="mt-2 space-y-2">
                {done.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    subject={subjectsById[task.subjectId]}
                    subtasks={childrenOf(task.id)}
                    totals={taskTotals}
                    activeTaskId={activeTaskId}
                    {...taskHandlers}
                    onToggleToday={null}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-fg">Matérias e backlog</h2>
            <p className="text-xs text-muted">Toque ▶ para estudar a matéria sem tarefa específica</p>
          </div>
          <button
            type="button"
            onClick={onCreateSubject}
            className="flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/25"
          >
            <Plus size={14} /> Nova matéria
          </button>
        </div>
        <div className="space-y-2.5">
          {subjects.map((subject) => {
            const own = topLevel.filter((t) => t.subjectId === subject.id && !t.inToday);
            return (
              <SubjectCard
                key={subject.id}
                subject={subject}
                session={activeSession}
                expanded={expanded.has(subject.id)}
                backlog={own.filter((t) => !t.done)}
                doneCount={own.filter((t) => t.done).length}
                totals={taskTotals}
                childrenOf={childrenOf}
                taskHandlers={taskHandlers}
                onToggleExpanded={() => toggleExpanded(subject.id)}
                onPlay={() => onToggleSubject(subject.id)}
                onEdit={() => onEditSubject(subject)}
                onAddTask={onAddTask}
              />
            );
          })}
        </div>
        {subjects.length < 3 && suggestions.length > 0 && (
          <div className="mt-4 rounded-2xl border border-dashed border-line p-4 text-center">
            <p className="text-sm font-semibold text-fg">{subjects.length ? 'Adicione mais matérias' : 'Comece pelas suas matérias'}</p>
            <p className="mt-1 text-xs text-muted">Toque numa sugestão ou crie uma do zero. Cada matéria tem cronômetro e backlog de tarefas.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {suggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => onQuickAdd(name)}
                  className="rounded-full border border-line bg-card px-3 py-1.5 text-xs font-semibold text-fg/85 transition hover:border-primary/60 hover:text-fg"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
