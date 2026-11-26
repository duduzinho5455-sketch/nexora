/**
 * Auryx Nexos para Windows (Electron)
 * Abre a Auryx Nexos numa janela própria, com seletor de tela, ícone na bandeja
 * e o Agente Auryx embutido (controle remoto sem baixar nada à parte).
 */
"use strict";
const { app, BrowserWindow, shell, session, desktopCapturer, ipcMain, Menu, Tray, nativeImage, screen } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const APP_URL = (process.env.AURYX_URL || process.env.NEXORA_URL || "https://nexora-ujw6.onrender.com").replace(/\/+$/, "");
const ORIGIN = new URL(APP_URL).origin;
const ICON = path.join(__dirname, "build", "icon.png");

if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId("com.nexora.app");
// a versão do app vai no user-agent: o servidor usa para pedir a atualização quando sai um instalador novo
app.userAgentFallback = `${app.userAgentFallback} AuryxDesktop/${app.getVersion()}`;

let win = null, tray = null, quitting = false;
let agent = null, agentCode = null;

/* ---------- janela principal ---------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1300, height: 820, minWidth: 940, minHeight: 560,
    backgroundColor: "#08090f", title: "Auryx Nexos", icon: ICON, show: false, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true, spellcheck: true, backgroundThrottling: false }
  });
  Menu.setApplicationMenu(null);
  win.once("ready-to-show", () => win.show());
  // se a página demorar (servidor acordando), mostra a janela mesmo assim em vez de ficar invisível
  setTimeout(() => { if (!win.isDestroyed() && !win.isVisible()) win.show(); }, 2500);
  win.loadURL(APP_URL);

  // links externos (Steam, lojas, sites) abrem fora do app
  win.webContents.setWindowOpenHandler(({ url }) => {
    // login do Spotify: abre dentro do app, para o player de música da call tocar a música inteira
    try {
      const h = new URL(url).hostname;
      if (/(^|\.)spotify\.com$/.test(h)) return { action: "allow", overrideBrowserWindowOptions: { width: 480, height: 760, parent: win, autoHideMenuBar: true, title: "Entrar no Spotify", backgroundColor: "#121212", webPreferences: { contextIsolation: true, sandbox: true } } };
    } catch {}
    openExternal(url); return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(ORIGIN)) { e.preventDefault(); openExternal(url); }
  });
  win.webContents.on("did-fail-load", (_e, code, _desc, _url, isMain) => {
    if (!isMain || code === -3) return;
    win.loadFile(path.join(__dirname, "offline.html"), { query: { url: APP_URL } });
  });
  win.webContents.on("before-input-event", (e, input) => {
    if (input.type === "keyDown" && (input.key === "F5" || (input.control && input.key.toLowerCase() === "r"))) { win.webContents.reload(); e.preventDefault(); }
    if (input.type === "keyDown" && input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // fechar a janela só esconde (como o Discord); sair pela bandeja
  win.on("close", e => { if (!quitting) { e.preventDefault(); win.hide(); } });
  for (const ev of ["focus", "blur", "show", "hide", "minimize", "restore"]) win.on(ev, () => setTimeout(syncOverlay, 60));
}
function openExternal(url) {
  if (/^(https?|steam|mailto):/i.test(url)) shell.openExternal(url).catch(() => {});
}
function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/* ---------- bandeja ---------- */
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON).resize({ width: 16, height: 16 }));
  tray.setToolTip("Auryx Nexos");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Abrir Auryx Nexos", click: showWindow },
    { label: "Recarregar", click: () => win && win.webContents.reload() },
    { type: "separator" },
    { label: "Sair da Auryx Nexos", click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on("click", showWindow);
}

