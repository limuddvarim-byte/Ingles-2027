import { APP_VERSION, UPDATE_URL } from '../core/build';
import type { UpdateInfo } from './types';

/** -1 se a < b, 0 se igual, 1 se a > b. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  const pb = b.replace(/^v/i, '').split(/[.+-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

/** Lê a última release (GitHub API ou o endpoint /update do seu Worker — mesmo formato). */
export async function fetchLatestRelease(ext: '.apk' | '.zip' | '.exe', current = APP_VERSION): Promise<UpdateInfo> {
  try {
    const res = await fetch(UPDATE_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return { available: false };
    const rel = (await res.json()) as { tag_name: string; body?: string; html_url?: string; assets?: ReleaseAsset[] };
    const version = rel.tag_name.replace(/^v/i, '');
    const asset = rel.assets?.find((a) => a.name.toLowerCase().endsWith(ext));
    return {
      available: compareVersions(version, current) > 0 && !!asset,
      version,
      notes: rel.body ?? '',
      url: asset?.browser_download_url ?? rel.html_url,
    };
  } catch {
    return { available: false };
  }
}

/** Script que preenche e envia o prompt no Gemini (usado pela extensão e pelo clone do celular). */
export function geminiFillScript(prompt: string): string {
  return `(function(p){var n=0;var t=setInterval(function(){var el=document.querySelector('rich-textarea .ql-editor,div.ql-editor[contenteditable="true"],div[contenteditable="true"][role="textbox"]');if(el){clearInterval(t);el.focus();document.execCommand('insertText',false,p);el.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(function(){var b=document.querySelector('button.send-button,button[aria-label*="Send" i],button[aria-label*="Enviar" i]');if(b&&!b.disabled)b.click();},900);}if(++n>80)clearInterval(t);},500);})(${JSON.stringify(prompt)});`;
}

/** Script que preenche (sem enviar) o prompt em ChatGPT/Claude caso ?q= não funcione. */
export function genericFillScript(prompt: string): string {
  return `(function(p){var n=0;var t=setInterval(function(){var el=document.querySelector('#prompt-textarea,div.ProseMirror[contenteditable="true"],textarea');if(el){clearInterval(t);if(el.innerText&&el.innerText.trim().length>0)return;el.focus();if(el.tagName==='TEXTAREA'){el.value=p;el.dispatchEvent(new Event('input',{bubbles:true}));}else{document.execCommand('insertText',false,p);}}if(++n>60)clearInterval(t);},500);})(${JSON.stringify(prompt)});`;
}
