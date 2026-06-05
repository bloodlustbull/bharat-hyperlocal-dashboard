param([switch]$Restart,[switch]$Stop)

$root = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $root "logs"
$null = New-Item -ItemType Directory -Path $logDir -Force
$BPORT = 8787; $FPORT = 5500

function Log($m) { Write-Output "[$(Get-Date -Format 'HH:mm:ss')] $m" }
function Free-Port($port) {
  try {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop | Where-Object { $_.State -eq "Listen" }
    if ($conn) { Log "Port $port in use by PID $($conn.OwningProcess). Killing..."; Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue; Start-Sleep 1 }
  } catch { }
}
function Listen($port) { try { $c = Get-NetTCPConnection -LocalPort $port -ErrorAction Stop; return ($c.State -eq "Listen") } catch { return $false } }

if ($Stop) { Free-Port $BPORT; Free-Port $FPORT; Log "Stopped."; exit }
if ($Restart) { Free-Port $BPORT; Free-Port $FPORT; Start-Sleep 1 }

Log "Starting Bharat Hyperlocal Dashboard..."
Free-Port $BPORT; Free-Port $FPORT

if (Test-Path "$root\backend\.env.local") {
  Get-Content "$root\backend\.env.local" | ForEach-Object {
    if ($_ -match "^\s*([^#][^=]+)=(.*)$") {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim()
      Set-Item -Path "Env:$name" -Value $value -ErrorAction SilentlyContinue
    }
  }
}

Start-Process -FilePath "node" -ArgumentList "backend/server.js" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$logDir\backend_out.log" -RedirectStandardError "$logDir\backend_err.log"
Log "Backend launching..."

Start-Process -FilePath "cmd.exe" -ArgumentList "/c npx vite --host 127.0.0.1 --port $FPORT" -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput "$logDir\frontend_out.log" -RedirectStandardError "$logDir\frontend_err.log"
Log "Frontend launching..."

Start-Sleep 5
$feOk = Listen $FPORT; $bkOk = Listen $BPORT

if ($feOk) { Log "Frontend: http://127.0.0.1:$FPORT" } else { Log "WARNING: Frontend not on $FPORT. Logs:"; Get-Content "$logDir\frontend_err.log" -Tail 5 -ErrorAction SilentlyContinue }
if ($bkOk) { Log "Backend: http://127.0.0.1:$BPORT" } else { Log "WARNING: Backend not on $BPORT. Logs:"; Get-Content "$logDir\backend_err.log" -Tail 5 -ErrorAction SilentlyContinue }
Log "Log dir: $logDir"
