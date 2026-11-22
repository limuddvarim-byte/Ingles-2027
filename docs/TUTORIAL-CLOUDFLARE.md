# Tutorial — servidor de sincronização no Cloudflare (e como embutir o link no app)

A tríade (software, app e extensão) guarda tudo localmente e sincroniza por um **Cloudflare Worker + banco D1** que é **seu** (plano grátis é suficiente).
Sincroniza: frases, verso dos flashcards, áudios do ElevenLabs, rascunho do editor (inclusive o texto do OCR), atalhos do launcher, tempo de streaming e ajustes (tema, fontes, voz…).

---

## Opção A — pelo computador, com o terminal (≈10 minutos)

Pré-requisitos: [Node.js 20+](https://nodejs.org) e uma conta grátis em <https://dash.cloudflare.com>.

```bash
git clone https://github.com/limuddvarim-byte/Ingles-2027.git
cd Ingles-2027/worker
npm install
npx wrangler login
```

1. **Crie o banco D1**

   ```bash
   npx wrangler d1 create ingles-sync
   ```

   Copie o `database_id` que aparecer e cole em `worker/wrangler.toml` no lugar de `COLE_AQUI_O_DATABASE_ID`.

2. **Crie as tabelas**

   ```bash
   npx wrangler d1 execute ingles-sync --remote --file=schema.sql
   ```

3. **Publique o Worker**

   ```bash
   npx wrangler deploy
   ```

   No fim aparece o endereço, algo como `https://ingles-sync.SEU-USUARIO.workers.dev`. **Guarde-o.**

4. **Crie o token secreto** (uma senha longa só sua — ex.: gere em <https://1password.com/password-generator>)

   ```bash
   npx wrangler secret put SYNC_TOKEN
   ```

   Cole o token quando pedir.

5. **Teste**: abra `https://ingles-sync.SEU-USUARIO.workers.dev/health` no navegador → deve responder `{"error":"unauthorized"}` (é o esperado sem o token).

## Opção B — tudo pelo GitHub (sem instalar nada)

1. No Cloudflare: **Storage & Databases → D1 → Create** com o nome `ingles-sync`. Copie o *Database ID*.
2. No Cloudflare: **My Profile → API Tokens → Create Token → modelo “Edit Cloudflare Workers”** e adicione a permissão **D1: Edit**. Copie o token. Anote também seu **Account ID** (aparece na página inicial do Workers).
3. No GitHub, em **Settings → Secrets and variables → Actions**:
   - *Secrets*: `CLOUDFLARE_API_TOKEN` (o token do passo 2) e `SYNC_TOKEN` (sua senha de sincronização).
   - *Variables*: `D1_DATABASE_ID` e `CLOUDFLARE_ACCOUNT_ID`.
4. Vá em **Actions → “Publicar servidor Cloudflare” → Run workflow**. O log mostra o endereço `*.workers.dev`.

---

## Conectar a tríade

Em **cada** um (software, app e extensão): **Ajustes → Sincronização (Cloudflare)** → cole o endereço e o token → **Conectar e salvar**.
O ícone de nuvem fica verde quando está sincronizado. A sincronização roda sozinha a cada minuto e logo depois de cada mudança.

## Embutir o link dentro do app (para não precisar digitar)

O build lê três valores e os **embute** no software, no APK e na extensão:

| Nome | Onde cadastrar no GitHub | Para quê |
|---|---|---|
| `SYNC_URL` | *Variables* | Endereço do Worker — já vem preenchido em Ajustes |
| `SYNC_TOKEN` | *Secrets* | (opcional) Token já preenchido. ⚠️ Fica dentro do APK/extensão: só use se não for distribuir os arquivos para outras pessoas |
| `UPDATE_URL` | *Variables* | (opcional) Link de atualização. Use `https://ingles-sync.SEU-USUARIO.workers.dev/update` para as atualizações passarem pelo seu Worker (ele repassa a última Release do GitHub) |

Passo a passo:

1. GitHub → repositório → **Settings → Secrets and variables → Actions**.
2. Aba **Variables → New repository variable** → `SYNC_URL` = `https://ingles-sync.SEU-USUARIO.workers.dev`.
3. (Opcional) Aba **Secrets → New repository secret** → `SYNC_TOKEN` = seu token.
4. (Opcional) **Variables** → `UPDATE_URL` = `https://ingles-sync.SEU-USUARIO.workers.dev/update`.
5. Faça qualquer push (ou **Actions → Release da tríade → Run workflow**). A nova Release já sai com o link embutido.

Para rodar localmente com o link embutido:

```bash
SYNC_URL=https://ingles-sync.SEU-USUARIO.workers.dev npm run build:android-ui
```

## Como as atualizações chegam

- **Software (Windows)**: verifica as Releases do GitHub ao abrir e a cada 3 horas, baixa sozinho e mostra “Reiniciar e atualizar”.
- **App (Android)**: ao abrir, consulta `UPDATE_URL` (ou a API de Releases do GitHub). Se houver versão nova, toque em **Atualizar**: o APK é baixado e instalado **por cima** (mesma assinatura e versão sempre maior → seus dados ficam).
- **Extensão**: o software copia cada versão nova para `%APPDATA%\Ingles\extensao`; a extensão percebe a mudança e se recarrega sozinha.

## Rotas do Worker

| Rota | Uso |
|---|---|
| `GET /health` | teste de conexão (exige token) |
| `POST /sync` | envia mudanças e recebe as dos outros aparelhos (Last-Write-Wins por registro) |
| `GET/PUT /audio/:id` | áudios do ElevenLabs |
| `GET /update` | público — última Release (link de atualização) |
