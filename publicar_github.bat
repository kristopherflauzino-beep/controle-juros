@echo off
setlocal
cd /d "%~dp0"
call npm install
if errorlevel 1 goto :erro
call npm run build
if errorlevel 1 goto :erro
git branch -M principal
git remote get-url origin >nul 2>&1
if errorlevel 1 (git remote add origin https://github.com/kristopherflauzino-beep/controle-juros.git) else (git remote set-url origin https://github.com/kristopherflauzino-beep/controle-juros.git)
git add .
git commit -m "Publica Controle de Juros"
if errorlevel 1 echo Nenhuma alteracao nova para commit.
git push -u origin principal
if errorlevel 1 goto :erro
echo Projeto publicado na branch principal.
exit /b 0
:erro
echo A publicacao falhou. Confira a mensagem acima e sua autenticacao no GitHub.
exit /b 1
