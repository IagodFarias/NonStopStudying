/* Estado pessoal do aparelho (localStorage): matérias, tarefas, sessões, D-Days, Pomodoro e preferências.
 * Nada daqui vai para o Firebase além do status ao vivo publicado pelo App (matéria atual e tempo do dia).
 *
 * tarefa: { id, subjectId, parentId, title, notes, done, doneAt, timeEstimate, timeSpent, inToday, archived, createdAt }
 *   - parentId != null → subtarefa (um nível, como no Super Productivity)
 *   - timeSpent acumula o tempo das sessões encerradas; a parte da sessão em andamento é somada na tela
 */

import { dayKeyOf, HOUR, MINUTE, SECOND } from './lib/time.js';

export const STORAGE_KEY = 'ypt:v3';
const LEGACY_V2_KEY = 'ypt:v2'; // fica intacto no aparelho como backup da versão anterior
export const STATE_VERSION = 3;
const LOG_RETENTION_DAYS = 35;

export const DEFAULT_POMODORO_SETTINGS = { focus: 25, short: 5, long: 15, longEvery: 4, autoStart: false };

const IDLE_POMODORO = {
  phase: 'idle', // 'idle' | 'focus' | 'break'
  breakKind: 'short',
  endsAt: null, // fim da fase em andamento
  remaining: null, // ms que sobraram quando o foco foi pausado
  completed: 0, // ciclos de foco concluídos no dia (define a pausa longa)
  cycleDay: null,
  resume: null, // matéria/tarefa para retomar depois da pausa
  lastEvent: null, // { type: 'focus-done' | 'break-done', at, ... } → aviso sonoro/visual
};

export function createInitialState(now) {
  return {
    version: STATE_VERSION,
    subjects: [],
    tasks: [],
    studyLogs: [],
    activeSession: null,
    ddays: [],
    selectedDdayId: null,
    battleMode: 'avg',
    timerMode: 'stopwatch', // 'stopwatch' | 'pomodoro'
    pomodoroSettings: { ...DEFAULT_POMODORO_SETTINGS },
    pomodoro: { ...IDLE_POMODORO },
    preferences: { openFocusOnPlay: true, sound: true },
    lastTick: now,
  };
}

// A v2 guardava as tarefas como `todos` simples dentro de cada matéria: viram tarefas do backlog.
function migrateV2(saved, now) {
  const tasks = [];
  const subjects = (saved.subjects ?? []).map((subject) => {
    (subject.todos ?? []).forEach((todo, index) => {
      tasks.push({
        id: todo.id,
        subjectId: subject.id,
        parentId: null,
        title: todo.text,
        notes: '',
        done: Boolean(todo.done),
        doneAt: null,
        timeEstimate: 0,
        timeSpent: 0,
        inToday: false,
        archived: false,
        createdAt: now + tasks.length + index,
      });
    });
    return { id: subject.id, name: subject.name, color: subject.color };
  });
  return {
    ...createInitialState(now),
    subjects,
    tasks,
    studyLogs: (saved.studyLogs ?? []).map((log) => ({ ...log, taskId: log.taskId ?? null })),
    activeSession: saved.activeSession ? { ...saved.activeSession, taskId: null } : null,
    ddays: saved.ddays ?? [],
    selectedDdayId: saved.selectedDdayId ?? null,
    battleMode: saved.battleMode ?? 'avg',
  };
}

function hydrate(saved, now) {
  const base = createInitialState(now);
  const cutoff = now - LOG_RETENTION_DAYS * 24 * HOUR;
  return {
    ...base,
    ...saved,
    tasks: saved.tasks ?? [],
    studyLogs: (saved.studyLogs ?? []).filter((log) => log.endTime >= cutoff),
    pomodoroSettings: { ...base.pomodoroSettings, ...saved.pomodoroSettings },
    pomodoro: { ...base.pomodoro, ...saved.pomodoro },
    preferences: { ...base.preferences, ...saved.preferences },
    lastTick: now,
  };
}

export function loadInitialState() {
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved?.version === STATE_VERSION && Array.isArray(saved.subjects)) return hydrate(saved, now);
    }
    const legacy = window.localStorage.getItem(LEGACY_V2_KEY);
    if (legacy) {
      const saved = JSON.parse(legacy);
      if (saved?.version === 2 && Array.isArray(saved.subjects)) return hydrate(migrateV2(saved, now), now);
    }
  } catch {
    // localStorage indisponível ou corrompido: começa do zero
  }
  return createInitialState(now);
}

/* ------------------------------- Sessões ---------------------------------- */

