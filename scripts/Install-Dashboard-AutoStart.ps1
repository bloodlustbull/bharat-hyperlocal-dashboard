$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $projectRoot 'Run-Dashboard.bat'
$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupFolder 'Bharat Hyperlocal Dashboard.lnk'

if (-not (Test-Path $launcher)) {
  throw "Launcher not found: $launcher"
}

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectRoot
$shortcut.WindowStyle = 7
$shortcut.Description = 'Starts the local Bharat Hyperlocal Dashboard server.'
$shortcut.Save()

Write-Host "Installed auto-start shortcut: $shortcutPath"
Write-Host 'The dashboard will start automatically after you log in to Windows.'
