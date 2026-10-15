# Genera un certificado AUTOFIRMADO para probar la API y el front con HTTPS en desarrollo.
# Uso (en la carpeta backend):   powershell -ExecutionPolicy Bypass -File .\generar-certificado.ps1
# Requiere "keytool", que viene con el JDK (el mismo con el que corren Spring Boot).
# Crea: certificados\miaa-dev.p12   (contraseña: miaa-dev)   -> NO lo suban a Git.

$ErrorActionPreference = 'Stop'
$carpeta = Join-Path $PSScriptRoot 'certificados'
$archivo = Join-Path $carpeta 'miaa-dev.p12'
$password = 'miaa-dev'

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
    Write-Error 'No encuentro keytool. Agrega la carpeta bin de tu JDK al PATH (p. ej. C:\Program Files\Java\jdk-17\bin).'
}

New-Item -ItemType Directory -Force -Path $carpeta | Out-Null
if (Test-Path $archivo) {
    Write-Host "Ya existe $archivo. Bórralo si quieres generar uno nuevo."
    exit 0
}

# IPs locales de la PC (para entrar desde el celular en la misma red)
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress
$san = @('dns:localhost', 'ip:127.0.0.1') + ($ips | ForEach-Object { "ip:$_" })

keytool -genkeypair -alias miaa -keyalg RSA -keysize 2048 -validity 3650 `
    -storetype PKCS12 -keystore $archivo -storepass $password -keypass $password `
    -dname 'CN=localhost, OU=Desarrollo, O=MIAA, C=MX' -ext ('SAN=' + ($san -join ','))

Write-Host ''
Write-Host "Listo: $archivo"
Write-Host ('Válido para: ' + ($san -join ', '))
Write-Host 'Backend: mvn spring-boot:run "-Dspring-boot.run.profiles=https"'
Write-Host 'Front:   npm run dev:https'
