# Auryx Nexos — Auditoria técnica completa

Data: 21/11/2026 · Escopo: `server.js` (2.7 mil linhas), `ai.js`, `public/app.js` (6.5 mil linhas), `style.css`, `sw.js`, `index.html`, `site.html`, apps Windows (Electron) e Android (WebView).

## Como esta auditoria foi feita (e o que ela NÃO mediu)

| O que foi medido de verdade | Resultado |
|---|---|
| Site em produção `/site` (navegador do Claude, servidor acordado) | TTFB 757 ms · FCP 1.388 ms · HTML 11 KB |
| App em produção `/` (primeira visita) | TTFB 236 ms · `app.js` 131 KB comprimido / 445 KB real, **1.184 ms para baixar** · `style.css` 26 KB · DOMContentLoaded 1.443 ms |
| Compressão do `app.js` (medido com Node) | sem compressão 456 KB · gzip-9 134 KB (16 ms) · **Brotli-11 107 KB (775 ms de CPU)** |
| Dependências (`npm audit --omit=dev`) | **0 vulnerabilidades** |
| Aury ponta a ponta com um "Gemini falso" local | resposta completa, troca automática de raciocínio em 11 ms, contador e histórico certos |

**Não medido:** LCP, INP e CLS reais de usuários (precisa de RUM no navegador das pessoas), cold start do Render (o servidor estava acordado), uso de RAM do app Android/Windows em aparelhos reais e latência real do Gemini/Claude (o teste usou um servidor falso para não gastar sua chave). As medições do navegador foram feitas com o painel oculto, o que pode deixar os tempos um pouco maiores do que um usuário vê.

Legenda: ✅ **corrigido nesta atualização** · 🟡 proposta (código pronto abaixo, não aplicado).

---

# PARTE 1 — A Aury (IA): velocidade e leveza

### ✅ [CRITICIDADE: Alta] Streaming reenviava a resposta inteira a cada 60 ms

- **Onde está:** `server.js` → `aiChatRun()` (evento `ai:delta`) e `public/app.js` → `onAIDelta()`.
- **O que estava acontecendo:** a cada pedaço novo da IA o servidor mandava **o texto inteiro acumulado** para todos os aparelhos da pessoa, e o app refazia a formatação (`renderText`) da resposta inteira na hora, sem esperar o próximo quadro de tela. O custo crescia ao quadrado: numa resposta de 2.500 tokens (~10 KB de texto) chegando em ~15 s, são ~250 envios com média de ~5 KB cada ≈ **1,2 MB de rede para entregar 10 KB de texto** (estimativa pelo tamanho; não foi medido em produção).
- **Impacto real:** consumo de dados no 4G, CPU e bateria no celular, "engasgo" na tela durante respostas longas, mais trabalho no servidor (JSON de payloads cada vez maiores).
- **Como foi resolvido:** o app novo se identifica como `v: 4` e recebe só o pedaço novo (`ai:chunk { n, d }`, onde `n` é a posição em que o pedaço começa). Apps antigos que ainda estão abertos continuam recebendo o formato velho, sem quebrar. No app, o desenho fica limitado a 1 vez por quadro (`requestAnimationFrame`).

