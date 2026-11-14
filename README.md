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
