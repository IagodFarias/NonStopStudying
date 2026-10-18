// Testes da lógica local (src/state.js e src/lib): tarefas, tempo gasto, Pomodoro e migração da v2.
// Rode com `npm run test:state`.
import assert from 'node:assert/strict';

const storage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
};

const { createInitialState, loadInitialState, reducer } = await import('../src/state.js');
const { buildTaskTotals } = await import('../src/lib/stats.js');
const { parseDuration, MINUTE } = await import('../src/lib/time.js');

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log(`  ok  ${name}`);
}

const T0 = new Date(2026, 9, 18, 9, 0, 0).getTime(); // sábado 09:00, dentro do mesmo dia de estudo
const task = (id, extra = {}) => ({
  id,
  subjectId: 'mat',
  parentId: null,
  title: id,
  notes: '',
  done: false,
  doneAt: null,
  timeEstimate: 0,
  timeSpent: 0,
  inToday: false,
  archived: false,
  createdAt: T0,
  ...extra,
});
const run = (state, ...actions) => actions.reduce(reducer, state);
const base = () => ({
  ...createInitialState(T0),
  subjects: [
    { id: 'mat', name: 'Matemática', color: '#3B82F6' },
    { id: 'fis', name: 'Física', color: '#22C55E' },
  ],
  tasks: [task('lista'), task('sub1', { parentId: 'lista', timeEstimate: 30 * 60 }), task('sub2', { parentId: 'lista', timeEstimate: 20 * 60 })],
});
const pomodoroBase = () => run(base(), { type: 'SET_TIMER_MODE', mode: 'pomodoro', now: T0 });

console.log('Tarefas e tempo gasto');
test('tempo da sessão vai para a tarefa ao pausar', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'lista', now: T0 }, { type: 'PAUSE', now: T0 + 10 * MINUTE });
  assert.equal(s.tasks.find((t) => t.id === 'lista').timeSpent, 600);
  assert.equal(s.studyLogs.at(-1).taskId, 'lista');
  assert.equal(s.activeSession, null);
});
test('dar Play em outra tarefa encerra e registra a anterior', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'sub1', now: T0 }, { type: 'START', subjectId: 'fis', taskId: null, now: T0 + 5 * MINUTE });
  assert.equal(s.tasks.find((t) => t.id === 'sub1').timeSpent, 300);
  assert.equal(s.activeSession.subjectId, 'fis');
  assert.equal(s.studyLogs.length, 1);
});
test('tarefa-mãe soma tempo e estimativa das subtarefas', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'sub1', now: T0 }, { type: 'PAUSE', now: T0 + 15 * MINUTE });
  const totals = buildTaskTotals(s.tasks, null, T0);
  assert.equal(totals.get('lista').spent, 900);
  assert.equal(totals.get('lista').estimate, 50 * 60);
  assert.equal(totals.get('lista').subtasks, 2);
});
test('sessão em andamento entra no total ao vivo', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'sub2', now: T0 });
  assert.equal(buildTaskTotals(s.tasks, s.activeSession, T0 + 2 * MINUTE).get('sub2').spent, 120);
});
test('concluir a tarefa ativa encerra a sessão e conclui as subtarefas', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'lista', now: T0 }, { type: 'TOGGLE_TASK', id: 'lista', now: T0 + MINUTE });
  assert.equal(s.activeSession, null);
  assert.ok(s.tasks.every((t) => t.done && t.doneAt === T0 + MINUTE));
});
test('encerrar o dia arquiva só as concluídas de hoje (com subtarefas)', () => {
  const start = { ...base(), tasks: [task('feita', { inToday: true, done: true }), task('filha', { parentId: 'feita' }), task('pendente', { inToday: true })] };
  const s = run(start, { type: 'FINISH_DAY' });
  assert.deepEqual(
    s.tasks.map((t) => [t.id, t.archived, t.inToday]),
    [
      ['feita', true, false],
      ['filha', true, false],
      ['pendente', false, true],
    ],
  );
});
test('excluir a matéria remove as tarefas e o histórico dela', () => {
  const s = run(base(), { type: 'START', subjectId: 'mat', taskId: 'lista', now: T0 }, { type: 'PAUSE', now: T0 + MINUTE }, { type: 'DELETE_SUBJECT', id: 'mat' });
  assert.equal(s.tasks.length, 0);
  assert.equal(s.studyLogs.length, 0);
});

