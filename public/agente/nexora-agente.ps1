# Agente Auryx
# Deixa um amigo controlar este PC (mouse e teclado) pelo Auryx Nexavoria - somente
# enquanto esta janela estiver aberta e somente depois que VOCE aceitar no Auryx Nexavoria.
# Fechar esta janela corta o controle na hora.
param([int]$Porta = 47800, [string]$Codigo = "", [switch]$Oculto)

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
"@

$codigo = if ($Codigo -match '^\d{6}$') { $Codigo } else { -join (1..6 | ForEach-Object { Get-Random -Minimum 0 -Maximum 10 }) }
$inv = [Globalization.CultureInfo]::InvariantCulture
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$Porta/")
try { $listener.Start() } catch {
  Write-Host ""
  Write-Host "  Nao foi possivel abrir a porta $Porta. O agente ja esta aberto em outra janela?" -ForegroundColor Red
  if (-not $Oculto) { Read-Host "  Aperte Enter para sair" }
  exit 1
}

$Host.UI.RawUI.WindowTitle = "Agente Auryx - codigo $codigo"
Write-Host ""
Write-Host "  =========================================" -ForegroundColor Magenta
Write-Host "            Agente Auryx ativo" -ForegroundColor Magenta
Write-Host "  =========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  Seu codigo:  $codigo" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. No Auryx Nexavoria, abra Configuracoes > Controle remoto"
Write-Host "  2. Digite o codigo acima e clique em Conectar"
Write-Host "  3. Quando alguem pedir controle, voce escolhe se aceita"
Write-Host ""
Write-Host "  Para cortar o controle a qualquer momento: feche esta janela." -ForegroundColor Yellow
Write-Host ""

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  if (-not $ctx.Request.IsWebSocketRequest) {
    $b = [Text.Encoding]::UTF8.GetBytes("Agente Auryx ativo")
    $ctx.Response.OutputStream.Write($b, 0, $b.Length)
    $ctx.Response.Close()
    continue
  }
  if ($ctx.Request.QueryString["t"] -ne $codigo) {
    Write-Host "  Conexao recusada: codigo errado." -ForegroundColor Red
    $ctx.Response.StatusCode = 403
    $ctx.Response.Close()
    continue
  }
  try { $ws = $ctx.AcceptWebSocketAsync([NullString]::Value).GetAwaiter().GetResult().WebSocket }
  catch { Write-Host ("  Falha ao conectar: " + $_.Exception.Message) -ForegroundColor Red; try { $ctx.Response.Close() } catch { }; continue }
  Write-Host ("  Conectado ao Auryx Nexavoria (" + $ctx.Request.Headers["Origin"] + ")") -ForegroundColor Green
  $buf = New-Object byte[] 8192
  $seg = New-Object System.ArraySegment[byte] -ArgumentList (,$buf)
  $teclas = @{}
  $botoes = @{}
  try {
    while ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
      $r = $ws.ReceiveAsync($seg, [Threading.CancellationToken]::None).GetAwaiter().GetResult()
      if ($r.MessageType -eq [System.Net.WebSockets.WebSocketMessageType]::Close) { break }
      $texto = [Text.Encoding]::UTF8.GetString($buf, 0, $r.Count)
      foreach ($linha in ($texto -split "`n")) {
        $p = $linha.Trim().Split(" ")
        try {
          switch ($p[0]) {
            "m" { [NxInput]::Move([double]::Parse($p[1], $inv), [double]::Parse($p[2], $inv)) }
            "d" { $botoes[[int]$p[1]] = $true; [NxInput]::Button([int]$p[1], $true) }
            "u" { $botoes.Remove([int]$p[1]); [NxInput]::Button([int]$p[1], $false) }
            "w" { [NxInput]::Wheel([int]$p[1]) }
            "k" {
              $vk = [int]$p[2]; $ext = $p[3] -eq "1"
              if ($p[1] -eq "1") { $teclas[$vk] = $ext } else { $teclas.Remove($vk) }
              [NxInput]::Key($vk, $p[1] -eq "1", $ext)
            }
          }
        } catch { }
      }
    }
  } catch { }
  finally {
    foreach ($k in @($teclas.Keys)) { [NxInput]::Key([int]$k, $false, [bool]$teclas[$k]) }
    foreach ($b in @($botoes.Keys)) { [NxInput]::Button([int]$b, $false) }
    try { $ws.Dispose() } catch { }
  }
  Write-Host "  Desconectado do Auryx Nexavoria." -ForegroundColor Yellow
}
