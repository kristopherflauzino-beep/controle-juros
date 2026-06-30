@echo off
setlocal
cd /d "%~dp0"

echo Instalando dependencias...
call npm install
if errorlevel 1 goto :erro

echo Testando build...
call npm run build
if errorlevel 1 goto :erro

echo Preparando GitHub...
git branch -M main
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin https://github.com/kristopherflauzino-beep/controle-juros.git
) else (
  git remote set-url origin https://github.com/kristopherflauzino-beep/controle-juros.git
)

git add .
git commit -m "Ajusta projeto para GitHub e Vercel"
if errorlevel 1 echo Nenhuma alteracao nova para commit.

git push -u origin main
if errorlevel 1 goto :erro

echo Projeto enviado para o GitHub na branch main.
exit /b 0

:erro
echo Falha no processo. Confira a mensagem acima e sua autenticacao no GitHub.
exit /b 1
