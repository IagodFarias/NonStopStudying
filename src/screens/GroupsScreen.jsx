import { useMemo, useState } from 'react';
import { Activity, Check, Copy, Crown, KeyRound, Loader2, LogOut, Plus, Settings2, Swords, Target, Trash2, Trophy, UserMinus, UserPlus, Users, WifiOff } from 'lucide-react';
import { CARD, COLORS, ICON_BTN, INPUT, INSET_INPUT, LABEL, PRIMARY_BTN, SQUAD_PALETTE } from '../theme.js';
import { formatHMS, formatRelative } from '../lib/time.js';
import { clamp, sum, withAlpha } from '../lib/misc.js';
import { friendlyError, normalizeCode } from '../social.js';
import {
  ActiveBadge,
  Avatar,
  ColorPicker,
  FlameStatus,
  LiveBadge,
  LoadingBlock,
  Modal,
  ProgressBar,
  RankMedal,
  SectionTitle,
  Segmented,
  SquadBadge,
  useDelayedFlag,
} from '../components/ui.jsx';

/* ------------------------------ Convites ---------------------------------- */

async function copyText(text, pushToast, message) {
  try {
    await navigator.clipboard.writeText(text);
    pushToast(message);
  } catch {
    pushToast(text);
  }
}

async function shareInvite(code, groupName, pushToast) {
  const text = `Bora estudar junto no YPT Squads! Entra no grupo "${groupName}" com o código ${code}.`;
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }
  await copyText(text, pushToast, 'Convite copiado — é só colar na conversa com os amigos');
}

export function InviteBar({ code, groupName, pushToast }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-line bg-shell p-2 pl-3">
      <KeyRound size={15} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Código de convite</p>
        <p className="font-mono text-base font-bold tracking-[0.3em] text-fg">{code}</p>
      </div>
      <button type="button" onClick={() => copyText(code, pushToast, 'Código copiado')} aria-label="Copiar código" className={ICON_BTN}>
        <Copy size={16} />
      </button>
      <button
        type="button"
        onClick={() => shareInvite(code, groupName, pushToast)}
        className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:brightness-110"
      >
        <UserPlus size={14} /> Convidar
      </button>
    </div>
  );
}

/* --------------------------- Conta e entrada ------------------------------ */

export function SocialUnavailable() {
  return (
    <div className={`${CARD} px-5 py-8 text-center`}>
      <WifiOff size={26} className="mx-auto text-primary" />
      <h2 className="mt-3 font-bold text-fg">Grupos e chat desligados</h2>
      <p className="mt-1 text-sm text-muted">Esta versão do app ainda não está ligada a um projeto do Firebase. O cronômetro pessoal funciona normalmente.</p>
    </div>
  );
}

