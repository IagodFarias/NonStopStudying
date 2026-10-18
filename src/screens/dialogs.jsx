import { useState } from 'react';
import { Play, Trash2, Volume2 } from 'lucide-react';
import { COLORS, INPUT, LABEL, PRIMARY_BTN, SECONDARY_BTN, SUBJECT_PALETTE } from '../theme.js';
import { addDays, ddayInfo, formatISODate, toISODate } from '../lib/time.js';
import { clamp, makeId, withAlpha } from '../lib/misc.js';
import { ColorPicker, Modal, Toggle } from '../components/ui.jsx';

export function SubjectModal({ subject, defaultColor, onSave, onDelete, onClose }) {
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? defaultColor);

  const submit = (event) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSave({ name: trimmed, color });
  };

  return (
    <Modal
      title={subject ? 'Editar matéria' : 'Nova matéria'}
      subtitle={subject ? 'Altere nome e cor, ou exclua a matéria' : 'Cada matéria tem cronômetro e backlog de tarefas'}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-5">
        <label className="block">
          <span className={LABEL}>Nome</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="Ex.: Química Orgânica" className={INPUT} />
        </label>
        <div>
          <span className={LABEL}>Cor</span>
          <ColorPicker palette={SUBJECT_PALETTE} value={color} onChange={setColor} />
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: withAlpha(color, 0.16), color }}>
            <Play size={16} fill="currentColor" className="ml-0.5" />
          </span>
          <span className="min-w-0 flex-1 truncate font-semibold text-fg">{name.trim() || 'Pré-visualização'}</span>
          <span className="font-mono tabular-nums text-muted">00:00:00</span>
        </div>
        <div className="flex gap-2">
          {subject && (
            <button
              type="button"
              onClick={onDelete}
              className="flex items-center gap-1.5 rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
            >
              <Trash2 size={15} /> Excluir
            </button>
          )}
          <button type="submit" disabled={!name.trim()} className={`${PRIMARY_BTN} flex-1`}>
            {subject ? 'Salvar alterações' : 'Criar matéria'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DdayModal({ ddays, selectedId, now, onSelect, onAdd, onDelete, onClose }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => toISODate(addDays(now, 21)));
  const sorted = [...ddays].sort((a, b) => a.date.localeCompare(b.date));

  const submit = (event) => {
    event.preventDefault();
    if (!title.trim() || !date) return;
    onAdd({ id: makeId('dd'), title: title.trim(), date });
    setTitle('');
  };

  return (
    <Modal title="Metas D-Day" subtitle="Escolha a contagem regressiva exibida no topo" onClose={onClose}>
      <div className="space-y-2">
        {sorted.map((d) => {
          const info = ddayInfo(d.date, now);
          const selected = d.id === selectedId;
          return (
            <div key={d.id} className={`flex items-center gap-2 rounded-2xl border p-2 transition ${selected ? 'border-primary/60 bg-primary/10' : 'border-line bg-card'}`}>
              <button type="button" onClick={() => onSelect(d.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left">
                <span className={`w-[4.5rem] shrink-0 rounded-xl py-2 text-center text-sm font-black tabular-nums ${selected ? 'bg-primary text-white' : 'bg-shell text-fg/85'}`}>
                  {info.label}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-fg">{d.title}</span>
                  <span className="block text-xs text-muted">{formatISODate(d.date)}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(d.id)}
                aria-label={`Excluir ${d.title}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
            Nenhum D-Day ainda. Cadastre a data da sua prova ou entrega.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="mt-5 border-t border-line pt-4">
        <p className={LABEL}>Novo D-Day</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={32} placeholder="Ex.: Prova de Anatomia" className={INPUT} />
        <div className="mt-2 flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required aria-label="Data" className={`${INPUT} [color-scheme:dark]`} />
          <button type="submit" disabled={!title.trim() || !date} className={`${PRIMARY_BTN} shrink-0`}>
            Adicionar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function MinutesField({ label, value, min, max, onCommit }) {
  const [text, setText] = useState(String(value));
  const commit = () => {
    const next = clamp(Math.round(Number(text) || value), min, max);
    setText(String(next));
    if (next !== value) onCommit(next);
  };
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        className={INPUT}
      />
    </label>
  );
}

export function TimerSettingsModal({ settings, preferences, onChangeSettings, onChangePreference, onTestSound, onClose }) {
  return (
    <Modal title="Cronômetro e Pomodoro" subtitle="Ajuste os ciclos e o que acontece ao dar Play" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <MinutesField label="Foco (min)" value={settings.focus} min={1} max={180} onCommit={(focus) => onChangeSettings({ focus })} />
        <MinutesField label="Pausa curta (min)" value={settings.short} min={1} max={60} onCommit={(short) => onChangeSettings({ short })} />
        <MinutesField label="Pausa longa (min)" value={settings.long} min={1} max={90} onCommit={(long) => onChangeSettings({ long })} />
        <MinutesField label="Pausa longa a cada" value={settings.longEvery} min={2} max={10} onCommit={(longEvery) => onChangeSettings({ longEvery })} />
      </div>
      <div className="mt-4 divide-y divide-line rounded-2xl border border-line bg-card px-4">
        <Toggle
          checked={settings.autoStart}
          onChange={(autoStart) => onChangeSettings({ autoStart })}
          label="Começar o próximo foco sozinho"
          hint="Quando a pausa acaba, o cronômetro volta para a mesma tarefa"
        />
        <Toggle checked={preferences.sound} onChange={(value) => onChangePreference('sound', value)} label="Som e vibração no fim do ciclo" />
        <Toggle
          checked={preferences.openFocusOnPlay}
          onChange={(value) => onChangePreference('openFocusOnPlay', value)}
          label="Abrir o Modo Estudo ao dar Play"
          hint="Tela cheia com o cronômetro grande e a sala ao vivo"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onTestSound} className={`${SECONDARY_BTN} flex-1`}>
          <Volume2 size={15} style={{ color: COLORS.amber }} /> Testar aviso
        </button>
        <button type="button" onClick={onClose} className={`${PRIMARY_BTN} flex-1`}>
          Pronto
        </button>
      </div>
    </Modal>
  );
}
