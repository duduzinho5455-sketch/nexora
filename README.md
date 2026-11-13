# NEXORA

MVP de comunidade: cadastro/login, chat em tempo real, presença online, voz e compartilhamento de tela WebRTC P2P.

## Publicar no Render
1. Extraia o ZIP e envie o conteúdo para a raiz de um repositório GitHub.
2. No Render, selecione **New + → Blueprint** e conecte o repositório.
3. O Render detectará `render.yaml` e criará o Web Service e o PostgreSQL.
4. Aguarde o deploy e abra a URL `onrender.com`.

O Blueprint usa um PostgreSQL gerenciado pelo Render e gera `SESSION_SECRET` automaticamente.

## Rodar localmente
Requer Node.js 20+ e PostgreSQL.
1. Copie `.env.example` para `.env` e configure `DATABASE_URL` e `SESSION_SECRET`.
2. `npm install`
3. `npm start`
4. Abra `http://localhost:3000`.

## Limitações honestas desta versão
- Render hospeda o site, API, banco e sinalização; a mídia de voz/tela trafega diretamente entre navegadores via WebRTC P2P.
- Não há TURN configurado. Algumas redes/NATs podem impedir conexões entre usuários.
- Mesh P2P não escala bem: indicado para chamadas pequenas, não para grandes salas.
- A captura solicita até 2560x1440 e 60 FPS, mas não garante esses valores. O navegador, sistema, GPU, conexão e máquina receptora determinam a qualidade efetiva.
- Esta versão ainda não tem painel de criação de servidores/canais, vídeo remoto em elemento visual, DMs, recuperação de senha, moderação ou controles avançados.
- O Render Free pode suspender o serviço por inatividade. HTTPS é necessário para captura de tela/microfone em produção.
- Antes de uso público, adicione rate limiting, verificação de e-mail, recuperação de conta, moderação, limites de mensagens/conexões, TURN, monitoramento e política de privacidade.