// Encerra a sessão ativa em `at`: vira log e o tempo vai para a tarefa que estava selecionada.
function closeActiveSession(state, at) {
  const session = state.activeSession;
  if (!session) return state;
  const endTime = Math.max(at, session.startedAt);
  const durationSeconds = Math.round((endTime - session.startedAt) / SECOND);
  if (durationSeconds < 1) return { ...state, activeSession: null };
  const log = {
    id: `log_${session.startedAt.toString(36)}_${endTime.toString(36)}`,
    subjectId: session.subjectId,
    taskId: session.taskId ?? null,
    startTime: session.startedAt,
    endTime,
    durationSeconds,
  };
  const tasks = session.taskId
    ? state.tasks.map((t) => (t.id === session.taskId ? { ...t, timeSpent: (t.timeSpent || 0) + durationSeconds } : t))
    : state.tasks;
  return { ...state, studyLogs: [...state.studyLogs, log], tasks, activeSession: null };
}

/* ------------------------------- Pomodoro --------------------------------- */

// Fecha as fases do Pomodoro que já venceram (pode ser mais de uma se o app ficou em segundo plano).
function advancePomodoro(state, now) {
  let next = state;
  for (let guard = 0; guard < 4; guard += 1) {
    const p = next.pomodoro;
    const settings = next.pomodoroSettings;
    if (next.timerMode !== 'pomodoro' || !p.endsAt || now < p.endsAt) break;
    if (p.phase === 'focus') {
      const resume = next.activeSession ? { subjectId: next.activeSession.subjectId, taskId: next.activeSession.taskId ?? null } : p.resume;
      const closed = closeActiveSession(next, p.endsAt);
      const completed = p.completed + 1;
      const breakKind = completed % settings.longEvery === 0 ? 'long' : 'short';
      next = {
        ...closed,
        pomodoro: {
          ...p,
          phase: 'break',
          breakKind,
          endsAt: p.endsAt + settings[breakKind] * MINUTE,
          remaining: null,
          completed,
          resume,
          lastEvent: { type: 'focus-done', at: p.endsAt, breakKind, minutes: settings[breakKind] },
        },
      };
    } else if (p.phase === 'break') {
      const canResume = settings.autoStart && p.resume && next.subjects.some((s) => s.id === p.resume.subjectId);
      next = canResume
        ? {
            ...next,
            activeSession: { ...p.resume, startedAt: p.endsAt, elapsedSeconds: 0 },
            pomodoro: { ...p, phase: 'focus', endsAt: p.endsAt + settings.focus * MINUTE, lastEvent: { type: 'break-done', at: p.endsAt, autoStarted: true } },
          }
        : { ...next, pomodoro: { ...p, phase: 'idle', endsAt: null, lastEvent: { type: 'break-done', at: p.endsAt, autoStarted: false } } };
    } else {
      break;
    }
  }
  return next;
}

function pauseSession(state, now) {
  const closed = closeActiveSession(state, now);
  const p = state.pomodoro;
  if (state.timerMode === 'pomodoro' && p.phase === 'focus' && p.endsAt) {
    return { ...closed, pomodoro: { ...p, endsAt: null, remaining: Math.max(0, p.endsAt - now) } };
  }
  return closed;
}

/* -------------------------------- Reducer --------------------------------- */

const mapTasks = (state, update) => ({ ...state, tasks: state.tasks.map(update) });

