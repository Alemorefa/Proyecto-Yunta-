@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

title Importador de Inventario Excel - Proyecto La Yunta

echo.
echo ========================================================
echo   PROYECTO LA YUNTA - IMPORTADOR DE INVENTARIO EXCEL
echo ========================================================
echo.

:: Verificar si Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] No se encontro Node.js instalado en el sistema.
    echo Por favor instala Node.js para continuar.
    pause
    exit /b 1
)

:: Determinar el directorio base del proyecto
set "BASE_DIR=%~dp0"
cd /d "%BASE_DIR%"

:: Si se le paso un archivo por arrastrar y soltar (Drag and Drop sobre el .bat)
if not "%~1"=="" (
    set "EXCEL_FILE=%~1"
    goto :EJECUTAR
)

:: Buscar archivos .xlsx en la carpeta actual o en scripts\
set "EXCEL_FILE="
set /a COUNT=0

for %%f in (*.xlsx scripts\*.xlsx) do (
    if not "%%~nxf"=="" (
        set /a COUNT+=1
        set "FILE_!COUNT!=%%f"
        if "!EXCEL_FILE!"=="" set "EXCEL_FILE=%%f"
    )
)

if %COUNT% EQU 0 (
    echo [AVISO] No se encontro ningun archivo .xlsx en la carpeta del proyecto.
    echo.
    set /p "EXCEL_FILE=Por favor, arrastra o escribe la ruta de tu archivo Excel: "
    set "EXCEL_FILE=!EXCEL_FILE:"=!"
    if "!EXCEL_FILE!"=="" (
        echo [ERROR] No se especifico ningun archivo.
        pause
        exit /b 1
    )
    goto :EJECUTAR
)

if %COUNT% EQU 1 (
    echo Archivo Excel detectado automaticamente: "%EXCEL_FILE%"
    echo.
    goto :EJECUTAR
)

:: Si hay mas de 1 archivo .xlsx, permitir elegir
echo Se encontraron varios archivos Excel:
for /L %%i in (1,1,%COUNT%) do (
    echo   [%%i] !FILE_%%i!
)
echo.
set /p "CHOICE=Selecciona el numero del archivo a importar (1-%COUNT%): "
set "EXCEL_FILE=!FILE_%CHOICE%!"

if "!EXCEL_FILE!"=="" (
    echo Seleccion invalida.
    pause
    exit /b 1
)

:EJECUTAR
echo.
echo Ejecutando importador sobre: "!EXCEL_FILE!"
echo --------------------------------------------------------
echo.

node "scripts\importar-excel-inventario.mjs" "!EXCEL_FILE!"

echo.
echo ========================================================
pause
