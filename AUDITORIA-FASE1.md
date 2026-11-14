# Auryx Nexavória (NEXORA) — Fase 1: Auditoria

Data: 14/11/2026 · Nenhum código foi alterado nesta fase.

## 1. Arquitetura atual

| Parte | Arquivos | Tamanho |
|---|---|---|
| Servidor (Node + Socket.IO, sem framework) | `server.js`, `ai.js` | ~2.050 linhas |
| App web (um único script, sem framework) | `public/app.js`, `style.css`, `index.html`, `sw.js` | ~7.200 linhas |
| Site de apresentação | `public/site.html` | 484 linhas |
| App Windows (Electron 44) | `desktop/*` | ~250 linhas |
| App Android (WebView nativo) | `android/.../*.java` | ~620 linhas |

- **Hospedagem:** Render (plano grátis) + PostgreSQL do Render. Builds do APK e do instalador do Windows pelo GitHub Actions.
- **Banco:** o estado inteiro (usuários, servidores, mensagens…) fica num **único registro JSON** no Postgres, regravado no máximo 1 vez por segundo. Os arquivos enviados ficam numa tabela separada.
- **Voz/vídeo:** WebRTC ponto a ponto (cada pessoa conecta com todas), até 12 por sala. Só servidores STUN do Google, **sem TURN**.
- **Tempo real:** um único processo Node; não escala para mais de uma máquina.

## 2. O que já existe e funciona (testado em sessões anteriores)

- **Contas:** cadastro, login, logout, verificação de e-mail (Resend), recuperação de senha por código, bloqueio após 8 senhas erradas, hash scrypt, sessões de 60 dias, limite de requisições.
- **Perfis:** avatar (imagem/GIF/emoji), banner, bio, cor, status (online/ausente/não perturbe/invisível), status personalizado, Perfil Turbo (efeitos de nome, degradês), insígnias.
- **Servidores:** criar (com modelos), editar, ícone, público/privado, convites, explorar comunidades, expulsar, sair, transferir dono, excluir, criar/editar/mover/excluir canais de texto e voz.
- **Mensagens:** enviar, editar, apagar, responder, reações, menções, formatação, blocos de código, spoiler, anexos (arrastar, colar), histórico paginado, não lidas, rascunhos, indicador de digitação.
- **Social:** amigos (pedir/aceitar/remover), mensagens privadas, grupos, chamadas privadas com toque.
- **Voz e vídeo:** salas de voz, mutar/ensurdecer, escolha de microfone e saída, teste de microfone, supressão de ruído com IA (RNNoise), eco/ganho automático, volume individual, quem fala, câmera, transmissão de tela com qualidade/FPS, controle remoto com permissão, chat da call, atividades (YouTube, Spotify, lousa, jogo da velha), reconexão automática.
- **Outros:** Aury (IA), catálogo de jogos, Steam, notificações push (web e Android), Painel ADM (pagamentos, planos, usuários, servidores bloqueados, suspensões, aviso geral, histórico), planos Plus/Pro/Max com Pix manual aprovado pelo ADM, temas Escuro/Midnight/Claro, cor de destaque, menos movimento, PWA, sobreposição de jogo no PC.

## 3. Incompleto

- **Planos:** hoje são Plus R$ 5,99, Pro R$ 14,99 e **Max R$ 34,99**. O pedido fala em VIP R$ 5,99 e Premium R$ 14,99. Falta decidir se o Max continua.
- **Pagamento:** só manual (o ADM confere o Pix). Falta gateway automático (ex.: Mercado Pago), cancelamento e renovação.
- **Pesquisa global (Ctrl+K):** acha só servidores e canais; não procura mensagens, pessoas, conversas nem configurações.
- **Convites:** não têm validade nem limite de usos.
- **Moderação de servidor:** só o dono modera; dá para expulsar, mas não banir.
- **Explorar:** sem categorias, filtros, destaque ou página pública do servidor.
- **iPhone:** só pelo navegador (PWA), sem app próprio.

## 4. Não existe ainda

