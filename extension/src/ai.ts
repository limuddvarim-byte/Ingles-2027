// Preenche o prompt enviado pela tríade nas IAs (Gemini não aceita ?q= na URL).
const m = location.hash.match(/ingles-prompt=([^&]+)/);
if (m) {
  const prompt = decodeURIComponent(m[1]);
  history.replaceState(null, '', location.pathname + location.search);
  let n = 0;
  const t = setInterval(() => {
    const el = document.querySelector<HTMLElement>('rich-textarea .ql-editor, div.ql-editor[contenteditable="true"], div[contenteditable="true"][role="textbox"], #prompt-textarea, div.ProseMirror[contenteditable="true"]');
    if (el) {
      clearInterval(t);
      el.focus();
      document.execCommand('insertText', false, prompt);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        const b = document.querySelector<HTMLButtonElement>('button.send-button, button[aria-label*="Send" i], button[aria-label*="Enviar" i]');
        if (b && !b.disabled) b.click();
      }, 900);
    }
    if (++n > 80) clearInterval(t);
  }, 500);
}