/* ---------- permissões (microfone, câmera, tela, notificações) ---------- */
function setupPermissions() {
  const allowed = new Set(["media", "display-capture", "notifications", "fullscreen", "pointerLock", "clipboard-sanitized-write", "local-network-access"]);
  const fromApp = wc => { try { return new URL(wc.getURL()).origin === ORIGIN; } catch { return false; } };
  session.defaultSession.setPermissionRequestHandler((wc, perm, cb) => cb(fromApp(wc) && allowed.has(perm)));
  session.defaultSession.setPermissionCheckHandler((wc, perm) => !!wc && fromApp(wc) && allowed.has(perm));

  // Seletor de tela próprio (o Windows não tem um nativo para apps Electron)
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: { width: 400, height: 225 }, fetchWindowIcons: true });
      const chosen = await pickSource(sources);
      if (!chosen) return callback({});
      const res = { video: chosen };
      if (request.audioRequested) res.audio = "loopback";
      callback(res);
    } catch (e) {
      console.error(e);
      callback({});
    }
  }, { useSystemPicker: false });
}
function pickSource(sources) {
  return new Promise(resolve => {
    const picker = new BrowserWindow({
      width: 900, height: 620, parent: win, modal: true, resizable: false, minimizable: false, maximizable: false,
      backgroundColor: "#0e1019", title: "Escolha o que transmitir", icon: ICON, autoHideMenuBar: true, show: false,
      webPreferences: { preload: path.join(__dirname, "picker-preload.js"), contextIsolation: true, sandbox: true }
    });
    let done = false;
    const finish = id => {
      if (done) return;
      done = true;
      resolve(id ? sources.find(s => s.id === id) || null : null);
      if (!picker.isDestroyed()) picker.close();
    };
    const onChoose = (_e, id) => finish(id);
    ipcMain.once("picker:choose", onChoose);
    picker.on("closed", () => { ipcMain.removeListener("picker:choose", onChoose); finish(null); });
    picker.loadFile(path.join(__dirname, "picker.html"));
    picker.webContents.once("did-finish-load", () => {
      picker.webContents.send("picker:sources", sources.map(s => ({
        id: s.id, name: s.name, screen: s.id.startsWith("screen:"),
        thumb: s.thumbnail.isEmpty() ? "" : s.thumbnail.toDataURL(),
        icon: s.appIcon && !s.appIcon.isEmpty() ? s.appIcon.toDataURL() : ""
      })));
      picker.show();
    });
  });
}