- Cargos e permissões nos servidores.
- Categorias de canais.
- Mensagens fixadas, prévia de links, menção a cargos, pesquisa no histórico.
- Bloquear usuários e privacidade de mensagens privadas.
- Central de notificações (histórico, marcar como lida, controle por servidor/canal).
- Denúncias (de mensagens, usuários e servidores) e punições temporárias (silenciar por X horas).
- Ver e encerrar sessões em outros aparelhos; trocar a senha estando logado (hoje só pela recuperação por e-mail).
- Nome de exibição separado do nome de usuário.
- Densidade da interface e intensidade das animações.
- Termos de uso, política de privacidade, tutorial inicial, central de ajuda.
- Dashboard com números (usuários online, cadastros, mensagens, assinaturas).

## 5. Problemas e riscos encontrados (por gravidade)

1. **🔴 Banco grátis do Render.** O PostgreSQL grátis do Render **expira** depois de um período (pela regra do Render, cerca de 30 dias). Se expirar, **todas as contas e mensagens somem**. Também **não há backup automático**. É o risco nº 1.
2. **🔴 Banco num registro só.** Cada mudança regrava tudo. Com mais usuários isso fica lento, e uma falha no meio da gravação pode perder dados recentes.
3. **🟠 Mensagens antigas são apagadas.** Só as **últimas 500 por canal** ficam guardadas; o resto é descartado.
4. **🟠 Voz sem servidor TURN.** Quem está em 4G ou atrás de algumas redes (NAT restrito) pode **não conseguir ouvir nem ser ouvido**. Provável causa de parte dos problemas de call.
5. **🟠 Limite da call.** O formato ponto a ponto pesa a partir de ~6 pessoas com câmera ou tela (cada um envia para todos). Para salas grandes seria preciso um servidor de mídia (SFU).
6. **🟡 Render grátis "dorme".** Depois de um tempo sem uso, o primeiro acesso demora ~1 minuto.
7. **🟡 Segurança.** O site não envia cabeçalhos de proteção contra ser embutido em outro site (clickjacking) nem uma política de conteúdo (CSP) na página principal. Os arquivos enviados já têm proteção.
8. **🟡 Código grande demais num arquivo.** O `app.js`, com ~5.700 linhas, já causou um bug (função com nome repetido). Funciona, mas cada mudança exige cuidado.

Pontos que já estão bem feitos:
- Permissões de ADM conferidas no servidor.
- Senhas com scrypt e tokens com hash.
- Bloqueio contra força bruta.
- Arquivos privados (comprovantes) protegidos.
- Validação dos dados no servidor.
- A chave da IA fica só no servidor.

## 6. Plano recomendado para as próximas fases

- **Fase 2 — Fundação (prioridade máxima):**
  1. Backup automático diário do banco + exportação manual pelo Painel ADM.
  2. Trocar o banco grátis por um que não expira.
  3. Guardar as mensagens em tabela própria, sem o limite de 500.
  4. Cabeçalhos de segurança.
  5. Trocar senha logado e gerenciar sessões/aparelhos.
  6. Validade e limite nos convites.
- **Fase 3 — Comunicação:** servidor TURN para a voz funcionar em qualquer rede, cargos e permissões, banir/silenciar em servidores, bloquear usuários, mensagens fixadas, categorias de canais.
- **Fase 4 — Experiência:** central de notificações, pesquisa global completa, densidade da interface, tutorial, termos e privacidade.
- **Fase 5 — Monetização:** definir planos (VIP/Premium/Max), histórico de compras e renovação; gateway de pagamento automático (exige conta no provedor, feita por você).
- **Fase 6 — Administração:** dashboard com números, denúncias e punições temporárias.
- **Fase 7 — Otimização e testes completos.**

## 7. Decisões que dependem de você

- Contratar um banco que não expira (Render pago ~US$ 7/mês, Neon/Supabase grátis com limites) e um TURN (Cloudflare/Metered têm planos grátis). Esses serviços exigem criar conta, e isso precisa ser feito por você.
- Planos: manter Plus/Pro/Max ou passar a VIP/Premium.