Antes (`server.js`):
```js
let last = 0;
const r = await AI.reply({
  system: sys, messages: history, maxTokens: 2500,
  onText: full => { if (Date.now() - last > 60) { last = Date.now(); io.to("u:" + uid).emit("ai:delta", { id: replyId, t: full }); } }
});
```
Depois (`server.js`):
```js
let last = 0, sent = 0;
const flush = full => {
  const ids = online.get(uid);
  if (ids) for (const sid of ids) {
    const s = io.sockets.sockets.get(sid);
    if (!s) continue;
    if (Number(s.handshake.auth && s.handshake.auth.v) >= 4) s.emit("ai:chunk", { id: replyId, n: Math.min(sent, full.length), d: full.slice(Math.min(sent, full.length)) });
    else if (full) s.emit("ai:delta", { id: replyId, t: full });
  }
  sent = full.length; last = Date.now();
};
const r = await AI.reply({
  system: sys, messages: history, maxTokens: 2500,
  onText: full => { if (full.length < sent || Date.now() - last > 50) flush(full); }
});
```
Depois (`public/app.js`):
```js
let aiPaintRaf = 0;
function aiPaint() {
  aiPaintRaf = 0;
  const p = AIS.pending;
  if (!p || S.view !== "ai") return;
  const el = $(`#aiList [data-id="${CSS.escape(p.id)}"] .ai-b`), stick = aiAtBottom();
  if (el) el.innerHTML = p.t ? renderText(p.t).html : `<span class="ai-dots"><i></i><i></i><i></i></span>`; else renderAIView();
  if (stick) { const l = $("#aiList"); if (l) l.scrollTop = l.scrollHeight; }
}
function aiQueuePaint() { if (!aiPaintRaf) aiPaintRaf = requestAnimationFrame(aiPaint); }
function onAIChunk({ id, n, d }) {
  if (!AIS.pending || AIS.pending.id !== id) return;
  AIS.pending.t = AIS.pending.t.slice(0, Math.max(0, n | 0)) + String(d || "");
  aiQueuePaint();
}
```
Detalhe importante: quando o Claude falha no meio e o Gemini assume, o texto recomeça; o servidor manda `n: 0` na hora e o app limpa o que tinha — não sobra pedaço da primeira IA.

### ✅ [CRITICIDADE: Média] Gemini pensava mais do que precisava

- **Onde está:** `ai.js` → `replyGemini()`.
- **O que estava acontecendo:** o código pedia `thinkingLevel: "low"` (não o mínimo) e, quando um modelo recusava o ajuste, mandava **sem ajuste nenhum** — e sem ajuste o Gemini 3 usa o raciocínio padrão, que é o mais lento. Além disso, essa recusa se repetia (com uma requisição perdida) em toda mensagem nova.
- **Impacto real:** mais tempo até a primeira palavra aparecer.
- **Como foi resolvido:** tenta `"minimal"` → `"low"` → sem ajuste, e **lembra por modelo** qual funcionou. No teste local, a troca levou 11 ms e a mensagem seguinte já foi direto no nível certo.

```js
const thinkStep = new Map();
const thinkOpts = model => /gemini-2\./.test(model) ? [{ thinkingBudget: 0 }, null] : [{ thinkingLevel: "minimal" }, { thinkingLevel: "low" }, null];
// ...
let step = thinkStep.get(model) || 0, res = await send(opts[step]), bad400 = "";
while (res && res.status === 400 && opts[step]) {
  const t = await res.text().catch(() => "");
  if (!/thinking/i.test(t)) { bad400 = t; break; }
  thinkStep.set(model, ++step);
  res = await send(opts[step]);
}
```

### ✅ [CRITICIDADE: Média] Temperatura 0.8 no Gemini 3

- **Onde está:** `ai.js` → `generationConfig`.
- **O que estava acontecendo:** o Google recomenda deixar a temperatura no padrão nos modelos Gemini 3; baixar pode causar repetição/loop na resposta (que também deixa a resposta mais longa e lenta).
- **Como foi resolvido:** a temperatura foi retirada do Gemini (o Groq/Llama continua com 0.8).

### ✅ [CRITICIDADE: Média] Histórico da Aury inchando o banco

- **Onde está:** `server.js` → `aiChatRun()` / `db.ai`.
- **O que estava acontecendo:** guardava até **200 mensagens por pessoa** (até 4.000 caracteres cada = até ~800 KB por assinante) dentro do JSON único do banco, que é **regravado inteiro** a cada segundo com mudanças. Mas o app só mostra as últimas 80 e a IA só lê as últimas 20.
- **Impacto real:** cada assinante ativo deixava todo `save()` mais lento e o Postgres maior.
- **Como foi resolvido:** limite de 80 (`AI_KEEP`) e limpeza única no boot das conversas antigas.

### ✅ [CRITICIDADE: Baixa] Tela de venda da Aury mostrava limites errados

- **Onde está:** `public/app.js` → `renderAIView()` (quem não é assinante).
- **O que estava acontecendo:** mostrava 40/120/300 mensagens por dia, mas o servidor libera 60/200/500 (`AI_LIMIT`). Propaganda menor do que o produto.
- **Como foi resolvido:** o servidor manda os limites em `ai:state` e o app usa esses números.

### ✅ [CRITICIDADE: Baixa] Atendimento de pagamento esperava 1,2 s antes de começar

- **Onde está:** `server.js` → `aiTicket()`.
- **Como foi resolvido:** 700 ms — ainda junta mensagens mandadas em sequência.

### ✅ [CRITICIDADE: Média] Claude Opus 5.5 era o modelo mais caro/lento para bate-papo

- **Onde está:** `ai.js` → `const MODEL = "claude-opus-5-5"`.
- **O que está acontecendo:** quando a conta Anthropic tem créditos, todo bate-papo usa o Opus 5.5 ($4 entrada / $20 saída por milhão de tokens). Para conversa leve, o **Claude Haiku 5.5** custa $0,10 / $0,50 (40× menos) e é mais rápido. Hoje o Claude está sem créditos e a Aury está rodando no Gemini.
- **Impacto real:** custo e tempo de resposta quando o Claude voltar a ser usado.
- **Como foi resolvido (aprovado por você):** a Aury usa o **Claude Haiku 5.5** com esforço baixo; Opus/Sonnet continuam possíveis pela variável `CLAUDE_MODEL` no Render. O Haiku não tem o fallback automático do servidor para recusas — nesse caso a Aury responde com a mensagem educada de sempre. Mudança:
```js
// ai.js
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";
// em replyClaude(): o "fallbacks" do servidor não existe no Haiku — remover estas duas linhas
//   betas: ["server-side-fallback-2026-07-01"],
//   fallbacks: "default",
// e trocar getClient().beta.messages.stream por getClient().messages.stream
```

### 🟡 [CRITICIDADE: Média] Sem botão "Parar", "Copiar" e "Tentar de novo" na Aury

- **Onde está:** `public/app.js` → `aiBubble()` / `server.js` → `ai:send`.
- **O que está acontecendo:** uma resposta longa e errada só termina quando a IA acaba; se der erro, a pessoa precisa redigitar.
- **Como resolver:** passar um `AbortController` até o `fetch`/stream.
```js
// server.js — guardar o controlador por pessoa
const aiAbort = new Map();
// em aiChatRun(): const ac = new AbortController(); aiAbort.set(uid, ac);
//   ... AI.reply({ ..., signal: ac.signal }) ... finally { aiAbort.delete(uid); }
on("ai:stop", () => { const ac = aiAbort.get(uid); if (ac) ac.abort(); return { ok: true }; });

