import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function PageHeader({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="flex items-center gap-3 text-2xl font-bold tracking-tight text-white">
          <Icon className="text-atom-accent" size={22} /> {title}
        </h2>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-atom-muted">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function Caveat({ text }: { text: string }) {
  return (
    <div className="border border-atom-warning/30 bg-atom-warning/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-atom-warning">
      {text}
    </div>
  );
}

export function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail?: string; icon: LucideIcon }) {
  return (
    <div className="tech-border bg-atom-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="border border-atom-border bg-atom-bg p-1.5 text-atom-accent">
          <Icon size={16} />
        </div>
        {detail ? <span className="font-mono text-[10px] text-atom-muted">{detail}</span> : null}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-atom-muted">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-white">{value}</div>
    </div>
  );
}

export function Panel({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`tech-border bg-atom-card p-5 ${className}`}>
      {title ? <h3 className="mb-4 font-mono text-[11px] font-bold uppercase tracking-widest text-white">{title}</h3> : null}
      {children}
    </section>
  );
}

export function StateMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center border border-dashed border-atom-border px-6 text-center">
      <div className="font-mono text-xs uppercase tracking-widest text-white">{title}</div>
      <p className="mt-2 max-w-md font-mono text-[11px] leading-relaxed text-atom-muted">{body}</p>
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return <div className="font-mono text-[11px] text-atom-muted">Not enough points in this Phoenix day for a line.</div>;
  }
  const width = 220;
  const height = 48;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1e-9, max - min);
  const d = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-12 w-full" role="img" aria-label="Cumulative hypothetical P&L">
      <path d={d} fill="none" stroke="#00F0FF" strokeWidth="2" />
    </svg>
  );
}