export function AuthPanel({ actions, pushToast }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'signup') await actions.signUp({ name, email, password });
      else await actions.signIn({ email, password });
    } catch (caught) {
      setError(friendlyError(caught));
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError('Digite seu e-mail acima para receber o link de redefinição.');
      return;
    }
    try {
      await actions.resetPassword(email);
      setError('');
      pushToast('Enviamos um link para redefinir sua senha');
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-5 pt-2">
      <div className="text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Users size={26} />
        </span>
        <h2 className="mt-3 text-xl font-bold text-fg">Estude junto com seus amigos</h2>
        <p className="mt-1 text-sm text-muted">Entre para participar de um grupo, competir nos squads e conversar no chat. O cronômetro pessoal funciona sem conta.</p>
      </div>
      <div className={`${CARD} p-4`}>
        <Segmented
          value={mode}
          onChange={(next) => {
            setMode(next);
            setError('');
          }}
          options={[
            { value: 'signin', label: 'Entrar' },
            { value: 'signup', label: 'Criar conta' },
          ]}
        />
        <form onSubmit={submit} className="mt-4 space-y-3">
          {mode === 'signup' && (
            <label className="block">
              <span className={LABEL}>Seu nome</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="nickname"
                maxLength={24}
                required
                placeholder="Como seus amigos te chamam"
                className={`${INSET_INPUT} py-2.5`}
              />
            </label>
          )}
          <label className="block">
            <span className={LABEL}>E-mail</span>
            <input
              type="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              placeholder="voce@email.com"
              className={`${INSET_INPUT} py-2.5`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              placeholder="Mínimo de 6 caracteres"
              className={`${INSET_INPUT} py-2.5`}
            />
          </label>
          {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-rose-300">{error}</p>}
          <button type="submit" disabled={busy} className={`${PRIMARY_BTN} w-full py-3`}>
            {busy && <Loader2 size={16} className="animate-spin" />}
            {mode === 'signup' ? 'Criar conta' : 'Entrar'}
          </button>
          {mode === 'signin' && (
            <button type="button" onClick={resetPassword} className="w-full text-center text-xs text-muted transition hover:text-fg">
              Esqueci minha senha
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function AccountRow({ name, email, onSignOut }) {
  return (
    <div className={`${CARD} flex items-center gap-3 p-3`}>
      <Avatar name={name} color={COLORS.primary} size={38} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-fg">{name || 'Sem nome'}</p>
        <p className="truncate text-xs text-muted">{email}</p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-fg/80 transition hover:border-primary/50 hover:text-fg"
      >
        <LogOut size={13} /> Sair
      </button>
    </div>
  );
}

function GroupSetup({ social, runSocial }) {
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(null);

  const run = async (kind, operation, success) => {
    setBusy(kind);
    const ok = await runSocial(operation, success);
    if (!ok) setBusy(null);
  };

  return (
    <div className="space-y-4">
      <AccountRow name={social.myName} email={social.user?.email} onSignOut={() => runSocial(() => social.actions.signOut(), 'Você saiu da conta')} />

      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 font-bold text-fg">
          <UserPlus size={18} className="text-primary" /> Criar um grupo
        </h2>
        <p className="mt-1 text-xs text-muted">Você vira o dono e recebe um código para convidar os amigos. O grupo já começa com 2 squads.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run('create', () => social.actions.createGroup(groupName), 'Grupo criado! Agora é só mandar o código para os amigos.');
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={40}
            placeholder="Ex.: Turma do cursinho"
            aria-label="Nome do grupo"
            className={`${INSET_INPUT} min-w-0 flex-1 py-2.5`}
          />
          <button type="submit" disabled={!groupName.trim() || Boolean(busy)} className={`${PRIMARY_BTN} shrink-0`}>
            {busy === 'create' ? <Loader2 size={16} className="animate-spin" /> : 'Criar'}
          </button>
        </form>
      </section>

      <section className={`${CARD} p-4`}>
        <h2 className="flex items-center gap-2 font-bold text-fg">
          <KeyRound size={18} className="text-primary" /> Entrar com código
        </h2>
        <p className="mt-1 text-xs text-muted">Peça o código de 6 caracteres para quem criou o grupo.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run('join', () => social.actions.joinGroup(code), 'Você entrou no grupo!');
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC234"
            aria-label="Código de convite"
            className={`${INSET_INPUT} min-w-0 flex-1 py-2.5 font-mono uppercase tracking-[0.3em]`}
          />
          <button type="submit" disabled={code.length !== 6 || Boolean(busy)} className={`${PRIMARY_BTN} shrink-0`}>
            {busy === 'join' ? <Loader2 size={16} className="animate-spin" /> : 'Entrar'}
          </button>
        </form>
      </section>
    </div>
  );
}

function ConnectionBanner() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-3 py-2 text-xs text-amber">
      <WifiOff size={14} className="shrink-0" />
      Sem conexão. O placar volta a atualizar quando a internet voltar.
    </p>
  );
}

/* --------------------------------- Batalha -------------------------------- */

function BattlePanel({ ranking, subgroups, mode, onSetMode }) {
  const lanes = subgroups.map((g) => ranking.find((r) => r.id === g.id)).filter(Boolean);
  const totalScore = sum(lanes.map((s) => s.score));
  const shareOf = (squad) => (totalScore > 0 ? (squad.score / totalScore) * 100 : 100 / lanes.length);
  const [leader, runnerUp] = ranking;
  const lead = leader && runnerUp ? leader.score - runnerUp.score : 0;

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-shell p-4">
      <div
        className="pointer-events-none absolute -right-10 -top-20 h-48 w-48 rounded-full blur-3xl transition-colors duration-700"
        style={{ background: withAlpha(leader?.color ?? COLORS.primary, 0.22) }}
      />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
            <Swords size={18} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-fg">Batalha de Squads</h2>
            <p className="truncate text-[11px] text-muted">Cabo de guerra do dia · tempo real</p>
          </div>
        </div>
        <LiveBadge />
      </div>

      <div className="relative mt-4">
        <Segmented
          value={mode}
          onChange={onSetMode}
          options={[
            { value: 'avg', label: 'Média por membro' },
            { value: 'total', label: 'Tempo total bruto' },
          ]}
        />
      </div>

      <div className="relative mt-5">
        <div className="mb-1 flex h-4">
          {lanes.map((s) => (
            <div key={s.id} className="flex justify-center transition-[width] duration-700 ease-out" style={{ width: `${shareOf(s)}%` }}>
              {s.id === leader?.id && totalScore > 0 && <Crown size={14} color="#FCD34D" />}
            </div>
          ))}
        </div>
        <div className="flex h-12 overflow-hidden rounded-2xl bg-card ring-1 ring-inset ring-white/5">
          {lanes.map((s, i) => {
            const share = shareOf(s);
            return (
              <div
                key={s.id}
                className="relative flex min-w-0 items-center justify-center overflow-hidden transition-[width] duration-700 ease-out"
                style={{ width: `${share}%`, background: `linear-gradient(180deg, ${s.color}, ${withAlpha(s.color, 0.72)})` }}
              >
                {i > 0 && <span className="absolute inset-y-0 left-0 w-0.5 bg-ink" />}
                {share >= 11 && <span className="text-sm font-black tabular-nums text-white drop-shadow">{Math.round(share)}%</span>}
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${clamp(lanes.length, 1, 3)}, minmax(0, 1fr))` }}>
          {lanes.map((s) => (
            <div key={s.id} className="min-w-0">
              <p className="flex items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate text-[11px] font-semibold text-fg/85">{s.name || 'Sem nome'}</span>
              </p>
              <p className="mt-0.5 font-mono text-sm font-bold tabular-nums" style={{ color: s.color }}>
                {formatHMS(s.score)}
              </p>
              <p className="truncate text-[10px] text-muted">
                {mode === 'avg' ? 'média/membro' : 'soma da equipe'} · {s.active}/{s.members.length} on
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="relative mt-4 rounded-xl bg-card px-3 py-2.5 text-xs text-fg/80">
        {lead >= 1 ? (
          <>
            🏆{' '}
            <span className="font-bold" style={{ color: leader.color }}>
              {leader.name}
            </span>{' '}
            lidera por <span className="font-bold tabular-nums text-fg">{formatHMS(lead)}</span> {mode === 'avg' ? 'na média por membro' : 'no tempo total'}
          </>
        ) : (
          'Empate técnico! Cada minuto de estudo decide a liderança.'
        )}
      </p>
    </section>
  );
}

function Metric({ label, value, highlight, color }) {
  return (
    <div className="rounded-xl bg-shell px-3 py-2" style={highlight ? { boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.55)}` } : undefined}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="font-mono text-base font-bold tabular-nums" style={{ color: highlight ? color : COLORS.fg }}>
        {value}
      </p>
    </div>
  );
}

function SquadCard({ squad, rank, isMine, mode }) {
  const target = (squad.targetHoursPerMember || 0) * 3600;
  const progress = target ? squad.avg / target : 0;
  return (
    <article className={`relative overflow-hidden rounded-2xl border bg-card p-4 pl-5 ${isMine ? 'border-primary/50' : 'border-line'}`}>
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: squad.color }} />
      <div className="flex items-start gap-3">
        <RankMedal rank={rank} />
        <SquadBadge squad={squad} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-fg">{squad.name || 'Sem nome'}</h3>
            {isMine && <span className="shrink-0 rounded-md bg-primary/15 px-1.5 py-0.5 text-[9px] font-black tracking-wider text-primary">SEU SQUAD</span>}
          </div>
          {squad.motto && <p className="truncate text-xs italic text-muted">“{squad.motto}”</p>}
          <div className="mt-1.5">
            <ActiveBadge active={squad.active} total={squad.members.length} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Tempo total" value={formatHMS(squad.total)} highlight={mode === 'total'} color={squad.color} />
        <Metric label="Média / integrante" value={formatHMS(squad.avg)} highlight={mode === 'avg'} color={squad.color} />
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[10px] text-muted">
          <span className="flex items-center gap-1">
            <Target size={11} /> Meta de {squad.targetHoursPerMember}h por membro
          </span>
          <span className="font-semibold tabular-nums text-fg/80">{Math.round(progress * 100)}%</span>
        </div>
        <ProgressBar value={progress} color={squad.color} />
      </div>
    </article>
  );
}

export function FilterChip({ active, color = COLORS.primary, onClick, label, count, dot = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'text-white' : 'border-line bg-card text-fg/80 hover:border-primary/40'
      }`}
      style={active ? { background: color, borderColor: color } : undefined}
    >
      {dot && !active && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
      <span className={`rounded-full px-1.5 text-[10px] ${active ? 'bg-black/20' : 'bg-shell text-muted'}`}>{count}</span>
    </button>
  );
}

function MemberCard({ member, squad, rank, serverNow }) {
  const color = squad?.color ?? COLORS.muted;
  let status = 'Offline';
  if (member.isStudying) status = member.currentSubject || 'Estudando';
  else if (member.isCurrentUser) status = 'Pausado';
  else if (member.online) status = 'Online · pausado';
  else if (member.lastSeen) status = `Offline · ${formatRelative(member.lastSeen, serverNow)}`;
  return (
    <article className={`rounded-2xl border p-3 transition ${member.isCurrentUser ? 'border-primary/60 bg-primary/[0.08]' : 'border-line bg-card'}`}>
      <div className="flex items-start justify-between gap-2">
        <FlameStatus active={member.isStudying} />
        <span className="text-[10px] font-bold tabular-nums text-muted/70">#{rank}</span>
      </div>
      <p className="mt-2 flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-fg">{member.name}</span>
        {member.isCurrentUser && <span className="shrink-0 rounded bg-primary px-1 text-[9px] font-black text-white">VOCÊ</span>}
      </p>
      <span className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: withAlpha(color, 0.15), color }}>
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{squad?.name || 'Sem squad'}</span>
      </span>
      <p className={`mt-2 truncate text-xs ${member.isStudying ? 'text-online' : member.online ? 'text-fg/70' : 'text-muted/70'}`}>{status}</p>
      <p className={`mt-0.5 font-mono text-xl font-bold tracking-tight tabular-nums ${member.isStudying ? 'text-flame' : 'text-muted'}`}>{formatHMS(member.seconds)}</p>
    </article>
  );
}

function ActivityFeed({ feed, memberById, squadById, serverNow }) {
  const items = feed.filter((ev) => memberById[ev.memberId]);
  if (!items.length) {
    return <p className={`${CARD} px-4 py-6 text-center text-xs text-muted`}>Quando alguém começar ou pausar os estudos, aparece aqui.</p>;
  }
  return (
    <ul className="divide-y divide-line rounded-2xl border border-line bg-shell">
      {items.map((ev) => {
        const member = memberById[ev.memberId];
        const color = squadById[member.subgroupId]?.color ?? COLORS.muted;
        return (
          <li key={ev.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={member.name} color={color} size={30} />
            <p className="min-w-0 flex-1 truncate text-xs text-muted">
              <span className="font-semibold text-fg">{member.name}</span>{' '}
              {ev.type === 'start' && (
                <>
                  começou{' '}
                  <span className="font-semibold" style={{ color }}>
                    {ev.subject || 'a estudar'}
                  </span>
                </>
              )}
              {ev.type === 'pause' && 'fez uma pausa'}
              {ev.type === 'offline' && 'saiu do app'}
            </p>
            <span className="shrink-0 text-[10px] tabular-nums text-muted/70">{formatRelative(ev.ts, serverNow)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function GroupDashboard({ group, members, ranking, subgroups, mode, feed, serverNow, connected, userSquadId, pushToast, onSetMode, onOpenManager }) {
  const [filter, setFilter] = useState('all');
  const offline = useDelayedFlag(!connected, 3000);
  const squadById = useMemo(() => Object.fromEntries(subgroups.map((g) => [g.id, g])), [subgroups]);
  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members]);
  const ordered = [...members].sort((a, b) => b.seconds - a.seconds);
  const rankOf = new Map(ordered.map((m, i) => [m.id, i + 1]));
  const activeFilter = filter === 'all' || squadById[filter] ? filter : 'all';
  const visible = activeFilter === 'all' ? ordered : ordered.filter((m) => m.subgroupId === activeFilter);
  const studying = members.filter((m) => m.isStudying).length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Grupo de estudos</p>
            <h1 className="truncate text-xl font-bold text-fg">{group.name}</h1>
            <p className="text-xs text-muted">
              {members.length} {members.length === 1 ? 'membro' : 'membros'} · <span className="font-semibold text-flame">{studying} estudando agora</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenManager}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-card px-3 py-2 text-xs font-semibold text-fg/85 transition hover:border-primary/50"
          >
            <Settings2 size={14} /> Gerenciar
          </button>
        </div>
        <InviteBar code={group.inviteCode} groupName={group.name} pushToast={pushToast} />
        {members.length === 1 && <p className="text-center text-xs text-muted">Você está sozinho por aqui. Toque em Convidar e mande o código para os amigos.</p>}
        {offline && <ConnectionBanner />}
      </div>

      {subgroups.length >= 2 ? (
        <BattlePanel ranking={ranking} subgroups={subgroups} mode={mode} onSetMode={onSetMode} />
      ) : (
        <div className={`${CARD} p-4 text-center text-sm text-muted`}>
          A batalha precisa de pelo menos 2 squads.{' '}
          <button type="button" onClick={onOpenManager} className="font-semibold text-primary">
            Criar squad
          </button>
        </div>
      )}

      {ranking.length > 0 && (
        <section>
          <SectionTitle icon={Trophy} title="Leaderboard" hint={mode === 'avg' ? 'pela média por membro' : 'pelo tempo total'} />
          <div className="space-y-2.5">
            {ranking.map((squad, i) => (
              <SquadCard key={squad.id} squad={squad} rank={i + 1} isMine={squad.id === userSquadId} mode={mode} />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle icon={Users} title="Membros ao vivo" hint="chama acesa = estudando" />
        <div className="ypt-no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterChip active={activeFilter === 'all'} onClick={() => setFilter('all')} label="Todos os membros" count={members.length} />
          {subgroups.map((g) => (
            <FilterChip
              key={g.id}
              dot
              active={activeFilter === g.id}
              color={g.color}
              onClick={() => setFilter(g.id)}
              label={g.name || 'Sem nome'}
              count={members.filter((m) => m.subgroupId === g.id).length}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {visible.map((m) => (
            <MemberCard key={m.id} member={m} squad={squadById[m.subgroupId]} rank={rankOf.get(m.id)} serverNow={serverNow} />
          ))}
        </div>
        {visible.length === 0 && <p className="rounded-2xl border border-dashed border-line py-8 text-center text-sm text-muted">Ninguém neste squad ainda.</p>}
      </section>

      <section>
        <SectionTitle icon={Activity} title="Atividade de hoje" />
        <ActivityFeed feed={feed} memberById={memberById} squadById={squadById} serverNow={serverNow} />
      </section>
    </div>
  );
}

export function GroupsScreen({ social, runSocial, pushToast, ...dashboard }) {
  if (social.status === 'disabled') return <SocialUnavailable />;
  if (social.status === 'loading') return <LoadingBlock label="Conectando ao grupo…" />;
  if (social.status === 'signed-out') return <AuthPanel actions={social.actions} pushToast={pushToast} />;
  if (social.status === 'no-group') return <GroupSetup social={social} runSocial={runSocial} />;
  return <GroupDashboard group={social.group} connected={social.connected} pushToast={pushToast} {...dashboard} />;
}

/* ------------------------------ Gerenciamento ----------------------------- */

const blurOnEnter = (event) => {
  if (event.key === 'Enter') event.currentTarget.blur();
};

function SquadEditor({ squad, count, canDelete, onSave, onDelete }) {
  const [name, setName] = useState(squad.name);
  const [motto, setMotto] = useState(squad.motto ?? '');
  const [target, setTarget] = useState(String(squad.targetHoursPerMember ?? 4));
  const [synced, setSynced] = useState(squad);

  // acompanha mudanças feitas por outros membros enquanto o modal está aberto
  if (synced !== squad) {
    setSynced(squad);
    if (squad.name !== synced.name) setName(squad.name);
    if (squad.motto !== synced.motto) setMotto(squad.motto ?? '');
    if (squad.targetHoursPerMember !== synced.targetHoursPerMember) setTarget(String(squad.targetHoursPerMember ?? 4));
  }

  const saveName = () => {
    const value = name.trim();
    if (!value) setName(squad.name);
    else if (value !== squad.name) onSave({ name: value });
  };
  const saveMotto = () => {
    const value = motto.trim();
    if (value !== (squad.motto ?? '')) onSave({ motto: value });
  };
  const saveTarget = () => {
    const value = clamp(Number(target) || squad.targetHoursPerMember || 4, 1, 16);
    setTarget(String(value));
    if (value !== squad.targetHoursPerMember) onSave({ targetHoursPerMember: value });
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <div className="flex items-center gap-2">
        <SquadBadge squad={squad} size={34} />
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={blurOnEnter} maxLength={28} placeholder="Nome do squad" aria-label="Nome do squad" className={INSET_INPUT} />
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Excluir ${squad.name}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-danger/10 hover:text-danger"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <input
        value={motto}
        onChange={(e) => setMotto(e.target.value)}
        onBlur={saveMotto}
        onKeyDown={blurOnEnter}
        maxLength={60}
        placeholder="Lema do squad"
        aria-label="Lema do squad"
        className={`${INSET_INPUT} mt-2`}
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ColorPicker small palette={SQUAD_PALETTE} value={squad.color} onChange={(color) => onSave({ color })} />
        <label className="flex items-center gap-2 text-xs text-muted">
          Meta
          <input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onBlur={saveTarget}
            onKeyDown={blurOnEnter}
            className="w-16 rounded-lg border border-line bg-shell px-2 py-1 text-sm text-fg outline-none focus:border-primary"
          />
          h/membro
        </label>
      </div>
      <p className="mt-2 text-[11px] text-muted/80">
        {count} {count === 1 ? 'membro' : 'membros'}
      </p>
    </div>
  );
}

export function SquadManagerModal({ group, subgroups, members, myUid, myName, actions, runSocial, pushToast, onConfirm, onClose }) {
  const isOwner = group.ownerId === myUid;
  const me = members.find((m) => m.id === myUid);
  const owner = members.find((m) => m.id === group.ownerId);
  const counts = Object.fromEntries(subgroups.map((g) => [g.id, members.filter((m) => m.subgroupId === g.id).length]));
  const freeColor = (exclude) => SQUAD_PALETTE.find((c) => c !== exclude && !subgroups.some((g) => g.color === c)) ?? SQUAD_PALETTE[0];
  const [nameDraft, setNameDraft] = useState(myName);
  const [groupNameDraft, setGroupNameDraft] = useState(group.name);
  const [draft, setDraft] = useState(() => ({ name: '', motto: '', color: freeColor(), target: '4', join: false }));

  const saveName = () => {
    const value = nameDraft.trim();
    if (!value) setNameDraft(myName);
    else if (value !== myName) runSocial(() => actions.renameMe(value), 'Nome atualizado');
  };
  const saveGroupName = () => {
    const value = groupNameDraft.trim();
    if (!value) setGroupNameDraft(group.name);
    else if (value !== group.name) runSocial(() => actions.renameGroup(value), 'Grupo renomeado');
  };
  const createSquad = async (event) => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const squad = { name, motto: draft.motto.trim(), color: draft.color, targetHoursPerMember: clamp(Number(draft.target) || 4, 1, 16) };
    const ok = await runSocial(() => actions.createSquad(squad, draft.join), draft.join ? `Squad ${name} criado — agora você compete por ele` : `Squad ${name} criado`);
    if (ok) setDraft({ name: '', motto: '', color: freeColor(draft.color), target: '4', join: false });
  };
  const requestDeleteSquad = (squad) => {
    const count = counts[squad.id];
    onConfirm({
      title: 'Excluir squad?',
      message: count
        ? `${count === 1 ? 'O membro' : `Os ${count} membros`} do ${squad.name} ${count === 1 ? 'vai' : 'vão'} para os outros squads.`
        : `O squad ${squad.name} será removido.`,
      confirmLabel: 'Excluir squad',
      onConfirm: () => runSocial(() => actions.deleteSquad(squad.id), `Squad ${squad.name} excluído`),
    });
  };
  const requestRemove = (member) =>
    onConfirm({
      title: `Remover ${member.name}?`,
      message: `${member.name} sai do grupo e do chat. Para voltar, vai precisar do código de convite.`,
      confirmLabel: 'Remover',
      onConfirm: () => runSocial(() => actions.removeMember(member.id), `${member.name} foi removido do grupo`),
    });
  const requestLeave = () => {
    const others = members.filter((m) => m.id !== myUid).sort((a, b) => a.joinedAt - b.joinedAt);
    let message = 'Você pode voltar depois com o código de convite.';
    if (isOwner) {
      message = others.length ? `A liderança do grupo passa para ${others[0].name}. ${message}` : 'Você é o único membro: o grupo, o chat e o código de convite serão apagados.';
    }
    onConfirm({
      title: 'Sair do grupo?',
      message,
      confirmLabel: 'Sair do grupo',
      onConfirm: async () => {
        if (await runSocial(() => actions.leaveGroup(), 'Você saiu do grupo')) onClose();
      },
    });
  };
  const signOut = async () => {
    if (await runSocial(() => actions.signOut(), 'Você saiu da conta')) onClose();
  };

  return (
    <Modal title="Gerenciar grupo" subtitle={isOwner ? 'Você é o dono deste grupo' : `Dono: ${owner?.name ?? '—'}`} onClose={onClose}>
      <section>
        <p className={LABEL}>Convite</p>
        <InviteBar code={group.inviteCode} groupName={group.name} pushToast={pushToast} />
      </section>

      {isOwner && (
        <section className="mt-5">
          <p className={LABEL}>Nome do grupo</p>
          <input value={groupNameDraft} onChange={(e) => setGroupNameDraft(e.target.value)} onBlur={saveGroupName} onKeyDown={blurOnEnter} maxLength={40} aria-label="Nome do grupo" className={INPUT} />
        </section>
      )}

      <section className="mt-5">
        <p className={LABEL}>Seu nome no grupo</p>
        <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} onBlur={saveName} onKeyDown={blurOnEnter} maxLength={24} aria-label="Seu nome" className={INPUT} />
        <p className={`${LABEL} mt-4`}>Competir pelo squad</p>
        <div className="space-y-2">
          {subgroups.map((g) => {
            const mine = g.id === me?.subgroupId;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => {
                  if (!mine) runSocial(() => actions.switchSquad(g.id), `Agora você compete pelo ${g.name}`);
                }}
                className="flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition"
                style={mine ? { borderColor: withAlpha(g.color, 0.7), background: withAlpha(g.color, 0.12) } : { borderColor: COLORS.line, background: COLORS.card }}
              >
                <SquadBadge squad={g} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-fg">{g.name || 'Sem nome'}</span>
                  <span className="block text-[11px] text-muted">
                    {counts[g.id]} {counts[g.id] === 1 ? 'membro' : 'membros'}
                  </span>
                </span>
                {mine ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold" style={{ color: g.color }}>
                    <Check size={14} /> Seu squad
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-muted">Entrar</span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-6">
        <p className={LABEL}>Squads</p>
        <div className="space-y-2.5">
          {subgroups.map((g) => (
            <SquadEditor
              key={g.id}
              squad={g}
              count={counts[g.id]}
              canDelete={isOwner && subgroups.length > 2}
              onSave={(patch) => runSocial(() => actions.updateSquad(g.id, patch))}
              onDelete={() => requestDeleteSquad(g)}
            />
          ))}
        </div>
        {isOwner ? (
          subgroups.length <= 2 && <p className="mt-2 text-[11px] text-muted">A batalha precisa de pelo menos 2 squads, então dá para excluir só a partir do 3º.</p>
        ) : (
          <p className="mt-2 text-[11px] text-muted">Qualquer membro cria e edita squads; só o dono pode excluir.</p>
        )}
      </section>

      <form onSubmit={createSquad} className="mt-6 rounded-2xl border border-dashed border-line p-3">
        <p className={LABEL}>Criar novo squad</p>
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={28} placeholder="Nome (ex.: Falcões do Foco)" aria-label="Nome do novo squad" className={INPUT} />
        <input value={draft.motto} onChange={(e) => setDraft({ ...draft, motto: e.target.value })} maxLength={60} placeholder="Lema (opcional)" aria-label="Lema do novo squad" className={`${INPUT} mt-2`} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <ColorPicker small palette={SQUAD_PALETTE} value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          <label className="flex items-center gap-2 text-xs text-muted">
            Meta
            <input
              type="number"
              min={1}
              max={16}
              step={0.5}
              value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })}
              className="w-16 rounded-lg border border-line bg-shell px-2 py-1 text-sm text-fg outline-none focus:border-primary"
            />
            h/membro
          </label>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm text-fg/85">
          <input type="checkbox" checked={draft.join} onChange={(e) => setDraft({ ...draft, join: e.target.checked })} className="h-4 w-4 accent-primary" />
          Entrar neste squad ao criar
        </label>
        <button type="submit" disabled={!draft.name.trim()} className={`${PRIMARY_BTN} mt-3 w-full`}>
          <Plus size={16} /> Criar squad
        </button>
      </form>

      <section className="mt-6">
        <p className={LABEL}>Membros ({members.length})</p>
        <ul className="space-y-1.5">
          {[...members]
            .sort((a, b) => a.joinedAt - b.joinedAt)
            .map((member) => {
              const squad = subgroups.find((g) => g.id === member.subgroupId);
              return (
                <li key={member.id} className="flex items-center gap-3 rounded-xl bg-card p-2.5">
                  <Avatar name={member.name} color={squad?.color ?? COLORS.muted} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {member.name}
                      {member.isCurrentUser ? ' (você)' : ''}
                    </span>
                    <span className="block truncate text-[11px] text-muted">
                      {member.id === group.ownerId ? 'Dono · ' : ''}
                      {squad?.name ?? 'Sem squad'}
                    </span>
                  </span>
                  {isOwner && !member.isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => requestRemove(member)}
                      aria-label={`Remover ${member.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-danger/10 hover:text-danger"
                    >
                      <UserMinus size={15} />
                    </button>
                  )}
                </li>
              );
            })}
        </ul>
      </section>

      <section className="mt-6 grid grid-cols-2 gap-2">
        <button type="button" onClick={requestLeave} className="rounded-xl border border-danger/40 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10">
          Sair do grupo
        </button>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-line py-2.5 text-sm font-semibold text-fg/80 transition hover:bg-raised"
        >
          <LogOut size={14} /> Sair da conta
        </button>
      </section>
    </Modal>
  );
}