// ai.js — repassar o sinal: em replyGemini/replyGroq
//   signal: AbortSignal.any([signal, AbortSignal.timeout(60 * 1000)].filter(Boolean))
// e no Claude: getClient().beta.messages.stream({...}, { signal })

// app.js — botão de parar no lugar do enviar enquanto AIS.busy
// <button type="button" class="icon-btn" data-ai-stop aria-label="Parar resposta">${ic("x")}</button>
// root.addEventListener("click", e => { if (e.target.closest("[data-ai-stop]")) emit("ai:stop", {}); });
// copiar: navigator.clipboard.writeText(m.t) num botão em aiBubble() para respostas da Aury
```

---

# PARTE 2 — Inicialização, runtime e performance

### ✅ [CRITICIDADE: Média] Sem Brotli e gzip travando o servidor

- **Onde está:** `server.js` → `serveStatic()`.
- **O que estava acontecendo:** só gzip, feito com `gzipSync` (síncrono) no primeiro acesso de cada arquivo depois de cada deploy — o servidor inteiro (chat, voz, IA) para enquanto isso.
- **Impacto real:** `app.js` com Brotli fica **107 KB em vez de 134 KB (−20%)**, menos tempo de download na primeira visita e em cada atualização.
- **Como foi resolvido:** gzip assíncrono; Brotli calculado em segundo plano (775 ms de CPU fora da thread principal) e usado assim que fica pronto. Testado: o navegador recebe `content-encoding: br` e o JS decodificado é válido.

```js
const gz = zip ? await new Promise(ok => zlib.gzip(raw, { level: 9 }, (e, b) => ok(e ? null : b))) : null;
entry = { mtime: st.mtimeMs, raw, gz, br: null, type, etag: /* ... */ };
fileCache.set(file, entry);
if (zip) zlib.brotliCompress(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: raw.length } },
  (e, b) => { if (!e && b.length < (gz ? gz.length : raw.length)) entry.br = b; });
