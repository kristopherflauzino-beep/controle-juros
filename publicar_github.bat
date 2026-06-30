@echo off
chcp 65001 >nul
echo ========================================
echo Instalando Controle de Juros
echo ========================================

if not exist .env (
  echo Criando .env a partir de .env.example...
  copy .env.example .env
)

call npm install
if errorlevel 1 (
  echo Erro no npm install.
  pause
  exit /b 1
)

echo.
echo Instalação concluída.
echo Configure DATABASE_URL e JWT_SECRET no arquivo .env.
echo Depois rode: npx prisma db push
echo Para iniciar: npm run dev
echo.
pause
