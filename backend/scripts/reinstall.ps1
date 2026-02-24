param(
  [string]$AdminEmail = "admin@admin.com",
  [string]$AdminPassword = "123456",
  [string]$AdminName = "Administrador"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Instalando dependencias..." -ForegroundColor Cyan
npm install

Write-Host "==> Aplicando migrations..." -ForegroundColor Cyan
npx prisma migrate deploy

Write-Host "==> Gerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate

Write-Host "==> Build do backend..." -ForegroundColor Cyan
npm run build

Write-Host "==> Criando/garantindo admin inicial..." -ForegroundColor Cyan
$env:ADMIN_EMAIL = $AdminEmail
$env:ADMIN_PASSWORD = $AdminPassword
$env:ADMIN_NAME = $AdminName
node dist/scripts/seedAdmin.js

Write-Host "==> Reinstalacao concluida." -ForegroundColor Green
Write-Host "Para iniciar: npm start" -ForegroundColor Yellow

