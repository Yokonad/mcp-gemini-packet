# install-ptbuilder.ps1
# Descarga Builder.pts del repositorio PTBuilder de GitHub

param(
  [string]$DestinationDir = (Join-Path (Join-Path $PSScriptRoot '..') 'config'),
  [switch]$ForceReplace
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)

$url = 'https://raw.githubusercontent.com/kimmknight/PTBuilder/main/Builder.pts'
$destPath = Join-Path (Resolve-Path $DestinationDir) 'Builder.pts'

if ((Test-Path -LiteralPath $destPath) -and $ForceReplace) {
  Remove-Item -LiteralPath $destPath -Force
  Write-Output "Builder.pts anterior eliminado para reinstalacion limpia."
}

if (-not (Test-Path -LiteralPath $destPath)) {
  Write-Output "Descargando Builder.pts desde GitHub..."
  try {
    Invoke-WebRequest -Uri $url -OutFile $destPath -UseBasicParsing
    Write-Output "Descargado exitosamente: $destPath"
  } catch {
    Write-Error "Error descargando Builder.pts: $_"
    exit 1
  }
} else {
  Write-Output "Builder.pts ya existe en: $destPath"
}

Write-Output ""
Write-Output "=== INSTRUCCIONES DE INSTALACION ==="
Write-Output "1. Abre Cisco Packet Tracer"
Write-Output "2. Ve a: Extensions > Scripting > Configure PT Script Modules"
Write-Output "3. Haz clic en 'Add...' y selecciona: $destPath"
Write-Output "4. Verifica que aparece 'Extensions > Builder Code Editor' en el menu"
Write-Output "==================================="
