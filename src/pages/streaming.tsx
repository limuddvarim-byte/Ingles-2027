// Aba de tempo de streaming em inglês: diário, mensal, por serviço, com gráficos.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { remove } from '../core/db';
import { SERVICE_MAP, SERVICES } from '../core/defaults';
import { isLive, subscribeLive } from '../core/live';
import { sumServices, watchByDay, watchStreak, watchTotals } from '../core/stats';
import { addMonths, dayKey, dayLabel, daysInMonth, formatDuration, lastNDays, monthKey, monthLabel } from '../core/time';
import type { StreamingService } from '../core/types';
import { addManualWatch } from '../core/watch';
import { platform } from '../platform';
import { useStore } from '../state/store';
import { TileIcon } from '../ui/BrandIcon';
import { BarChart, Donut, Legend, LineChart } from '../ui/charts';
import { Icon } from '../ui/Icon';
import { Modal, PageHead, Ring, Segmented, Switch } from '../ui/kit';
import { useChartColors } from '../ui/theme';
import { Kpi, MonthNav } from './stats';

const mins = (s: number) => `${Math.round(s / 60)}min`;
const hrs = (s: number) => (s >= 3600 ? `${(s / 3600).toFixed(1).replace('.', ',')}h` : mins(s));

export function StreamingPage() {
  const watch = useStore((s) => s.watch);
  const shared = useStore((s) => s.shared);
  const setShared = useStore((s) => s.setShared);
  const colors = useChartColors();
  const [month, setMonth] = useState(monthKey());
  const [range, setRange] = useState<'30' | 'month'>('30');
  const [manual, setManual] = useState(false);
  const [live, setLive] = useState<Partial<Record<StreamingService, number>>>({});
  const [, tick] = useState(0);
  useEffect(() => subscribeLive(setLive), []);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 5000);
    return () => clearInterval(t);
  }, []);

  const today = dayKey();
  const todayT = useMemo(() => watchTotals(watch, (d) => d === today), [watch, today]);
  const monthT = useMemo(() => watchTotals(watch, (d) => d.startsWith(month)), [watch, month]);
  const byDay = useMemo(() => watchByDay(watch), [watch]);
  const streak = useMemo(() => watchStreak(watch), [watch]);
  const goal = shared.dailyGoalMinutes * 60;
  const elapsedDays = month === monthKey() ? Number(today.slice(8)) : daysInMonth(month).length;
  const days = range === '30' ? lastNDays(30) : daysInMonth(month);
  const series = SERVICES.map((s) => ({ key: s.id, name: s.name, color: colors.service(s.id) }));
  const activeSeries = series.filter((s) => days.some((d) => (byDay.get(d)?.[s.key as StreamingService] ?? 0) > 0));
  const months = Array.from({ length: 12 }, (_, i) => addMonths(monthKey(), i - 11));
  const manualList = watch.filter((w) => w.source === 'manual').sort((a, b) => b.day.localeCompare(a.day) || b.updatedAt - a.updatedAt).slice(0, 8);

  const togglePause = (id: StreamingService, paused: boolean) => setShared({ trackingPaused: { ...shared.trackingPaused, [id]: paused } });

  return (
    <div className="page" style={{ '--accent': 'var(--g-stream)', '--accent-glow': 'rgba(249,115,22,.55)' } as CSSProperties}>
      <PageHead
        eyebrow="Streaming"
        icon="tv"
        title={<span>Tempo de <span className="grad-text">inglês assistido</span></span>}
        sub={platform.kind === 'extension' ? 'Contado automaticamente quando você dá play nos serviços.' : platform.kind === 'android' ? 'Contado pelo app (notificações de mídia/acessibilidade) e pela extensão.' : 'Contado pela extensão e pelo app; também dá para adicionar manualmente.'}
        right={
          <>
            <button className="btn" onClick={() => setShared({ trackingAllPaused: !shared.trackingAllPaused })}>
              <Icon name={shared.trackingAllPaused ? 'play' : 'pause'} size={15} /> {shared.trackingAllPaused ? 'Retomar contagem' : 'Pausar tudo'}
            </button>
            <button className="btn primary" onClick={() => setManual(true)}>
              <Icon name="plus" size={16} stroke={2.6} /> Adicionar manual
            </button>
          </>
        }
      />

      {shared.trackingAllPaused && (
        <div className="banner" style={{ background: 'linear-gradient(135deg,#f97316,#ef4444)' }}>
          <Icon name="pause" size={20} />
          <div className="grow">
            <b>Contagem pausada em todos os serviços</b>
          </div>
          <button className="btn sm" onClick={() => setShared({ trackingAllPaused: false })}>
            Retomar
          </button>
        </div>
      )}

      <div className="grid cols-3" style={{ alignItems: 'stretch' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Ring value={goal ? todayT.total / goal : 0} size={150} stroke={14} colors={['#facc15', '#ef4444']}>
            <b>{formatDuration(todayT.total)}</b>
            <div className="small muted" style={{ fontWeight: 700 }}>hoje</div>
          </Ring>
          <div className="col" style={{ gap: 4 }}>
            <div className="label">Meta diária</div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{shared.dailyGoalMinutes} min</div>
            <div className="small muted">{goal && todayT.total >= goal ? 'Meta batida! 🏆' : `Faltam ${formatDuration(Math.max(0, goal - todayT.total))}`}</div>
            <div className="row" style={{ gap: 4 }}>
              {[30, 60, 90, 120].map((g) => (
                <button key={g} className={`btn sm ${shared.dailyGoalMinutes === g ? 'primary' : ''}`} style={{ padding: '0 8px' }} onClick={() => setShared({ dailyGoalMinutes: g })}>
                  {g}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Kpi icon="calendar" gradient="var(--g-stream)" value={hrs(monthT.total)} label={`Total em ${monthLabel(month)}`} sub={`Média de ${mins(monthT.total / Math.max(1, elapsedDays))} por dia`} color="#f97316" />
        <Kpi icon="flame" gradient="var(--g-gold)" value={`${streak} ${streak === 1 ? 'dia' : 'dias'}`} label="Sequência assistindo" sub="Dias seguidos com algum tempo" color="#facc15" />
      </div>

      <div className="grid cols-2 mt">
        {SERVICES.map((s) => {
          const t = todayT.per[s.id] ?? 0;
          const mt = monthT.per[s.id] ?? 0;
          const paused = !!shared.trackingPaused[s.id] || shared.trackingAllPaused;
          return (
            <div key={s.id} className={`svc-card ${paused ? 'paused' : ''}`}>
              <span className="svc-ico" style={{ '--tile-glow': s.colors[0] } as CSSProperties}>
                <TileIcon icon={{ kind: 'preset', value: s.id }} colors={s.colors} size={48} />
              </span>
              <div className="svc-body">
                <div className="row between">
                  <b>{s.name}</b>
                  {isLive(live, s.id) && !paused && <span className="chip live">ao vivo</span>}
                  {paused && <span className="chip">pausado</span>}
                </div>
                <div className="row between">
                  <span className="svc-time">{formatDuration(t)}</span>
                  <span className="small muted">{hrs(mt)} no mês</span>
                </div>
                <div className="progress">
                  <i style={{ width: `${monthT.total ? (mt / monthT.total) * 100 : 0}%`, background: colors.service(s.id) }} />
                </div>
              </div>
              <div className="col" style={{ alignItems: 'center', gap: 2 }}>
                <Switch on={!shared.trackingPaused[s.id]} onChange={(on) => togglePause(s.id, !on)} label={`Contar ${s.name}`} />
                <span className="tiny muted">contar</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card mt-lg">
        <div className="card-title">
          <span className="chip-ico">
            <Icon name="chart" size={16} />
          </span>
          Minutos por dia
          <span className="right row wrap">
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: '30', label: '30 dias' },
                { value: 'month', label: 'Mês' },
              ]}
            />
            {range === 'month' && <MonthNav month={month} setMonth={setMonth} />}
          </span>
        </div>
        <BarChart
          series={activeSeries.length ? activeSeries : series.slice(0, 1)}
          format={(v) => `${Math.round(v)}`}
          data={days.map((d) => {
            const v = byDay.get(d) ?? {};
            return { label: String(Number(d.slice(8))), full: `${dayLabel(d)} · ${formatDuration(sumServices(v))}`, values: Object.fromEntries(SERVICES.map((s) => [s.id, (v[s.id] ?? 0) / 60])) };
          })}
        />
        <div className="mt">
          <Legend items={(activeSeries.length ? activeSeries : series).map((s) => ({ name: s.name, color: s.color }))} />
        </div>
      </div>

      <div className="grid cols-2 mt">
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="target" size={16} />
            </span>
            Distribuição em {monthLabel(month)}
          </div>
          <div className="row wrap" style={{ gap: 22, justifyContent: 'center', flex: 1 }}>
            <Donut
              format={formatDuration}
              segments={SERVICES.map((s) => ({ key: s.id, name: s.name, value: monthT.per[s.id] ?? 0, color: colors.service(s.id) }))}
              center={
                <>
                  <b style={{ fontSize: 22 }}>{hrs(monthT.total)}</b>
                  <div className="small muted" style={{ fontWeight: 700 }}>no mês</div>
                </>
              }
            />
            <div className="col" style={{ gap: 6, minWidth: 170 }}>
              {SERVICES.filter((s) => (monthT.per[s.id] ?? 0) > 0)
                .sort((a, b) => (monthT.per[b.id] ?? 0) - (monthT.per[a.id] ?? 0))
                .map((s) => (
                  <div key={s.id} className="row between small">
                    <span className="row" style={{ gap: 8 }}>
                      <i className="dot" style={{ background: colors.service(s.id), width: 10, height: 10, borderRadius: 3 }} />
                      {s.name}
                    </span>
                    <b>{formatDuration(monthT.per[s.id] ?? 0)}</b>
                  </div>
                ))}
              {!monthT.total && <span className="muted small">Nada assistido neste mês ainda.</span>}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="calendar" size={16} />
            </span>
            Horas por mês
          </div>
          <LineChart
            series={[{ key: 'h', name: 'Horas', color: colors.service('crunchyroll') }]}
            format={(v) => `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')}h`}
            data={months.map((mk) => ({ label: monthLabel(mk, true), full: monthLabel(mk), values: { h: watchTotals(watch, (d) => d.startsWith(mk)).total / 3600 } }))}
          />
        </div>
      </div>

      {manualList.length > 0 && (
        <div className="card mt">
          <div className="card-title">
            <span className="chip-ico">
              <Icon name="pen" size={16} />
            </span>
            Lançamentos manuais recentes
          </div>
          {manualList.map((w) => (
            <div key={w.id} className="set-row">
              <span className="svc-ico" style={{ width: 34, height: 34, borderRadius: 11, overflow: 'hidden', flex: 'none' }}>
                <TileIcon icon={{ kind: 'preset', value: w.service }} colors={SERVICE_MAP[w.service].colors} size={34} />
              </span>
              <div className="set-text">
                <b>
                  {SERVICE_MAP[w.service].name} · {formatDuration(w.seconds)}
                </b>
                <span>
                  {dayLabel(w.day)}
                  {w.note ? ` · ${w.note}` : ''}
                </span>
              </div>
              <button className="icon-btn sm" onClick={() => remove('watch', w.id)} title="Excluir">
                <Icon name="trash" size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
      {manual && <ManualModal onClose={() => setManual(false)} />}
    </div>
  );
}

function ManualModal({ onClose }: { onClose: () => void }) {
  const toast = useStore((s) => s.toast);
  const [service, setService] = useState<StreamingService>('netflix');
  const [h, setH] = useState(0);
  const [m, setM] = useState(30);
  const [day, setDay] = useState(dayKey());
  const [note, setNote] = useState('');
  const save = async () => {
    const total = h * 60 + m;
    if (total <= 0) return toast('Informe o tempo assistido', 'error');
    await addManualWatch(service, total, day, note.trim());
    toast(`${formatDuration(total * 60)} adicionados em ${SERVICE_MAP[service].name}`, 'success');
    onClose();
  };
  return (
    <Modal
      title="Adicionar tempo manualmente"
      icon="clock"
      accent="var(--g-stream)"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={save}>
          <Icon name="check" size={16} /> Adicionar
        </button>
      }
    >
      <div className="col" style={{ gap: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {SERVICES.map((s) => (
            <button key={s.id} className="tile" style={{ padding: 4 }} onClick={() => setService(s.id)}>
              <span className="tile-icon" style={{ width: 54, height: 54, borderRadius: 17, outline: service === s.id ? '3px solid var(--turquoise)' : undefined, outlineOffset: 2 }}>
                <TileIcon icon={{ kind: 'preset', value: s.id }} colors={s.colors} size={54} />
              </span>
              <span className="tile-name" style={{ fontSize: 11 }}>{s.name}</span>
            </button>
          ))}
        </div>
        <div className="grid cols-3">
          <div className="field">
            <label>Horas</label>
            <input className="input" type="number" min={0} max={23} value={h} onChange={(e) => setH(Math.max(0, Number(e.target.value)))} />
          </div>
          <div className="field">
            <label>Minutos</label>
            <input className="input" type="number" min={0} max={59} value={m} onChange={(e) => setM(Math.max(0, Number(e.target.value)))} />
          </div>
          <div className="field">
            <label>Dia</label>
            <input className="input" type="date" value={day} max={dayKey()} onChange={(e) => setDay(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label>Observação (opcional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: assisti na TV — Friends S02E03" />
        </div>
      </div>
    </Modal>
  );
}
