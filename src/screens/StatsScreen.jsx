import { memo, useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, Flame, TrendingUp, Trophy } from 'lucide-react';
import { CARD, COLORS } from '../theme.js';
import { addDays, dayKeyOf, formatDuration, formatHMS, WEEKDAYS } from '../lib/time.js';
import { sameProps, sum } from '../lib/misc.js';
import { computeStreak, summarizeRange } from '../lib/stats.js';
import { ChartTooltip, ProgressBar, Segmented, SquadBadge, StatTile } from '../components/ui.jsx';

const AXIS_TICK = { fill: COLORS.muted, fontSize: 11 };
const AXIS_TICK_SMALL = { fill: COLORS.muted, fontSize: 10 };
const PAST_BAR = '#2B3B5C';

const DonutChart = memo(function DonutChart({ rows }) {
  const totalMinutes = sum(rows.map((r) => r.minutes));
  if (!rows.length) {
    return <p className="rounded-xl border border-dashed border-line py-10 text-center text-sm text-muted">Nenhum estudo registrado neste período.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative h-[200px] w-[200px] shrink-0">
        <PieChart width={200} height={200}>
          <Pie
            data={rows}
            dataKey="minutes"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={92}
            paddingAngle={rows.length > 1 ? 2 : 0}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            {rows.map((row) => (
              <Cell key={row.id} fill={row.color} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip format={(v) => formatDuration(v * 60)} />} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted">Total</p>
            <p className="text-xl font-bold tabular-nums text-fg">{formatDuration(totalMinutes * 60)}</p>
          </div>
        </div>
      </div>
      <ul className="w-full space-y-2.5">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} />
            <span className="min-w-0 flex-1 truncate text-fg/85">{row.name}</span>
            <span className="tabular-nums text-muted">{formatDuration(row.minutes * 60)}</span>
            <span className="w-10 text-right text-xs font-semibold tabular-nums text-fg">{Math.round((row.minutes / totalMinutes) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}, sameProps);

const WeeklyChart = memo(function WeeklyChart({ data, average }) {
  return (
    <div className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={COLORS.line} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis tick={AXIS_TICK_SMALL} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} allowDecimals={false} width={40} />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip format={(v) => formatDuration(v * 3600)} />} />
          {average > 0 && (
            <ReferenceLine
              y={average}
              stroke={COLORS.amber}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{ value: 'média', fill: COLORS.muted, fontSize: 10, position: 'insideTopRight' }}
            />
          )}
          <Bar dataKey="hours" name="Estudo" fill={COLORS.primary} radius={[6, 6, 0, 0]} maxBarSize={34}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.today ? COLORS.primary : PAST_BAR} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}, sameProps);

const ContributionChart = memo(function ContributionChart({ data, squadColor }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-4 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: COLORS.primary }} />
          Você
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: squadColor }} />
          Média dos colegas
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barGap={3}>
            <CartesianGrid vertical={false} stroke={COLORS.line} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK_SMALL} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}h`} allowDecimals={false} width={40} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip format={(v) => formatDuration(v * 3600)} />} />
            <Bar dataKey="voce" name="Você" fill={COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={16} />
            <Bar dataKey="squad" name="Média dos colegas" fill={squadColor} radius={[4, 4, 0, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}, sameProps);

export function StatsScreen({ sessions, todayStart, subjectsById, me, userSquad, groupId, fetchDays }) {
  const [range, setRange] = useState('today');
  const [history, setHistory] = useState({});
  const todayEnd = addDays(todayStart, 1);

  // horas dos colegas nos dias anteriores (o "hoje" vem ao vivo do placar)
  useEffect(() => {
    if (!groupId) {
      setHistory({});
      return undefined;
    }
    let cancelled = false;
    fetchDays(dayKeyOf(addDays(todayStart, -6)))
      .then((value) => {
        if (!cancelled) setHistory(value);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [groupId, todayStart, fetchDays]);

  const donutSummary = summarizeRange(sessions, range === 'today' ? todayStart : addDays(todayStart, -6), todayEnd);
  const donutRows = Object.entries(donutSummary.bySubject)
    .map(([id, seconds]) => ({
      id,
      name: subjectsById[id]?.name ?? 'Matéria removida',
      color: subjectsById[id]?.color ?? COLORS.muted,
      minutes: Math.round(seconds / 60),
    }))
    .filter((row) => row.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);

  const week = Array.from({ length: 7 }, (_, i) => {
    const start = addDays(todayStart, i - 6);
    const seconds = summarizeRange(sessions, start, addDays(start, 1)).total;
    return {
      key: dayKeyOf(start),
      label: i === 6 ? 'Hoje' : WEEKDAYS[new Date(start).getDay()],
      hours: Math.round(seconds / 36) / 100,
      today: i === 6,
    };
  });
  const weekHours = sum(week.map((d) => d.hours));
  const best = week.reduce((acc, d) => (d.hours > acc.hours ? d : acc), week[0]);
  const streak = computeStreak(sessions, todayStart);

  const mates = userSquad ? userSquad.members.filter((m) => !m.isCurrentUser) : [];
  const contribution = week.map((d) => {
    const values = mates.map((m) => (d.today ? m.seconds : Number(history[d.key]?.[m.id]) || 0));
    const average = values.length ? sum(values) / values.length : 0;
    return { key: d.key, label: d.label, voce: d.hours, squad: Math.round(average / 36) / 100 };
  });
  const share = userSquad && me && userSquad.total > 0 ? me.seconds / userSquad.total : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile icon={Clock} label="Últimos 7 dias" value={formatDuration(weekHours * 3600)} hint="tempo total" />
        <StatTile icon={TrendingUp} label="Média diária" value={formatDuration((weekHours / 7) * 3600)} hint="na semana" />
        <StatTile icon={Trophy} label="Melhor dia" value={formatDuration(best.hours * 3600)} hint={best.hours > 0 ? best.label : '—'} />
        <StatTile icon={Flame} label="Sequência" value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} hint="estudando sem falhar" accent />
      </div>

      <section className={`${CARD} p-4`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-fg">Tempo por matéria</h3>
            <p className="text-[11px] text-muted">Proporção de foco de cada disciplina</p>
          </div>
          <div className="w-36 shrink-0">
            <Segmented
              compact
              value={range}
              onChange={setRange}
              options={[
                { value: 'today', label: 'Hoje' },
                { value: 'week', label: '7 dias' },
              ]}
            />
          </div>
        </div>
        <DonutChart rows={donutRows} />
      </section>

      <section className={`${CARD} p-4`}>
        <h3 className="text-sm font-bold text-fg">Horas nos últimos 7 dias</h3>
        <p className="mb-3 text-[11px] text-muted">Linha tracejada = sua média diária</p>
        <WeeklyChart data={week} average={Math.round((weekHours / 7) * 100) / 100} />
      </section>

      {userSquad && (
        <section className={`${CARD} p-4`}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <h3 className="truncate text-sm font-bold text-fg">Você × {userSquad.name}</h3>
            <SquadBadge squad={userSquad} size={26} />
          </div>
          <p className="mb-3 text-[11px] text-muted">Suas horas comparadas à média dos colegas do seu squad</p>
          <ContributionChart data={contribution} squadColor={userSquad.color} />
          <div className="mt-4 border-t border-line pt-4">
            <p className="text-xs text-fg/80">
              Hoje você gerou <span className="font-bold text-primary">{Math.round(share * 100)}%</span> do tempo do {userSquad.name}.
            </p>
            <ul className="mt-3 space-y-2.5">
              {[...userSquad.members]
                .sort((a, b) => b.seconds - a.seconds)
                .map((m) => {
                  const memberShare = userSquad.total > 0 ? m.seconds / userSquad.total : 0;
                  return (
                    <li key={m.id}>
                      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                        <span className={`truncate ${m.isCurrentUser ? 'font-bold text-primary' : 'text-fg/80'}`}>
                          {m.name}
                          {m.isCurrentUser ? ' (você)' : ''}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted">
                          {formatHMS(m.seconds)} · {Math.round(memberShare * 100)}%
                        </span>
                      </div>
                      <ProgressBar value={memberShare} color={m.isCurrentUser ? COLORS.primary : userSquad.color} />
                    </li>
                  );
                })}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
