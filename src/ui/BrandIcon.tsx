// Ícones dos atalhos do launcher (estilizados, desenhados aqui) + ícones personalizados.
import type { CSSProperties } from 'react';
import type { IconSpec } from '../core/types';
import realworld from '../assets/realworld.png';
import { Icon } from './Icon';

const center: CSSProperties = { display: 'grid', placeItems: 'center', width: '100%', height: '100%' };

function Brand({ id }: { id: string }) {
  switch (id) {
    case 'netflix':
      return (
        <div style={{ ...center, background: 'radial-gradient(circle at 30% 20%, #2a0a0c, #000 70%)' }}>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: '3.4em', color: '#E50914', lineHeight: 1, textShadow: '0 4px 14px rgba(229,9,20,.6)', transform: 'scaleX(1.05)' }}>N</span>
        </div>
      );
    case 'hbomax':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#6A3BFF,#1D0FA8 60%,#0A0650)' }}>
          <div style={{ textAlign: 'center', color: '#fff', lineHeight: 0.9 }}>
            <div style={{ fontFamily: 'Archivo', fontWeight: 700, fontSize: '0.62em', letterSpacing: '.12em' }}>HBO</div>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.55em', letterSpacing: '-.04em' }}>max</div>
          </div>
        </div>
      );
    case 'disney':
      return (
        <div style={{ ...center, background: 'radial-gradient(circle at 50% 120%, #19D3E6 0%, #1647A8 45%, #0A1A4A 100%)' }}>
          <div style={{ color: '#fff', textAlign: 'center', lineHeight: 0.8 }}>
            <div style={{ fontFamily: 'Dancing Script', fontWeight: 700, fontSize: '1.1em' }}>Disney</div>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.7em', textShadow: '0 0 14px #7FE9FF' }}>+</div>
          </div>
        </div>
      );
    case 'crunchyroll':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#FF9A3D,#F2540B)' }}>
          <svg viewBox="0 0 48 48" width="62%" height="62%">
            <circle cx="24" cy="24" r="17" fill="none" stroke="#fff" strokeWidth="5" />
            <circle cx="29" cy="20" r="8.5" fill="#fff" />
            <circle cx="31.5" cy="18" r="3.2" fill="#F47521" />
          </svg>
        </div>
      );
    case 'prime':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#22B2FF,#0A5FD1)' }}>
          <div style={{ textAlign: 'center', color: '#fff' }}>
            <div style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '1.05em', letterSpacing: '-.02em', lineHeight: 1 }}>prime</div>
            <svg viewBox="0 0 40 10" width="1.9em" height=".45em" style={{ display: 'block', margin: '1px auto 0' }}>
              <path d="M2 2c10 7 26 7 34 1" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
              <path d="M32 1.5l5 1-2 4.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontSize: '.42em', fontWeight: 700, letterSpacing: '.18em', opacity: 0.9 }}>VIDEO</div>
          </div>
        </div>
      );
    case 'appletv':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#3d3d44,#050507)' }}>
          <span style={{ fontFamily: 'Outfit', fontWeight: 700, color: '#fff', fontSize: '1.5em', letterSpacing: '-.04em' }}>tv</span>
        </div>
      );
    case 'youtube':
      return (
        <div style={{ ...center, background: '#fff' }}>
          <svg viewBox="0 0 48 34" width="66%">
            <rect x="0" y="0" width="48" height="34" rx="10" fill="#FF0033" />
            <path d="M19 9.5v15l13-7.5z" fill="#fff" />
          </svg>
        </div>
      );
    case 'realworld':
      return (
        <div style={{ ...center, background: 'linear-gradient(160deg,#fff,#FFF1DE)' }}>
          <img src={realworld} alt="" style={{ width: '74%', height: '74%', objectFit: 'contain' }} />
        </div>
      );
    case 'chatgpt':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#19C37D,#0B6B4F)' }}>
          <svg viewBox="0 0 48 48" width="62%">
            {[0, 60, 120, 180, 240, 300].map((r) => (
              <rect key={r} x="19" y="6" width="10" height="20" rx="5" fill="none" stroke="#fff" strokeWidth="3" transform={`rotate(${r} 24 24)`} />
            ))}
          </svg>
        </div>
      );
    case 'gemini':
      return (
        <div style={{ ...center, background: '#fff' }}>
          <svg viewBox="0 0 48 48" width="64%">
            <defs>
              <linearGradient id="gem" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4F8BF9" />
                <stop offset=".55" stopColor="#9B72F5" />
                <stop offset="1" stopColor="#E66F9A" />
              </linearGradient>
            </defs>
            <path d="M24 2c1.6 11.6 10.4 20.4 22 22-11.6 1.6-20.4 10.4-22 22C22.4 34.4 13.6 25.6 2 24 13.6 22.4 22.4 13.6 24 2z" fill="url(#gem)" />
          </svg>
        </div>
      );
    case 'claude':
      return (
        <div style={{ ...center, background: 'linear-gradient(145deg,#E08A68,#B95A3C)' }}>
          <svg viewBox="0 0 48 48" width="60%">
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x="22.5" y="5" width="3" height="19" rx="1.5" fill="#fff" transform={`rotate(${i * 36} 24 24)`} />
            ))}
          </svg>
        </div>
      );
    default:
      return null;
  }
}

export const BRAND_IDS = ['netflix', 'hbomax', 'disney', 'crunchyroll', 'prime', 'appletv', 'youtube', 'realworld', 'chatgpt', 'gemini', 'claude'];

export function TileIcon({ icon, colors, size = 76 }: { icon: IconSpec; colors: [string, string]; size?: number }) {
  const bg = `linear-gradient(145deg, ${colors[0]}, ${colors[1]})`;
  let inner: React.ReactNode = null;
  if (icon.kind === 'preset' && BRAND_IDS.includes(icon.value)) inner = <Brand id={icon.value} />;
  else if (icon.kind === 'preset') inner = <div style={{ ...center, background: bg, color: '#fff' }}><Icon name={icon.value} size={size * 0.42} stroke={2.2} /></div>;
  else if (icon.kind === 'emoji') inner = <div style={{ ...center, background: bg }}><span className="emoji" style={{ fontSize: size * 0.48 }}>{icon.value}</span></div>;
  else if (icon.kind === 'image') inner = <img src={icon.value} alt="" />;
  else if (icon.kind === 'favicon')
    inner = (
      <div style={{ ...center, background: bg }}>
        <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(icon.value)}&sz=128`} alt="" style={{ width: '56%', height: '56%', objectFit: 'contain', borderRadius: 10, background: '#fff', padding: 4 }} />
      </div>
    );
  return <div style={{ width: '100%', height: '100%', fontSize: size * 0.32 }}>{inner}</div>;
}
