# UnLockPre · GaboStore

Biblioteca web de **preloaders/loaders MediaTek (MTK)** en formatos `.bin` y `.json`, organizada para consulta técnica junto a herramientas como UnlockTool y TSM Tool.

🌐 **Sitio:** https://gabo-store.github.io/UnLockPre/  
📦 **Repositorio:** https://github.com/Gabo-Store/UnLockPre

## Qué incluye

- Catálogo dinámico desde `downloads/catalog.json`.
- Búsqueda por modelo, firmware, región/CSC, variante y archivo.
- Filtros por marca, región, Android y tipo de registro.
- Fichas detalladas, archivos relacionados, favoritos y vistos recientemente.
- Comparador de dos registros.
- Verificador SHA-256 local en el navegador: el archivo no se sube a ningún servidor.
- Estadísticas por marca/Android e indicadores de integridad.
- PWA instalable, caché del catálogo y soporte básico offline.
- Temas visuales, modo compacto y diseño responsive.
- URL de búsqueda compartible y reporte de archivos mediante GitHub Issues.

## Advertencia

**GaboStore no se hace responsable por daños, pérdida de datos, bloqueos, incompatibilidades, uso indebido ni consecuencias derivadas del uso de los archivos o herramientas enlazadas.** Verifica siempre modelo, variante, región, firmware/revisión y SHA-256. La presencia de un archivo en el catálogo no garantiza compatibilidad con un equipo o herramienta concreta.

UnlockTool, TSM Tool y las marcas mencionadas pertenecen a sus respectivos propietarios. Este repositorio no afirma afiliación oficial con ellos.

## Catálogo y validación

Los binarios publicados conservan su SHA-256, tamaño, firmware, región y JSON de procedencia. `scripts/library-index.cjs` valida los archivos disponibles y regenera `downloads/catalog.json` sin depender del HTML.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run catalog:build
npm.cmd test
```

La automatización de GitHub vuelve a validar el catálogo cuando cambian archivos en `downloads/` y puede actualizar el inventario generado.

## Estructura

```text
index.html
assets/
  app.css
  app.js
manifest.webmanifest
sw.js
favicon.svg
404.html
downloads/
  catalog.json
  *.bin
  *.json
scripts/
research/
.github/workflows/
```

## Contribuciones

Lee [CONTRIBUTING.md](CONTRIBUTING.md). Para reportar un registro incorrecto, abre un Issue incluyendo archivo, modelo, firmware y descripción del problema.

## Créditos

**GaboStore / Gabo-Store** · mantenimiento, interfaz y publicación de UnLockPre.