console.log('Pomodoro');
test('foco de 25 min fecha a sessão exatamente no fim e começa a pausa', () => {
  const s = run(pomodoroBase(), { type: 'START', subjectId: 'mat', taskId: 'lista', now: T0 }, { type: 'TICK', now: T0 + 25 * MINUTE + 1000 });
  assert.equal(s.pomodoro.phase, 'break');
  assert.equal(s.pomodoro.breakKind, 'short');
  assert.equal(s.activeSession, null);
  assert.equal(s.studyLogs.at(-1).durationSeconds, 25 * 60);
  assert.equal(s.pomodoro.lastEvent.type, 'focus-done');
});
test('fim da pausa volta para "pronto" e avisa', () => {
  const s = run(pomodoroBase(), { type: 'START', subjectId: 'mat', now: T0 }, { type: 'TICK', now: T0 + 25 * MINUTE }, { type: 'TICK', now: T0 + 30 * MINUTE + 1000 });
  assert.equal(s.pomodoro.phase, 'idle');
  assert.equal(s.pomodoro.lastEvent.type, 'break-done');
});
test('pausar guarda o tempo restante e o Play continua de onde parou', () => {
  const paused = run(pomodoroBase(), { type: 'START', subjectId: 'mat', now: T0 }, { type: 'PAUSE', now: T0 + 10 * MINUTE });
  assert.equal(paused.pomodoro.remaining, 15 * MINUTE);
  const resumed = run(paused, { type: 'START', subjectId: 'mat', now: T0 + 20 * MINUTE });
  assert.equal(resumed.pomodoro.endsAt, T0 + 35 * MINUTE);
});
test('a cada 4 ciclos a pausa é longa', () => {
  const s = run({ ...pomodoroBase(), pomodoro: { ...pomodoroBase().pomodoro, completed: 3, cycleDay: '2026-10-18' } }, { type: 'START', subjectId: 'mat', now: T0 }, { type: 'TICK', now: T0 + 25 * MINUTE });
  assert.equal(s.pomodoro.breakKind, 'long');
  assert.equal(s.pomodoro.endsAt, T0 + 40 * MINUTE);
});
test('com início automático, a pausa acaba e o foco volta para a mesma tarefa', () => {
  const auto = run(pomodoroBase(), { type: 'UPDATE_POMODORO_SETTINGS', patch: { autoStart: true } });
  const s = run(auto, { type: 'START', subjectId: 'mat', taskId: 'sub1', now: T0 }, { type: 'TICK', now: T0 + 30 * MINUTE + 1000 });
  assert.equal(s.pomodoro.phase, 'focus');
  assert.equal(s.activeSession.taskId, 'sub1');
  assert.equal(s.activeSession.startedAt, T0 + 30 * MINUTE);
});
test('app fechado por horas: fecha foco e pausa de uma vez, sem contar tempo a mais', () => {
  const s = run(pomodoroBase(), { type: 'START', subjectId: 'mat', taskId: 'lista', now: T0 }, { type: 'TICK', now: T0 + 3 * 60 * MINUTE });
  assert.equal(s.pomodoro.phase, 'idle');
  assert.equal(s.tasks.find((t) => t.id === 'lista').timeSpent, 25 * 60);
});

console.log('Estimativas digitadas');
test('lê os formatos de estimativa', () => {
  const cases = { '1h30m': 5400, '1h30': 5400, '90m': 5400, '45 min': 2700, '1,5h': 5400, '1:30': 5400, 40: 2400, '2h': 7200, '': 0, abc: null };
  Object.entries(cases).forEach(([input, expected]) => assert.equal(parseDuration(input), expected, input));
});

console.log('Migração dos dados da versão anterior');
test('tarefas antigas viram backlog e o histórico é mantido', () => {
  storage.clear();
  storage.set(
    'ypt:v2',
    JSON.stringify({
      version: 2,
      subjects: [{ id: 'calc', name: 'Cálculo', color: '#3B82F6', todos: [{ id: 't1', text: 'Lista 3', done: true }, { id: 't2', text: 'Revisar Taylor', done: false }] }],
      studyLogs: [{ id: 'l1', subjectId: 'calc', startTime: Date.now() - 3600e3, endTime: Date.now() - 1800e3, durationSeconds: 1800 }],
      activeSession: null,
      ddays: [{ id: 'd1', title: 'Prova', date: '2026-11-20' }],
      selectedDdayId: 'd1',
      battleMode: 'total',
    }),
  );
  const s = loadInitialState();
  assert.equal(s.version, 3);
  assert.deepEqual(s.subjects, [{ id: 'calc', name: 'Cálculo', color: '#3B82F6' }]);
  assert.deepEqual(
    s.tasks.map((t) => [t.id, t.title, t.done, t.inToday]),
    [
      ['t1', 'Lista 3', true, false],
      ['t2', 'Revisar Taylor', false, false],
    ],
  );
  assert.equal(s.studyLogs[0].taskId, null);
  assert.equal(s.ddays.length, 1);
  assert.equal(s.battleMode, 'total');
  assert.ok(storage.has('ypt:v2'), 'o backup da v2 continua no aparelho');
});

console.log(`\n${passed} verificações passaram.`);
