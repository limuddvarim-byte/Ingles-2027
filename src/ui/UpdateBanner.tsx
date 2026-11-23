import { useEffect, useState } from 'react';
import { platform } from '../platform';
import type { UpdateInfo } from '../platform/types';
import { Icon } from './Icon';

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    platform.onUpdate?.((u) => setInfo(u));
    const t = setTimeout(() => {
      platform
        .checkUpdate()
        .then((u) => u.available && setInfo(u))
        .catch(() => undefined);
    }, 4000);
    return () => clearTimeout(t);
  }, []);
  if (!info?.available || hidden) return null;
  return (
    <div className="banner">
      <Icon name="download" size={18} className="acc" />
      <div className="grow">
        <b>Nova versão {info.version}</b> {info.ready ? '— pronta, reinicie para aplicar' : info.progress ? `— baixando ${Math.round(info.progress)}%` : 'disponível'}
      </div>
      <button className="btn sm primary" onClick={() => platform.installUpdate(info)}>
        {info.ready ? 'Reiniciar' : 'Atualizar'}
      </button>
      <button className="icon-btn sm" onClick={() => setHidden(true)} aria-label="Fechar">
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