export function reducer(state, action) {
  switch (action.type) {
    case 'TICK': {
      const advanced = advancePomodoro(state, action.now);
      const activeSession = advanced.activeSession
        ? { ...advanced.activeSession, elapsedSeconds: Math.max(0, Math.floor((action.now - advanced.activeSession.startedAt) / SECOND)) }
        : null;
      return { ...advanced, activeSession, lastTick: action.now };
    }

    case 'START': {
      const { subjectId, now } = action;
      const taskId = action.taskId ?? null;
      const current = state.activeSession;
      if (current && current.subjectId === subjectId && (current.taskId ?? null) === taskId) return state;
      // exclusividade mútua: a sessão anterior é encerrada (e registrada) antes de a nova começar
      const next = { ...closeActiveSession(state, now), activeSession: { subjectId, taskId, startedAt: now, elapsedSeconds: 0 } };
      if (state.timerMode !== 'pomodoro') return next;
      const p = state.pomodoro;
      if (p.phase === 'focus' && p.endsAt) return next; // só trocou de tarefa no meio do foco
      const today = dayKeyOf(now);
      const fresh = p.cycleDay === today ? p : { ...p, completed: 0, cycleDay: today };
      const endsAt = p.phase === 'focus' && p.remaining ? now + p.remaining : now + state.pomodoroSettings.focus * MINUTE;
      return { ...next, pomodoro: { ...fresh, phase: 'focus', endsAt, remaining: null } };
    }

    case 'PAUSE':
      return pauseSession(state, action.now);

    case 'STOP': // encerra a sessão e zera o ciclo do Pomodoro
      return { ...closeActiveSession(state, action.now), pomodoro: { ...state.pomodoro, phase: 'idle', endsAt: null, remaining: null } };

    case 'SKIP_BREAK':
      return { ...state, pomodoro: { ...state.pomodoro, phase: 'idle', endsAt: null, remaining: null } };

    case 'SET_TIMER_MODE': {
      if (action.mode === state.timerMode) return state;
      const pomodoro = { ...state.pomodoro, phase: 'idle', endsAt: null, remaining: null };
      if (action.mode === 'pomodoro' && state.activeSession) {
        const today = dayKeyOf(action.now);
        const completed = pomodoro.cycleDay === today ? pomodoro.completed : 0;
        return {
          ...state,
          timerMode: 'pomodoro',
          pomodoro: { ...pomodoro, phase: 'focus', endsAt: action.now + state.pomodoroSettings.focus * MINUTE, completed, cycleDay: today },
        };
      }
      return { ...state, timerMode: action.mode, pomodoro };
    }

    case 'UPDATE_POMODORO_SETTINGS':
      return { ...state, pomodoroSettings: { ...state.pomodoroSettings, ...action.patch } };

    case 'SET_PREFERENCE':
      return { ...state, preferences: { ...state.preferences, [action.key]: action.value } };

    case 'ADD_SUBJECT':
      return { ...state, subjects: [...state.subjects, action.subject] };

    case 'UPDATE_SUBJECT':
      return { ...state, subjects: state.subjects.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)) };

    case 'DELETE_SUBJECT': {
      const removed = new Set(state.tasks.filter((t) => t.subjectId === action.id).map((t) => t.id));
      return {
        ...state,
        subjects: state.subjects.filter((s) => s.id !== action.id),
        tasks: state.tasks.filter((t) => !removed.has(t.id)),
        studyLogs: state.studyLogs.filter((log) => log.subjectId !== action.id),
        activeSession: state.activeSession?.subjectId === action.id ? null : state.activeSession,
      };
    }

    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.task] };

    case 'UPDATE_TASK': {
      const updated = mapTasks(state, (t) => (t.id === action.id ? { ...t, ...action.patch } : t));
      // trocar a matéria de uma tarefa leva as subtarefas junto
      if (!action.patch.subjectId) return updated;
      return mapTasks(updated, (t) => (t.parentId === action.id ? { ...t, subjectId: action.patch.subjectId } : t));
    }

    case 'TOGGLE_TASK': {
      const task = state.tasks.find((t) => t.id === action.id);
      if (!task) return state;
      const done = !task.done;
      const ids = new Set([task.id, ...(done ? state.tasks.filter((t) => t.parentId === task.id).map((t) => t.id) : [])]);
      // concluir a tarefa que está sendo cronometrada encerra a sessão (como no Super Productivity)
      const next = done && ids.has(state.activeSession?.taskId) ? pauseSession(state, action.now) : state;
      return mapTasks(next, (t) => (ids.has(t.id) && t.done !== done ? { ...t, done, doneAt: done ? action.now : null } : t));
    }

    case 'TOGGLE_TODAY':
      return mapTasks(state, (t) => (t.id === action.id ? { ...t, inToday: !t.inToday, archived: false } : t));

    case 'DELETE_TASK': {
      const ids = new Set([action.id, ...state.tasks.filter((t) => t.parentId === action.id).map((t) => t.id)]);
      const next = ids.has(state.activeSession?.taskId) ? pauseSession(state, action.now) : state;
      return { ...next, tasks: next.tasks.filter((t) => !ids.has(t.id)) };
    }

    case 'FINISH_DAY': {
      // tarefas concluídas saem de "Hoje" e vão para o arquivo; as pendentes continuam para amanhã
      const archived = new Set(state.tasks.filter((t) => !t.parentId && t.inToday && t.done).map((t) => t.id));
      return mapTasks(state, (t) => (archived.has(t.id) || archived.has(t.parentId) ? { ...t, inToday: false, archived: true } : t));
    }

    case 'ADD_DDAY':
      return { ...state, ddays: [...state.ddays, action.dday], selectedDdayId: action.dday.id };

    case 'DELETE_DDAY': {
      const ddays = state.ddays.filter((d) => d.id !== action.id);
      const selectedDdayId = state.selectedDdayId === action.id ? (ddays[0]?.id ?? null) : state.selectedDdayId;
      return { ...state, ddays, selectedDdayId };
    }

    case 'SELECT_DDAY':
      return { ...state, selectedDdayId: action.id };

    case 'SET_BATTLE_MODE':
      return { ...state, battleMode: action.mode };

    default:
      return state;
  }
}
