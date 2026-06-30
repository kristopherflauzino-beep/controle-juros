@echo off
chcp 65001 >nul
cls
echo ================================================
echo  Subir Controle de Juros Web para o GitHub
echo ================================================
echo.
set /p REPO_URL=Cole a URL do repositorio GitHub: 
if "%REPO_URL%"=="" (
  echo URL nao informada.
  pause
  exit /b 1
)

git --version >nul 2>&1
if errorlevel 1 (
  echo Git nao encontrado. Instale o Git antes de continuar.
  pause
  exit /b 1
)

if not exist .git (
  git init
)

git add .
git commit -m "Versao web do controle de juros" || echo Nada novo para commit.
git branch -M main
git remote remove origin >nul 2>&1
git remote add origin %REPO_URL%
git push -u origin main

echo.
echo Finalizado. Agora importe este repositorio na Vercel.
pause
