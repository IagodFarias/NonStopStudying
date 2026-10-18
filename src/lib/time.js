export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY_START_HOUR = 5; // o "dia de estudo" do YPT vai das 05:00 às 04:59 do dia seguinte
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export const pad = (n) => String(n).padStart(2, '0');

export function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0 || s === 0) return `${m}m`;
  return `${s}s`;
}

export function formatClock(ts) {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDayLabel(ts) {
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatISODate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${WEEKDAYS[new Date(y, m - 1, d).getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatRelative(ts, now) {
  const diff = Math.max(0, Math.floor((now - ts) / SECOND));
  if (diff < 45) return 'agora';
  if (diff < 3600) return `há ${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86400)} d`;
}

export function calendarDayLabel(ts, now) {
  const startOf = (value) => {
    const d = new Date(value);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((startOf(now) - startOf(ts)) / (24 * HOUR));
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return formatDayLabel(ts);
}

export function getStudyDayStart(ts) {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), DAY_START_HOUR, 0, 0, 0);
  if (d.getHours() < DAY_START_HOUR) start.setDate(start.getDate() - 1);
  return start.getTime();
}

export function addDays(ts, days) {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function toISODate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const dayKeyOf = (ts) => toISODate(getStudyDayStart(ts));

export function ddayInfo(iso, now) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const t = new Date(now);
  const today = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime();
  const diff = Math.round((target - today) / (24 * HOUR));
  return { diff, label: diff === 0 ? 'D-DAY' : diff > 0 ? `D-${diff}` : `D+${-diff}` };
}

// Lê estimativas digitadas como "1h30m", "1h30", "90m", "45 min", "1,5h", "1:30" ou "40" (minutos).
// Devolve segundos, 0 para vazio e null quando não dá para entender.
export function parseDuration(input) {
  const text = String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(',', '.')
    .replace(/\s+/g, '');
  if (!text) return 0;
  const clock = text.match(/^(\d+):([0-5]?\d)$/);
  if (clock) return (Number(clock[1]) * 60 + Number(clock[2])) * 60;
  if (/^\d+(\.\d+)?$/.test(text)) return Math.round(Number(text) * 60);
  const parts = text.match(/^(?:(\d+(?:\.\d+)?)h(?:oras?|rs?)?)?(?:(\d+)(?:m|min|mins|minutos?)?)?$/);
  if (!parts || (parts[1] === undefined && parts[2] === undefined)) return null;
  return Math.round((Number(parts[1] ?? 0) * 60 + Number(parts[2] ?? 0)) * 60);
}

export function formatEstimateInput(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h ? `${h}h` : ''}${m ? `${m}m` : ''}` || '0m';
}
