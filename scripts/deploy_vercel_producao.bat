@echo off
chcp 65001 >nul
cls

set VERCEL_PROJECT=controle-juros
set VERCEL_SCOPE=flauzino-s-projects
set VERCEL_DASHBOARD=https://vercel.com/flauzino-s-projects/controle-juros

echo =====================================================
echo  Deploy de Producao na Vercel - Controle de Juros
echo =====================================================
echo Projeto Vercel: %VERCEL_DASHBOARD%
echo.

node -v >nul 2>&1
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js LTS antes de continuar.
  pause
  exit /b 1
)

call npm install
if errorlevel 1 (
  echo Falha no npm install.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  echo Build falhou. Corrija antes do deploy.
  pause
  exit /b 1
)

echo.
echo Fazendo login na Vercel...
call npx vercel login
if errorlevel 1 (
  echo Login na Vercel falhou.
  pause
  exit /b 1
)

echo.
echo Vinculando esta pasta ao projeto correto da Vercel...
echo Projeto: %VERCEL_PROJECT%
echo Escopo/equipe: %VERCEL_SCOPE%
call npx vercel link --project %VERCEL_PROJECT% --scope %VERCEL_SCOPE%
if errorlevel 1 (
  echo Falha ao vincular o projeto. Se aparecer uma pergunta, selecione a equipe flauzino-s-projects e o projeto controle-juros.
  pause
  exit /b 1
)

echo.
echo Enviando deploy de producao para o projeto correto...
call npx vercel --prod --project %VERCEL_PROJECT% --scope %VERCEL_SCOPE%
if errorlevel 1 (
  echo Deploy falhou. Verifique o erro acima.
  pause
  exit /b 1
)

echo.
echo Deploy concluido. Abra:
echo %VERCEL_DASHBOARD%
pause
