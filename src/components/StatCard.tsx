interface Props {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number; // positive = gain, negative = loss
  deltaLabel?: string;
}

export default function StatCard({ label, value, unit, delta, deltaLabel }: Props) {
  const hasDelta = delta != null;
  const isPositive = (delta ?? 0) > 0;

  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-1"
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--color-muted)' }}>
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-text)' }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>
            {unit}
          </span>
        )}
      </div>
      {hasDelta && (
        <span
          className="text-xs font-medium"
          style={{ color: isPositive ? 'var(--color-danger)' : 'var(--color-success)' }}
        >
          {isPositive ? '▲' : '▼'} {Math.abs(delta!).toFixed(1)} {unit} {deltaLabel ?? ''}
        </span>
      )}
    </div>
  );
}
