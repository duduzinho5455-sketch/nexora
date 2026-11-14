# NEXORA 2.0

Comunidade com chat, servidores, convites, voz, câmera e transmissão de tela.

## No Render

O `render.yaml` cria o site e um banco **PostgreSQL**. Contas, servidores e mensagens ficam
no banco, então não somem quando o Render reinicia o app.

- Já conectado: cada envio para o GitHub faz o Render publicar a versão nova sozinho.
- Do zero: no Render, **New + → Blueprint** → escolha este repositório.

Observações do plano gratuito:
- O app "dorme" depois de 15 min sem uso; o primeiro acesso demora uns 30–60 s.
- O PostgreSQL gratuito do Render expira depois de 30 dias; renove ou troque de plano antes.
- O Render usa HTTPS, então microfone, câmera e tela funcionam.

## No seu PC

1. Instale o **Node.js 18+** (https://nodejs.org).
2. Dê dois cliques em `INICIAR.bat` e abra `http://localhost:3000`.
   Sem `DATABASE_URL`, os dados ficam em `data/nexora.json`.

## Sem servidor (modo local)

Abrir o `public/index.html` direto ativa o **modo local**: tudo fica salvo só no navegador.

## Variáveis
| Variável | Para quê |
|---|---|
| `DATABASE_URL` | PostgreSQL (o Render preenche sozinho) |
| `PORT` | Porta (o Render preenche sozinho) |
| `DATA_DIR` | Pasta do `nexora.json` quando não há PostgreSQL |
| `TURN_URL`, `TURN_USER`, `TURN_PASS` | Servidor TURN, para voz entre redes restritas (4G, empresas) |
| `STEAM_API_KEY` | "Jogando agora" automático pela Steam (chave grátis em https://steamcommunity.com/dev/apikey) |

## Amigos e mensagens privadas
Na tela **Início**: **Amigos** (Online / Todos / Pendentes / Adicionar amigo) e **Mensagens diretas**.
Dá para conversar no privado com amigos ou com quem está no mesmo servidor.

## Controle remoto e co-op
1. Quem transmite baixa o **NEXORA Agente** em Configurações › Controle remoto, abre o `NEXORA-Agente.bat`
   e digita o código de 6 números no NEXORA.
2. Quem assiste clica em 🎮 **Pedir controle** na transmissão.
3. Quem transmite escolhe **Co-op** (só teclado/controle) ou **Controle total** (mouse e teclado).
4. Fechar a janela do agente corta o controle na hora.

O controle (gamepad) de quem joga vira teclas no PC de quem transmite (WASD ou setas).
Um controle de Xbox virtual de verdade precisaria do driver ViGEm, que não está incluído.
