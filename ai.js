/**
 * Aury — a IA da Auryx Nexos.
 * Usada em dois lugares:
 *  1) Atendimento de pagamento: responde quem está comprando o VIP (tira dúvidas, explica
 *     o Pix e informa o status). Quem aprova pagamento é sempre um ADM.
 *  2) Bate-papo exclusivo para assinantes (VIP/Pro/Max).
 *
 * Funciona com duas IAs (as chaves ficam só no servidor, nunca no app):
 *  - Claude (Anthropic): ANTHROPIC_API_KEY — pago, usado primeiro quando existe.
 *  - Gemini (Google):    GEMINI_API_KEY    — tem plano grátis. Se o Claude falhar
 *    (ex.: conta sem créditos), a Aury usa o Gemini automaticamente.
 *  AI_PROVIDER=gemini força usar só o Gemini.
 */
"use strict";

const MODEL = "claude-opus-5-5";
const GEMINI_MODELS = [process.env.GEMINI_MODEL, "gemini-flash-latest", "gemini-2.5-flash"].filter(Boolean);
const GEMINI_BASE = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com").replace(/\/+$/, "");
let client = null;

const hasClaude = () => process.env.AI_PROVIDER !== "gemini" && !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const hasGemini = () => !!process.env.GEMINI_API_KEY && process.env.AI_PROVIDER !== "groq";
const hasGroq = () => !!process.env.GROQ_API_KEY && process.env.AI_PROVIDER !== "gemini";
const configured = () => hasClaude() || hasGemini() || hasGroq();

function getClient() {
  if (!hasClaude()) return null;
  if (!client) {
    const mod = require("@anthropic-ai/sdk");
    const Anthropic = mod.Anthropic || mod.default || mod;
    client = new Anthropic({ timeout: 90 * 1000, maxRetries: 2 });
  }
  return client;
}

async function replyClaude({ system, messages, maxTokens, onText }) {
  const stream = getClient().beta.messages.stream({
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

/* Gemini pela API REST oficial do Google, com a resposta chegando aos pedaços (SSE) */
async function replyGemini({ system, messages, maxTokens, onText }) {
  const sys = Array.isArray(system) ? system.map(b => b.text || "").join("\n\n") : String(system || "");
  const body = {
    systemInstruction: { parts: [{ text: sys }] },
    contents: messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 }
  };
  let lastErr = null;
  for (const model of GEMINI_MODELS) {
    const res = await fetch(`${GEMINI_BASE}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90 * 1000)
    }).catch(e => { lastErr = e; return null; });
    if (!res) continue;
    if (res.status === 404) { lastErr = new Error("modelo " + model + " indisponível"); continue; }   // tenta o próximo nome de modelo
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`Gemini ${res.status}: ${t.slice(0, 200)}`);
    }
    let full = "", blocked = false, buf = "";
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        let j;
        try { j = JSON.parse(line.slice(5)); } catch { continue; }
        if (j.promptFeedback && j.promptFeedback.blockReason) blocked = true;
        const c = j.candidates && j.candidates[0];
        if (c && /SAFETY|PROHIBITED|BLOCKLIST/.test(c.finishReason || "")) blocked = true;
        const piece = c && c.content && c.content.parts ? c.content.parts.map(p => p.text || "").join("") : "";
        if (piece) { full += piece; if (onText) { try { onText(full); } catch {} } }
      }
    }
    if (!full.trim() && blocked) return { text: "", refused: true };
    return { text: full.trim(), refused: false };
  }
  throw lastErr || new Error("Gemini indisponível");
}

/* Groq (plano grátis, modelos Llama) pela API REST, com a resposta chegando aos pedaços */
const GROQ_MODELS = [process.env.GROQ_MODEL, "llama-3.3-70b-versatile", "llama-3.1-8b-instant"].filter(Boolean);
const GROQ_BASE = (process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/+$/, "");
async function replyGroq({ system, messages, maxTokens, onText }) {
  const sys = Array.isArray(system) ? system.map(b => b.text || "").join("\n\n") : String(system || "");
  let lastErr = null;
  for (const model of GROQ_MODELS) {
    const res = await fetch(GROQ_BASE + "/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + process.env.GROQ_API_KEY },
      body: JSON.stringify({ model, stream: true, max_tokens: maxTokens, temperature: 0.8, messages: [{ role: "system", content: sys }, ...messages] }),
      signal: AbortSignal.timeout(90 * 1000)
    }).catch(e => { lastErr = e; return null; });
    if (!res) continue;
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 404 || /model_(not_found|decommissioned)|does not exist/.test(t)) { lastErr = new Error("modelo " + model + " indisponível"); continue; }
      throw new Error("Groq " + res.status + ": " + t.slice(0, 200));
    }
    let full = "", buf = "";
    const dec = new TextDecoder();
    for await (const chunk of res.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:") || line === "data: [DONE]") continue;
        let j;
        try { j = JSON.parse(line.slice(5)); } catch { continue; }
        const piece = (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || "";
        if (piece) { full += piece; if (onText) { try { onText(full); } catch {} } }
      }
    }
    return { text: full.trim(), refused: false };
  }
  throw lastErr || new Error("Groq indisponível");
}

/**
 * Gera uma resposta em streaming.
 * @param {object} o
 * @param {string|Array} o.system  instruções
 * @param {Array}  o.messages   [{ role: "user"|"assistant", content: string }]
 * @param {number} [o.maxTokens]
 * @param {(full: string) => void} [o.onText] chamado com o texto acumulado até agora
 * @returns {Promise<{ text: string, refused: boolean }>}
 */
async function reply({ system, messages, maxTokens = 2000, onText }) {
  if (!configured()) throw new Error("IA não configurada");
  // tenta na ordem: Claude (pago) → Gemini (grátis) → Groq (grátis); se um falhar, o próximo assume
  const chain = [hasClaude() && ["Claude", replyClaude], hasGemini() && ["Gemini", replyGemini], hasGroq() && ["Groq", replyGroq]].filter(Boolean);
  let err = null;
  for (const [name, fn] of chain) {
    try { return await fn({ system, messages, maxTokens, onText }); }
    catch (e) { err = e; console.warn("[ia] " + name + " falhou:", e && e.message); if (onText) { try { onText(""); } catch {} } }
  }
  throw err || new Error("IA indisponível");
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

const provider = () => [hasClaude() && "Claude", hasGemini() && "Gemini (grátis)", hasGroq() && "Groq (grátis)"].filter(Boolean).join(" + ");
module.exports = { configured, reply, tidy, MODEL, provider };
