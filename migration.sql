@echo off
chcp 65001 >nul
set REPO=https://github.com/kristopherflauzino-beep/controle-juros.git
set BRANCH=principal

echo ========================================
echo Publicar Controle de Juros no GitHub
echo ========================================

call npm install
if errorlevel 1 (
  echo Erro no npm install.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  echo Build falhou. Publicação cancelada.
  pause
  exit /b 1
)

git init
git checkout -B %BRANCH%
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin %REPO%
) else (
  git remote set-url origin %REPO%
)

git add .
git commit -m "Versao inicial Controle de Juros" || echo Nenhuma alteração nova para commit.
git push -u origin %BRANCH%

if errorlevel 1 (
  echo Falha ao enviar para o GitHub.
  pause
  exit /b 1
)

echo.
echo Projeto enviado para a branch %BRANCH%.
echo.
pause
