// Ajustes da tríade.
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { all, putMany } from '../core/db';
import { APP_VERSION } from '../core/build';
import { FONT_LIST, PHRASE_COLORS } from '../core/defaults';
import { syncNow, testConnection } from '../core/sync';
import type { CollectionName } from '../core/types';
import { platform } from '../platform';
import type { UpdateInfo } from '../platform/types';
import { listVoices, MODELS, playUrl, synthesize, type Voice } from '../services/eleven';
import { useStore } from '../state/store';
import { Icon, type IconName } from '../ui/Icon';
import { PageHead, Spinner, Switch, useAsync } from '../ui/kit';
import { useResolvedTheme } from '../ui/theme';

function Section({ icon, title, gradient, children, sub }: { icon: IconName; title: string; gradient: string; children: ReactNode; sub?: string }) {
  return (
    <div className="card" style={{ '--accent': gradient } as CSSProperties}>
      <div className="card-title">
        <span className="chip-ico">
          <Icon name={icon} size={16} />
        </span>
        <div>
          {title}
          {sub && <div className="small muted" style={{ fontWeight: 600 }}>{sub}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ title, sub, children, stack }: { title: string; sub?: ReactNode; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`set-row ${stack ? 'stack' : ''}`}>
      <div className="set-text">
        <b>{title}</b>
        {sub && <span>{sub}</span>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const shared = useStore((s) => s.shared);
  const setShared = useStore((s) => s.setShared);
  const resolved = useResolvedTheme();
  const [fontTarget, setFontTarget] = useState<'phraseFont' | 'uiFont'>('phraseFont');

  return (
    <div className="page" style={{ '--accent': 'var(--g-settings)', '--accent-glow': 'rgba(99,102,241,.55)' } as CSSProperties}>
      <PageHead eyebrow="Ajustes" icon="settings" title={<span>Deixe a tríade <span className="grad-text">com a sua cara</span></span>} sub={`Inglês ${APP_VERSION} · ${platform.label}`} />

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="col" style={{ gap: 16 }}>
          <Section icon="palette" title="Aparência" gradient="var(--g-settings)">
            <div className="label">Tema</div>
            <div className="row mt" style={{ gap: 10 }}>
              {(
                [
                  ['light', 'Claro', '#f4f3fa', '#fff'],
                  ['amoled', 'AMOLED', '#000', '#0a0a0f'],
                  ['auto', 'Automático', 'linear-gradient(90deg,#f4f3fa 50%,#000 50%)', '#888'],
                ] as const
              ).map(([v, label, bg, card]) => (
                <button key={v} className={`theme-opt ${shared.theme === v ? 'on' : ''}`} onClick={() => setShared({ theme: v })}>
                  <div className="tprev" style={{ background: bg, border: '1px solid var(--border)' }}>
                    <i style={{ background: 'linear-gradient(90deg,#c2389b,#2e44b8)' }} />
                    <i style={{ background: card, border: '1px solid rgba(128,128,128,.3)' }} />
                    <i style={{ background: '#14d2c8' }} />
                  </div>
                  <b className="small">{label}</b>
                </button>
              ))}
            </div>

            <div className="label mt-lg">Cor das frases</div>
            <div className="row mt wrap">
              <button className={`color-opt ${shared.phraseColor === 'default' ? 'on' : ''}`} onClick={() => setShared({ phraseColor: 'default' })}>
                <i style={{ background: resolved === 'amoled' ? PHRASE_COLORS.amoled : PHRASE_COLORS.light }} />
                {resolved === 'amoled' ? 'Branca' : 'Preta'} (padrão)
              </button>
              <button className={`color-opt ${shared.phraseColor === 'turquoise' ? 'on' : ''}`} onClick={() => setShared({ phraseColor: 'turquoise' })}>
                <i style={{ background: PHRASE_COLORS.turquoise }} />
                Azul turquesa
              </button>
            </div>

            <div className="row between mt-lg wrap">
              <div className="label">Fontes ({FONT_LIST.length})</div>
              <div className="segmented">
                <button className={fontTarget === 'phraseFont' ? 'on' : ''} onClick={() => setFontTarget('phraseFont')}>
                  Frases e atalhos
                </button>
                <button className={fontTarget === 'uiFont' ? 'on' : ''} onClick={() => setFontTarget('uiFont')}>
                  Funções
                </button>
              </div>
            </div>
            <div className="font-grid mt">
              {FONT_LIST.map((f) => (
                <button key={f} className={`font-opt ${shared[fontTarget] === f ? 'on' : ''}`} onClick={() => setShared({ [fontTarget]: f })}>
                  <span className="fo-sample" style={{ fontFamily: `'${f}'` }}>
                    Break a leg!
                  </span>
                  <span className="fo-name">{f}</span>
                </button>
              ))}
            </div>
            <Row title="Tamanho das frases" sub={`${shared.phraseSize}px`}>
              <input type="range" min={14} max={34} value={shared.phraseSize} onChange={(e) => setShared({ phraseSize: Number(e.target.value) })} style={{ width: 160, accentColor: '#14d2c8' }} />
            </Row>
            <div className="phrase" style={{ padding: '10px 0 0' }}>
              I <b>could use</b> a cup of <span className="term">coffee</span> right now.
            </div>
          </Section>

          <VoiceSection />
        </div>

        <div className="col" style={{ gap: 16 }}>
          <SyncSection />
          {platform.kind === 'android' && <AndroidTrackingSection />}
          {platform.kind === 'desktop' && <DesktopSection />}
          <AnkiSection />
          <UpdateSection />
          <DataSection />
        </div>
      </div>
    </div>
  );
}

function VoiceSection() {
  const shared = useStore((s) => s.shared);
  const setShared = useStore((s) => s.setShared);
  const toast = useStore((s) => s.toast);
  const [key, setKey] = useState(shared.elevenApiKey);
  const [voices, setVoices] = useState<Voice[]>([]);
  const { busy, run } = useAsync();
  useEffect(() => setKey(shared.elevenApiKey), [shared.elevenApiKey]);

  const load = () =>
    run('voices', async () => {
      const v = await listVoices(key.trim());
      setVoices(v);
      if (key.trim() !== shared.elevenApiKey) await setShared({ elevenApiKey: key.trim() });
      toast(`${v.length} vozes carregadas`, 'success');
    });

  return (
    <Section icon="headphones" title="Voz (ElevenLabs)" sub="Gera o áudio da frente das frases" gradient="var(--g-editor)">
      <div className="field">
        <label>Chave da API</label>
        <div className="row">
          <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk_…" autoComplete="off" />
          <button className="btn primary" onClick={load} disabled={!key.trim() || busy === 'voices'}>
            {busy === 'voices' ? <Spinner /> : <Icon name="refresh" size={16} />} Vozes
          </button>
        </div>
        <span className="hint">Fica salva na sua tríade (sincroniza pelo seu servidor Cloudflare). elevenlabs.io → Profile → API Keys.</span>
      </div>
      {shared.elevenVoiceId && (
        <div className="chip mt" style={{ color: 'var(--text)' }}>
          <Icon name="mic" size={14} /> Voz atual: <b>{shared.elevenVoiceName || shared.elevenVoiceId}</b>
        </div>
      )}
      {voices.length > 0 && (
        <div className="col mt" style={{ gap: 6, maxHeight: 280, overflow: 'auto' }}>
          {voices.map((v) => (
            <div key={v.voice_id} className="row" style={{ padding: '8px 10px', borderRadius: 14, background: shared.elevenVoiceId === v.voice_id ? 'rgba(236,72,153,.12)' : 'var(--surface-2)', border: `1px solid ${shared.elevenVoiceId === v.voice_id ? '#ec4899' : 'var(--border)'}` }}>
              <button className="icon-btn sm" onClick={() => v.preview_url && playUrl(v.preview_url)} title="Ouvir amostra">
                <Icon name="play" size={14} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b className="small">{v.name}</b>
                <div className="tiny muted">{[v.labels?.accent, v.labels?.gender, v.labels?.age, v.category].filter(Boolean).join(' · ')}</div>
              </div>
              <button className={`btn sm ${shared.elevenVoiceId === v.voice_id ? 'primary' : ''}`} onClick={() => setShared({ elevenVoiceId: v.voice_id, elevenVoiceName: v.name })}>
                {shared.elevenVoiceId === v.voice_id ? <Icon name="check" size={14} /> : 'Usar'}
              </button>
            </div>
          ))}
        </div>
      )}
      <Row title="Modelo" stack>
        <select className="select" style={{ maxWidth: 260 }} value={shared.elevenModel} onChange={(e) => setShared({ elevenModel: e.target.value })}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Row>
      <button
        className="btn block mt"
        disabled={!shared.elevenVoiceId || busy === 'test'}
        onClick={() =>
          run('test', async () => {
            const b = await synthesize('Hey! This is how your phrases will sound.');
            await playUrl(URL.createObjectURL(b));
          })
        }
      >
        {busy === 'test' ? <Spinner /> : <Icon name="volume" size={16} />} Testar voz
      </button>
    </Section>
  );
}

function SyncSection() {
  const local = useStore((s) => s.local);
  const setLocal = useStore((s) => s.setLocal);
  const sync = useStore((s) => s.sync);
  const toast = useStore((s) => s.toast);
  const [url, setUrl] = useState(local.syncUrl);
  const [token, setToken] = useState(local.syncToken);
  const [msg, setMsg] = useState('');
  const { busy, run } = useAsync();
  useEffect(() => {
    setUrl(local.syncUrl);
    setToken(local.syncToken);
  }, [local.syncUrl, local.syncToken]);

  return (
    <Section icon="cloud" title="Sincronização (Cloudflare)" sub="Software, app e extensão com os mesmos dados" gradient="var(--g-phrases)">
      <div className="field">
        <label>Endereço do servidor (Worker)</label>
        <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://ingles-sync.SEU-USUARIO.workers.dev" />
      </div>
      <div className="field mt">
        <label>Token de sincronização</label>
        <input className="input" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="o mesmo SYNC_TOKEN do Worker" />
      </div>
      <div className="row mt wrap">
        <button
          className="btn primary"
          disabled={busy === 'save'}
          onClick={() =>
            run('save', async () => {
              const r = await testConnection(url, token);
              setMsg(r.message);
              if (!r.ok) throw new Error(r.message);
              await setLocal({ syncUrl: url.trim(), syncToken: token.trim() });
              await syncNow();
              toast('Sincronização ativada ☁️', 'success');
            })
          }
        >
          {busy === 'save' ? <Spinner /> : <Icon name="link" size={16} />} Conectar e salvar
        </button>
        <button className="btn" onClick={() => run('now', () => syncNow())} disabled={!local.syncUrl}>
          <Icon name="refresh" size={16} className={sync.state === 'syncing' ? 'spin' : ''} /> Sincronizar agora
        </button>
      </div>
      <div className="small mt" style={{ color: sync.state === 'error' ? 'var(--bad)' : 'var(--text-2)' }}>
        {msg && <div>{msg}</div>}
        {sync.state === 'off' && 'Sincronização desligada — os dados ficam só neste aparelho.'}
        {sync.state === 'error' && `Erro: ${sync.error}`}
        {(sync.state === 'ok' || local.lastSyncAt > 0) && sync.state !== 'error' && `Última sincronização: ${new Date(local.lastSyncAt || sync.at).toLocaleString('pt-BR')}`}
      </div>
      <p className="hint">Passo a passo em docs/TUTORIAL-CLOUDFLARE.md (no repositório). Dá para embutir o endereço no build para não precisar digitar.</p>
    </Section>
  );
}

function AndroidTrackingSection() {
  const [st, setSt] = useState<{ notification: boolean; accessibility: boolean } | null>(null);
  const refresh = () => platform.tracking?.status().then(setSt).catch(() => setSt(null));
  useEffect(() => {
    void refresh();
    const h = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  return (
    <Section icon="tv" title="Contagem de streaming no celular" sub="Netflix, HBO Max, Disney+, Prime, YouTube…" gradient="var(--g-stream)">
      <Row title="Acesso às notificações" sub="Lê se o player está tocando ou pausado (MediaSession). Mais preciso.">
        <button className={`btn sm ${st?.notification ? '' : 'primary'}`} onClick={() => platform.tracking?.openNotificationSettings()}>
          {st?.notification ? <><Icon name="check" size={14} /> Ativo</> : 'Ativar'}
        </button>
      </Row>
      <Row title="Serviço de acessibilidade" sub="Reserva: detecta o app de streaming aberto na tela quando não há notificação de mídia.">
        <button className={`btn sm ${st?.accessibility ? '' : 'primary'}`} onClick={() => platform.tracking?.openAccessibilitySettings()}>
          {st?.accessibility ? <><Icon name="check" size={14} /> Ativo</> : 'Ativar'}
        </button>
      </Row>
      <p className="hint">Os clones (Real World e YouTube) contam sozinhos quando há vídeo tocando. Pausas por serviço ficam na aba Streaming.</p>
    </Section>
  );
}

function DesktopSection() {
  const local = useStore((s) => s.local);
  const setLocal = useStore((s) => s.setLocal);
  const toast = useStore((s) => s.toast);
  const [auto, setAuto] = useState(true);
  const [chrome, setChrome] = useState<{ found: boolean; path: string; profile: string } | null>(null);
  const [ext, setExt] = useState('');
  useEffect(() => {
    platform.getAutoStart?.().then(setAuto);
    platform.desktop?.chromeStatus().then(setChrome);
  }, [local.chromePath]);
  return (
    <Section icon="monitor" title="Software (Windows)" gradient="var(--g-home)">
      <Row title="Abrir ao iniciar o Windows" sub="O Inglês abre sozinho quando você liga o PC">
        <Switch
          on={auto}
          onChange={async (v) => {
            setAuto(v);
            await platform.setAutoStart?.(v);
            toast(v ? 'Vai abrir com o Windows' : 'Não abre mais com o Windows', 'success');
          }}
        />
      </Row>
      <Row title="Abrir atalhos em" sub={local.browserMode === 'chrome-estudos' ? 'Chrome Estudos: perfil separado, em inglês, tudo em abas' : 'Navegador padrão do Windows'} stack>
        <select className="select" style={{ maxWidth: 220 }} value={local.browserMode} onChange={(e) => setLocal({ browserMode: e.target.value as 'chrome-estudos' | 'default' })}>
          <option value="chrome-estudos">Chrome Estudos (isolado)</option>
          <option value="default">Navegador padrão</option>
        </select>
      </Row>
      <div className="small" style={{ margin: '10px 0', color: chrome?.found ? 'var(--text-2)' : 'var(--bad)' }}>
        {chrome ? (chrome.found ? <>Chrome encontrado · perfil em <span className="kbd">{chrome.profile}</span></> : 'Google Chrome não encontrado — informe o caminho do chrome.exe') : 'Verificando Chrome…'}
      </div>
      <div className="field">
        <label>Caminho do chrome.exe (opcional)</label>
        <input className="input" defaultValue={local.chromePath} onBlur={(e) => setLocal({ chromePath: e.target.value.trim() })} placeholder="C:\Program Files\Google\Chrome\Application\chrome.exe" />
      </div>
      <div className="sep" />
      <b className="small">Extensão no Chrome Estudos</b>
      <p className="hint" style={{ margin: '4px 0 10px' }}>
        O software mantém a extensão atualizada numa pasta fixa. Instale uma vez: em <span className="kbd">chrome://extensions</span> ative “Modo do desenvolvedor” → “Carregar sem compactação” → escolha a pasta.
      </p>
      <div className="row wrap">
        <button
          className="btn primary"
          onClick={async () => {
            const r = await platform.desktop!.setupExtension();
            setExt(r.folder);
          }}
        >
          <Icon name="puzzle" size={16} /> Instalar no Chrome Estudos
        </button>
        <button className="btn" onClick={() => platform.desktop?.openExtensionFolder()}>
          <Icon name="folder" size={16} /> Abrir pasta
        </button>
      </div>
      {ext && <div className="code mt">{ext}</div>}
    </Section>
  );
}

function AnkiSection() {
  const local = useStore((s) => s.local);
  const setLocal = useStore((s) => s.setLocal);
  const shared = useStore((s) => s.shared);
  const setShared = useStore((s) => s.setShared);
  const [msg, setMsg] = useState('');
  const { busy, run } = useAsync();
  return (
    <Section icon="layers" title="Anki" sub={platform.anki.describe()} gradient="var(--g-gold)">
      {platform.kind !== 'android' && (
        <div className="field">
          <label>Endereço do AnkiConnect</label>
          <input className="input" defaultValue={local.ankiConnectUrl} onBlur={(e) => setLocal({ ankiConnectUrl: e.target.value.trim() || 'http://127.0.0.1:8765' })} />
          <span className="hint">Instale o add-on AnkiConnect (código 2055492159) no Anki do PC. Os cards vão para o AnkiWeb na próxima sincronização do Anki.</span>
        </div>
      )}
      <div className="field mt">
        <label>Baralho padrão</label>
        <input className="input" defaultValue={shared.ankiDeck} onBlur={(e) => setShared({ ankiDeck: e.target.value.trim() || 'Inglês' })} />
      </div>
      <button
        className="btn mt"
        onClick={() =>
          run('t', async () => {
            const r = await platform.anki.available();
            setMsg(r.message);
          })
        }
      >
        {busy ? <Spinner /> : <Icon name="zap" size={16} />} Testar conexão
      </button>
      {msg && <div className="small mt">{msg}</div>}
    </Section>
  );
}

function UpdateSection() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const toast = useStore((s) => s.toast);
  const { busy, run } = useAsync();
  return (
    <Section icon="download" title="Atualizações" sub={`Versão instalada: ${APP_VERSION}`} gradient="var(--g-stats)">
      <div className="row wrap">
        <button
          className="btn"
          onClick={() =>
            run('check', async () => {
              const i = await platform.checkUpdate();
              setInfo(i);
              if (!i.available) toast('Você já está na versão mais recente', 'success');
            })
          }
        >
          {busy === 'check' ? <Spinner /> : <Icon name="refresh" size={16} />} Procurar atualização
        </button>
        {info?.available && (
          <button className="btn primary" onClick={() => run('install', () => platform.installUpdate(info))}>
            <Icon name="download" size={16} /> {info.ready ? 'Reiniciar e atualizar' : `Atualizar para ${info.version}`}
          </button>
        )}
      </div>
      <p className="hint">
        {platform.kind === 'android' && 'O APK novo instala por cima do antigo, mantendo seus dados.'}
        {platform.kind === 'desktop' && 'O software baixa as atualizações sozinho das Releases do GitHub.'}
        {platform.kind === 'extension' && 'Se instalada pela pasta do software, a extensão se atualiza sozinha.'}
      </p>
    </Section>
  );
}

function DataSection() {
  const toast = useStore((s) => s.toast);
  const cols: CollectionName[] = ['phrases', 'launcher', 'watch', 'draft', 'settings'];
  const exportData = async () => {
    const data: Record<string, unknown> = { app: 'ingles', version: APP_VERSION, at: new Date().toISOString() };
    for (const c of cols) data[c] = await all(c, true);
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ingles-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importData = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'ingles') throw new Error('Arquivo não é um backup do Inglês');
      for (const c of cols) if (Array.isArray(data[c])) await putMany(c, data[c]);
      toast('Backup importado', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };
  return (
    <Section icon="folder" title="Dados" sub="Backup em arquivo" gradient="var(--g-settings)">
      <div className="row wrap">
        <button className="btn" onClick={exportData}>
          <Icon name="download" size={16} /> Exportar backup
        </button>
        <label className="btn">
          <Icon name="upload" size={16} /> Importar
          <input type="file" accept="application/json" hidden onChange={(e) => importData(e.target.files?.[0])} />
        </label>
      </div>
    </Section>
  );
}
