@echo off
chcp 65001 >nul
cls
setlocal enabledelayedexpansion

echo =====================================================
echo  CORRECAO TOTAL DO REPOSITORIO controle-juros
echo =====================================================
echo.
echo Este script substitui o conteudo errado do GitHub pela versao limpa.
echo Ele corrige o package.json que esta com CSS dentro.
echo.
set REPO_URL=https://github.com/kristopherflauzino-beep/controle-juros.git
set COMMIT_MSG=Corrige estrutura do projeto para deploy na Vercel

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

echo [1/4] Instalando dependencias...
call npm install
if errorlevel 1 (
  echo Falha no npm install.
  pause
  exit /b 1
)

echo.
echo [2/4] Validando build...
call npm run build
if errorlevel 1 (
  echo Build falhou. O GitHub nao sera alterado.
  pause
  exit /b 1
)

echo.
echo [3/4] Preparando repositorio Git local limpo...
if exist .git rmdir /s /q .git
git init
git branch -M main
git remote add origin %REPO_URL%
git add -A
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Erro ao criar commit.
  pause
  exit /b 1
)

echo.
echo [4/4] Enviando para o GitHub e substituindo a versao quebrada...
echo.
echo ATENCAO: isso vai substituir os arquivos atuais do repositorio remoto.
set /p CONFIRMAR=Digite SIM para continuar: 
if /I not "!CONFIRMAR!"=="SIM" (
  echo Cancelado.
  pause
  exit /b 1
)

git push -u origin main --force
if errorlevel 1 (
  echo.
  echo Push falhou. Verifique se voce esta logado no GitHub e tem permissao no repositorio.
  pause
  exit /b 1
)

echo.
echo GitHub corrigido com sucesso.
echo Agora va na Vercel e clique em Redeploy no projeto controle-juros.
echo https://vercel.com/flauzino-s-projects/controle-juros
pause
