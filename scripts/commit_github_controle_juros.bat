@echo off
chcp 65001 >nul
cls
echo =====================================================
echo  Commit e Push - Controle de Juros
echo =====================================================
echo.

set REPO_URL=https://github.com/kristopherflauzino-beep/controle-juros.git
set COMMIT_MSG=Corrige deploy Vercel e versao web do controle de juros

git --version >nul 2>&1
if errorlevel 1 (
  echo Git nao encontrado. Instale o Git antes de continuar.
  pause
  exit /b 1
)

node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS antes de continuar.
  pause
  exit /b 1
)

echo Instalando dependencias e validando build...
call npm install
if errorlevel 1 (
  echo Erro no npm install.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  echo O build falhou. Corrija o erro acima antes do push.
  pause
  exit /b 1
)

if not exist .git (
  git init
)

git branch -M main
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git add -A
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nada novo para commit ou erro no commit. Continuando para tentar o push...
)

git push -u origin main
if errorlevel 1 (
  echo.
  echo Push falhou. Possiveis causas:
  echo 1. Repositorio privado sem login autorizado.
  echo 2. Repositorio ainda nao foi criado.
  echo 3. Branch remota tem arquivos diferentes.
  echo.
  echo Se for historico diferente, tente:
  echo git pull origin main --allow-unrelated-histories
  echo depois resolva conflitos, commit e push novamente.
  pause
  exit /b 1
)

echo.
echo Commit e push concluidos. Agora conecte/redeploy o projeto na Vercel.
pause
