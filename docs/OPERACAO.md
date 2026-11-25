# Auryx Nexos — Guia de operação

Como o Auryx Nexos funciona por dentro, como publicar, como configurar, como fazer e restaurar backup,
como acompanhar a saúde do servidor e como rodar os testes. Atualizado em 25/11/2026.

---

## 1. Visão geral

| Parte | Onde | O que faz |
|---|---|---|
| Servidor | `server.js` (+ `ai.js`, `backup.js`) | Site, API, Socket.IO (chat, voz, tela), pagamentos, Painel ADM, Aury, backup, monitoramento |
| App web | `public/app.js`, `public/style.css`, `public/index.html` | O app inteiro (navegador, PWA e dentro dos apps) |
| Site | `public/site.html` (`/site`, `/baixar`) | Apresentação e downloads |
| App de PC | `desktop/` (Electron) | Janela própria, seletor de tela, sobreposição, Agente embutido |
| App Android | `android/` (WebView) | Tela do celular, chamada com tela bloqueada, notificações |
| Agente Auryx | `public/agente/nexora-agente.ps1` | Controle remoto e controles de Xbox virtuais no PC de quem transmite |
| Testes | `tests/` | Testes de ponta a ponta (servidor real + PostgreSQL local) |

**Banco (PostgreSQL / Neon):**

| Tabela | Conteúdo |
|---|---|
| `nexora_state` | Estado geral em JSON: contas, sessões, servidores, convites, pedidos, Aury, configurações, denúncias. Guarda também só as 50 últimas mensagens de cada canal, como segurança para voltar de versão. |
| `nexora_msgs` | **Todas** as mensagens, uma por linha (histórico completo, sem limite de 500). |
| `nexora_files` | Imagens, vídeos e comprovantes enviados. |
| `nexora_backups` | Os backups diários, criptografados e conferidos. |

Sem `DATABASE_URL`, tudo fica em `data/nexora.json` (só para testes locais).

---

## 2. Publicar (deploy)

1. `git push` na `main`. O Render publica sozinho em 1 a 2 minutos.
2. Se `public/agente/**` mudou, o GitHub Actions gera um app de PC novo (`app-v3.0.N`).
   - Refaça o `Auryx-Agente.zip` sempre que mudar o `.ps1`.
3. Para quem está com o app aberto, a atualização é automática: o `app.js` leva a própria versão e o app se recarrega sozinho.
4. Para obrigar quem tem o app de PC ou Android antigo a atualizar: **Painel ADM › Sistema › versão mínima**.

**Nunca mudar:**
- o pacote Android `com.auryx.nexavoria`;
- o `appId` do app de PC `com.nexora.app`;
- o endereço que o app de PC abre (`nexora-ujw6.onrender.com`). Se ele mudar, todo mundo que usa o app de PC sai da conta.

---

## 3. Variáveis de ambiente (Render › Environment)

| Variável | Para quê | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Banco PostgreSQL | Sim |
| `BACKUP_KEY` | Senha que criptografa os backups. **Guarde fora do Render** (gerenciador de senhas): sem ela o backup não abre. | Recomendada |
| `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN` | Cópia dos backups no Google Drive (gere com `node scripts/google-drive-token.js`) | Opcional |
| `GDRIVE_FOLDER_ID`, `GDRIVE_KEEP` | Pasta no Drive e quantas cópias manter (padrão 14) | Opcional |
| `RESEND_API_KEY`, `MAIL_FROM` | E-mails: confirmação, recuperação de senha e backup por e-mail | Recomendada |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `GEMINI_API_KEY`, `GROQ_API_KEY` | Provedores da Aury (usa o primeiro que funcionar) | Para a Aury |
| `AI_FIRST_MS`, `AI_TOTAL_MS` | Tempo máximo até a 1ª palavra (padrão 20 s) e total (120 s) | Opcional |
| `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` | Voz em 4G e em redes de empresa ou escola | Recomendada |
| `ADMIN_USERS` | ADMs fixos por nome | Opcional |
| `MEM_LIMIT_MB` | Memória do plano do Render, para o alerta de memória (padrão 512) | Opcional |
| `DB_LIMIT_GB` | Tamanho do banco, para o alerta de espaço (Neon grátis = 0,5) | Opcional |
| `YOUTUBE_API_KEY`, `STEAM_API_KEY`, `SPOTIFY_CLIENT_ID` | Busca de músicas, "Jogando X" e Spotify | Opcional |

---

## 4. Backup e restauração

**Automático:**
- Uma cópia por dia, com contas, servidores, pedidos e todas as mensagens.
- Cada cópia é **conferida** depois de gravada: o servidor abre, descompacta e compara o SHA-256. Só então as antigas são apagadas.
- No banco ficam as 3 últimas, mais as cópias "antes de atualização", que ficam 30 dias.
- Cópias externas:
  - **Google Drive:** as antigas vão para a lixeira do Drive, que guarda 30 dias, então nada é apagado de vez;
  - **e-mail do dono**, quando o arquivo tem até 20 MB.
- Se algo falhar, o dono recebe uma notificação e o aviso fica no Histórico do painel.

**Ainda fora do backup:** imagens e vídeos enviados (tabela `nexora_files`).

**Fazer na hora:** Painel ADM › Backups › *Fazer backup agora*. Para guardar uma cópia no seu PC, use *Baixar*.

**Restaurar** (rode no seu PC, com o serviço do Render **suspenso**):

