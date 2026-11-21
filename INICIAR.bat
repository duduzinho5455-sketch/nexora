@echo off
chcp 65001 >nul
title Auryx Nexos
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao esta instalado.
  echo  Baixe a versao LTS em https://nodejs.org e rode este arquivo de novo.
  echo.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install --omit=dev
)
node server.js
pause
