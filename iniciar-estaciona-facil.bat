@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Estaciona Fácil - Inicializador

echo ============================================
echo       ESTACIONA FACIL - INICIAR SISTEMA
echo ============================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao foi encontrado neste computador.
  echo Instale a versao LTS em: https://nodejs.org/
  echo Depois, feche e abra este arquivo novamente.
  echo.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo O npm nao foi encontrado. Reinstale o Node.js LTS.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Preparando o sistema pela primeira vez. E necessario internet.
  call npm install
  if errorlevel 1 (
    echo.
    echo Nao foi possivel instalar as dependencias. Verifique a internet e tente novamente.
    pause
    exit /b 1
  )
)
echo.
echo Iniciando o sistema. Mantenha esta janela aberta.
echo O navegador abrira no endereco informado pelo Vite.
echo Para encerrar, pressione Ctrl+C nesta janela.
echo.
call npm run dev -- --host 127.0.0.1
pause