// ...
const body = entry.br && /\bbr\b/.test(ae) ? (headers["content-encoding"] = "br", entry.br)
  : entry.gz && /\bgzip\b/.test(ae) ? (headers["content-encoding"] = "gzip", entry.gz) : entry.raw;
```

### 🟡 [CRITICIDADE: Alta] Banco inteiro num único registro JSON regravado a cada segundo

- **Onde está:** `server.js` → `writeDb()` / `save()` / `flush()`.
- **O que está acontecendo:** usuários, servidores, mensagens, pedidos e conversas da Aury ficam num **único JSONB** no Postgres. Qualquer mudança (uma mensagem, uma reação) marca tudo como sujo e, 1 s depois, o servidor faz `JSON.stringify(db)` **na thread principal** e reenvia o banco inteiro. Medido: 0,8 MB de JSON leva ~4 ms; o custo cresce linearmente — com 50 MB seriam ~250 ms de travamento por segundo de uso, mais o upload de 50 MB por segundo ao Postgres.
- **Impacto real:** é o teto de escala do app. Mensagens e voz vão "engasgando" à medida que o banco cresce; uma queda no meio da gravação perde o último segundo.
- **Como resolver na prática (migração incremental, sem parar o app):** tirar primeiro o que mais cresce — as mensagens — para uma tabela própria, gravando só o que mudou.
```js
// 1) tabela (rodar uma vez no boot, junto do CREATE TABLE nexora_state)
await pg.query(`CREATE TABLE IF NOT EXISTS nexora_msgs (
  channel TEXT NOT NULL, id TEXT NOT NULL, data JSONB NOT NULL, ts BIGINT NOT NULL,
  PRIMARY KEY (channel, id))`);
await pg.query("CREATE INDEX IF NOT EXISTS nexora_msgs_ch_ts ON nexora_msgs (channel, ts DESC)");

