export const makeId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const sum = (list) => list.reduce((acc, value) => acc + value, 0);
export const sameProps = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const byCreated = (a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0);

export function withAlpha(hex, alpha) {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6);
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function initialsOf(name) {
  const initials = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
  return initials || '?';
}

export const firstName = (name) => (name || '').trim().split(/\s+/)[0] || '—';
