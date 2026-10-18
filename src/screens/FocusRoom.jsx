import { useEffect, useState } from 'react';
import { ChevronDown, Coffee, Flame, Pause, Play, SkipForward, Square, Target, Users } from 'lucide-react';
import { CARD, COLORS, LABEL, PRIMARY_BTN } from '../theme.js';
import { ddayInfo, formatDuration, formatHMS, MINUTE, SECOND } from '../lib/time.js';
import { byCreated, firstName, initialsOf, withAlpha } from '../lib/misc.js';
import { Modal, ProgressBar, Segmented, useBodyScrollLock, useEscapeKey } from '../components/ui.jsx';
import { DeskAvatar } from '../components/DeskAvatar.jsx';

const QUICK_ESTIMATES = [25 * 60, 45 * 60, 3600, 90 * 60, 2 * 3600];
const TOP_BUTTON = 'grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/5 text-fg/80 transition hover:bg-white/10 disabled:opacity-30';

// mantém a tela acesa enquanto o Modo Estudo estiver aberto (quando o aparelho suporta)
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let cancelled = false;
    navigator.wakeLock
      ?.request('screen')
      .then((sentinel) => {
        if (cancelled) sentinel.release().catch(() => {});
        else lock = sentinel;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
    };
  }, []);
}

function SelfAvatar({ name, running }) {
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center" aria-label={running ? 'Você está estudando' : 'Você está pausado'}>
      {running && <span className="ypt-glow absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${withAlpha(COLORS.flame, 0.5)}, transparent 70%)` }} />}
      <span className={`relative grid h-14 w-14 place-items-center rounded-full text-lg font-black ${running ? 'bg-flame/20 text-flame ring-2 ring-flame' : 'bg-card text-muted ring-1 ring-line'}`}>
        {initialsOf(name)}
      </span>
      <Flame size={22} className={`absolute -top-0.5 right-1 ${running ? 'ypt-flicker text-flame' : 'text-muted/40'}`} fill={running ? COLORS.amber : 'none'} />
    </div>
  );
}

function MemberDesk({ member, color, highlight }) {
  const studying = member.isStudying;
  const subjectColor = member.subjectColor ?? color;
  return (
    <li
      data-member={member.name}
      data-studying={studying ? 'true' : 'false'}
      className={`flex min-w-0 flex-col items-center rounded-2xl border px-1.5 pb-2.5 pt-2 text-center transition ${
        highlight ? 'border-primary bg-primary/10' : studying ? 'border-flame/35 bg-card' : 'border-line bg-shell'
      }`}
    >
      <div className="relative">
        <DeskAvatar studying={studying} color={color} size={58} />
        <span
          className={`absolute bottom-1 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-surface ${studying ? 'bg-flame' : member.online ? 'bg-online' : 'bg-muted/50'}`}
          title={studying ? 'Estudando' : member.online ? 'Online' : 'Offline'}
        />
      </div>
      <p className={`mt-1 w-full truncate text-xs font-semibold ${studying ? 'text-online' : 'text-muted'}`}>{member.isCurrentUser ? 'Você' : firstName(member.name)}</p>
      <p className={`font-mono text-[13px] font-bold tabular-nums ${studying ? 'text-flame' : 'text-muted/80'}`}>{formatHMS(member.seconds)}</p>
      {studying && member.currentSubject && (
        <span className="mt-1 max-w-full truncate rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: withAlpha(subjectColor, 0.18), color: subjectColor }}>
          {member.currentSubject}
        </span>
      )}
    </li>
  );
}