// 2) fila de gravação: só as mensagens alteradas, em lote
const msgDirty = new Map();             // "canal|id" -> { channel, m } (m = null para apagar)
function saveMsg(channel, m) { msgDirty.set(channel + "|" + m.id, { channel, m }); save(); }
function deleteMsg(channel, id) { msgDirty.set(channel + "|" + id, { channel, id, m: null }); save(); }
async function flushMsgs() {
  if (!pg || !msgDirty.size) return;
  const batch = [...msgDirty.values()]; msgDirty.clear();
  const ups = batch.filter(x => x.m), dels = batch.filter(x => !x.m);
  if (ups.length) await pg.query(
    `INSERT INTO nexora_msgs (channel, id, data, ts)
     SELECT * FROM UNNEST($1::text[], $2::text[], $3::jsonb[], $4::bigint[])
     ON CONFLICT (channel, id) DO UPDATE SET data = EXCLUDED.data`,
    [ups.map(x => x.channel), ups.map(x => x.m.id), ups.map(x => JSON.stringify(x.m)), ups.map(x => x.m.ts)]);
  if (dels.length) await pg.query("DELETE FROM nexora_msgs WHERE channel = ANY($1) AND id = ANY($2)",
    [dels.map(x => x.channel), dels.map(x => x.id)]);
}
// 3) em writeDb(): gravar o estado SEM db.messages e chamar flushMsgs()
const { messages, ...rest } = db;
await pg.query("INSERT INTO nexora_state ... VALUES (1, $1::jsonb, NOW()) ...", [JSON.stringify(rest)]);
await flushMsgs();
// 4) migração única (db.migrations): copiar db.messages atual para nexora_msgs em lotes de 1.000
// 5) no boot: carregar as últimas HISTORY_KEEP de cada canal; histórico antigo sob demanda (paginação)
```
Isso também elimina o limite de 500 mensagens por canal apontado na Fase 1.

### 🟡 [CRITICIDADE: Alta] Render grátis "dorme" — primeiro acesso leva ~1 minuto

- **Onde está:** hospedagem (`render.yaml`).
- **O que está acontecendo:** após ~15 min sem visitas, o Render desliga o servidor. O service worker mostra a "casca" do app na hora, mas login, mensagens **e a Aury** só respondem quando o servidor acorda. Para quem abre a Aury e manda uma pergunta, a "IA lenta" é na verdade o servidor acordando.
- **Como resolver:** a solução de verdade é o plano pago do Render (instância que não dorme, ~US$ 7/mês). Alternativa gratuita: um monitor externo (ex.: UptimeRobot) chamando `https://nexora-ujw6.onrender.com/health` a cada 10 min. Ambos exigem que **você** crie a conta.

### 🟡 [CRITICIDADE: Média] `app.js` de 445 KB sem minificação, num arquivo só

- **Onde está:** `public/app.js` (6.5 mil linhas) carregado inteiro antes de qualquer tela.
- **O que está acontecendo:** o navegador baixa e interpreta 445 KB de JS (com comentários e nomes longos) até para mostrar a tela de login. Painel ADM, jogos, atividades da call, Spotify e Aury vêm juntos.
- **Impacto real:** 1,2 s só de download na primeira visita medida; parse/compilação pesa em Android fraco.
- **Como resolver:** minificar na hora de publicar (sem mudar o código-fonte):
```json
// package.json
"scripts": {
  "start": "node server.js",
  "build": "esbuild public/app.js --minify --target=es2020 --outfile=public/app.min.js"
},
"devDependencies": { "esbuild": "0.24.0" }
```
```html
<!-- index.html -->
<script src="/app.min.js"></script>
```
No Render: Build Command `npm install && npm run build`. Ganho típico de minificação: 35–45% antes da compressão (estimativa — medir depois). Passo seguinte: dividir em módulos (`admin.js`, `voice.js`, `games.js`) carregados com `import()` só quando a tela abre.

### 🟡 [CRITICIDADE: Baixa] Arquivos estáticos sempre revalidados

- **Onde está:** `serveStatic()` → `cache-control: no-cache` para tudo, inclusive ícones e `vendor/`.
- **O que está acontecendo:** fora do service worker (primeira visita, app Android sem SW), cada recurso faz uma ida ao servidor para confirmar o ETag.
- **Como resolver:**
```js
const immutable = /^\/(icons|vendor)\//.test(pathname);
const headers = { "content-type": entry.type, "cache-control": immutable ? "public, max-age=604800" : "no-cache", /* ... */ };
```

### 🟡 [CRITICIDADE: Baixa] Socket.IO sem compressão em mensagens grandes

- **Onde está:** `new Server(server, { perMessageDeflate: false })`.
- **O que está acontecendo:** o evento `ready` (todos os servidores, membros e amigos) vai sem compressão; para quem está em muitos servidores, são dezenas/centenas de KB a cada reconexão no 4G.
- **Como resolver:** comprimir só mensagens grandes (as pequenas do chat continuam sem custo de CPU):
```js
perMessageDeflate: { threshold: 4096 },
```

