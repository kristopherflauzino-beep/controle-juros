@echo off
chcp 65001 >nul
cls

set VERCEL_PROJECT=controle-juros
set VERCEL_SCOPE=flauzino-s-projects
set VERCEL_DASHBOARD=https://vercel.com/flauzino-s-projects/controle-juros

echo =====================================================
echo  Deploy - Controle de Juros na Vercel
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
call npm run build
if errorlevel 1 (
  echo Build falhou. Verifique o erro acima.
  pause
  exit /b 1
)

call npx vercel login
call npx vercel link --project %VERCEL_PROJECT% --scope %VERCEL_SCOPE%
call npx vercel --prod --project %VERCEL_PROJECT% --scope %VERCEL_SCOPE%

echo.
echo Deploy enviado para: %VERCEL_DASHBOARD%
pause
