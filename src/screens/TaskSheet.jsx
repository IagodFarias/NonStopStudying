import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Sun, Trash2, X } from 'lucide-react';
import { COLORS, INPUT, INSET_INPUT, LABEL, PRIMARY_BTN } from '../theme.js';
import { formatDuration, formatEstimateInput, formatHMS, parseDuration } from '../lib/time.js';
import { CheckButton, Modal, PlayButton, ProgressBar } from '../components/ui.jsx';
import { MarkdownText } from '../components/Markdown.jsx';

const blurOnEnter = (event) => {
  if (event.key === 'Enter') event.currentTarget.blur();
};

function EstimateInput({ seconds, onSave, compact = false }) {
  const [text, setText] = useState(formatEstimateInput(seconds));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(formatEstimateInput(seconds));
  }, [seconds]);

  const commit = () => {
    const parsed = parseDuration(text);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setText(formatEstimateInput(parsed));
    if (parsed !== seconds) onSave(parsed);
  };

  const base = compact
    ? 'w-[4.5rem] rounded-lg border bg-shell px-2 py-1 text-xs text-fg placeholder:text-muted/60 outline-none focus:border-primary'
    : `${INSET_INPUT} w-28`;
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={blurOnEnter}
      placeholder={compact ? 'meta' : 'ex.: 1h30m'}
      aria-label="Estimativa de tempo"
      aria-invalid={invalid}
      className={`${base} ${invalid ? 'border-danger' : 'border-line'}`}
    />
  );
}