### 🟡 [CRITICIDADE: Baixa] Listeners registrados sem remoção

- **Onde está:** `public/app.js` — 133 `addEventListener` e 1 `removeEventListener`; 25 deles em `document`/`window`.
- **O que está acontecendo:** listeners em elementos recriados pelo `innerHTML` são liberados junto com o elemento; os de `document`/`window` não. Se algum deles estiver dentro de uma função chamada mais de uma vez (abrir modal, entrar em call), acumula e roda N vezes. Não encontrei um vazamento confirmado — **precisa de revisão um por um**.
- **Como resolver:** padrão com `AbortController` por tela:
```js
let viewAbort = new AbortController();
function setView(v) {
  viewAbort.abort(); viewAbort = new AbortController();
  // ...
}
document.addEventListener("keydown", onKey, { signal: viewAbort.signal });   // some sozinho ao trocar de tela
```

---

# PARTE 3 — UX, UI e acessibilidade

### 🟡 [CRITICIDADE: Média] Botões só com ícone sem nome acessível

- **Onde está:** `public/app.js` — 38 de 43 `class="icon-btn"` sem `aria-label` (no navegador, a árvore de acessibilidade mostra vários "button" sem nome na tela inicial).
- **Impacto real:** leitor de tela anuncia só "botão"; navegação por teclado sem contexto.
- **Como resolver:** um helper único e trocar os botões aos poucos:
```js
const iconBtn = (icon, label, attrs = "") => `<button type="button" class="icon-btn" aria-label="${esc(label)}" data-tip="${esc(label)}" ${attrs}>${ic(icon)}</button>`;
// antes: `<button class="icon-btn" data-act="mute">${ic("mic")}</button>`
// depois: iconBtn("mic", "Silenciar microfone", 'data-act="mute"')
```

### 🟡 [CRITICIDADE: Baixa] `confirm()` nativo para apagar a conversa da Aury

- **Onde está:** `clearAI()`.
- **O que está acontecendo:** a caixa cinza do navegador destoa do visual do app e, no Android WebView, aparece com o título do site.
- **Como resolver:** usar o modal do próprio app (o mesmo dos outros "Tem certeza?"), com botão vermelho "Apagar".

---

# PARTE 4 — Arquitetura e código

### 🟡 [CRITICIDADE: Alta] Dois arquivos gigantes ("God files")

- **Onde está:** `public/app.js` (6.5 mil linhas, tudo num closure) e `server.js` (2.7 mil linhas: HTTP, contas, banco, Socket.IO, voz, pagamentos, ADM, IA).
- **O que está acontecendo:** uma função com nome repetido sobrescreve a anterior sem erro (já causou bug); qualquer mudança exige ler milhares de linhas; nada é testável isoladamente.
- **Como resolver (sem reescrever):** extrair um módulo por vez, começando pelo que tem fronteira clara:
```
server/
  db.js        (load, save, flush, writeDb)
  http.js      (serveStatic, sendJson, readJson, rotas /api)
  auth.js      (registro, login, sessões, e-mail)
  ai.js        (já separado) + ai-chat.js (aiChatRun, aiTicket*)
  payments.js  (PLANS, pedidos, Pix)
  socket/*.js  (um arquivo por grupo de eventos: chat, voz, servidores, admin)
```
Regra para o `app.js` até lá: rodar antes de cada commit
```bash
grep -oE '^(async )?function \w+' public/app.js | sort | uniq -d
```
(hoje não há nenhum nome duplicado).

### 🟡 [CRITICIDADE: Média] Um único processo; não escala para 2 máquinas

- **Onde está:** estado em memória (`online`, `voice`, `aiBusy`, `attempts`) + banco carregado inteiro na RAM.
- **Como resolver (longo prazo):** depois da Parte 2 (mensagens em tabela), adicionar `@socket.io/redis-adapter` e mover `online`/`voice` para Redis. Antes disso não vale a pena.

### 🟡 [CRITICIDADE: Média] Resiliência quando a IA cai