/* ---------- sobreposição de jogo (quem está na call, por cima do jogo) ---------- */
// Aparece quando você está numa call e sai da janela da Auryx (foi pro jogo).
// Não recebe cliques: o mouse passa direto para o jogo.
let overlay = null, ovState = null, ovHeight = 60;
const OV_W = 260;
function overlayWindow() {
  if (overlay && !overlay.isDestroyed()) return overlay;
  overlay = new BrowserWindow({
    width: OV_W, height: ovHeight, frame: false, transparent: true, resizable: false, movable: false, minimizable: false, maximizable: false,
    focusable: false, skipTaskbar: true, alwaysOnTop: true, show: false, hasShadow: false, backgroundColor: "#00000000", title: "Auryx — sobreposição",
    webPreferences: { preload: path.join(__dirname, "overlay-preload.js"), contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setIgnoreMouseEvents(true);
  overlay.loadFile(path.join(__dirname, "overlay.html"));
  overlay.webContents.on("did-finish-load", () => { if (ovState) overlay.webContents.send("overlay:state", ovState); });
  overlay.on("closed", () => { overlay = null; });
  return overlay;
}
function placeOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  let area;
  try { area = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea; } catch { area = screen.getPrimaryDisplay().workArea; }
  const pos = (ovState && ovState.pos) || "tl", m = 12;
  const x = pos.endsWith("r") ? area.x + area.width - OV_W - m : area.x + m;
  const y = pos.startsWith("b") ? area.y + area.height - ovHeight - m : area.y + m;
  overlay.setBounds({ x: Math.round(x), y: Math.round(y), width: OV_W, height: ovHeight });
}
function syncOverlay() {
  const inCall = !!(ovState && ovState.on && ovState.people && ovState.people.length);
  const away = !win || win.isDestroyed() || !win.isVisible() || win.isMinimized() || !win.isFocused();
  if (inCall && away) {
    const o = overlayWindow();
    if (!o.isVisible()) { placeOverlay(); o.showInactive(); o.setAlwaysOnTop(true, "screen-saver"); }
  } else if (overlay && !overlay.isDestroyed() && overlay.isVisible()) overlay.hide();
}
ipcMain.on("overlay:state", (e, st) => {
  if (!win || e.sender !== win.webContents) return;
  ovState = st && typeof st === "object" ? st : null;
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send("overlay:state", ovState);
  if (!ovState || !ovState.on) { if (overlay && !overlay.isDestroyed()) overlay.hide(); return; }
  syncOverlay();
});
ipcMain.on("overlay:size", (e, h) => {
  if (!overlay || overlay.isDestroyed() || e.sender !== overlay.webContents) return;
  const nh = Math.max(40, Math.min(600, Math.round(+h || 60)));
  if (nh !== ovHeight) { ovHeight = nh; placeOverlay(); }
});

/* ---------- Agente Auryx embutido ---------- */
function agentScript() {
  const packed = path.join(process.resourcesPath || "", "agente", "nexora-agente.ps1");
  if (app.isPackaged && fs.existsSync(packed)) return packed;
  return path.join(__dirname, "..", "public", "agente", "nexora-agente.ps1");
}
// Segurança: código longo e aleatório (ninguém adivinha), só a página do próprio app pode conectar
// (-Origens) e o agente fecha sozinho se este app fechar, mesmo num travamento (-PaiPid).
ipcMain.handle("agent:start", e => {
  if (process.platform !== "win32") throw new Error("O controle remoto funciona só no Windows.");
  if (!win || e.sender !== win.webContents) throw new Error("Pedido inválido.");
  if (agent && agent.exitCode === null) return agentCode;
  agentCode = crypto.randomBytes(24).toString("hex");
  const proc = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", agentScript(),
    "-Codigo", agentCode, "-Oculto", "-PaiPid", String(process.pid), "-Origens", ORIGIN], { windowsHide: true, stdio: "ignore" });
  agent = proc;
  proc.on("exit", () => { if (agent === proc) { agent = null; agentCode = null; } });
  return agentCode;
});
/* ---------- Driver de controles virtuais (ViGEmBus) embutido: "Ativar controles" com um clique ---------- */
// Só quem transmite precisa. O Windows pede "Sim" (administrador) uma vez; nada é baixado na hora.
let padInstalling = false;
function padSetupPath() {
  const packed = path.join(process.resourcesPath || "", "vigem", "ViGEmBus-Setup.exe");
  return app.isPackaged ? packed : path.join(__dirname, "vigem", "ViGEmBus-Setup.exe");
}
// "ok" = driver rodando · "parado" = instalado mas parado (normalmente pede reiniciar) · "nao" = não instalado
function padDriverState() {
  return new Promise(res => {
    const p = spawn("sc.exe", ["query", "ViGEmBus"], { windowsHide: true });
    let out = "";
    p.stdout.on("data", d => { out += d; });
    p.on("error", () => res("nao"));
    // o texto do sc muda com o idioma do Windows ("ESTADO"/"STATE"), mas RUNNING e o código 1060 (não existe) não
    p.on("close", code => res(/\bRUNNING\b/.test(out) ? "ok" : code === 0 ? "parado" : "nao"));
  });
}
// roda o instalador como administrador; devolve o código de saída (1223 = a pessoa não clicou em "Sim")
function runElevated(file, args) {
  return new Promise(res => {
    const ps = "$ErrorActionPreference='Stop'; try { $a = @{ FilePath = $env:NX_SETUP; Verb = 'RunAs'; Wait = $true; PassThru = $true }; " +
      "if ($env:NX_ARGS) { $a.ArgumentList = $env:NX_ARGS }; $p = Start-Process @a; exit $p.ExitCode } catch { exit 1223 }";
    const p = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-Command", ps],
      { windowsHide: true, stdio: "ignore", env: { ...process.env, NX_SETUP: file, NX_ARGS: args || "" } });
    p.on("error", () => res(-1));
    p.on("exit", code => res(code === null ? -1 : code));
  });
}
ipcMain.handle("pad:state", async e => {
  if (process.platform !== "win32" || !win || e.sender !== win.webContents) return "nao";
  return padDriverState();
});
ipcMain.handle("pad:install", async e => {
  if (process.platform !== "win32") throw new Error("Os controles virtuais funcionam só no Windows.");
  if (!win || e.sender !== win.webContents) throw new Error("Pedido inválido.");
  if (padInstalling) throw new Error("A instalação já está em andamento.");
  const setup = padSetupPath();
  if (!fs.existsSync(setup)) throw new Error("O instalador do driver não veio com este app. Atualize o app de PC.");
  padInstalling = true;
  try {
    const cancel = c => c === 1223 || c === 1602;
    // 1º sem janelas (Advanced Installer: /exenoui = sem tela do instalador, /qn = MSI silencioso)
    let code = await runElevated(setup, "/exenoui /qn /norestart");
    if (cancel(code)) return { ok: false, cancelled: true, code };
    let st = await padDriverState();
    // não deu sem janelas: abre o instalador normal (Avançar, Avançar…)
    if (st !== "ok" && code !== 0 && code !== 3010) {
      code = await runElevated(setup, "");
      if (cancel(code)) return { ok: false, cancelled: true, code };
      st = await padDriverState();
    }
    return { ok: st === "ok" || code === 0 || code === 3010, reboot: st !== "ok", code, state: st };
  } finally { padInstalling = false; }
});
ipcMain.handle("agent:stop", e => { if (win && e.sender === win.webContents) stopAgent(); return true; });
function stopAgent() { if (agent) { try { agent.kill(); } catch {} agent = null; agentCode = null; } }

/* ---------- ciclo de vida ---------- */
app.on("second-instance", showWindow);
app.on("before-quit", () => { quitting = true; stopAgent(); });
app.whenReady().then(() => {
  setupPermissions();
  createWindow();
  createTray();
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
