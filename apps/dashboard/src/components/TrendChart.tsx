import { count } from '@/lib/format';
import type { Window } from '@/lib/range';
import { axisLabel, type Point } from '@/lib/series';

const W = 800;
const H = 240;
const PAD = { left: 48, right: 12, top: 12, bottom: 32 };
const BAR = 'var(--sds-clr-lilac-06)';
const LINE = 'var(--sds-clr-lilac-11)';

/** Bars for one series (page views) and an optional line for another (visitors), on one time axis. */
export function TrendChart({
  bars,
  line,
  barLabel,
  lineLabel,
  unit,
  title,
}: {
  bars: Point[];
  line?: Point[];
  barLabel: string;
  lineLabel?: string;
  unit: Window['unit'];
  title: string;
}) {
  const values = [...bars.map(p => p.y), ...(line ?? []).map(p => p.y)];
  const max = Math.max(1, ...values);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = bars.length > 0 ? plotW / bars.length : plotW;
  const y = (v: number) => PAD.top + plotH * (1 - v / max);
  const every = Math.max(1, Math.ceil(bars.length / 8));
  const ticks = [0, Math.round(max / 2), max];

  return (
    <figure style={{ margin: 0 }} className="stack">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label={title}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--sds-clr-gray-06)" strokeWidth="1" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="12" fill="var(--sds-clr-gray-11)">
              {count(t)}
            </text>
          </g>
        ))}
        {bars.map((p, i) => (
          <rect
            key={p.x}
            x={PAD.left + i * step + step * 0.15}
            width={Math.max(1, step * 0.7)}
            y={y(p.y)}
            height={Math.max(0, PAD.top + plotH - y(p.y))}
            rx="2"
            fill={BAR}
          >
            <title>{`${axisLabel(p.x, unit)}: ${count(p.y)} ${barLabel.toLowerCase()}`}</title>
          </rect>
        ))}
        {line && line.length > 1 ? (
          <polyline
            fill="none"
            stroke={LINE}
            strokeWidth="2"
            points={line.map((p, i) => `${PAD.left + i * step + step / 2},${y(p.y)}`).join(' ')}
          />
        ) : null}
        {bars.map((p, i) =>
          i % every === 0 ? (
            <text key={p.x} x={PAD.left + i * step + step / 2} y={H - 10} textAnchor="middle" fontSize="12" fill="var(--sds-clr-gray-11)">
              {axisLabel(p.x, unit)}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="legend">
        <span style={{ ['--swatch' as string]: BAR }}>{barLabel}</span>
        {line && lineLabel ? <span style={{ ['--swatch' as string]: LINE }}>{lineLabel}</span> : null}
      </figcaption>
    </figure>
  );
}
