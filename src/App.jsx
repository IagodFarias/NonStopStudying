/* ========================================================================== */
/* YPT Squads — estudo com cronômetro, tarefas no estilo Super Productivity,  */
/* Modo Estudo com sala ao vivo e Batalha de Squads (Firebase).               */
/* ========================================================================== */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { friendlyError, useSocial } from './social.js';
import { loadInitialState, reducer, STORAGE_KEY } from './state.js';
import { SUBJECT_PALETTE } from './theme.js';
import { addDays, formatHMS, getStudyDayStart, MINUTE, SECOND, toISODate } from './lib/time.js';
import { byCreated, makeId } from './lib/misc.js';
import { buildFeed, buildTaskTotals, getSessions, liveSecondsFor, rankSquads, summarizeRange, taskSecondsInRange } from './lib/stats.js';
import { playChime, unlockAudio } from './lib/alerts.js';
import { closeTopLayer, ConfirmDialog, Toasts, useToasts } from './components/ui.jsx';
import { BottomNav, Header, TABS } from './screens/Header.jsx';
import { TodayScreen } from './screens/TodayScreen.jsx';
import { TaskSheet } from './screens/TaskSheet.jsx';
import { DaySummaryModal } from './screens/DaySummary.jsx';
import { DdayModal, SubjectModal, TimerSettingsModal } from './screens/dialogs.jsx';
import { PlannerScreen } from './screens/PlannerScreen.jsx';
import { StatsScreen } from './screens/StatsScreen.jsx';
import { GroupsScreen, SquadManagerModal } from './screens/GroupsScreen.jsx';
import { ChatScreen } from './screens/ChatScreen.jsx';
import { FocusRoom } from './screens/FocusRoom.jsx';

const CHAT_READ_KEY = 'ypt:chat-read';

function readTabFromHash() {
  const hash = window.location.hash.replace('#', '');
  return TABS.some((t) => t.id === hash) ? hash : 'home';
}

function readChatMarks() {
  try {
    return JSON.parse(window.localStorage.getItem(CHAT_READ_KEY)) ?? {};
  } catch {
    return {};
  }
}

