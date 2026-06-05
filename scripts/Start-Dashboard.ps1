$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 5500
$url = "http://127.0.0.1:$port/index.html"

Set-Location $projectRoot

function Test-PortOpen {
  param([int]$Port)

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
    if (-not $result.AsyncWaitHandle.WaitOne(300, $false)) {
      return $false
    }
    $client.EndConnect($result)
    return $true
  }
  catch {
    return $false
  }
  finally {
    $client.Close()
  }
}

function Test-DashboardServer {
  param([string]$DashboardUrl)

  try {
    $response = Invoke-WebRequest -Uri $DashboardUrl -UseBasicParsing -TimeoutSec 3
    return ($response.Content -match '/@vite/client')
  }
  catch {
    return $false
  }
}

if (-not (Test-Path (Join-Path $projectRoot 'node_modules'))) {
  Write-Host 'Installing dependencies first...'
  npm install
}

if (-not (Test-PortOpen -Port $port)) {
  Write-Host "Starting Bharat Hyperlocal Dashboard on $url"
  Start-Process -FilePath 'npm.cmd' -ArgumentList 'run', 'dev' -WorkingDirectory $projectRoot -WindowStyle Minimized

  $deadline = (Get-Date).AddSeconds(20)
  while ((Get-Date) -lt $deadline) {
    if (Test-PortOpen -Port $port) {
      break
    }
    Start-Sleep -Milliseconds 500
  }
}
else {
  if (Test-DashboardServer -DashboardUrl $url) {
    Write-Host "Dashboard server is already running on $url"
  }
  else {
    Write-Host "Port $port is already being used, but it does not look like the Vite dashboard server."
    Write-Host 'Close VS Code Live Server or any old local server using port 5500, then run Run-Dashboard.bat again.'
    exit 1
  }
}

Start-Process $url
