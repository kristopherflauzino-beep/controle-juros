@echo off
setlocal
cd /d "%~dp0"
echo Instalando dependencias...
call npm install
if errorlevel 1 goto :erro
echo.
echo Dependencias instaladas. Copie .env.example para .env e configure DATABASE_URL e JWT_SECRET.
exit /b 0
:erro
echo Falha na instalacao.
exit /b 1