```bash
# 1. só confere o arquivo e mostra o resumo (não muda nada)
BACKUP_KEY="sua-senha" DATABASE_URL="postgres://..." node scripts/restaurar-backup.js nexora-123-manual.axb

# 2. restaura de verdade
BACKUP_KEY="sua-senha" DATABASE_URL="postgres://..." node scripts/restaurar-backup.js nexora-123-manual.axb --confirmar
```

No PowerShell, defina as variáveis com `$env:BACKUP_KEY="..."` e `$env:DATABASE_URL="..."` antes do comando.

O script:
- salva antes uma cópia de segurança do que está no banco (`seguranca-antes-de-restaurar-*.axb`);
- restaura tudo numa transação só e confere o número de mensagens;
- se recusa a rodar se o servidor gravou nos últimos 90 segundos (ele estaria ligado e gravaria por cima).

Depois, retome o serviço no Render.

---

## 5. Saúde do servidor e alertas

**Painel ADM › Visão geral › "Saúde do servidor"** (medida a cada minuto):
- banco respondendo (ms) e última gravação;
- lentidão do servidor (atraso do processamento) e tempo de resposta das páginas;
- memória usada;
- erros recentes;
- avisos da proteção contra scripts (CSP em observação).

**Alertas** (notificação para o dono e aviso na tela dos ADMs):

| Problema | Quando avisa |
|---|---|
| Banco | parou de responder |
| Gravações | 3 falhas seguidas |
| Memória | passou de 85% |
| Lentidão | atraso acima de 500 ms |
| Erros | mais de 30 em 10 minutos |
| Espaço do banco | passou de 85% |

Avisa de novo quando volta ao normal, e no máximo 1 aviso a cada 30 minutos por problema.
Para receber, **deixe as notificações do Auryx ligadas no seu aparelho**. Os logs completos ficam no Render (Logs).

**Proteção contra scripts (CSP):** está em *modo de observação*. Não bloqueia nada, só mostra no painel o que seria bloqueado.
Se o painel ficar sem avisos estranhos por uma ou duas semanas, dá para trocar `content-security-policy-report-only` por `content-security-policy` em `server.js`.

---

## 6. Controle remoto e co-op

- **Quem transmite:**
  - no **app de PC**, o agente já vem embutido (abre e fecha sozinho);
  - no **navegador**, a pessoa baixa o `Auryx-Agente.zip`, abre e digita o código de 6 números.
- **Co-op com controle (Jogador 2, 3, 4):** o PC de quem transmite precisa do driver gratuito **ViGEmBus**
  (github.com/nefarius/ViGEmBus/releases), instalado uma vez.
  - Cada amigo vira um controle de Xbox virtual (XInput).
  - Sem o driver, o controle do amigo vira teclado.
  - O autor não atualiza mais o ViGEmBus, mas ele continua sendo o padrão usado por Sunshine e DS4Windows.
- **Segurança do agente:**
  - só aceita a página do Auryx Nexos;
  - fecha depois de 5 códigos errados;
  - fecha junto com o app de PC;
  - registra tudo em `%LOCALAPPDATA%\AuryxAgente\atividade.log`.
- **Na tela de quem transmite:**
  - nada acontece sem aceitar;
  - "Bloquear pedidos de controle";
  - fim automático depois de 15 minutos sem uso;
  - histórico de quem controlou.

---

## 7. Testes

```bash
cd tests
npm install --legacy-peer-deps   # uma vez
npm test                          # todos (cerca de 2 min)
npm test -- aury                  # só os que têm "aury" no nome
```

- Os testes sobem o `server.js` de verdade contra um **PostgreSQL em memória (PGlite)**, com Google Drive, Gemini e Groq **falsos**. Não usam chave real nem o banco de produção.
- No Windows também testam o Agente Auryx. O teste dos controles virtuais só roda com o ViGEmBus instalado.
- Resultado em 25/11/2026: **155 de 155 aprovados**.

| Arquivo | O que testa |
|---|---|
| `banco-e-backup.test.js` | Migração das mensagens, sessões, conta suspensa, envio sem duplicar, histórico completo, edição de antigas, limpeza de arquivos, backup (criptografia, Drive, retenção), restauração, banco fora do ar, reinício |
| `modo-arquivo.test.js` | Tudo funcionando sem PostgreSQL |
| `aury-fixadas-pesquisa.test.js` | Troca de provedor travado, Parar, Tentar de novo, fixar com permissões, pesquisa |
| `denuncias-dados-saude.test.js` | Denúncias, Baixar meus dados (LGPD), alertas com o banco fora, cache |
| `controle-mapeamento.test.js` | Controle Xbox/PlayStation do navegador → controle de Xbox |
| `agente-seguranca.test.js` | Origem, código errado, fechar com o app |
| `agente-controles.test.js` | Dois controles virtuais ao mesmo tempo, valores, remoção |

---

## 8. Pendências conhecidas

- Backup das imagens e vídeos enviados (`nexora_files`).
- "Excluir minha conta" pelo próprio usuário (LGPD).
- Pagamento com confirmação automática: o Pix por link do Nubank não avisa o servidor. Precisa de um provedor com API, como Mercado Pago, Efí ou Asaas.
- Medir memória e processador do app de PC e do Android nos aparelhos reais.
- Partida real de co-op entre dois PCs (os testes cobrem o agente e o driver, não uma partida inteira).
- Cancelamento da Aury com o Claude de verdade (hoje sem créditos; testado com Gemini e Groq).
- Atualizar `@anthropic-ai/sdk` (1.8 → 1.14) quando o Claude voltar a ser usado, para testar junto.
