@echo off
setlocal EnableExtensions EnableDelayedExpansion

title MCP Packet Tracer - Installer (Windows)
echo ===============================================
echo MCP Packet Tracer - Installer de prerrequisitos
echo ===============================================
echo.

set "IS_ADMIN=0"
net session >nul 2>&1 && set "IS_ADMIN=1"

call :check_node
if errorlevel 1 goto :end

call :ensure_npm_path
call :maybe_install_gemini
call :maybe_install_copilot
call :final_status
goto :end

:command_exists
where "%~1" >nul 2>&1
exit /b %errorlevel%

:check_node
call :command_exists node
if %errorlevel%==0 (
  for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
  echo [OK] Node.js instalado: !NODE_VER!

  call :command_exists npm
  if %errorlevel%==0 (
    for /f "delims=" %%v in ('npm -v') do set "NPM_VER=%%v"
    echo [OK] npm instalado: !NPM_VER!
    exit /b 0
  )

  echo [WARN] Node existe pero npm no responde.
) else (
  echo [WARN] Node.js no esta instalado.
)

choice /M "Deseas instalar Node.js LTS ahora"
if errorlevel 2 (
  echo [ERROR] Sin Node.js no puedo instalar Gemini/Copilot CLI.
  exit /b 1
)

call :install_node

call :command_exists node
if not %errorlevel%==0 (
  echo [ERROR] No se pudo instalar Node.js automaticamente.
  echo [INFO] Instala manualmente desde: https://nodejs.org/
  exit /b 1
)

call :command_exists npm
if not %errorlevel%==0 (
  echo [WARN] npm no aparece en PATH aun.
  echo [INFO] Prueba cerrando y abriendo la terminal.
  call :refresh_session_path
)

call :command_exists npm
if not %errorlevel%==0 (
  echo [ERROR] npm sigue sin estar disponible.
  exit /b 1
)

for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('npm -v') do set "NPM_VER=%%v"
echo [OK] Node.js instalado: !NODE_VER!
echo [OK] npm instalado: !NPM_VER!
exit /b 0

:install_node
echo [INFO] Intentando instalar Node.js con todos los metodos conocidos...

call :try_winget "OpenJS.NodeJS.LTS"
if %errorlevel%==0 exit /b 0

call :try_winget "OpenJS.NodeJS"
if %errorlevel%==0 exit /b 0

call :try_choco "nodejs-lts"
if %errorlevel%==0 exit /b 0

call :try_choco "nodejs"
if %errorlevel%==0 exit /b 0

call :try_scoop "nodejs-lts"
if %errorlevel%==0 exit /b 0

call :try_scoop "nodejs"
if %errorlevel%==0 exit /b 0

call :try_nvm
if %errorlevel%==0 exit /b 0

call :try_fnm
if %errorlevel%==0 exit /b 0

call :try_manual_node_installer
if %errorlevel%==0 exit /b 0

echo [ERROR] Ningun metodo automatico funciono para Node.js.
exit /b 1

:try_winget
set "WINGET_ID=%~1"
call :command_exists winget
if not %errorlevel%==0 exit /b 1
echo [TRY] winget install %WINGET_ID%
winget install -e --id %WINGET_ID% --accept-package-agreements --accept-source-agreements --silent
if %errorlevel%==0 (
  call :refresh_session_path
  call :command_exists node
  if %errorlevel%==0 exit /b 0
)
echo [WARN] winget con %WINGET_ID% fallo.
exit /b 1

:try_choco
set "CHOCO_PKG=%~1"
call :command_exists choco
if not %errorlevel%==0 exit /b 1
echo [TRY] choco install %CHOCO_PKG%
choco install %CHOCO_PKG% -y
if %errorlevel%==0 (
  call :refresh_session_path
  call :command_exists node
  if %errorlevel%==0 exit /b 0
)
echo [WARN] choco con %CHOCO_PKG% fallo.
exit /b 1

:try_scoop
set "SCOOP_PKG=%~1"
call :command_exists scoop
if not %errorlevel%==0 exit /b 1
echo [TRY] scoop install %SCOOP_PKG%
scoop install %SCOOP_PKG%
if %errorlevel%==0 (
  call :refresh_session_path
  call :command_exists node
  if %errorlevel%==0 exit /b 0
)
echo [WARN] scoop con %SCOOP_PKG% fallo.
exit /b 1

