# Corre las pruebas del punto 5 y deja el reporte en pruebas\reportes\reporte.html
#
#   .\correr_pruebas.ps1                 todo (API + Selenium + carga)
#   .\correr_pruebas.ps1 -SinNavegador   solo API y HTTPS (rápido, sin abrir Chrome)
#   .\correr_pruebas.ps1 -Ver            con Chrome visible (para enseñarlo en la demo)
#
# Antes: backend con  .\mvnw spring-boot:run "-Dspring-boot.run.profiles=https,pruebas"
#        front con    npm run dev:https
param([switch]$SinNavegador, [switch]$Ver)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

if (-not (Test-Path .venv)) {
    Write-Host 'Creando entorno de Python (solo la primera vez)...'
    python -m venv .venv
    .\.venv\Scripts\python -m pip install --upgrade pip | Out-Null
    .\.venv\Scripts\python -m pip install -r requirements.txt
}

if ($Ver) { $env:MIAA_HEADLESS = '0' }
$filtro = @()
if ($SinNavegador) { $filtro = @('-m', 'not ui') }

.\.venv\Scripts\python -m pytest @filtro --html=reportes\reporte.html --self-contained-html --junitxml=reportes\junit.xml
Write-Host ''
Write-Host 'Reporte:  pruebas\reportes\reporte.html'
Write-Host 'Capturas: pruebas\reportes\capturas\'
