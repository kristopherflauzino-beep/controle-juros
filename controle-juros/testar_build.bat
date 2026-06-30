@echo off
chcp 65001 >nul
echo ========================================
echo Testando build do Controle de Juros
echo ========================================

call npm install
if errorlevel 1 (
  echo Erro no npm install.
  pause
  exit /b 1
)

call npm run build
if errorlevel 1 (
  echo Build falhou.
  pause
  exit /b 1
)

echo.
echo Build concluído com sucesso.
echo.
pause