- **Onde está:** `ai.js` → `reply()`.
- **Situação atual (boa):** Claude → Gemini → Groq com troca automática, "castigo" de 6 h para conta sem crédito, último erro visível no Painel ADM.
- **O que falta:** um limite de tempo para a **primeira** palavra. Hoje, se um provedor aceita a conexão e não manda nada, a pessoa espera até 60 s (Gemini) ou 90 s (Groq) antes da troca.
```js
// em replyGemini/replyGroq: abortar se nada chegar em 15 s
const first = AbortSignal.timeout(15000);
let gotFirst = false;
// combinar: signal: AbortSignal.any([AbortSignal.timeout(60000), firstGuard.signal])
// e ao receber o 1º pedaço: gotFirst = true; clearTimeout(firstTimer);
```

---

# PARTE 5 — Segurança, privacidade e SEO/ASO

### 🟡 [CRITICIDADE: Alta] `.gitignore` local perdeu a proteção das chaves do Android

- **Onde está:** `.gitignore` (mudança **não salva no git**, feita fora desta sessão).
- **O que está acontecendo:** as linhas `*.jks`, `*.keystore`, `*.p12`, `android/local.properties` e as pastas de build do Android foram removidas na sua cópia local. Hoje não existe nenhum desses arquivos na pasta, mas se um dia a chave de assinatura do APK for colocada ali e alguém rodar `git add -A`, **ela vai para o GitHub**. Quem tiver essa chave consegue publicar um APK falso que atualiza por cima do seu.
- **Como resolver:** desfazer a mudança local (não fiz isso sozinho porque não fui eu que alterei):
```bash
git checkout -- .gitignore
```
Também estão apagados localmente `README.md`, `LICENSE` e `.env.example` (sem commit). Não incluí essas mudanças no deploy.

### 🟡 [CRITICIDADE: Média] Token de login no `localStorage` + CSP sem `script-src`

- **Onde está:** `store.set("token", ...)` em `app.js`; cabeçalho CSP em `serveStatic()` só tem `frame-ancestors`, `base-uri`, `object-src`.
- **O que está acontecendo:** o `renderText()` escapa o texto corretamente (não encontrei XSS), mas há 155 `innerHTML` no app. Se um único ponto esquecer o `esc()`, um script injetado lê o `localStorage` e rouba a sessão. Uma CSP com `script-src 'self'` bloquearia esse script mesmo assim.
- **Por que não apliquei direto:** o app tem 2 handlers inline (`onclick` na tela de manutenção, linha ~1370; `onerror` na imagem do jogo, linha ~4990) e usa WASM (RNNoise) — uma CSP estrita quebraria isso.
- **Como resolver com segurança:** primeiro em modo "só relatar":
```js
"content-security-policy": "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
"content-security-policy-report-only": "script-src 'self' 'wasm-unsafe-eval'; report-uri /api/csp",
```
```js
// rota que só registra no log
if (req.method === "POST" && pathname === "/api/csp") { readJson(req).then(j => console.warn("[csp]", JSON.stringify(j).slice(0, 500))).catch(() => {}); res.writeHead(204); res.end(); return; }
```
Trocar os 2 handlers inline por `addEventListener` e, sem relatórios por uma semana, mudar para a CSP de verdade.

### ✅ [CRITICIDADE: Média] Sem `robots.txt`, `sitemap.xml` e canonical

- **Onde está:** `public/` e `site.html`.
- **O que estava acontecendo:** o Google não tinha mapa do site; `og:image` era relativo (WhatsApp/Discord não mostram a imagem na prévia do link); sem `canonical`.
- **Como foi resolvido:** `robots.txt` (libera `/site`, bloqueia `/api/`, `/f/`, `/socket.io/`, `/agente/`), `sitemap.xml`, `canonical`, `og:url`, `og:type`, `og:locale`, `twitter:card` e `og:image` com endereço completo. O servidor agora entrega `.txt` e `.xml` com o tipo certo.

