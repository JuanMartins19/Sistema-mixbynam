@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0.tools\node-v22.22.0-win-x64\node.exe" set "PATH=%~dp0.tools\node-v22.22.0-win-x64;%PATH%"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 22 ou superior e tente novamente.
  pause
  exit /b 1
)
if not exist "node_modules\next\package.json" (
  echo Dependencias ausentes. Execute npm.cmd ci na pasta do projeto.
  pause
  exit /b 1
)
set "NEXT_TELEMETRY_DISABLED=1"
echo Iniciando Mixbynam em http://127.0.0.1:3000
echo Mantenha esta janela aberta. Para parar, pressione Ctrl+C.
echo Se a porta estiver em uso, ja existe outro servidor: use a janela existente.
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
echo O servidor foi encerrado. Consulte as mensagens acima se ocorreu algum erro.
pause
