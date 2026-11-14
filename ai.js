/**
 * Aury — a IA da Auryx Nexavória (Claude, da Anthropic).
 * Usada em dois lugares:
 *  1) Atendimento de pagamento: responde quem está comprando o VIP (tira dúvidas, explica
 *     o Pix e informa o status). Quem aprova pagamento é sempre um ADM.
 *  2) Bate-papo exclusivo para assinantes (Plus/Pro/Max).
 * A chave fica só no servidor (variável ANTHROPIC_API_KEY no Render), nunca no app.
 */
"use strict";

const MODEL = "claude-opus-5-5";
let client = null;

const configured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

function getClient() {
  if (!configured()) return null;
  if (!client) {
    const mod = require("@anthropic-ai/sdk");
    const Anthropic = mod.Anthropic || mod.default || mod;
    client = new Anthropic({ timeout: 90 * 1000, maxRetries: 2 });
  }
  return client;
}

/**
 * Gera uma resposta em streaming.
 * @param {object} o
 * @param {string} o.system     instruções (fixas, em primeiro lugar — ajudam o cache)
 * @param {Array}  o.messages   [{ role: "user"|"assistant", content: string }]
 * @param {number} [o.maxTokens]
 * @param {(full: string) => void} [o.onText] chamado com o texto acumulado até agora
 * @returns {Promise<{ text: string, refused: boolean }>}
 */
async function reply({ system, messages, maxTokens = 2000, onText }) {
  const c = getClient();
  if (!c) throw new Error("IA não configurada");
  const stream = c.beta.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    // conversa do dia a dia: pouco raciocínio, resposta rápida
    output_config: { effort: "low" },
    // se o modelo recusar por política, a própria API tenta outro modelo na mesma chamada
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system,
    messages
  });
  let full = "";
  stream.on("text", delta => {
    full += delta;
    if (onText) { try { onText(full); } catch {} }
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return { text: "", refused: true };
  const text = msg.content.filter(b => b.type === "text").map(b => b.text).join("").trim();
  return { text: text || full.trim(), refused: false };
}

/** Transforma o histórico em mensagens válidas: começa e termina com "user", sem vazios. */
function tidy(list) {
  const out = [];
  for (const m of list) {
    const content = String(m.content || "").trim();
    if (!content) continue;
    if (!out.length && m.role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === m.role) last.content += "\n\n" + content;
    else out.push({ role: m.role, content });
  }
  while (out.length && out[out.length - 1].role !== "user") out.pop();
  return out;
}

module.exports = { configured, reply, tidy, MODEL };