### 🟡 [CRITICIDADE: Média] SEO limitado pelo domínio `onrender.com`

- **O que está acontecendo:** o site vive em `nexora-ujw6.onrender.com` — nome difícil de lembrar, sem autoridade própria e o nome antigo "nexora" na URL.
- **Como resolver:** comprar um domínio (ex.: `auryx.com.br`), apontar no Render (Custom Domain) e trocar as URLs do `sitemap.xml`, `canonical` e `og:*`. Exige compra feita por você.

### 🟡 [CRITICIDADE: Baixa] ASO: o app Android não está em loja

- **O que está acontecendo:** o APK é baixado do GitHub; não há ficha na Play Store (busca, avaliações, atualização automática, confiança). O Android avisa "app de fonte desconhecida", o que derruba a conversão.
- **Como resolver:** conta de desenvolvedor Google Play (US$ 25, feita por você), gerar AAB no GitHub Actions (`bundleRelease`) e publicar com o mesmo `applicationId` `com.auryx.nexavoria` (nunca mudar).

### ✅ Pontos que já estão bons
- 0 vulnerabilidades conhecidas nas dependências.
- Chaves das IAs só no servidor; o app nunca vê.
- Senhas com scrypt, tokens com hash, bloqueio por força bruta, limite por IP atrás do proxy.
- Cabeçalhos anti-clickjacking, `nosniff`, HSTS em produção.
- Arquivos privados (comprovantes) protegidos por dono/ADM.

---

# Plano de execução

### Fase 1 — Correções urgentes e quick wins
| # | Item | Status |
|---|---|---|
| 1 | Aury: streaming só com o pedaço novo + desenho por quadro | ✅ feito |
| 2 | Aury: raciocínio mínimo do Gemini com memória por modelo, sem temperatura | ✅ feito |
| 3 | Aury: histórico 200 → 80, limites certos na tela de venda, atendimento 0,7 s | ✅ feito |
| 4 | Brotli + gzip assíncrono | ✅ feito |
| 5 | robots.txt, sitemap.xml, canonical, Open Graph | ✅ feito |
| 6 | Restaurar o `.gitignore` (chaves do Android) | 🟡 1 comando seu |
| 7 | Render sem dormir (plano pago ou monitor externo) | 🟡 precisa da sua conta |
| 8 | Claude da Aury: Opus 5.5 → Haiku 5.5 | ✅ feito |

### Fase 2 — Otimização profunda de performance e UX
1. Mensagens em tabela própria no Postgres (fim do JSON gigante e do limite de 500).
2. Minificação do `app.js` com esbuild no build do Render.
3. Botões Parar / Copiar / Tentar de novo na Aury + limite de 15 s para a primeira palavra.
4. `aria-label` em todos os botões de ícone; modal próprio no lugar do `confirm()`.
5. CSP em modo relatório → CSP estrita.
6. Revisar os 25 listeners de `document`/`window` com `AbortController`.

### Fase 3 — Evolução de arquitetura e escala
1. Dividir `server.js` e `app.js` em módulos (um por domínio), com `import()` sob demanda no app.
2. Redis (adapter do Socket.IO + presença) para rodar em mais de uma máquina.
3. Servidor de mídia (SFU) para calls grandes e TURN próprio.
4. Domínio próprio e app na Play Store.
5. Medição real de usuários (Web Vitals: LCP/INP/CLS enviados para `/api/metrics`).

## O que eu preciso de você para aprofundar
- Os **logs do Render** de um dia normal (para ver tempo de resposta real da Aury e erros do Gemini/Claude).
- O **tamanho atual do banco** em produção (`SELECT pg_size_pretty(pg_total_relation_size('nexora_state'))` no Render) — define a urgência da Fase 2.1.
- Prints da Aury no **celular Android** e no app de **Windows** durante uma resposta longa.
- O arquivo `.github/workflows` do build do APK, se quiser a parte de Play Store.
