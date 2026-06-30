@echo off
setlocal enabledelayedexpansion

echo ============================================
echo Corrigir Controle de Juros - Vercel/GitHub
echo ============================================
echo.

REM Execute este script dentro da pasta do projeto controle-juros.
REM Ele remove o vercel.json invalido, cria/usa a branch principal
REM e tambem atualiza a branch main para a Vercel parar de compilar o arquivo quebrado.

where git >nul 2>nul
if errorlevel 1 (
  echo ERRO: Git nao encontrado. Instale o Git antes de continuar.
  pause
  exit /b 1
)

if not exist ".git" (
  echo ERRO: Esta pasta nao parece ser um repositorio Git.
  echo Abra o terminal dentro da pasta controle-juros clonada do GitHub e rode novamente.
  pause
  exit /b 1
)

echo Verificando repositorio remoto...
git remote -v
echo.

echo Removendo vercel.json invalido...
if exist "vercel.json" (
  git rm -f vercel.json
) else (
  echo vercel.json nao existe na pasta local.
)

echo.
echo Salvando alteracoes...
git add -A
git commit -m "Remove vercel.json invalido" || echo Nenhuma alteracao nova para commit.

echo.
echo Criando/alterando branch para principal...
git branch -M principal

echo.
echo Enviando para GitHub na branch principal...
git push -u origin principal --force
if errorlevel 1 (
  echo.
  echo ERRO: O push para principal falhou. Verifique login/permissao do GitHub.
  pause
  exit /b 1
)

echo.
echo Atualizando tambem a branch main para a Vercel nao usar codigo antigo...
git push origin principal:main --force
if errorlevel 1 (
  echo.
  echo AVISO: Nao consegui atualizar main. A branch principal foi enviada, mas a Vercel pode estar apontando para main.
  echo No painel da Vercel, altere a Production Branch para principal ou tente novamente.
  pause
  exit /b 1
)

echo.
echo ============================================
echo Concluido. Agora faca Redeploy na Vercel.
echo ============================================
pause
