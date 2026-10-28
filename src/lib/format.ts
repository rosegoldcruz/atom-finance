export function formatUsd(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatSignedUsd(amount: number): string {
  const body = formatUsd(Math.abs(amount));
  if (amount > 0) return `+${body}`;
  if (amount < 0) return `-${body}`;
  return body;
}

export function formatSol(amount: number): string {
  const digits = amount.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  if (amount > 0) return `+${digits} SOL`;
  return `${digits} SOL`;
}

export function formatBps(amount: number): string {
  return `${amount.toLocaleString('en-US', { maximumFractionDigits: 3 })} bps`;
}

export function formatPhoenix(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'short',
  }).format(date);
}
