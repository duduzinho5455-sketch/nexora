@echo off
title Agente Auryx
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0nexora-agente.ps1"
pause