function SubtaskEditor({ task, total, active, onUpdate, onToggleDone, onPlay, onDelete }) {
  const [title, setTitle] = useState(task.title);

  useEffect(() => {
    setTitle(task.title);
  }, [task.title]);

  const save = () => {
    const value = title.trim();
    if (!value) setTitle(task.title);
    else if (value !== task.title) onUpdate(task.id, { title: value });
  };

  return (
    <li className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${active ? 'border-flame/60 bg-flame/[0.07]' : 'border-line bg-card'}`}>
      <CheckButton small checked={task.done} onClick={() => onToggleDone(task)} label={task.done ? 'Reabrir subtarefa' : 'Concluir subtarefa'} />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={blurOnEnter}
        maxLength={120}
        aria-label="Título da subtarefa"
        className={`min-w-0 flex-1 bg-transparent text-sm outline-none ${task.done ? 'text-muted line-through' : 'text-fg'}`}
      />
      <span className={`shrink-0 text-[11px] tabular-nums ${active ? 'text-flame' : 'text-muted'}`}>{formatDuration(total.spent)}</span>
      <EstimateInput compact seconds={task.timeEstimate} onSave={(seconds) => onUpdate(task.id, { timeEstimate: seconds })} />
      {!task.done && <PlayButton size="sm" active={active} onClick={() => onPlay(task)} label={active ? `Pausar ${task.title}` : `Iniciar ${task.title}`} />}
      <button
        type="button"
        onClick={() => onDelete(task)}
        aria-label="Excluir subtarefa"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition hover:bg-danger/10 hover:text-danger"
      >
        <X size={14} />
      </button>
    </li>
  );
}

export function TaskSheet({ task, subtasks, totals, subjects, activeTaskId, onUpdate, onToggleDone, onToggleToday, onPlay, onAddSubtask, onDelete, onClose }) {
  const total = totals.get(task.id);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [editingNotes, setEditingNotes] = useState(!task.notes);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const subject = subjects.find((s) => s.id === task.subjectId);
  const active = activeTaskId === task.id;
  const hasSubtaskEstimates = subtasks.some((s) => s.timeEstimate > 0);
  const ratio = total.estimate ? total.spent / total.estimate : 0;
  const remaining = total.estimate - total.spent;
  const subtasksDone = subtasks.filter((s) => s.done).length;

  const saveTitle = () => {
    const value = title.trim();
    if (!value) setTitle(task.title);
    else if (value !== task.title) onUpdate(task.id, { title: value });
  };

  const saveNotes = () => {
    if (notes !== (task.notes ?? '')) onUpdate(task.id, { notes });
  };

  const toggleNotesMode = () => {
    if (editingNotes) saveNotes();
    setEditingNotes((value) => !value);
  };

  const addSubtask = (event) => {
    event.preventDefault();
    const value = subtaskTitle.trim();
    if (!value) return;
    onAddSubtask(task, value);
    setSubtaskTitle('');
  };

  return (
    <Modal title={task.done ? 'Tarefa concluída' : 'Detalhes da tarefa'} subtitle={subject ? `Matéria: ${subject.name}` : undefined} onClose={onClose}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={blurOnEnter}
        maxLength={120}
        aria-label="Título da tarefa"
        className={`${INPUT} text-base font-semibold`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={task.subjectId}
          onChange={(e) => onUpdate(task.id, { subjectId: e.target.value })}
          aria-label="Matéria"
          className={`${INSET_INPUT} w-auto max-w-[60%] bg-card [color-scheme:dark]`}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onToggleToday(task)}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
            task.inToday ? 'border-amber/50 bg-amber/15 text-amber' : 'border-line text-fg/85 hover:bg-raised'
          }`}
        >
          <Sun size={14} /> {task.inToday ? 'Planejada para hoje' : 'Planejar para hoje'}
        </button>
      </div>

      <section className="mt-4 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-center gap-3">
          {!task.done && <PlayButton size="lg" active={active} onClick={() => onPlay(task)} label={active ? `Pausar ${task.title}` : `Iniciar ${task.title}`} />}
          <div className="min-w-0 flex-1">
            <p className={LABEL}>Tempo gasto</p>
            <p className={`font-mono text-2xl font-bold tabular-nums ${active ? 'text-flame' : 'text-fg'}`}>{formatHMS(total.spent)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={LABEL}>Estimativa</p>
            {hasSubtaskEstimates ? (
              <p className="text-sm font-semibold text-fg">
                {formatDuration(total.estimate)}
                <span className="block text-[10px] font-normal text-muted">soma das subtarefas</span>
              </p>
            ) : (
              <EstimateInput seconds={task.timeEstimate} onSave={(seconds) => onUpdate(task.id, { timeEstimate: seconds })} />
            )}
          </div>
        </div>
        {total.estimate > 0 && (
          <>
            <ProgressBar value={ratio} thick className="mt-3" color={ratio >= 1 ? COLORS.amber : active ? COLORS.flame : COLORS.primary} />
            <p className="mt-1.5 text-xs text-muted">
              {remaining >= 0 ? `Faltam ${formatDuration(remaining)} para a meta` : `${formatDuration(-remaining)} além da meta`}
            </p>
          </>
        )}
      </section>

      <section className="mt-5">
        <p className={LABEL}>Subtarefas{subtasks.length ? ` (${subtasksDone}/${subtasks.length})` : ''}</p>
        <ul className="space-y-1.5">
          {subtasks.map((sub) => (
            <SubtaskEditor
              key={sub.id}
              task={sub}
              total={totals.get(sub.id)}
              active={activeTaskId === sub.id}
              onUpdate={onUpdate}
              onToggleDone={onToggleDone}
              onPlay={onPlay}
              onDelete={onDelete}
            />
          ))}
        </ul>
        <form onSubmit={addSubtask} className="mt-2 flex gap-2">
          <input
            value={subtaskTitle}
            onChange={(e) => setSubtaskTitle(e.target.value)}
            maxLength={120}
            placeholder="Nova subtarefa…"
            aria-label="Nova subtarefa"
            className={`${INSET_INPUT} min-w-0 flex-1 bg-card`}
          />
          <button
            type="submit"
            disabled={!subtaskTitle.trim()}
            aria-label="Adicionar subtarefa"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition hover:brightness-110 disabled:opacity-30"
          >
            <Plus size={18} />
          </button>
        </form>
      </section>

      <section className="mt-5">
        <div className="mb-1.5 flex items-center justify-between">
          <p className={`${LABEL} mb-0`}>Notas</p>
          <button type="button" onClick={toggleNotesMode} className="flex items-center gap-1 text-xs font-semibold text-primary">
            {editingNotes ? (
              <>
                <Eye size={13} /> Visualizar
              </>
            ) : (
              <>
                <Pencil size={13} /> Editar
              </>
            )}
          </button>
        </div>
        {editingNotes ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            rows={5}
            maxLength={5000}
            aria-label="Notas da tarefa"
            placeholder={'Anotações, links, fórmulas…\nAceita **negrito**, *itálico*, `código` e listas com - [ ]'}
            className={`${INPUT} min-h-28 resize-y leading-relaxed`}
          />
        ) : notes.trim() ? (
          <button type="button" onClick={() => setEditingNotes(true)} className="block w-full rounded-xl border border-line bg-card p-3 text-left">
            <MarkdownText text={notes} />
          </button>
        ) : (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-muted">Sem notas.</p>
        )}
      </section>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => onDelete(task)}
          className="flex items-center gap-1.5 rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
        >
          <Trash2 size={15} /> Excluir
        </button>
        <button type="button" onClick={() => onToggleDone(task)} className={`${PRIMARY_BTN} flex-1`}>
          {task.done ? 'Reabrir tarefa' : 'Concluir tarefa'}
        </button>
      </div>
    </Modal>
  );
}
