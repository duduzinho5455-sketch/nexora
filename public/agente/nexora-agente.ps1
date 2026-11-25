# Agente Auryx
# Deixa um amigo controlar este PC (mouse e teclado) pelo Auryx Nexos - somente
# enquanto esta janela estiver aberta e somente depois que VOCE aceitar no Auryx Nexos.
# Fechar esta janela corta o controle na hora.
#
# Seguranca:
#  - so aceita conexoes vindas do proprio computador (127.0.0.1) e de paginas do Auryx Nexos
#    (cabecalho Origin conferido): um site qualquer aberto no navegador nao consegue se conectar;
#  - o codigo e exigido em toda conexao; 5 codigos errados fecham o agente;
#  - no app de PC, o agente fecha sozinho quando o app fecha (-PaiPid);
#  - tudo fica registrado em %LOCALAPPDATA%\AuryxAgente\atividade.log.
param(
  [int]$Porta = 47800,
  [string]$Codigo = "",
  [switch]$Oculto,
  [int]$PaiPid = 0,
  [string]$Origens = "https://auryxnexos.com.br,https://www.auryxnexos.com.br,https://nexora-ujw6.onrender.com"
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NxInput {
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION u; }
  [DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint mapType);
  static void Send(INPUT i) { SendInput(1, new INPUT[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Move(double x, double y) {
    INPUT i = new INPUT(); i.type = 0;
    i.u.mi.dx = (int)Math.Round(Math.Max(0.0, Math.Min(1.0, x)) * 65535);
    i.u.mi.dy = (int)Math.Round(Math.Max(0.0, Math.Min(1.0, y)) * 65535);
    i.u.mi.dwFlags = 0x0001 | 0x8000;
    Send(i);
  }
  public static void Button(int b, bool down) {
    uint f = b == 0 ? (down ? 0x0002u : 0x0004u) : b == 2 ? (down ? 0x0008u : 0x0010u) : (down ? 0x0020u : 0x0040u);
    INPUT i = new INPUT(); i.type = 0; i.u.mi.dwFlags = f;
    Send(i);
  }
  public static void Wheel(int delta) {
    INPUT i = new INPUT(); i.type = 0; i.u.mi.mouseData = unchecked((uint)delta); i.u.mi.dwFlags = 0x0800;
    Send(i);
  }
  // movimento relativo (jogos 3D/FPS leem o mouse "cru"; o movimento absoluto nao gira a camera)
  public static void MoveRel(int dx, int dy) {
    INPUT i = new INPUT(); i.type = 0; i.u.mi.dx = dx; i.u.mi.dy = dy; i.u.mi.dwFlags = 0x0001;
    Send(i);
  }
  public static void Key(int vk, bool down, bool ext) {
    INPUT i = new INPUT(); i.type = 1;
    ushort scan = (ushort)MapVirtualKey((uint)vk, 0);
    uint f = down ? 0u : 0x0002u;
    if (ext) f |= 0x0001u;
    if (scan != 0) { i.u.ki.wScan = scan; f |= 0x0008u; } else { i.u.ki.wVk = (ushort)vk; }
    i.u.ki.dwFlags = f;
    Send(i);
  }
}

// Controles de Xbox 360 virtuais pelo driver ViGEmBus (gratuito, instalado uma vez no PC de quem transmite).
// Cada pessoa que joga junto vira um controle de verdade para o Windows (XInput): o jogo enxerga
// Jogador 2, 3, 4 em vez de misturar tudo no teclado do Jogador 1.
// Protocolo: o mesmo do ViGEmClient oficial (BusShared.h / ViGEmClient.cpp, licenca MIT).
public static class NxPad {
  [StructLayout(LayoutKind.Sequential)] struct SP_DEVICE_INTERFACE_DATA { public int cbSize; public Guid InterfaceClassGuid; public int Flags; public IntPtr Reserved; }
  [DllImport("setupapi.dll", SetLastError = true)] static extern IntPtr SetupDiGetClassDevs(ref Guid g, IntPtr enumerator, IntPtr hwnd, uint flags);
  [DllImport("setupapi.dll", SetLastError = true)] static extern bool SetupDiEnumDeviceInterfaces(IntPtr set, IntPtr devInfo, ref Guid g, uint idx, ref SP_DEVICE_INTERFACE_DATA data);
  [DllImport("setupapi.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr set, ref SP_DEVICE_INTERFACE_DATA data, IntPtr detail, uint size, out uint required, IntPtr devInfo);
  [DllImport("setupapi.dll")] static extern bool SetupDiDestroyDeviceInfoList(IntPtr set);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern IntPtr CreateFile(string name, uint access, uint share, IntPtr sec, uint disp, uint flags, IntPtr tmpl);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool DeviceIoControl(IntPtr h, uint code, byte[] inBuf, int inSize, byte[] outBuf, int outSize, out int returned, IntPtr overlapped);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);

  static readonly IntPtr INVALID = new IntPtr(-1);
  static IntPtr bus = IntPtr.Zero;
  static uint[] serial = new uint[4];          // 0 = vaga livre
  public static string Error = "";
  // CTL_CODE(FILE_DEVICE_BUS_EXTENDER, funcao, METHOD_BUFFERED, acesso)
  static uint Ctl(uint fn, uint access) { return (0x2Au << 16) | (access << 14) | (fn << 2); }
  public static readonly uint PLUGIN = Ctl(0x801, 2), UNPLUG = Ctl(0x802, 2), CHECKVER = Ctl(0x803, 2), WAITREADY = Ctl(0x804, 2), SUBMIT = Ctl(0xA02, 2);
  static void P32(byte[] b, int at, uint v) { b[at] = (byte)v; b[at + 1] = (byte)(v >> 8); b[at + 2] = (byte)(v >> 16); b[at + 3] = (byte)(v >> 24); }
  static void P16(byte[] b, int at, int v) { b[at] = (byte)v; b[at + 1] = (byte)(v >> 8); }
  public static int LastErr = 0;
  static bool Io(uint code, byte[] inb, byte[] outb) {
    int r;
    bool ok = DeviceIoControl(bus, code, inb, inb.Length, outb, outb == null ? 0 : outb.Length, out r, IntPtr.Zero);
    LastErr = ok ? 0 : Marshal.GetLastWin32Error();
    return ok;
  }

  public static bool Open() {
    if (bus != IntPtr.Zero) return true;
    Error = "";
    Guid g = new Guid("96E42B22-F5E9-42F8-B043-ED0F932F014F");
    IntPtr set = SetupDiGetClassDevs(ref g, IntPtr.Zero, IntPtr.Zero, 0x12);   // DIGCF_PRESENT | DIGCF_DEVICEINTERFACE
    if (set == INVALID) { Error = "sem driver"; return false; }
    try {
      for (uint i = 0; i < 8; i++) {
        SP_DEVICE_INTERFACE_DATA d = new SP_DEVICE_INTERFACE_DATA();
        d.cbSize = Marshal.SizeOf(typeof(SP_DEVICE_INTERFACE_DATA));
        if (!SetupDiEnumDeviceInterfaces(set, IntPtr.Zero, ref g, i, ref d)) break;
        uint need;
        SetupDiGetDeviceInterfaceDetail(set, ref d, IntPtr.Zero, 0, out need, IntPtr.Zero);
        if (need == 0) continue;
        IntPtr buf = Marshal.AllocHGlobal((int)need);
        try {
          Marshal.WriteInt32(buf, IntPtr.Size == 8 ? 8 : 6);
          if (!SetupDiGetDeviceInterfaceDetail(set, ref d, buf, need, out need, IntPtr.Zero)) continue;
          string path = Marshal.PtrToStringUni(new IntPtr(buf.ToInt64() + 4));
          IntPtr h = CreateFile(path, 0xC0000000, 3, IntPtr.Zero, 3, 0x80, IntPtr.Zero);
          if (h == INVALID) { Error = "sem acesso ao driver"; continue; }
          bus = h;
          byte[] ver = new byte[8]; P32(ver, 0, 8); P32(ver, 4, 1);
          if (Io(CHECKVER, ver, null)) return true;
          CloseHandle(h); bus = IntPtr.Zero; Error = "versao do driver incompativel";
        } finally { Marshal.FreeHGlobal(buf); }
      }
    } finally { SetupDiDestroyDeviceInfoList(set); }
    if (Error == "") Error = "sem driver";
    return false;
  }
  // liga um controle na vaga (0-3); devolve o numero do jogador no Windows (0-3), -1 se ainda nao definido, -2 se falhou
  public static int Plug(int slot) {
    if (slot < 0 || slot > 3) return -2;
    if (serial[slot] != 0) return -1;                      // ja ligado
    if (!Open()) return -2;
    for (uint sn = 1; sn <= 64; sn++) {
      byte[] p = new byte[16]; P32(p, 0, 16); P32(p, 4, sn); P32(p, 8, 0); P16(p, 12, 0x045E); P16(p, 14, 0x028E);
      if (!Io(PLUGIN, p, null)) continue;                 // numero de serie em uso: tenta o proximo
      byte[] w = new byte[8]; P32(w, 0, 8); P32(w, 4, sn);
      if (!Io(WAITREADY, w, null)) {
        int e = Marshal.GetLastWin32Error();
        if (e != 87) { byte[] u = new byte[8]; P32(u, 0, 8); P32(u, 4, sn); Io(UNPLUG, u, null); Error = "o controle nao ficou pronto (" + e + ")"; return -2; }
      }
      serial[slot] = sn;
      // O controle nasce com lixo nos analogicos e o driver so repassa o estado quando ele MUDA:
      // manda um toque imperceptivel (LX = 1 de 32767, dentro de qualquer zona morta) e depois zera,
      // para nenhum jogo ver o personagem andando sozinho. Repete depois que o Windows abre o controle.
      for (int t = 0; t < 20 && !Submit(slot, 0, 0, 0, 1, 0, 0, 0); t++) System.Threading.Thread.Sleep(25);
      Submit(slot, 0, 0, 0, 0, 0, 0, 0);
      // Numero do jogador: a consulta do driver (XUSB_GET_USER_INDEX) sempre devolve 0 na pratica,
      // entao marca o controle com um valor minusculo e unico e procura em qual vaga do XInput ele aparece.
      int idx = -1;
      Submit(slot, 0, 0, 0, 7, -7, 7, -7);
      for (int t = 0; t < 20 && idx < 0; t++) { idx = FindMarked(); if (idx < 0) System.Threading.Thread.Sleep(50); }
      Submit(slot, 0, 0, 0, 0, 0, 0, 0);
      return idx;
    }
    Error = "nao foi possivel criar o controle";
    return -2;
  }
  [StructLayout(LayoutKind.Sequential)] struct XGAMEPAD { public ushort wButtons; public byte bLeftTrigger; public byte bRightTrigger; public short sThumbLX; public short sThumbLY; public short sThumbRX; public short sThumbRY; }
  [StructLayout(LayoutKind.Sequential)] struct XSTATE { public uint dwPacketNumber; public XGAMEPAD Gamepad; }
  [DllImport("xinput1_4.dll")] static extern uint XInputGetState(uint idx, out XSTATE st);
  // vaga do XInput (0-3) que esta mostrando a marca 7/-7/7/-7 nos analogicos; -1 se nenhuma
  static int FindMarked() {
    try {
      for (uint i = 0; i < 4; i++) {
        XSTATE st;
        if (XInputGetState(i, out st) != 0) continue;
        XGAMEPAD g = st.Gamepad;
        if (g.sThumbLX == 7 && g.sThumbLY == -7 && g.sThumbRX == 7 && g.sThumbRY == -7) return (int)i;
      }
    } catch { }
    return -1;
  }
  public static bool Submit(int slot, int buttons, int lt, int rt, int lx, int ly, int rx, int ry) {
    if (slot < 0 || slot > 3 || serial[slot] == 0) return false;
    byte[] r = new byte[20];
    P32(r, 0, 20); P32(r, 4, serial[slot]);
    P16(r, 8, buttons & 0xFFFF); r[10] = (byte)Math.Max(0, Math.Min(255, lt)); r[11] = (byte)Math.Max(0, Math.Min(255, rt));
    P16(r, 12, Math.Max(-32768, Math.Min(32767, lx))); P16(r, 14, Math.Max(-32768, Math.Min(32767, ly)));
    P16(r, 16, Math.Max(-32768, Math.Min(32767, rx))); P16(r, 18, Math.Max(-32768, Math.Min(32767, ry)));
    return Io(SUBMIT, r, null);
  }
  public static void Unplug(int slot) {
    if (slot < 0 || slot > 3 || serial[slot] == 0) return;
    Submit(slot, 0, 0, 0, 0, 0, 0, 0);                   // solta tudo antes de tirar
    byte[] u = new byte[8]; P32(u, 0, 8); P32(u, 4, serial[slot]);
    Io(UNPLUG, u, null);
    serial[slot] = 0;
  }
  public static void UnplugAll() { for (int s = 0; s < 4; s++) { Unplug(s); failed[s] = false; } }
  public static int Count() { int n = 0; for (int s = 0; s < 4; s++) if (serial[s] != 0) n++; return n; }

  // Linha inteira da pagina, processada aqui (rapido a 60 por segundo e sem depender do PowerShell
  // para chamar metodos com muitos parametros, que falhava em silencio):
  //   "p <vaga> <botoes> <LT> <RT> <LX> <LY> <RX> <RY>"  -> liga o controle na 1a vez e envia o estado
  //   "px <vaga>"                                          -> tira o controle
  // Devolve a resposta para a pagina ("pad <vaga> ok <jogador>" / "pad <vaga> erro <motivo>"),
  // "-px <vaga>" quando tirou um controle (so para o registro) ou null.
  static bool[] failed = new bool[4];
  public static string Line(string[] p) {
    int s;
    if (p == null || p.Length < 2 || !int.TryParse(p[1], out s) || s < 0 || s > 3) return null;
    if (p[0] == "px") {
      failed[s] = false;                                  // deixa tentar de novo depois
      if (serial[s] == 0) return null;
      Unplug(s);
      return "-px " + s;
    }
    if (p[0] != "p" || p.Length < 9) return null;
    int[] v = new int[7];
    for (int i = 0; i < 7; i++) if (!int.TryParse(p[i + 2], out v[i])) return null;
    string reply = null;
    if (serial[s] == 0) {
      if (failed[s]) return null;                         // ja falhou: espera um "px" antes de tentar de novo
      int idx = Plug(s);
      if (idx < -1) { failed[s] = true; return "pad " + s + " erro " + Error; }
      reply = "pad " + s + " ok " + idx;
    }
    Submit(s, v[0], v[1], v[2], v[3], v[4], v[5], v[6]);
    return reply;
  }
}
"@

# ---------- registro de atividades ----------
$logDir = Join-Path $env:LOCALAPPDATA "AuryxAgente"
try { New-Item -ItemType Directory -Force -Path $logDir | Out-Null } catch { }
$logFile = Join-Path $logDir "atividade.log"
function Registrar([string]$texto) {
  try {
    if ((Test-Path $logFile) -and (Get-Item $logFile).Length -gt 1MB) { Move-Item -Force $logFile ($logFile + ".antigo") }
    Add-Content -Path $logFile -Value ((Get-Date).ToString("yyyy-MM-dd HH:mm:ss") + "  " + $texto) -Encoding UTF8
  } catch { }
}
function Avisar([string]$texto, [string]$cor = "Gray") { if (-not $Oculto) { Write-Host ("  " + $texto) -ForegroundColor $cor } }

# o app de PC passa um codigo longo; o agente baixado usa 6 numeros (digitados pela pessoa)
function CodigoAleatorio {
  # gerador criptografico (Get-Random e previsivel); descarta 250-255 para nao favorecer nenhum numero
  $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
  $um = New-Object byte[] 1
  $s = ""
  while ($s.Length -lt 6) { $rng.GetBytes($um); if ($um[0] -lt 250) { $s += [string]($um[0] % 10) } }
  $rng.Dispose()
  return $s
}
$codigo = if ($Codigo -match '^[A-Za-z0-9]{6,64}$') { $Codigo } else { CodigoAleatorio }
$permitidas = @($Origens.Split(",") | ForEach-Object { $_.Trim().TrimEnd("/").ToLowerInvariant() } | Where-Object { $_ })
$MAX_ERROS = 5
$erros = 0

function PaiVivo {
  if ($PaiPid -le 0) { return $true }
  return [bool](Get-Process -Id $PaiPid -ErrorAction SilentlyContinue)
}
function OrigemOk($req) {
  # so conexoes do proprio computador
  if (-not [Net.IPAddress]::IsLoopback($req.RemoteEndPoint.Address)) { return $false }
  $o = [string]$req.Headers["Origin"]
  if (-not $o) { return $false }
  return $permitidas -contains $o.TrimEnd("/").ToLowerInvariant()
}
function Fechar($ctx, [int]$status) { try { $ctx.Response.StatusCode = $status; $ctx.Response.Close() } catch { } }
# manda uma linha para a pagina do Auryx Nexos (usa o $ws da conexao atual)
function Enviar([string]$t) {
  try {
    $b = [Text.Encoding]::UTF8.GetBytes($t)
    [void]$ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList (,$b)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait(2000)
  } catch { }
}

$inv = [Globalization.CultureInfo]::InvariantCulture
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Porta/")
try { $listener.Start() } catch {
  Avisar "" ; Avisar "Nao foi possivel abrir a porta $Porta. O agente ja esta aberto em outra janela?" "Red"
  Registrar "falha ao abrir a porta $Porta"
  if (-not $Oculto) { Read-Host "  Aperte Enter para sair" }
  exit 1
}
Registrar ("agente iniciado (" + $(if ($Oculto) { "app de PC" } else { "janela" }) + ")")

if (-not $Oculto) {
  $Host.UI.RawUI.WindowTitle = "Agente Auryx - codigo $codigo"
  Write-Host ""
  Write-Host "  =========================================" -ForegroundColor Magenta
  Write-Host "            Agente Auryx ativo" -ForegroundColor Magenta
  Write-Host "  =========================================" -ForegroundColor Magenta
  Write-Host ""
  Write-Host "  Seu codigo:  $codigo" -ForegroundColor Cyan
  Write-Host ""
  Write-Host "  1. No Auryx Nexos, abra Configuracoes > Controle remoto"
  Write-Host "  2. Digite o codigo acima e clique em Conectar"
  Write-Host "  3. Quando alguem pedir controle, voce escolhe se aceita"
  Write-Host ""
  Write-Host "  Para cortar o controle a qualquer momento: feche esta janela." -ForegroundColor Yellow
  Write-Host "  Registro de atividades: $logFile" -ForegroundColor DarkGray
  Write-Host ""
}

try {
  while ($listener.IsListening) {
    # espera uma conexao conferindo de 1 em 1 segundo se o app de PC ainda esta aberto
    $pedido = $listener.GetContextAsync()
    while (-not $pedido.Wait(1000)) { if (-not (PaiVivo)) { Registrar "app de PC fechado: agente encerrado"; exit 0 } }
    $ctx = $pedido.Result
    if (-not $ctx.Request.IsWebSocketRequest) {
      $b = [Text.Encoding]::UTF8.GetBytes("Agente Auryx ativo")
      try { $ctx.Response.OutputStream.Write($b, 0, $b.Length); $ctx.Response.Close() } catch { }
      continue
    }
    $origem = [string]$ctx.Request.Headers["Origin"]
    if (-not (OrigemOk $ctx.Request)) {
      Registrar ("conexao recusada: origem nao permitida (" + $origem + ")")
      Avisar ("Conexao recusada: pagina nao autorizada (" + $origem + ").") "Red"
      Fechar $ctx 403
      continue
    }
    if ([string]$ctx.Request.QueryString["t"] -cne $codigo) {
      $erros++
      Registrar ("conexao recusada: codigo errado (" + $erros + "/" + $MAX_ERROS + ")")
      Avisar ("Conexao recusada: codigo errado (" + $erros + " de " + $MAX_ERROS + ").") "Red"
      Fechar $ctx 403
      if ($erros -ge $MAX_ERROS) {
        Registrar "muitos codigos errados: agente fechado por seguranca"
        Avisar "Muitos codigos errados. O agente foi fechado por seguranca - abra de novo para gerar outro codigo." "Red"
        if (-not $Oculto) { Read-Host "  Aperte Enter para sair" }
        exit 2
      }
      Start-Sleep -Milliseconds 800
      continue
    }
    $erros = 0
    try { $ws = $ctx.AcceptWebSocketAsync([NullString]::Value).GetAwaiter().GetResult().WebSocket }
    catch { Avisar ("Falha ao conectar: " + $_.Exception.Message) "Red"; Fechar $ctx 500; continue }
    Registrar ("conectado ao Auryx Nexos (" + $origem + ")")
    Avisar ("Conectado ao Auryx Nexos (" + $origem + ")") "Green"
    $buf = New-Object byte[] 8192
    $seg = New-Object System.ArraySegment[byte] -ArgumentList (,$buf)
    $acumulado = New-Object System.Text.StringBuilder
    $teclas = @{}
    $botoes = @{}
    # conta para a pagina o que este agente sabe fazer: versao 2 = controles virtuais + mouse relativo
    $padSt = if ([NxPad]::Open()) { "ok" } elseif ([NxPad]::Error -eq "sem driver") { "nodriver" } else { "erro" }
    if ($padSt -ne "ok") { Avisar ("Controle virtual indisponivel: " + [NxPad]::Error + " (instale o ViGEmBus para jogar co-op com controle).") "DarkYellow" }
    Enviar "hello 2 pad=$padSt"
    try {
      while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
        $leitura = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None)
        while (-not $leitura.Wait(1000)) {
          if (-not (PaiVivo)) { Registrar "app de PC fechado durante o controle"; throw "pai" }
        }
        $r = $leitura.Result
        if ($r.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }
        [void]$acumulado.Append([Text.Encoding]::UTF8.GetString($buf, 0, $r.Count))
        if ($acumulado.Length -gt 65536) { Registrar "mensagem grande demais: conexao encerrada"; break }
        if (-not $r.EndOfMessage) { continue }
        $texto = $acumulado.ToString()
        [void]$acumulado.Clear()
        foreach ($linha in ($texto -split "`n")) {
          $p = $linha.Trim().Split(" ")
          try {
            switch ($p[0]) {
              "m" { [NxInput]::Move([double]::Parse($p[1], $inv), [double]::Parse($p[2], $inv)) }
              "d" { $b = [int]$p[1]; if ($b -ge 0 -and $b -le 2) { $botoes[$b] = $true; [NxInput]::Button($b, $true) } }
              "u" { $b = [int]$p[1]; if ($b -ge 0 -and $b -le 2) { $botoes.Remove($b); [NxInput]::Button($b, $false) } }
              "w" { [NxInput]::Wheel([Math]::Max(-1200, [Math]::Min(1200, [int]$p[1]))) }
              "r" { [NxInput]::MoveRel([Math]::Max(-800, [Math]::Min(800, [int]$p[1])), [Math]::Max(-800, [Math]::Min(800, [int]$p[2]))) }
              { $_ -eq "p" -or $_ -eq "px" } {
                # controles virtuais: a linha inteira e tratada no C# (NxPad.Line)
                $resp = [NxPad]::Line([string[]]$p)
                if ($resp) {
                  $q = $resp.Split(" ")
                  $num = [int]$q[1] + 1
                  if ($q[0] -eq "-px") { Registrar ("controle virtual " + $num + " removido") }
                  else {
                    Enviar $resp
                    if ($q[2] -eq "ok") { Registrar ("controle virtual " + $num + " conectado (jogador " + ([int]$q[3] + 1) + ")"); Avisar ("Controle virtual " + $num + " conectado.") "Green" }
                    else { Registrar ("controle virtual " + $num + " falhou: " + [NxPad]::Error); Avisar ("Controle virtual " + $num + " falhou: " + [NxPad]::Error) "Red" }
                  }
                }
              }
              "k" {
                $vk = [int]$p[2]; $ext = $p[3] -eq "1"
                if ($vk -gt 0 -and $vk -lt 255) {
                  if ($p[1] -eq "1") { $teclas[$vk] = $ext } else { $teclas.Remove($vk) }
                  [NxInput]::Key($vk, $p[1] -eq "1", $ext)
                }
              }
            }
          } catch { }
        }
      }
    } catch { }
    finally {
      # solta tudo o que ficou apertado (teclas e botoes do mouse)
      foreach ($k in @($teclas.Keys)) { [NxInput]::Key([int]$k, $false, [bool]$teclas[$k]) }
      foreach ($b in @($botoes.Keys)) { [NxInput]::Button([int]$b, $false) }
      # nenhum controle virtual fica ligado depois que a conexao termina
      if ([NxPad]::Count() -gt 0) { [NxPad]::UnplugAll(); Registrar "controles virtuais removidos" }
      try { $ws.Dispose() } catch { }
    }
    Registrar "desconectado do Auryx Nexos"
    Avisar "Desconectado do Auryx Nexos." "Yellow"
    if (-not (PaiVivo)) { exit 0 }
  }
} finally {
  try { [NxPad]::UnplugAll() } catch { }
  try { $listener.Stop(); $listener.Close() } catch { }
  Registrar "agente encerrado"
}
