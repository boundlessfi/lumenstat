const integer = new Intl.NumberFormat('en-US');

export function count(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : integer.format(value);
}

export function percent(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? '—' : `${(value * 100).toFixed(digits)}%`;
}

export function ms(value: number | null | undefined): string {
  return value === null || value === undefined ? '—' : `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} ms`;
}

export function duration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}
