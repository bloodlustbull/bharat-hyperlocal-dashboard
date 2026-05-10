$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$port = 3000
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
  Write-Host "Dashboard server is already running on $url"
}

Start-Process $url
