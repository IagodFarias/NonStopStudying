import { addDays, MINUTE, SECOND } from './time.js';
import { sum } from './misc.js';

export const BLOCK_MS = 10 * MINUTE;
export const BLOCKS_PER_DAY = 144;

export function getSessions(studyLogs, activeSession, now) {
  const sessions = studyLogs.map((log) => ({
    subjectId: log.subjectId,
    taskId: log.taskId ?? null,
    start: log.startTime,
    end: log.endTime,
    live: false,
  }));
  if (activeSession) {
    sessions.push({
      subjectId: activeSession.subjectId,
      taskId: activeSession.taskId ?? null,
      start: activeSession.startedAt,
      end: Math.max(now, activeSession.startedAt),
      live: true,
    });
  }
  return sessions;
}

export function summarizeRange(sessions, from, to) {
  const bySubject = {};
  const pieces = [];
  for (const session of sessions) {
    const start = Math.max(session.start, from);
    const end = Math.min(session.end, to);
    if (end <= start) continue;
    bySubject[session.subjectId] = (bySubject[session.subjectId] || 0) + (end - start) / SECOND;
    pieces.push({ start, end, live: session.live });
  }
  pieces.sort((a, b) => a.start - b.start);

  // foco contínuo: trocar de matéria sem pausa (até 1 min) continua o mesmo bloco de foco
  let longest = 0;
  let blockStart = 0;
  let blockEnd = -Infinity;
  let last = null;
  for (const piece of pieces) {
    if (piece.start - blockEnd > MINUTE) blockStart = piece.start;
    blockEnd = Math.max(blockEnd, piece.end);
    longest = Math.max(longest, (blockEnd - blockStart) / SECOND);
    if (!last || piece.end >= last.end) last = piece;
  }

  return {
    bySubject,
    total: sum(Object.values(bySubject)),
    first: pieces.length ? pieces[0].start : null,
    last: last ? last.end : null,
    lastLive: Boolean(last?.live),
    longest,
    count: pieces.length,
  };
}

// segundos de cada tarefa dentro de um intervalo (alimenta o resumo do dia)
export function taskSecondsInRange(sessions, from, to) {
  const byTask = {};
  for (const session of sessions) {
    if (!session.taskId) continue;
    const start = Math.max(session.start, from);
    const end = Math.min(session.end, to);
    if (end > start) byTask[session.taskId] = (byTask[session.taskId] || 0) + (end - start) / SECOND;
  }
  return byTask;
}

export function buildTimeline(sessions, dayStart, colorOf) {
  const dayEnd = dayStart + BLOCKS_PER_DAY * BLOCK_MS;
  const cells = Array.from({ length: BLOCKS_PER_DAY }, () => []);
  for (const session of sessions) {
    const start = Math.max(session.start, dayStart);
    const end = Math.min(session.end, dayEnd);
    if (end <= start) continue;
    const firstCell = Math.floor((start - dayStart) / BLOCK_MS);
    const lastCell = Math.floor((end - 1 - dayStart) / BLOCK_MS);
    for (let i = firstCell; i <= lastCell; i += 1) {
      const cellStart = dayStart + i * BLOCK_MS;
      const segStart = Math.max(start, cellStart);
      const segEnd = Math.min(end, cellStart + BLOCK_MS);
      cells[i].push({
        left: ((segStart - cellStart) / BLOCK_MS) * 100,
        width: ((segEnd - segStart) / BLOCK_MS) * 100,
        color: colorOf(session.subjectId),
        live: session.live,
      });
    }
  }
  return cells;
}

export function computeStreak(sessions, todayStart) {
  const studied = (start) => summarizeRange(sessions, start, addDays(start, 1)).total > 0;
  let cursor = studied(todayStart) ? todayStart : addDays(todayStart, -1);
  let streak = 0;
  while (streak < 60 && studied(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Tempo gasto e estimativa de cada tarefa. A tarefa-mãe soma o tempo das subtarefas e, se elas
// tiverem estimativa, passa a usar a soma das estimativas delas (como no Super Productivity).
export function buildTaskTotals(tasks, activeSession, now) {
  const live = activeSession?.taskId ? Math.max(0, (now - activeSession.startedAt) / SECOND) : 0;
  const totals = new Map();
  tasks.forEach((task) => {
    totals.set(task.id, {
      spent: (task.timeSpent || 0) + (task.id === activeSession?.taskId ? live : 0),
      estimate: task.timeEstimate || 0,
      childSpent: 0,
      childEstimate: 0,
      subtasks: 0,
      subtasksDone: 0,
    });
  });
  tasks.forEach((task) => {
    const parent = task.parentId && totals.get(task.parentId);
    if (!parent || task.archived) return;
    const own = totals.get(task.id);
    parent.childSpent += own.spent;
    parent.childEstimate += own.estimate;
    parent.subtasks += 1;
    if (task.done) parent.subtasksDone += 1;
  });
  totals.forEach((total) => {
    if (!total.subtasks) return;
    total.spent += total.childSpent;
    if (total.childEstimate) total.estimate = total.childEstimate;
  });
  return totals;
}

export function rankSquads(subgroups, members, mode) {
  return subgroups
    .map((squad, order) => {
      const squadMembers = members.filter((m) => m.subgroupId === squad.id);
      const total = sum(squadMembers.map((m) => m.seconds));
      const avg = squadMembers.length ? total / squadMembers.length : 0;
      return {
        ...squad,
        order,
        members: squadMembers,
        total,
        avg,
        active: squadMembers.filter((m) => m.isStudying).length,
        score: mode === 'avg' ? avg : total,
      };
    })
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

// Tempo de hoje de um colega a partir do que ele publicou no Play/pausa (tudo no relógio do servidor).
export function liveSecondsFor(status, serverNow, dayStartServer, todayKey) {
  if (!status) return 0;
  const base = status.dayKey === todayKey ? Number(status.base) || 0 : 0;
  if (!status.studying || !status.startedAt) return base;
  // se o aparelho caiu no meio da sessão, o tempo conta até o momento da queda
  const end = status.online === false && status.lastSeen ? Math.min(serverNow, status.lastSeen) : serverNow;
  return base + Math.max(0, (end - Math.max(status.startedAt, dayStartServer)) / SECOND);
}

export function buildFeed(members, dayStartServer) {
  const events = [];
  members.forEach((m) => {
    if (m.isCurrentUser) return;
    if (m.isStudying && m.startedAt) events.push({ id: `${m.id}-start`, memberId: m.id, type: 'start', subject: m.currentSubject, ts: m.startedAt });
    else if (!m.online && m.lastSeen >= dayStartServer) events.push({ id: `${m.id}-off`, memberId: m.id, type: 'offline', ts: m.lastSeen });
    else if (m.updatedAt >= dayStartServer) events.push({ id: `${m.id}-pause`, memberId: m.id, type: 'pause', ts: m.updatedAt });
  });
  return events.sort((a, b) => b.ts - a.ts).slice(0, 8);
}
