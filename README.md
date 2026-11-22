<p align="center"><img src="assets/logo.png" width="120" alt="Inglês"></p>
<h1 align="center">Inglês</h1>
<p align="center"><b>A tríade de estudos: software (Windows), app (Android) e extensão (Chrome) — com os mesmos dados, sincronizados.</b></p>

## Downloads

Sempre na última [Release](../../releases/latest):

| | Arquivo | Destaques |
|---|---|---|
| 💻 Software | `Ingles-Setup-x.y.z.exe` (instalador) | Abre com o Windows · launcher que abre tudo no **Chrome Estudos** (perfil isolado, em inglês, em abas) · atualiza sozinho |
| 📱 App | `Ingles-x.y.z.apk` | Atualiza **por cima** das versões antigas · **OCR** de imagens (Google ML Kit) · clones isolados (Real World, YouTube, ChatGPT, Gemini) · contagem de streaming por notificações de mídia/acessibilidade · AnkiDroid |
| 🧩 Extensão | `Ingles-Extensao-x.y.z.zip` | Frases · **cronômetro automático de streaming** (play/pause) · **captura de legenda** (botão “＋ Legenda” ou `Alt+Shift+S`) · “Adicionar às Frases” no botão direito |

## O que tem

- **Launcher** (software e app): HBO Max, Disney Plus, Crunchyroll, Real World (Instagram isolado), Netflix, Apple TV, Prime Video, YouTube, ChatGPT e Gemini. Crie atalhos para uma ou **várias páginas** (abrem juntas em abas) com ícone de marca, ícone, emoji, imagem própria ou o ícone do site.
- **Frases**: toque numa palavra para **copiar**; pressione a frase (ou 🗑) para **“Apagar frase (foi aprendida)”** ou **“Apagar frase (Digitação incorreta)”** — esta só descarta, não conta. Estatísticas do dia: adicionadas, aprendidas e **média de aprendizado** com cores.
- **Editor**: negrito, itálico, sublinhado com **cor própria**, cor por trecho, **setas com explicação** sob termos, rascunho sincronizado (recebe o OCR do celular).
- **Áudio ElevenLabs** para todas as frases de uma vez (só a frente; as explicações das setas são ignoradas).
- **Flashcards**: frente = frase, verso opcional; **prompts automáticos** (tradução PT-BR / definição em inglês, com ênfase no trecho destacado) abrem **Gemini, ChatGPT e Claude** já com o prompt; **Colar resposta**; envio ao **Anki** (AnkiConnect → AnkiWeb no PC, AnkiDroid no celular) com áudio, escolhendo ou criando o baralho.
- **Estatísticas** de frases (mensal, 12 meses, fila, sequência, tempo até aprender, mapa de calor, dias da semana) e de **streaming** (por serviço, dia, mês, meta diária, pausa por serviço, lançamento manual).
- **Temas** claro e AMOLED (preto verdadeiro), **48 fontes**, cor das frases preta/branca ou azul turquesa.

## Sincronização

Servidor próprio no Cloudflare (Worker + D1): veja **[docs/TUTORIAL-CLOUDFLARE.md](docs/TUTORIAL-CLOUDFLARE.md)** — inclui como **embutir o link** no app.

## Desenvolvimento

```bash
npm install
npm run dev            # interface no navegador (http://localhost:5173/?demo=1&as=android)
npm test               # testes
npm run electron       # software (Electron) local
npm run build:extension
npm run android:sync   # depois abra a pasta android/ no Android Studio
```

O workflow `.github/workflows/release.yml` gera e publica os 3 arquivos a cada push.

### Assinatura do APK (necessária para atualizar por cima)

O APK precisa ser assinado sempre com a **mesma chave** para cada versão nova instalar por cima da anterior. A chave **não fica no repositório** (ele é público): cadastre em **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Conteúdo |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | a chave (`.jks`) em base64 |
| `ANDROID_KEYSTORE_PASSWORD` | senha da chave |
| `ANDROID_KEY_ALIAS` | `ingles` |

Sem esses secrets o CI ainda gera o APK, mas com chave temporária (só para teste). Cadastre-os **antes** de instalar o app de verdade; trocar de chave depois exige desinstalar uma vez.

Para gerar sua própria chave:

```bash
keytool -genkeypair -keystore ingles-release.jks -alias ingles -keyalg RSA -keysize 2048 -validity 36500
base64 -w0 ingles-release.jks   # cole o resultado em ANDROID_KEYSTORE_BASE64
```
