@echo off
title NEXORA Agente
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nexora-agente.ps1"
pause
