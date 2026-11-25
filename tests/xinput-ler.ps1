# Le os 4 controles do XInput (o que os jogos enxergam) e imprime em JSON
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class XI2 {
  [StructLayout(LayoutKind.Sequential)] public struct GAMEPAD { public ushort wButtons; public byte bLeftTrigger; public byte bRightTrigger; public short sThumbLX; public short sThumbLY; public short sThumbRX; public short sThumbRY; }
  [StructLayout(LayoutKind.Sequential)] public struct STATE { public uint dwPacketNumber; public GAMEPAD Gamepad; }
  [DllImport("xinput1_4.dll")] public static extern uint XInputGetState(uint idx, out STATE st);
}
"@
$out = @()
for ($i = 0; $i -lt 4; $i++) {
  $st = New-Object XI2+STATE
  $r = [XI2]::XInputGetState($i, [ref]$st)
  if ($r -eq 0) { $g = $st.Gamepad; $out += @{ slot = $i; on = $true; btn = [int]$g.wButtons; lt = [int]$g.bLeftTrigger; rt = [int]$g.bRightTrigger; lx = [int]$g.sThumbLX; ly = [int]$g.sThumbLY; rx = [int]$g.sThumbRX; ry = [int]$g.sThumbRY } }
  else { $out += @{ slot = $i; on = $false } }
}
$out | ConvertTo-Json -Compress
