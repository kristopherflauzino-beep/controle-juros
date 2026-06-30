@echo off
chcp 65001 >nul
cls
setlocal enabledelayedexpansion

echo =====================================================
echo  Publicar Controle de Juros no GitHub e Vercel
echo =====================================================
echo.
set REPO_URL=https://github.com/kristopherflauzino-beep/controle-juros.git
set COMMIT_MSG=Atualiza Controle de Juros para Vercel

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

echo.
echo [1/5] Instalando dependencias...
call npm install
if errorlevel 1 (
  echo Falha no npm install.
  pause
  exit /b 1
)

echo.
echo [2/5] Validando build da Vercel...
call npm run build
if errorlevel 1 (
  echo O build falhou. Corrija o erro acima antes de publicar.
  pause
  exit /b 1
)

echo.
echo [3/5] Preparando Git...
if not exist .git (
  git init
)

git branch -M main
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%

git add -A
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  echo Nenhuma alteracao nova para commit ou commit ja existente. Continuando...
)

echo.
echo [4/5] Enviando para o GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo O push normal falhou. Isso normalmente acontece quando o repositorio remoto ja tem arquivos diferentes.
  echo.
  set /p FORCE_PUSH=Deseja substituir o conteudo remoto pela versao corrigida? Digite SIM para continuar: 
  if /I "!FORCE_PUSH!"=="SIM" (
    git push -u origin main --force-with-lease
    if errorlevel 1 (
      echo Falha tambem no force-with-lease. Verifique login do GitHub/permissoes.
      pause
      exit /b 1
    )
  ) else (
    echo Publicacao cancelada antes de substituir o remoto.
    pause
    exit /b 1
  )
)

echo.
echo [5/5] GitHub atualizado. Agora a Vercel deve iniciar o deploy automatico se o repositorio estiver conectado.
echo.
echo Para deploy manual pela CLI, execute:
echo npx vercel link
echo npx vercel --prod
echo.
pause