:try_nvm
call :command_exists nvm
if not %errorlevel%==0 exit /b 1
echo [TRY] nvm install lts
nvm install lts
if %errorlevel% neq 0 (
  echo [WARN] nvm install fallo.
  exit /b 1
)
nvm use lts
call :refresh_session_path
call :command_exists node
if %errorlevel%==0 exit /b 0
exit /b 1

:try_fnm
call :command_exists fnm
if not %errorlevel%==0 exit /b 1
echo [TRY] fnm install --lts
fnm install --lts
if %errorlevel% neq 0 (
  echo [WARN] fnm install fallo.
  exit /b 1
)
fnm use lts
call :refresh_session_path
call :command_exists node
if %errorlevel%==0 exit /b 0
exit /b 1

:try_manual_node_installer
echo [TRY] instalador manual MSI de Node.js (descarga oficial)
set "TMP_MSI=%TEMP%\node-lts-x64.msi"

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $u='https://nodejs.org/dist/latest-v20.x/node-v20.19.5-x64.msi'; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile '%TMP_MSI%' -ErrorAction Stop; exit 0 } catch { exit 1 }"
if %errorlevel% neq 0 (
  echo [WARN] No se pudo descargar MSI directo.
  echo [INFO] Abriendo web oficial para instalacion manual.
  start "" "https://nodejs.org/en/download"
  exit /b 1
)

if "%IS_ADMIN%"=="0" (
  echo [INFO] Para instalacion silenciosa del MSI se recomienda ejecutar como administrador.
  echo [INFO] Ejecuta este .bat como administrador o instala el MSI manualmente desde: %TMP_MSI%
  start "" "%TMP_MSI%"
  exit /b 1
)

msiexec /i "%TMP_MSI%" /qn /norestart
if %errorlevel%==0 (
  call :refresh_session_path
  call :command_exists node
  if %errorlevel%==0 exit /b 0
)
echo [WARN] Instalacion MSI fallo.
exit /b 1

:refresh_session_path
for /f "tokens=2,*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul ^| findstr /I "PATH"') do set "USER_PATH=%%b"
for /f "tokens=2,*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v PATH 2^>nul ^| findstr /I "PATH"') do set "MACHINE_PATH=%%b"
if defined USER_PATH (
  if defined MACHINE_PATH (
    set "PATH=!MACHINE_PATH!;!USER_PATH!"
  ) else (
    set "PATH=!USER_PATH!"
  )
)
exit /b 0

:ensure_npm_path
set "NPM_USER_BIN=%APPDATA%\npm"
if not exist "%NPM_USER_BIN%" mkdir "%NPM_USER_BIN%" >nul 2>&1

call :path_contains "%NPM_USER_BIN%"
if %errorlevel%==0 (
  echo [OK] PATH ya contiene: %NPM_USER_BIN%
  exit /b 0
)

echo [WARN] PATH no contiene %NPM_USER_BIN%
choice /M "Deseas agregarlo al PATH de usuario"
if errorlevel 2 (
  echo [INFO] Puedes agregarlo manualmente despues.
  echo [INFO] Si quieres PATH global, usa terminal como administrador.
  exit /b 0
)

for /f "tokens=2,*" %%a in ('reg query "HKCU\Environment" /v PATH 2^>nul ^| findstr /I "PATH"') do set "USER_PATH=%%b"
if not defined USER_PATH set "USER_PATH=%PATH%"
set "NEW_USER_PATH=%USER_PATH%;%NPM_USER_BIN%"
setx PATH "%NEW_USER_PATH%" >nul
if %errorlevel%==0 (
  echo [OK] PATH de usuario actualizado.
  echo [INFO] Cierra y abre la terminal para aplicar cambios.
) else (
  echo [WARN] No se pudo actualizar PATH de usuario.
  echo [INFO] Comando sugerido (admin):
  echo        setx /M PATH "%%PATH%%;%NPM_USER_BIN%"
)
exit /b 0

