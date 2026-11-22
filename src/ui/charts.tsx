// Gráficos em SVG puro: barras (empilhadas/agrupadas), linha/área, rosca e mapa de calor.
// Marcas finas, topo arredondado de 4px, 2px de respiro entre segmentos e tooltip no hover.
import { useEffect, useRef, useState, type ReactNode } from 'react';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export interface Series {
  key: string;
  name: string;
  color: string;
}

/** Escala com passos “redondos” (1, 2, 5 × 10ⁿ) e até ~4 divisões. */
function niceScale(v: number, divs = 4): { max: number; ticks: number[] } {
  if (!(v > 0)) return { max: 1, ticks: [0, 1] };
  const raw = v / divs;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  const max = Math.ceil(v / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= max + step / 2; t += step) ticks.push(t);
  return { max, ticks };
}

/** Caminho de barra com cantos superiores arredondados (base reta). */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function BarChart({
  data,
  series,
  stacked = true,
  height = 230,
  format = (v: number) => String(Math.round(v)),
  labelEvery,
}: {
  data: { label: string; full?: string; values: Record<string, number> }[];
  series: Series[];
  stacked?: boolean;
  height?: number;
  format?: (v: number) => string;
  labelEvery?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padB = 26;
  const padT = 8;
  const innerW = width - padL - 4;
  const innerH = height - padB - padT;
  const totals = data.map((d) => (stacked ? series.reduce((s, se) => s + (d.values[se.key] ?? 0), 0) : Math.max(0, ...series.map((se) => d.values[se.key] ?? 0))));
  const { max, ticks } = niceScale(Math.max(...totals, 0));
  const band = innerW / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(34, band * (stacked ? 0.62 : 0.8)));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const every = labelEvery ?? Math.max(1, Math.ceil(data.length / Math.floor(innerW / 46)));

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg height={height} viewBox={`0 0 ${width} ${height}`} role="img">
        <g className="axis">
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="gridline" x1={padL} x2={width - 4} y1={y(t)} y2={y(t)} strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={i} x={padL + band * i + band / 2} y={height - 7} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>
        {hover !== null && <rect x={padL + band * hover} y={padT} width={band} height={innerH} rx={8} fill="var(--hover)" />}
        {data.map((d, i) => {
          const cx = padL + band * i + band / 2;
          if (stacked) {
            let acc = 0;
            const segs = series.filter((s) => (d.values[s.key] ?? 0) > 0);
            return (
              <g key={i}>
                {segs.map((s, si) => {
                  const v = d.values[s.key] ?? 0;
                  const top = y(acc + v);
                  const bottom = y(acc);
                  acc += v;
                  const isTop = si === segs.length - 1;
                  const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0));
                  return isTop ? (
                    <path key={s.key} d={barPath(cx - barW / 2, top, barW, h, 4)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={cx - barW / 2} y={top} width={barW} height={h} fill={s.color} />
                  );
                })}
              </g>
            );
          }
          const gw = barW / series.length;
          return (
            <g key={i}>
              {series.map((s, si) => {
                const v = d.values[s.key] ?? 0;
                const x = cx - barW / 2 + gw * si + 1;
                return <path key={s.key} d={barPath(x, y(v), gw - 2, y(0) - y(v), 4)} fill={s.color} />;
              })}
            </g>
          );
        })}
        {data.map((_, i) => (
          <rect key={i} x={padL + band * i} y={0} width={band} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <Tip x={((padL + band * hover + band / 2) / width) * 100} y={y(totals[hover])}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{data[hover].full ?? data[hover].label}</div>
          {series.map((s) => (
            <div className="row" key={s.key} style={{ justifyContent: 'space-between', gap: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <i className="dot" style={{ background: s.color }} />
                {s.name}
              </span>
              <b>{format(data[hover].values[s.key] ?? 0)}</b>
            </div>
          ))}
          {stacked && series.length > 1 && (
            <div className="row" style={{ justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,.15)', marginTop: 4, paddingTop: 4 }}>
              <span>Total</span>
              <b>{format(totals[hover])}</b>
            </div>
          )}
        </Tip>
      )}
    </div>
  );
}

function Tip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  const left = Math.min(88, Math.max(12, x));
  return (
    <div className="chart-tip" style={{ left: `${left}%`, top: Math.max(40, y) }}>
      {children}
    </div>
  );
}

export function LineChart({
  data,
  series,
  height = 220,
  format = (v: number) => String(Math.round(v)),
  area = true,
}: {
  data: { label: string; full?: string; values: Record<string, number> }[];
  series: Series[];
  height?: number;
  format?: (v: number) => string;
  area?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 40;
  const padB = 26;
  const padT = 10;
  const innerW = width - padL - 10;
  const innerH = height - padB - padT;
  const { max, ticks } = niceScale(Math.max(0, ...data.flatMap((d) => series.map((s) => d.values[s.key] ?? 0))), 3);
  const x = (i: number) => padL + (data.length <= 1 ? innerW / 2 : (innerW * i) / (data.length - 1));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const every = Math.max(1, Math.ceil(data.length / Math.floor(innerW / 52)));
  const id = useRef(`lg${Math.random().toString(36).slice(2)}`).current;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const i = Math.round(((px - padL) / innerW) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={() => setHover(null)}>
      <svg height={height} viewBox={`0 0 ${width} ${height}`} onMouseMove={onMove} onClick={onMove} role="img">
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`${id}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity=".32" />
              <stop offset="1" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <g className="axis">
          {ticks.map((t, i) => (
            <g key={i}>
              <line className="gridline" x1={padL} x2={width - 10} y1={y(t)} y2={y(t)} strokeDasharray={i ? '3 4' : undefined} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            i % every === 0 ? (
              <text key={i} x={x(i)} y={height - 7} textAnchor="middle">
                {d.label}
              </text>
            ) : null,
          )}
        </g>
        {series.map((s, si) => {
          const pts = data.map((d, i) => [x(i), y(d.values[s.key] ?? 0)] as const);
          const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('');
          return (
            <g key={s.key}>
              {area && pts.length > 1 && <path d={`${line}L${pts[pts.length - 1][0]},${y(0)}L${pts[0][0]},${y(0)}Z`} fill={`url(#${id}-${si})`} />}
              <path d={line} fill="none" stroke={s.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={y(0)} stroke="var(--border-strong)" strokeDasharray="3 3" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(data[hover].values[s.key] ?? 0)} r={5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <Tip x={(x(hover) / width) * 100} y={Math.min(...series.map((s) => y(data[hover].values[s.key] ?? 0)))}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>{data[hover].full ?? data[hover].label}</div>
          {series.map((s) => (
            <div className="row" key={s.key} style={{ justifyContent: 'space-between', gap: 14 }}>
              <span className="row" style={{ gap: 6 }}>
                <i className="dot" style={{ background: s.color }} />
                {s.name}
              </span>
              <b>{format(data[hover].values[s.key] ?? 0)}</b>
            </div>
          ))}
        </Tip>
      )}
    </div>
  );
}

export function Donut({ segments, size = 190, stroke = 24, center, format = (v: number) => String(v) }: { segments: { key: string; name: string; value: number; color: string }[]; size?: number; stroke?: number; center?: ReactNode; format?: (v: number) => string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let acc = 0;
  const h = segments.find((s) => s.key === hover);
  return (
    <div className="rate-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const dash = Math.max(0.1, len - gap);
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={hover === s.key ? stroke + 6 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-acc}
                style={{ transition: 'stroke-width .2s', cursor: 'pointer' }}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover === s.key ? null : s.key)}
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      <div className="center">
        {h ? (
          <>
            <b style={{ fontSize: 20 }}>{format(h.value)}</b>
            <div className="small muted" style={{ fontWeight: 700 }}>
              {h.name} · {Math.round((h.value / total) * 100)}%
            </div>
          </>
        ) : (
          center
        )}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { name: string; color: string; value?: string }[] }) {
  return (
    <div className="legend">
      {items.map((i) => (
        <span key={i.name}>
          <i className="dot" style={{ background: i.color, width: 10, height: 10, borderRadius: 3 }} />
          {i.name}
          {i.value && <b style={{ color: 'var(--text)' }}>{i.value}</b>}
        </span>
      ))}
    </div>
  );
}

/** Mapa de calor estilo calendário (colunas = semanas). Uma cor, claro → escuro. */
export function Heatmap({ days, color, format }: { days: { day: string; value: number; label: string }[]; color: string; format: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));
  const first = days.length ? new Date(days[0].day + 'T12:00').getDay() : 0;
  const cells: ({ day: string; value: number; label: string } | null)[] = [...Array(first).fill(null), ...days];
  return (
    <div style={{ position: 'relative' }}>
      <div className="heat" onMouseLeave={() => setHover(null)}>
        {cells.map((c, i) =>
          c ? (
            <i
              key={i}
              title={`${c.label}: ${format(c.value)}`}
              onMouseEnter={() => setHover(i)}
              style={{
                background: c.value > 0 ? color : undefined,
                opacity: c.value > 0 ? 0.25 + 0.75 * (c.value / max) : 1,
                outline: hover === i ? '2px solid var(--text)' : undefined,
              }}
            />
          ) : (
            <i key={i} style={{ visibility: 'hidden' }} />
          ),
        )}
      </div>
      <div className="small muted" style={{ marginTop: 6, minHeight: 18 }}>
        {hover !== null && cells[hover] ? (
          <>
            <b style={{ color: 'var(--text)' }}>{cells[hover]!.label}</b> · {format(cells[hover]!.value)}
          </>
        ) : (
          'Passe o mouse/toque nos quadrados'
        )}
      </div>
    </div>
  );
}
