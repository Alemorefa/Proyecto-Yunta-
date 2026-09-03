@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo  ============================================
echo   Generador de SQL para cargar inventario
echo  ============================================
echo.
if not exist "%~dp0generar-sql.mjs" (
  echo  ERROR: falta el archivo generar-sql.mjs
  echo.
  echo  Este .bat necesita estar en la MISMA carpeta que generar-sql.mjs
  echo  Copia los dos archivos juntos.
  echo.
  echo  Presiona una tecla para cerrar...
  pause >nul
  exit /b 1
)

node generar-sql.mjs
echo.
echo  Presiona una tecla para cerrar...
pause >nul
