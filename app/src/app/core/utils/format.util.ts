export function fmt(n: number): string {
  return Math.round(n).toLocaleString('fr-FR');
}

export function fmtSigned(n: number): string {
  const rounded = Math.round(n);
  return (rounded > 0 ? '+' : '') + rounded.toLocaleString('fr-FR') + '$';
}

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

export function formatDateFull(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
