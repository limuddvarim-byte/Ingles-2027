// Estatísticas completas de frases (mensal + históricas).
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { backlogAt, countsByDay, learningStreak, learnTimeStats, monthlyHistory, monthPhraseStats, pendingPhrases, weekdayDistribution } from '../core/stats';
import { addMonths, dayKey, dayLabel, lastNDays, monthKey, monthLabel, WEEKDAYS_SHORT } from '../core/time';
import { useStore } from '../state/store';
import { BarChart, Heatmap, Legend, LineChart } from '../ui/charts';
import { Icon, type IconName } from '../ui/Icon';
import { PageHead, Ring } from '../ui/kit';
import { useChartColors } from '../ui/theme';

export function Kpi({ icon, gradient, value, label, sub, color }: { icon: IconName; gradient: string; value: ReactNode; label: string; sub?: ReactNode; color?: string }) {
  return (
    <div className="kpi" style={{ '--kpi-glow': color ?? '#7b3fd0' } as CSSProperties}>
      <div className="kpi-ico" style={{ background: gradient }}>
        <Icon name={icon} size={19} />
      </div>
      <b style={color ? { color } : undefined}>{value}</b>
      <div className="kpi-label">{label}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const cur = monthKey();
  return (
    <div className="segmented" style={{ alignItems: 'center' }}>
      <button onClick={() => setMonth(addMonths(month, -1))} aria-label="Mês anterior">
        <Icon name="chevronLeft" size={16} />
      </button>
      <button className="on" style={{ minWidth: 150 }} onClick={() => setMonth(cur)}>
        <Icon name="calendar" size={15} /> {monthLabel(month)}
      </button>
      <button onClick={() => setMonth(addMonths(month, 1))} disabled={month >= cur} aria-label="Próximo mês">
        <Icon name="chevronRight" size={16} />
      </button>
    </div>
  );
}

const fmtDays = (d: number | null) => (d === null ? '—' : d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${d.toFixed(d < 10 ? 1 : 0).replace('.', ',')} dias`);

export function StatsPage() {
  const phrases = useStore((s) => s.phrases);
  const colors = useChartColors();
  const [month, setMonth] = useState(monthKey());
  const m = useMemo(() => monthPhraseStats(phrases, month), [phrases, month]);
  const streak = useMemo(() => learningStreak(phrases), [phrases]);
  const times = useMemo(() => learnTimeStats(phrases), [phrases]);
  const week = useMemo(() => weekdayDistribution(phrases), [phrases]);
  const history = useMemo(() => monthlyHistory(phrases, Array.from({ length: 12 }, (_, i) => addMonths(monthKey(), i - 11))), [phrases]);
  const pending = pendingPhrases(phrases);
  const live = phrases.filter((p) => !p.deleted);
  const learnedAll = live.filter((p) => p.learnedAt && !p.removed).length;
  const discarded = live.filter((p) => p.removed).length;
  const withAudio = pending.filter((p) => p.audio).length;
  const withBack = pending.filter((p) => p.back).length;
  const anki = live.filter((p) => p.anki).length;
  const heat = useMemo(() => {
    const byDay = countsByDay(phrases);
    return lastNDays(26 * 7).map((d) => ({ day: d, value: byDay.get(d)?.learned ?? 0, label: dayLabel(d) }));
  }, [phrases]);
  const backlogNow = backlogAt(phrases, Date.now());
  const s = [
    { key: 'added', name: 'Adicionadas', color: colors.added },
    { key: 'learned', name: 'Aprendidas', color: colors.learned },
  ];

  return (
    <div className="page" style={{ '--accent': 'var(--g-stats)', '--accent-glow': 'rgba(34,197,94,.55)' } as CSSProperties}>
      <PageHead eyebrow="Estatísticas" icon="chart" title={<span>Seu progresso <span className="grad-text">com frases</span></span>} sub="Frases apagadas como “aprendidas” contam aqui. As de digitação incorreta são descartadas." right={<MonthNav month={month} setMonth={setMonth} />} />

      <div className="grid cols-4">
        <Kpi icon="plus" gradient="var(--g-phrases)" value={m.added} label="Adicionadas no mês" sub={`${m.avgAddedPerDay.toFixed(1).replace('.', ',')} por dia`} color={colors.added} />
        <Kpi icon="graduation" gradient="var(--g-stats)" value={m.learned} label="Aprendidas no mês" sub={`${m.avgLearnedPerDay.toFixed(1).replace('.', ',')} por dia`} color={colors.learned} />
        <Kpi icon="flame" gradient="var(--g-stream)" value={`${streak.current} ${streak.current === 1 ? 'dia' : 'dias'}`} label="Sequência aprendendo" sub={`Recorde: ${streak.best} dias`} color="#f97316" />
        <Kpi icon="list" gradient="var(--g-settings)" value={backlogNow} label="Na fila agora" sub={`${withAudio} com áudio · ${withBack} com verso`} color="#a855f7" />
      </div>

      <div className="grid cols-3 mt">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div className="card-title" style={{ alignSelf: 'stretch' }}>
            <span className="chip-ico" style={{ background: m.rate.color }}>
              <Icon name="target" size={16} />
            </span>
            Média de aprendizado do mês
          </div>
          <Ring value={(m.rate.pct ?? 0) / 100} size={170} stroke={16} colors={[m.rate.color, m.rate.color]}>
            <b style={{ color: m.rate.color }}>{m.rate.label}</b>
            <div className="small muted" style={{ fontWeight: 700 }}>
              {m.learned} de {m.added}
            </div>
          </Ring>
          <div className="chip" style={{ color: m.rate.color }}>
            {m.rate.description}
          </div>
          <div className="tiny muted" style={{ textAlign: 'center' }}>
            aprendidas ÷ adicionadas × 100 · <span style={{ color: '#f43f5e' }}>●</span> &lt;34% <span style={{ color: '#f5a524' }}>●</span> &lt;67% <span style={{ color: '#22c55e' }}>●</span> &lt;100% <span style={{ color: '#14d2c8' }}>●</span> 100%+
          </div>
        </div>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="chart" size={16} />
            </span>
            Dia a dia · {monthLabel(month)}
            <span className="right">
              <Legend items={s} />
            </span>
          </div>
          <BarChart stacked={false} series={s} data={m.days.map((d) => ({ label: String(Number(d.day.slice(8))), full: dayLabel(d.day), values: { added: d.added, learned: d.learned } }))} />
        </div>
      </div>

      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="layers" size={16} />
            </span>
            Fila de frases ao longo do mês
          </div>
          <LineChart series={[{ key: 'v', name: 'Na fila', color: colors.added }]} data={m.backlog.map((b) => ({ label: String(Number(b.day.slice(8))), full: dayLabel(b.day), values: { v: b.value } }))} />
          <p className="hint">Se a linha desce, você está aprendendo mais rápido do que adiciona.</p>
        </div>
        <div className="card">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="calendar" size={16} />
            </span>
            Últimos 12 meses
            <span className="right">
              <Legend items={s} />
            </span>
          </div>
          <BarChart stacked={false} series={s} data={history.map((h) => ({ label: monthLabel(h.month, true), full: `${monthLabel(h.month)} · média ${h.rate.label}`, values: { added: h.added, learned: h.learned } }))} />
        </div>
      </div>

      <div className="grid cols-3 mt">
        <Kpi icon="clock" gradient="var(--g-phrases)" value={fmtDays(times.avgDays)} label="Tempo médio até aprender" sub={`Mediana: ${fmtDays(times.medianDays)}`} />
        <Kpi icon="zap" gradient="var(--g-gold)" value={times.fastestHours === null ? '—' : `${Math.max(1, Math.round(times.fastestHours))}h`} label="Aprendizado mais rápido" sub={m.bestDay ? `Melhor dia do mês: ${dayLabel(m.bestDay.day)} (${m.bestDay.learned})` : 'Sem melhor dia ainda'} />
        <Kpi icon="trophy" gradient="var(--g-stats)" value={learnedAll} label="Aprendidas desde o início" sub={`${discarded} descartadas · ${anki} enviadas ao Anki`} />
      </div>

      <div className="grid cols-2 mt">
        <div className="card">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="flame" size={16} />
            </span>
            Frases aprendidas · últimos 6 meses
          </div>
          <Heatmap days={heat} color={colors.learned} format={(v) => `${v} aprendida${v === 1 ? '' : 's'}`} />
        </div>
        <div className="card">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="sun" size={16} />
            </span>
            Dias da semana mais produtivos
            <span className="right">
              <Legend items={s} />
            </span>
          </div>
          <BarChart stacked={false} height={200} series={s} data={WEEKDAYS_SHORT.map((w, i) => ({ label: w, values: { added: week.added[i], learned: week.learned[i] } }))} />
        </div>
      </div>
      <p className="hint mt" style={{ textAlign: 'center' }}>
        Hoje é {dayLabel(dayKey())} · dados sincronizados entre software, app e extensão
      </p>
    </div>
  );
}