:maybe_install_gemini
call :command_exists gemini
if %errorlevel%==0 (
  echo [OK] Gemini CLI instalado.
  exit /b 0
)

echo [WARN] Gemini CLI no instalado.
choice /M "Deseas instalar Gemini CLI ahora"
if errorlevel 2 exit /b 0

call :npm_global_install "@google/gemini-cli" "gemini" "gemini"
exit /b 0

:maybe_install_copilot
call :command_exists copilot
if %errorlevel%==0 (
  echo [OK] Copilot CLI instalado.
  exit /b 0
)

call :command_exists github-copilot-cli
if %errorlevel%==0 (
  echo [OK] GitHub Copilot CLI instalado.
  exit /b 0
)

echo [WARN] Copilot CLI no instalado.
choice /M "Deseas instalar Copilot CLI ahora"
if errorlevel 2 exit /b 0

call :npm_global_install "@githubnext/github-copilot-cli" "copilot" "github-copilot-cli"
exit /b 0

:npm_global_install
set "PKG=%~1"
set "CMD_A=%~2"
set "CMD_B=%~3"

echo [TRY] npm install -g %PKG%
call npm install -g %PKG%
call :cli_present "%CMD_A%" "%CMD_B%"
if %errorlevel%==0 (
  echo [OK] %PKG% instalado correctamente.
  exit /b 0
)

echo [TRY] npm --location=global install -g %PKG%
call npm --location=global install -g %PKG%
call :cli_present "%CMD_A%" "%CMD_B%"
if %errorlevel%==0 (
  echo [OK] %PKG% instalado correctamente.
  exit /b 0
)

echo [TRY] prefix de usuario APPDATA\\npm
call npm config set prefix "%APPDATA%\npm"
call npm install -g %PKG%
call :refresh_session_path
set "PATH=%PATH%;%APPDATA%\npm"
call :cli_present "%CMD_A%" "%CMD_B%"
if %errorlevel%==0 (
  echo [OK] %PKG% instalado correctamente (modo usuario).
  exit /b 0
)

call :command_exists pnpm
if %errorlevel%==0 (
  echo [TRY] pnpm add -g %PKG%
  call pnpm add -g %PKG%
  call :cli_present "%CMD_A%" "%CMD_B%"
  if %errorlevel%==0 (
    echo [OK] %PKG% instalado con pnpm.
    exit /b 0
  )
)

call :command_exists yarn
if %errorlevel%==0 (
  echo [TRY] yarn global add %PKG%
  call yarn global add %PKG%
  call :cli_present "%CMD_A%" "%CMD_B%"
  if %errorlevel%==0 (
    echo [OK] %PKG% instalado con yarn.
    exit /b 0
  )
)

echo [ERROR] No se pudo instalar %PKG% automaticamente.
echo [INFO] Si hay permisos restringidos, ejecuta en modo administrador:
echo        npm install -g %PKG%
exit /b 0

:cli_present
call :command_exists %~1
if %errorlevel%==0 exit /b 0
if not "%~2"=="" (
  call :command_exists %~2
  if %errorlevel%==0 exit /b 0
)
exit /b 1

:path_contains
set "TARGET=%~1"
echo %PATH% | find /I "%TARGET%" >nul
if %errorlevel%==0 exit /b 0
exit /b 1

:final_status
echo.
echo ========= ESTADO FINAL =========

call :command_exists node && (echo Node.js: instalado) || (echo Node.js: no instalado)
call :command_exists npm && (echo npm: instalado) || (echo npm: no instalado)
call :command_exists gemini && (echo Gemini CLI: instalado) || (echo Gemini CLI: no instalado)

call :command_exists copilot
if %errorlevel%==0 (
  echo Copilot CLI: instalado
) else (
  call :command_exists github-copilot-cli && (echo Copilot CLI: instalado) || (echo Copilot CLI: no instalado)
)

if "%IS_ADMIN%"=="1" (
  echo Modo admin: si
) else (
  echo Modo admin: no
  echo [INFO] Si necesitas cambios globales de PATH o instalacion de sistema, ejecuta este .bat como administrador.
)

echo =================================
exit /b 0

:end
echo.
echo Proceso finalizado.
endlocal
