import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

export interface WeightEntry {
  date: string;   // 'YYYY-MM-DD'
  weight: number; // kg
}

interface Props {
  data: WeightEntry[];
  goalKg?: number;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayload { value?: number }
interface TooltipArgs { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipArgs) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  return (
    <div
      className="rounded-xl px-3 py-2 text-sm shadow-lg"
      style={{
        backgroundColor: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        color: 'var(--color-text)',
      }}
    >
      <p className="font-semibold" style={{ color: 'var(--color-accent-light)' }}>
        {value != null ? `${value.toFixed(1)} kg` : '—'}
      </p>
      <p style={{ color: 'var(--color-muted)' }}>{formatDate(label as string)}</p>
    </div>
  );
}

export default function WeightChart({ data, goalKg }: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-xl text-sm"
        style={{ backgroundColor: 'var(--color-surface)', color: 'var(--color-muted)' }}
      >
        No weight data yet. Start logging!
      </div>
    );
  }

  const weights = data.map((d) => d.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const padding = 1.5;
  const yMin = Math.floor(minW - padding);
  const yMax = Math.ceil(maxW + padding);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--color-border)"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={formatDate}
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[yMin, yMax]}
          tick={{ fill: 'var(--color-muted)', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-border)', strokeWidth: 1 }} />
        {goalKg != null && (
          <ReferenceLine
            y={goalKg}
            stroke="var(--color-success)"
            strokeDasharray="5 4"
            label={{
              value: `Goal ${goalKg} kg`,
              position: 'insideTopRight',
              fill: 'var(--color-success)',
              fontSize: 10,
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
          dot={{ r: 3, fill: 'var(--color-accent)', strokeWidth: 0 }}
          activeDot={{ r: 5, fill: 'var(--color-accent-light)', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
