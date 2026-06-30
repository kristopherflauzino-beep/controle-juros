@echo off
setlocal
cd /d "%~dp0"
call npm install
if errorlevel 1 goto :erro
call npm run build
if errorlevel 1 goto :erro
echo Build concluido com sucesso.
exit /b 0
:erro
echo O teste de build falhou.
exit /b 1
