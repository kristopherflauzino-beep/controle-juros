@echo off
setlocal
cd /d "%~dp0"

echo ============================================================
echo  CORRECAO FINAL - controle-juros para Vercel
 echo ============================================================
echo.
echo Este script vai substituir o conteudo atual do GitHub pela versao limpa.
echo Repositorio: https://github.com/kristopherflauzino-beep/controle-juros.git
echo.
echo ATENCAO: ele usa git push --force para remover os arquivos quebrados.
echo.
set /p CONFIRMA=Digite SIM para continuar: 
if /I not "%CONFIRMA%"=="SIM" (
  echo Cancelado.
  pause
  exit /b 1
)

echo.
echo [1/6] Verificando package.json local...
powershell -NoProfile -Command "$c=Get-Content -Raw package.json; if($c.TrimStart().StartsWith('{')){Write-Host 'OK: package.json local comeca com {'} else {Write-Host 'ERRO: package.json local NAO comeca com {'; exit 1}"
if errorlevel 1 pause & exit /b 1

echo.
echo [2/6] Verificando Git...
where git >nul 2>nul
if errorlevel 1 (
  echo ERRO: Git nao encontrado. Instale o Git e execute novamente.
  pause
  exit /b 1
)

echo.
echo [3/6] Preparando repositorio local...
if exist .git rmdir /s /q .git
git init
if errorlevel 1 pause & exit /b 1
git branch -M main
git config user.name "Kristopher Flauzino"
git config user.email "kristophercunha.chiptronic@gmail.com"
git remote add origin https://github.com/kristopherflauzino-beep/controle-juros.git

echo.
echo [4/6] Criando commit limpo...
git add -A
git commit -m "Corrige estrutura do projeto para Vercel"
if errorlevel 1 pause & exit /b 1

echo.
echo [5/6] Enviando para o GitHub com FORCE...
git push -u origin main --force
if errorlevel 1 (
  echo.
  echo ERRO NO PUSH. Se pedir login, autorize o GitHub e rode o script novamente.
  pause
  exit /b 1
)

echo.
echo [6/6] Conferindo o package.json publicado no GitHub...
powershell -NoProfile -Command "Start-Sleep -Seconds 3; $url='https://raw.githubusercontent.com/kristopherflauzino-beep/controle-juros/main/package.json'; $c=(Invoke-WebRequest -UseBasicParsing $url).Content; Write-Host 'Primeiros caracteres publicados:'; Write-Host $c.Substring(0,[Math]::Min(120,$c.Length)); if($c.TrimStart().StartsWith('{')){Write-Host 'OK: GitHub corrigido. Agora faca Redeploy na Vercel.'} else {Write-Host 'AINDA ERRADO: o GitHub ainda nao foi substituido.'; exit 1}"

echo.
echo Abra a Vercel e faca Redeploy:
echo https://vercel.com/flauzino-s-projects/controle-juros
echo.
pause