function PickRow({ subject, title, hint, indent = false, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${indent ? 'ml-5 w-[calc(100%-1.25rem)]' : ''} ${
        selected ? 'border-primary bg-primary/10' : 'border-line bg-card hover:border-primary/40'
      }`}
    >
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject?.color ?? COLORS.muted }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-fg">{title}</span>
        {hint && <span className="block truncate text-[11px] text-muted">{hint}</span>}
      </span>
      <Play size={14} className="shrink-0 text-primary" fill="currentColor" />
    </button>
  );
}

function TaskPicker({ subjects, tasks, current, onPick, onClose }) {
  const open = tasks.filter((t) => !t.done && !t.archived).sort(byCreated);
  const subjectsById = Object.fromEntries(subjects.map((s) => [s.id, s]));
  const subtasksOf = (id) => open.filter((t) => t.parentId === id);
  const isCurrent = (subjectId, taskId) => current?.subjectId === subjectId && (current?.taskId ?? null) === taskId;
  const today = open.filter((t) => t.inToday && !t.parentId);

  const renderTask = (task) => (
    <div key={task.id} className="space-y-1.5">
      <PickRow
        subject={subjectsById[task.subjectId]}
        title={task.title}
        hint={subjectsById[task.subjectId]?.name}
        selected={isCurrent(task.subjectId, task.id)}
        onClick={() => onPick(task.subjectId, task.id)}
      />
      {subtasksOf(task.id).map((sub) => (
        <PickRow
          key={sub.id}
          indent
          subject={subjectsById[sub.subjectId]}
          title={sub.title}
          hint="subtarefa"
          selected={isCurrent(sub.subjectId, sub.id)}
          onClick={() => onPick(sub.subjectId, sub.id)}
        />
      ))}
    </div>
  );

  return (
    <Modal title="O que você vai estudar?" subtitle="O tempo do cronômetro vai para o que você escolher" layer="focus" onClose={onClose}>
      {subjects.length === 0 && <p className="rounded-xl border border-dashed border-line py-6 text-center text-sm text-muted">Crie uma matéria na tela Hoje para começar.</p>}
      {today.length > 0 && (
        <section className="mb-5">
          <p className={LABEL}>Planejado para hoje</p>
          <div className="space-y-1.5">{today.map(renderTask)}</div>
        </section>
      )}
      {subjects.map((subject) => {
        const backlog = open.filter((t) => t.subjectId === subject.id && !t.parentId && !t.inToday);
        return (
          <section key={subject.id} className="mb-4">
            <p className={LABEL}>{subject.name}</p>
            <div className="space-y-1.5">
              <PickRow subject={subject} title={`Só ${subject.name}`} hint="sem tarefa específica" selected={isCurrent(subject.id, null)} onClick={() => onPick(subject.id, null)} />
              {backlog.map(renderTask)}
            </div>
          </section>
        );
      })}
    </Modal>
  );
}

function FocusTaskCard({ subject, task, total, running, onPick, onResume, onSetEstimate, resumeLabel }) {
  if (!subject) {
    return (
      <button type="button" onClick={onPick} className={`${CARD} mt-6 flex w-full items-center gap-3 p-4 text-left transition hover:border-primary/50`}>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Target size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-fg">Escolha o que estudar</span>
          <span className="block text-xs text-muted">Uma tarefa ou uma matéria — o tempo vai para ela</span>
        </span>
      </button>
    );
  }
  const estimate = total?.estimate ?? 0;
  const spent = total?.spent ?? 0;
  const ratio = estimate ? spent / estimate : 0;
  const remaining = estimate - spent;
  return (
    <div className={`${CARD} mt-6 p-4`}>
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: subject.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted">{subject.name}</p>
          <p className="truncate font-semibold text-fg">{task ? task.title : 'Estudo livre da matéria'}</p>
        </div>
        <button type="button" onClick={onPick} className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-fg/85 transition hover:bg-raised">
          Trocar
        </button>
      </div>
      {task && estimate > 0 && (
        <>
          <ProgressBar value={ratio} thick className="mt-3" color={ratio >= 1 ? COLORS.amber : running ? COLORS.flame : COLORS.primary} />
          <p className="mt-2 flex justify-between gap-2 text-xs tabular-nums text-muted">
            <span>
              {formatDuration(spent)} de {formatDuration(estimate)}
            </span>
            <span className={remaining < 0 ? 'text-amber' : 'text-fg/85'}>
              {remaining >= 0 ? `faltam ${Math.ceil(remaining / 60)} min` : `+${Math.ceil(-remaining / 60)} min além da meta`}
            </span>
          </p>
        </>
      )}
      {task && !estimate && (
        <div className="mt-3">
          <p className="text-xs text-muted">Defina uma meta de tempo para acompanhar o progresso:</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_ESTIMATES.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => onSetEstimate(task.id, seconds)}
                className="rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/25"
              >
                {formatDuration(seconds)}
              </button>
            ))}
          </div>
        </div>
      )}
      {!task && <p className="mt-2 text-xs text-muted">Toque em Trocar para escolher uma tarefa e acompanhar o progresso dela.</p>}
      {!running && (
        <button type="button" onClick={onResume} className={`${PRIMARY_BTN} mt-4 w-full`}>
          <Play size={16} fill="currentColor" /> {resumeLabel}
        </button>
      )}
    </div>
  );
}

export function FocusRoom({
  now,
  timerMode,
  pomodoro,
  pomodoroSettings,
  activeSession,
  target,
  subjects,
  subjectsById,
  tasks,
  taskTotals,
  todaySeconds,
  sessionSeconds,
  members,
  squadById,
  mySquadId,
  myName,
  socialStatus,
  dday,
  onPause,
  onResume,
  onStop,
  onSkipBreak,
  onPick,
  onSetEstimate,
  onClose,
  onOpenGroups,
}) {
  const [display, setDisplay] = useState('session');
  const [filter, setFilter] = useState('all');
  const [picking, setPicking] = useState(false);
  useEscapeKey(onClose);
  useBodyScrollLock();
  useWakeLock();

  const running = Boolean(activeSession);
  const subject = target ? (subjectsById[target.subjectId] ?? null) : null;
  const task = target?.taskId ? (tasks.find((t) => t.id === target.taskId) ?? null) : null;
  const pomodoroActive = timerMode === 'pomodoro' && pomodoro.phase !== 'idle';
  const remainingMs = pomodoro.endsAt ? Math.max(0, pomodoro.endsAt - now) : (pomodoro.remaining ?? 0);
  const info = dday ? ddayInfo(dday.date, now) : null;

  let bigSeconds = sessionSeconds;
  let caption = running ? 'Sessão atual · toque para ver o dia' : 'Pausado · toque para ver o dia';
  if (pomodoroActive) {
    bigSeconds = Math.ceil(remainingMs / SECOND);
    caption =
      pomodoro.phase === 'focus'
        ? `Foco · ciclo ${(pomodoro.completed % pomodoroSettings.longEvery) + 1} de ${pomodoroSettings.longEvery}${running ? '' : ' · pausado'}`
        : pomodoro.breakKind === 'long'
          ? 'Pausa longa'
          : 'Pausa curta';
  } else if (display === 'day') {
    bigSeconds = todaySeconds;
    caption = 'Total de hoje · toque para ver a sessão';
  }

  const inGroup = socialStatus === 'ready';
  const me = {
    id: 'me',
    name: myName || 'Você',
    isCurrentUser: true,
    isStudying: running,
    online: true,
    currentSubject: running ? subject?.name : null,
    subjectColor: subject?.color,
    seconds: todaySeconds,
    subgroupId: mySquadId,
  };
  const pool = inGroup ? members : [me];
  const visible = filter === 'squad' ? pool.filter((m) => m.isCurrentUser || (mySquadId && m.subgroupId === mySquadId)) : pool;
  const ordered = [...visible].sort((a, b) => b.isCurrentUser - a.isCurrentUser || b.isStudying - a.isStudying || b.seconds - a.seconds);
  const activeCount = visible.filter((m) => m.isStudying).length;
  const breakEnded = timerMode === 'pomodoro' && pomodoro.phase === 'idle' && pomodoro.lastEvent?.type === 'break-done' && now - pomodoro.lastEvent.at < 2 * MINUTE;
  const resume = () => (target ? onResume() : setPicking(true));

  return (
    <div className="ypt-fade-in fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-ink text-fg" role="dialog" aria-modal="true" aria-label="Modo Estudo">
      <div className="mx-auto w-full max-w-3xl px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={onClose} aria-label="Minimizar" className={TOP_BUTTON}>
            <ChevronDown size={20} />
          </button>
          <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
            Modo Estudo{info ? ` · ${info.label} ${dday.title}` : ''}
          </p>
          <div className="flex shrink-0 gap-2">
            {running ? (
              <button type="button" onClick={onPause} aria-label="Pausar" className={TOP_BUTTON}>
                <Pause size={18} fill="currentColor" />
              </button>
            ) : (
              <button type="button" onClick={resume} aria-label="Retomar" className={TOP_BUTTON}>
                <Play size={18} fill="currentColor" />
              </button>
            )}
            <button type="button" onClick={onStop} aria-label="Encerrar sessão" disabled={!running && !pomodoroActive} className={TOP_BUTTON}>
              <Square size={15} fill="currentColor" />
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" onClick={() => !pomodoroActive && setDisplay((d) => (d === 'session' ? 'day' : 'session'))} className="min-w-0 text-left">
            <p className={`font-mono text-[clamp(2.6rem,13vw,4.75rem)] font-bold leading-none tracking-tight tabular-nums ${running ? 'text-fg' : 'text-fg/60'}`}>
              {formatHMS(bigSeconds)}
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">{caption}</p>
          </button>
          <SelfAvatar name={myName || 'Você'} running={running} />
        </div>

        <FocusTaskCard
          subject={subject}
          task={task}
          total={task ? taskTotals.get(task.id) : null}
          running={running}
          resumeLabel={pomodoro.phase === 'break' ? 'Pular pausa e focar' : 'Retomar'}
          onPick={() => setPicking(true)}
          onResume={resume}
          onSetEstimate={onSetEstimate}
        />

        {pomodoro.phase === 'break' && timerMode === 'pomodoro' && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-online/40 bg-online/10 px-4 py-3">
            <Coffee size={20} className="shrink-0 text-online" />
            <p className="min-w-0 flex-1 text-sm text-fg">
              <span className="font-semibold">Hora da pausa!</span> <span className="text-fg/70">Levanta, bebe água. Volta em {formatHMS(Math.ceil(remainingMs / SECOND))}.</span>
            </p>
            <button type="button" onClick={onSkipBreak} className="flex shrink-0 items-center gap-1 rounded-full border border-online/50 px-2.5 py-1 text-xs font-semibold text-online">
              <SkipForward size={13} /> Pular
            </button>
          </div>
        )}
        {breakEnded && (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-flame/40 bg-flame/10 px-4 py-3">
            <Flame size={20} className="ypt-flicker shrink-0 text-flame" />
            <p className="min-w-0 flex-1 text-sm font-semibold text-fg">A pausa acabou. Bora para o próximo ciclo?</p>
          </div>
        )}
      </div>

      <section className="mt-6 flex-1 rounded-t-3xl border-t border-line bg-surface">
        <div className="mx-auto w-full max-w-3xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-online opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-online" />
              </span>
              Estudando agora <span className="text-muted">•</span>
              <span className="text-flame">
                {activeCount} {activeCount === 1 ? 'pessoa ativa' : 'pessoas ativas'}
              </span>
            </h2>
            {inGroup && (
              <div className="w-56 max-w-full">
                <Segmented
                  compact
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { value: 'all', label: 'Todos do grupo' },
                    { value: 'squad', label: 'Meu squad' },
                  ]}
                />
              </div>
            )}
          </div>

          <ul className="mt-4 grid grid-cols-3 gap-2.5 min-[400px]:grid-cols-4 md:grid-cols-5">
            {ordered.map((member) => (
              <MemberDesk key={member.id} member={member} color={squadById[member.subgroupId]?.color ?? COLORS.primary} highlight={member.isCurrentUser} />
            ))}
          </ul>

          {!inGroup && (
            <button type="button" onClick={onOpenGroups} className={`${CARD} mt-4 flex w-full items-center gap-3 p-4 text-left transition hover:border-primary/50`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <Users size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">Estude com seus amigos</span>
                <span className="block text-xs text-muted">Entre num grupo para ver todo mundo estudando aqui, ao vivo.</span>
              </span>
            </button>
          )}
          {inGroup && filter === 'squad' && !mySquadId && <p className="mt-3 text-center text-xs text-muted">Você ainda não está em um squad.</p>}
        </div>
      </section>

      {picking && (
        <TaskPicker
          subjects={subjects}
          tasks={tasks}
          current={target}
          onPick={(subjectId, taskId) => {
            setPicking(false);
            onPick(subjectId, taskId);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