// nome que aparece nos avisos de pausa: a tarefa, se houver, senão a matéria
function sessionLabel(state, session) {
  const task = session.taskId && state.tasks.find((t) => t.id === session.taskId);
  return task?.title ?? state.subjects.find((s) => s.id === session.subjectId)?.name ?? 'Sessão';
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const social = useSocial();
  const [tab, setTab] = useState(readTabFromHash);
  const [focusOpen, setFocusOpen] = useState(false);
  const focusOpenRef = useRef(false);
  focusOpenRef.current = focusOpen;
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [chatMarks, setChatMarks] = useState(readChatMarks);
  const [toasts, pushToast] = useToasts();
  const now = state.lastTick;

  // relógio mestre: avança cronômetros, Pomodoro e placar ao vivo
  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), SECOND);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // sem espaço ou navegação privada: o app segue funcionando só em memória
    }
  }, [state]);

  useEffect(() => {
    try {
      window.history.replaceState(window.history.state, '', `#${tab}`);
    } catch {
      // ambiente sem acesso ao history
    }
    window.scrollTo(0, 0);
  }, [tab]);

  // o Modo Estudo vira uma entrada no histórico: o "voltar" do Android fecha a tela em vez de sair do app
  useEffect(() => {
    const onPop = () => setFocusOpen(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openFocus = useCallback(() => {
    if (!focusOpenRef.current) {
      try {
        window.history.pushState({ ypt: 'focus' }, '');
      } catch {
        // sem history: fecha só pelo botão
      }
    }
    setFocusOpen(true);
    document.documentElement.requestFullscreen?.()?.catch(() => {});
  }, []);

  const closeFocus = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch(() => {});
    if (window.history.state?.ypt === 'focus') window.history.back();
    else setFocusOpen(false);
  }, []);

  // "voltar" do Android: fecha a camada de cima (modal, seletor, Modo Estudo), depois volta para "Hoje" e só então minimiza
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const listener = NativeApp.addListener('backButton', () => {
      if (closeTopLayer()) return;
      if (tabRef.current !== 'home') setTab('home');
      else NativeApp.minimizeApp().catch(() => NativeApp.exitApp());
    });
    return () => {
      listener.then((handle) => handle.remove()).catch(() => {});
    };
  }, []);

  const { notice, clearNotice } = social;
  useEffect(() => {
    if (!notice) return;
    pushToast(notice, 'error');
    clearNotice();
  }, [notice, clearNotice, pushToast]);

  /* ---- tempo e tarefas ---- */
  const todayStart = getStudyDayStart(now);
  const todayEnd = addDays(todayStart, 1);
  const todayKey = toISODate(todayStart);
  const sessions = useMemo(() => getSessions(state.studyLogs, state.activeSession, now), [state.studyLogs, state.activeSession, now]);
  const today = useMemo(() => summarizeRange(sessions, todayStart, todayEnd), [sessions, todayStart, todayEnd]);
  // tempo de hoje sem a sessão em andamento: é o "base" publicado para o grupo
  const todayBase = useMemo(
    () => Math.min(86400, Math.round(summarizeRange(getSessions(state.studyLogs, null, 0), todayStart, todayEnd).total)),
    [state.studyLogs, todayStart, todayEnd],
  );
  const subjectsById = useMemo(() => Object.fromEntries(state.subjects.map((s) => [s.id, s])), [state.subjects]);
  // totalSecondsToday é derivado dos logs (fonte única da verdade), nunca acumulado à parte
  const subjectsToday = useMemo(() => state.subjects.map((s) => ({ ...s, totalSecondsToday: today.bySubject[s.id] ?? 0 })), [state.subjects, today.bySubject]);
  const taskTotals = useMemo(() => buildTaskTotals(state.tasks, state.activeSession, now), [state.tasks, state.activeSession, now]);
  const activeSubject = state.activeSession ? (subjectsById[state.activeSession.subjectId] ?? null) : null;
  const activeTask = state.activeSession?.taskId ? (state.tasks.find((t) => t.id === state.activeSession.taskId) ?? null) : null;
  const sessionSeconds = state.activeSession ? Math.max(0, (now - state.activeSession.startedAt) / SECOND) : 0;
  const selectedDday = state.ddays.find((d) => d.id === state.selectedDdayId) ?? null;
  const nextSubjectColor =
    SUBJECT_PALETTE.find((c) => !state.subjects.some((s) => s.color === c)) ?? SUBJECT_PALETTE[state.subjects.length % SUBJECT_PALETTE.length];

  // o que o Modo Estudo mostra/retoma: a sessão atual, a que a pausa do Pomodoro guardou ou o último registro
  const focusTarget = useMemo(() => {
    const lastLog = state.studyLogs[state.studyLogs.length - 1];
    const candidate = state.activeSession ?? state.pomodoro.resume ?? lastLog ?? null;
    if (!candidate || !subjectsById[candidate.subjectId]) return null;
    const task = candidate.taskId && state.tasks.find((t) => t.id === candidate.taskId && !t.done);
    return { subjectId: candidate.subjectId, taskId: task ? task.id : null };
  }, [state.activeSession, state.pomodoro.resume, state.studyLogs, state.tasks, subjectsById]);

  /* ---- grupo ao vivo ---- */
  const group = social.status === 'ready' ? social.group : null;
  const myUid = social.user?.uid ?? null;
  const offset = social.serverOffset;
  const serverNow = now + offset;
  const todayStartServer = todayStart + offset;
  const liveStartedAt = state.activeSession ? Math.round(state.activeSession.startedAt + offset) : null;
  const { publishLive } = social;

  // só o status ao vivo vai para o grupo: matéria atual, cor, início da sessão e o tempo do dia (nunca as tarefas)
  useEffect(() => {
    if (!group?.id || !social.connected) return;
    publishLive({
      studying: Boolean(activeSubject),
      subject: activeSubject?.name ?? null,
      color: activeSubject?.color ?? null,
      startedAt: activeSubject ? liveStartedAt : null,
      base: todayBase,
      dayKey: todayKey,
    }).catch(() => {});
  }, [group?.id, social.connected, publishLive, activeSubject?.name, activeSubject?.color, liveStartedAt, todayBase, todayKey]);

  const subgroups = useMemo(
    () =>
      Object.entries(group?.squads ?? {})
        .map(([id, squad]) => ({ id, ...squad }))
        .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0)),
    [group?.squads],
  );
  const liveMembers = useMemo(() => {
    if (!group || !myUid) return [];
    const live = group.live ?? {};
    return Object.entries(group.members ?? {}).map(([memberId, member]) => {
      const base = { id: memberId, name: member.name, subgroupId: member.squadId ?? null, joinedAt: member.joinedAt ?? 0 };
      if (memberId === myUid) {
        return {
          ...base,
          isCurrentUser: true,
          isStudying: Boolean(activeSubject),
          online: true,
          currentSubject: activeSubject?.name ?? null,
          subjectColor: activeSubject?.color ?? null,
          seconds: today.total,
        };
      }
      const status = live[memberId];
      const online = status?.online === true;
      return {
        ...base,
        isCurrentUser: false,
        isStudying: Boolean(status?.studying && online),
        online,
        currentSubject: status?.subject ?? null,
        subjectColor: status?.color ?? null,
        startedAt: status?.startedAt ?? null,
        lastSeen: status?.lastSeen ?? null,
        updatedAt: status?.updatedAt ?? null,
        seconds: liveSecondsFor(status, serverNow, todayStartServer, todayKey),
      };
    });
  }, [group, myUid, activeSubject, today.total, serverNow, todayStartServer, todayKey]);
  const me = liveMembers.find((m) => m.isCurrentUser) ?? null;
  const ranking = useMemo(() => rankSquads(subgroups, liveMembers, state.battleMode), [subgroups, liveMembers, state.battleMode]);
  const userSquad = ranking.find((g) => g.id === me?.subgroupId) ?? null;
  const userRank = userSquad ? ranking.indexOf(userSquad) + 1 : null;
  const studyingNow = liveMembers.filter((m) => m.isStudying).length;
  const feed = useMemo(() => buildFeed(liveMembers, todayStartServer), [liveMembers, todayStartServer]);
  const memberById = useMemo(() => Object.fromEntries(liveMembers.map((m) => [m.id, m])), [liveMembers]);
  const squadById = useMemo(() => Object.fromEntries(subgroups.map((g) => [g.id, g])), [subgroups]);

  // avisa quando um squad ultrapassa o líder; trocar o critério ou criar/excluir squads não conta
  const leaderId = ranking[0]?.id;
  const squadsKey = subgroups.map((g) => g.id).join('|');
  const leaderRef = useRef({ id: leaderId, mode: state.battleMode, squadsKey });
  useEffect(() => {
    const previous = leaderRef.current;
    const sameContest = previous.mode === state.battleMode && previous.squadsKey === squadsKey;
    if (sameContest && previous.id && leaderId && previous.id !== leaderId) {
      const leader = subgroups.find((g) => g.id === leaderId);
      if (leader) pushToast(`👑 ${leader.name} assumiu a liderança!`, 'gold');
    }
    leaderRef.current = { id: leaderId, mode: state.battleMode, squadsKey };
  }, [leaderId, state.battleMode, squadsKey, subgroups, pushToast]);

  /* ---- chat: mensagens não lidas ---- */
  const chatGroupId = group?.id ?? null;
  const lastReadId = chatGroupId ? chatMarks[chatGroupId] : undefined;
  const unread = chatGroupId ? social.messages.filter((m) => m.uid !== myUid && (!lastReadId || m.id > lastReadId)).length : 0;
  const lastMessageId = social.messages[social.messages.length - 1]?.id;
  useEffect(() => {
    if (tab !== 'chat' || !chatGroupId || !lastMessageId || chatMarks[chatGroupId] === lastMessageId) return;
    const next = { ...chatMarks, [chatGroupId]: lastMessageId };
    setChatMarks(next);
    try {
      window.localStorage.setItem(CHAT_READ_KEY, JSON.stringify(next));
    } catch {
      // sem localStorage: as não lidas voltam ao reabrir o app
    }
  }, [tab, chatGroupId, lastMessageId, chatMarks]);

  /* ---- avisos do Pomodoro ---- */
  const lastEvent = state.pomodoro.lastEvent;
  const seenEventRef = useRef(lastEvent?.at ?? null);
  useEffect(() => {
    if (!lastEvent || lastEvent.at === seenEventRef.current) return;
    seenEventRef.current = lastEvent.at;
    if (Date.now() - lastEvent.at > 10 * MINUTE) return; // aconteceu com o app fechado
    if (stateRef.current.preferences.sound) playChime(lastEvent.type === 'focus-done' ? 'focus' : 'break');
    if (lastEvent.type === 'focus-done') {
      pushToast(`🍅 Ciclo concluído! ${lastEvent.breakKind === 'long' ? 'Pausa longa' : 'Pausa'} de ${lastEvent.minutes} min`, 'gold');
    } else {
      pushToast(lastEvent.autoStarted ? '⏱ A pausa acabou — o próximo foco já começou' : '⏰ A pausa acabou — bora voltar!', 'gold');
    }
  }, [lastEvent, pushToast]);

  /* ---- ações ---- */
  const runSocial = useCallback(
    async (operation, successMessage) => {
      try {
        await operation();
        if (successMessage) pushToast(successMessage);
        return true;
      } catch (error) {
        pushToast(friendlyError(error), 'error');
        return false;
      }
    },
    [pushToast],
  );

  const startTarget = useCallback(
    (subjectId, taskId = null) => {
      const current = stateRef.current;
      const active = current.activeSession;
      const t = Date.now();
      unlockAudio();
      if (active && !(active.subjectId === subjectId && (active.taskId ?? null) === taskId)) {
        pushToast(`🔁 ${sessionLabel(current, active)} pausada automaticamente · ${formatHMS((t - active.startedAt) / SECOND)} registrado`);
      }
      dispatch({ type: 'START', subjectId, taskId, now: t });
      if (current.preferences.openFocusOnPlay) openFocus();
    },
    [openFocus, pushToast],
  );

  const pause = useCallback(() => {
    const current = stateRef.current;
    const active = current.activeSession;
    if (!active) return;
    const t = Date.now();
    dispatch({ type: 'PAUSE', now: t });
    pushToast(`⏸ ${sessionLabel(current, active)} pausada · ${formatHMS((t - active.startedAt) / SECOND)} registrado`);
  }, [pushToast]);

  const stop = () => {
    const current = stateRef.current;
    const active = current.activeSession;
    const t = Date.now();
    dispatch({ type: 'STOP', now: t });
    if (active) pushToast(`■ Sessão encerrada · ${formatHMS((t - active.startedAt) / SECOND)} em ${sessionLabel(current, active)}`);
    closeFocus();
  };

  const toggleSubject = (subjectId) => {
    const active = stateRef.current.activeSession;
    if (active && active.subjectId === subjectId && !active.taskId) pause();
    else startTarget(subjectId, null);
  };

  const playTask = (task) => {
    if (stateRef.current.activeSession?.taskId === task.id) pause();
    else startTarget(task.subjectId, task.id);
  };

  const addTask = ({ title, subjectId, inToday = false, parentId = null }) =>
    dispatch({
      type: 'ADD_TASK',
      task: {
        id: makeId('task'),
        subjectId,
        parentId,
        title,
        notes: '',
        done: false,
        doneAt: null,
        timeEstimate: 0,
        timeSpent: 0,
        inToday,
        archived: false,
        createdAt: Date.now(),
      },
    });

  const updateTask = (id, patch) => dispatch({ type: 'UPDATE_TASK', id, patch });

  const toggleDone = (task) => {
    dispatch({ type: 'TOGGLE_TASK', id: task.id, now: Date.now() });
    if (!task.done) pushToast(`✅ ${task.title} concluída`);
  };

  const toggleToday = (task) => {
    dispatch({ type: 'TOGGLE_TODAY', id: task.id });
    pushToast(task.inToday ? 'Tarefa voltou para o backlog' : '☀ Planejada para hoje');
  };

  const requestDeleteTask = (task) =>
    setConfirm({
      title: task.parentId ? 'Excluir subtarefa?' : 'Excluir tarefa?',
      message: task.parentId
        ? `“${task.title}” será removida. O tempo que você já estudou continua no seu histórico.`
        : `“${task.title}” e as subtarefas dela serão removidas. O tempo que você já estudou continua no seu histórico.`,
      confirmLabel: 'Excluir',
      onConfirm: () => {
        dispatch({ type: 'DELETE_TASK', id: task.id, now: Date.now() });
        setDialog((current) => (current?.type === 'task' && current.id === task.id ? null : current));
        pushToast('Tarefa excluída');
      },
    });

  const addSubject = (values) => dispatch({ type: 'ADD_SUBJECT', subject: { id: makeId('sub'), ...values } });

  const saveSubject = (values) => {
    if (dialog?.subject) {
      dispatch({ type: 'UPDATE_SUBJECT', id: dialog.subject.id, patch: values });
      pushToast(`Matéria ${values.name} atualizada`);
    } else {
      addSubject(values);
      pushToast(`Matéria ${values.name} criada`);
    }
    setDialog(null);
  };

  const requestDeleteSubject = (subject) =>
    setConfirm({
      title: 'Excluir matéria?',
      message: `“${subject.name}”, as tarefas dela e todo o histórico de estudo da matéria serão removidos. Essa ação não pode ser desfeita.`,
      confirmLabel: 'Excluir matéria',
      onConfirm: () => {
        dispatch({ type: 'DELETE_SUBJECT', id: subject.id });
        setDialog(null);
        pushToast(`Matéria ${subject.name} excluída`);
      },
    });

  const openTask = dialog?.type === 'task' ? state.tasks.find((t) => t.id === dialog.id) : null;

  let toastPlacement = 'bottom';
  if (focusOpen) toastPlacement = 'focus';
  else if (dialog || confirm) toastPlacement = 'top';
  else if (tab === 'chat' && group) toastPlacement = 'chat';

  return (
    <div className="min-h-screen bg-surface text-fg antialiased">
      <Header
        now={now}
        totalSeconds={today.total}
        activeSubject={activeSubject}
        activeTask={activeTask}
        sessionSeconds={sessionSeconds}
        timerMode={state.timerMode}
        pomodoro={state.pomodoro}
        dday={selectedDday}
        onOpenDday={() => setDialog({ type: 'dday' })}
        onOpenFocus={openFocus}
      />

      <main key={tab} className="ypt-fade mx-auto max-w-2xl px-4 pb-32 pt-4">
        {tab === 'home' && (
          <TodayScreen
            now={now}
            subjects={subjectsToday}
            tasks={state.tasks}
            taskTotals={taskTotals}
            activeSession={state.activeSession}
            timerMode={state.timerMode}
            pomodoro={state.pomodoro}
            pomodoroSettings={state.pomodoroSettings}
            todaySeconds={today.total}
            socialStatus={social.status}
            userSquad={userSquad}
            userRank={userRank}
            ranking={ranking}
            battleMode={state.battleMode}
            onToggleSubject={toggleSubject}
            onPlayTask={playTask}
            onToggleDone={toggleDone}
            onOpenTask={(id) => setDialog({ type: 'task', id })}
            onAddTask={addTask}
            onToggleToday={toggleToday}
            onCreateSubject={() => setDialog({ type: 'subject', subject: null })}
            onQuickAdd={(name) => addSubject({ name, color: nextSubjectColor })}
            onEditSubject={(subject) => setDialog({ type: 'subject', subject })}
            onSetTimerMode={(mode) => dispatch({ type: 'SET_TIMER_MODE', mode, now: Date.now() })}
            onOpenTimerSettings={() => setDialog({ type: 'timer' })}
            onOpenFocus={openFocus}
            onSkipBreak={() => dispatch({ type: 'SKIP_BREAK' })}
            onOpenSummary={() => setDialog({ type: 'summary' })}
            onOpenGroups={() => setTab('groups')}
            onOpenManager={() => setDialog({ type: 'squads' })}
          />
        )}
        {tab === 'planner' && (
          <PlannerScreen sessions={sessions} todayStart={todayStart} now={now} subjects={state.subjects} subjectsById={subjectsById} tasks={state.tasks} />
        )}
        {tab === 'stats' && (
          <StatsScreen
            sessions={sessions}
            todayStart={todayStart}
            subjectsById={subjectsById}
            me={me}
            userSquad={userSquad}
            groupId={group?.id ?? null}
            fetchDays={social.actions.fetchDays}
          />
        )}
        {tab === 'groups' && (
          <GroupsScreen
            social={social}
            runSocial={runSocial}
            pushToast={pushToast}
            members={liveMembers}
            ranking={ranking}
            subgroups={subgroups}
            mode={state.battleMode}
            feed={feed}
            serverNow={serverNow}
            userSquadId={me?.subgroupId ?? null}
            onSetMode={(mode) => dispatch({ type: 'SET_BATTLE_MODE', mode })}
            onOpenManager={() => setDialog({ type: 'squads' })}
          />
        )}
        {tab === 'chat' && (
          <ChatScreen
            social={social}
            runSocial={runSocial}
            pushToast={pushToast}
            memberById={memberById}
            squadById={squadById}
            onOpenGroups={() => setTab('groups')}
          />
        )}
      </main>

      <BottomNav tab={tab} onChange={setTab} studying={Boolean(activeSubject)} studyingNow={studyingNow} unread={unread} />

      {focusOpen && (
        <FocusRoom
          now={now}
          timerMode={state.timerMode}
          pomodoro={state.pomodoro}
          pomodoroSettings={state.pomodoroSettings}
          activeSession={state.activeSession}
          target={focusTarget}
          subjects={state.subjects}
          subjectsById={subjectsById}
          tasks={state.tasks}
          taskTotals={taskTotals}
          todaySeconds={today.total}
          sessionSeconds={sessionSeconds}
          members={liveMembers}
          squadById={squadById}
          mySquadId={me?.subgroupId ?? null}
          myName={me?.name ?? social.myName}
          socialStatus={social.status}
          dday={selectedDday}
          onPause={pause}
          onResume={() => focusTarget && startTarget(focusTarget.subjectId, focusTarget.taskId)}
          onStop={stop}
          onSkipBreak={() => dispatch({ type: 'SKIP_BREAK' })}
          onPick={startTarget}
          onSetEstimate={(id, seconds) => updateTask(id, { timeEstimate: seconds })}
          onClose={closeFocus}
          onOpenGroups={() => {
            closeFocus();
            setTab('groups');
          }}
        />
      )}

      {openTask && (
        <TaskSheet
          key={openTask.id}
          task={openTask}
          subtasks={state.tasks.filter((t) => t.parentId === openTask.id && !t.archived).sort(byCreated)}
          totals={taskTotals}
          subjects={state.subjects}
          activeTaskId={state.activeSession?.taskId ?? null}
          onUpdate={updateTask}
          onToggleDone={toggleDone}
          onToggleToday={toggleToday}
          onPlay={playTask}
          onAddSubtask={(parent, title) => addTask({ title, subjectId: parent.subjectId, parentId: parent.id })}
          onDelete={requestDeleteTask}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'summary' && (
        <DaySummaryModal
          dayStart={todayStart}
          summary={today}
          subjectsById={subjectsById}
          tasks={state.tasks}
          taskSeconds={taskSecondsInRange(sessions, todayStart, todayEnd)}
          onFinish={() => {
            dispatch({ type: 'FINISH_DAY' });
            setDialog(null);
            pushToast('🌙 Dia encerrado. Bom descanso!');
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'timer' && (
        <TimerSettingsModal
          settings={state.pomodoroSettings}
          preferences={state.preferences}
          onChangeSettings={(patch) => dispatch({ type: 'UPDATE_POMODORO_SETTINGS', patch })}
          onChangePreference={(key, value) => dispatch({ type: 'SET_PREFERENCE', key, value })}
          onTestSound={() => {
            unlockAudio();
            playChime('test');
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'subject' && (
        <SubjectModal
          key={dialog.subject?.id ?? 'new'}
          subject={dialog.subject}
          defaultColor={nextSubjectColor}
          onSave={saveSubject}
          onDelete={() => requestDeleteSubject(dialog.subject)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'dday' && (
        <DdayModal
          ddays={state.ddays}
          selectedId={state.selectedDdayId}
          now={now}
          onSelect={(id) => {
            dispatch({ type: 'SELECT_DDAY', id });
            setDialog(null);
          }}
          onAdd={(dday) => {
            dispatch({ type: 'ADD_DDAY', dday });
            pushToast(`D-Day “${dday.title}” adicionado`);
          }}
          onDelete={(id) => dispatch({ type: 'DELETE_DDAY', id })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.type === 'squads' && group && (
        <SquadManagerModal
          group={group}
          subgroups={subgroups}
          members={liveMembers}
          myUid={myUid}
          myName={social.myName}
          actions={social.actions}
          runSocial={runSocial}
          pushToast={pushToast}
          onConfirm={setConfirm}
          onClose={() => setDialog(null)}
        />
      )}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}

      <Toasts toasts={toasts} placement={toastPlacement} />
    </div>
  );
}
