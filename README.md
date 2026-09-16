# Device Atlas · TSM

Abre `index.html`. La página funciona sin servidor, fuentes externas ni bibliotecas de interfaz. Para publicarla conserva también `downloads/` y `research/` en sus rutas relativas. No es necesario publicar los scripts, temporales ni `node_modules/`.

## Alcance real

Directorio parcial: 140 marcas, 265 referencias agrupadas y 30 marcas con referencias locales. No es una lista exhaustiva de dispositivos, variantes u operaciones compatibles con TSM. El soporte debe confirmarse en [TSM](https://tsm-tool.com/support).

Se realizó una búsqueda inicial individual por cada una de las 265 referencias; su auditoría está en `research/preloader-search.json`. Eso no equivale a revisar cada variante, región y firmware. Los resultados de terceros no se publican automáticamente como descargas.

También se revisaron los 120 códigos Samsung del catálogo local: 9 tienen descarga, 25 no contenían un preloader en el componente BL comprobado, 17 no devolvieron firmware en las regiones consultadas y 69 quedaron pendientes de extracción/validación (61 por límite de tamaño y 8 por validación MD5). El detalle está en [la auditoría por variante](research/samsung-preloader-coverage.json). Se consultaron como máximo dos regiones y un firmware por código: **no es una revisión de todos los firmwares ni prueba de que las otras variantes carezcan de preloader**. La ficha muestra el resultado específico sin habilitar descargas inexistentes.

## Archivos incorporados · 16 de septiembre de 2026

Más de 100 archivos originales distintos, extraídos de paquetes servidos por Samsung, Xiaomi, OnePlus y Realme; 18 referencias de modelos del catálogo (algunas agrupan variantes 4G/5G). Incluye firmwares históricos y regiones: **más de 100 archivos no significa más de 100 modelos**. Los binarios idénticos se descartan por SHA-256, no se suman como archivos nuevos. Cada archivo tiene tamaño, SHA-256, firmware, origen y registro de extracción en su ficha. **La colección todavía no cubre todos los modelos ni todas sus variantes.**

El [inventario completo descargable](downloads/catalog.json) contiene el recuento exacto, desglose por marca y todos los archivos publicados. En la página puedes filtrar cada modelo por firmware, región o código de variante. Los filtros sin coincidencias no ofrecen un firmware diferente como sustituto.

La ampliación se documenta en [historial Samsung](research/samsung-history-acquisition.json) e [historial Xiaomi](research/xiaomi-history-acquisition.json). Los índices externos solo sirven para descubrir enlaces; los binarios se extraen de los servidores del fabricante y se comprueban antes de publicarlos. Los duplicados y fallos quedan registrados sin incrementar el contador.

Muestra de versiones incluidas (el inventario anterior es el listado completo):

| Modelo / variante | Región | Firmware | Registro |
| --- | --- | --- | --- |
| Galaxy A05 · SM-A055F | XSG | A055FXXSHDZF1 | [Samsung F](downloads/preloader_SM-A055F_A055FXXSHDZF1_XSG.json) |
| Galaxy A05 · SM-A055M | CHO | A055MUBSJDZF1 | [Samsung M](downloads/preloader_SM-A055M_A055MUBSJDZF1_CHO.json) |
| Redmi 13C / POCO C65 · gale | India | V14.0.5.0.TGPINXM | [gale India](downloads/provenance.json) |
| Redmi 13C / POCO C65 · gale | Global | OS2.0.208.0.VGPMIXM | [gale Global](downloads/gale-global-hyperos2.json) |
| Redmi 12 · fire | Global | V14.0.9.0.TMXMIXM | [fire](downloads/fire-global-miui14.json) |
| POCO C55 · earth | India | OS1.0.13.0.UCVINXM | [earth](downloads/earth-india-hyperos1.json) |
| Redmi Note 13 5G · gold | Global | OS3.0.5.0.VNQMIXM | [gold](downloads/gold-global-hyperos3.json) |
| Galaxy A07 5G · SM-A076E | XSG | A076EXXS5BZI3 | [A076E](downloads/preloader_SM-A076E_A076EXXS5BZI3_XSG.json) |
| Galaxy A07 5G · SM-A076M | CHO | A076MXXS4BZH1 | [A076M](downloads/preloader_SM-A076M_A076MXXS4BZH1_CHO.json) |
| Galaxy A15 · SM-A155M | CHO | A155MUBSBEZG1 | [A155M](downloads/preloader_SM-A155M_A155MUBSBEZG1_CHO.json) |
| Galaxy A15 5G · SM-A1560 | TGY | A1560ZHSAEZG1 | [A1560](downloads/preloader_SM-A1560_A1560ZHSAEZG1_TGY.json) |
| Galaxy A15 5G · SM-A156E | INS | A156EDXSAEZG1 | [A156E](downloads/preloader_SM-A156E_A156EDXSAEZG1_INS.json) |
| Galaxy A16 · SM-A165F | XSG | A165FXXSBDZH6 | [A165F](downloads/preloader_SM-A165F_A165FXXSBDZH6_XSG.json) |
| Galaxy Tab A7 Lite · SM-T225 | INS | T225XXSBEYE4 | [T225](downloads/preloader_SM-T225_T225XXSBEYE4_INS.json) |
| POCO C50 · ice | India | V13.0.17.0.SGMINXM | [ice](downloads/ice-india-miui13.json) |
| POCO M4 5G · light | Global | OS1.0.7.0.ULSMIXM | [light](downloads/light-global-hyperos1.json) |
| OnePlus Nord 2 · DN2103 | EEA | DN2103_11_F.50 | [Nord 2](downloads/nord2-eea-f50.json) |
| Realme 10 4G · RMX3630 | EEA | RMX3630_14.0.0.2302(EX01) | [Realme 10](downloads/realme10-eea-2302.json) |
| Realme 11 5G · RMX3780 | EEA | RMX3780_15.0.0.110(EX01) | [Realme 11 5G](downloads/realme11-eea-110.json) |
| Realme 11 4G · RMX3636 | EX01, región sin confirmar | RMX3636_15.0.0.1910(EX01) | [Realme 11 4G](downloads/realme11-4g-ex01-1910.json) |
| Realme C67 5G · RMX3782 | EX01, región sin confirmar | RMX3782_11_A.58 | [C67 5G](downloads/realme-c67-5g-a58.json) |
| Realme 12X 5G · RMX3998 | India | RMX3998_11_C.40 / 15.0.0.930(EX01) | [12X](downloads/realme12x-in-c40.json) |

Las imágenes conservan la partición completa, cabeceras y relleno; no se recortan, parchean ni se convierten en loaders de desbloqueo. **No se han probado en TSM ni en un teléfono.** Un archivo original no garantiza que su formato sea aceptado por TSM, ni que sirva para otras regiones, binarios o revisiones. Un preloader incorrecto puede impedir el arranque. No todos los chipsets utilizan preloader MediaTek.

Samsung: descarga HTTPS autenticada mediante el protocolo público de FUS, descifrado ENC4 y extracción del componente BL. Se comprueban CRC32 del ZIP, MD5 del TAR, cabeceras TAR, tamaño y checksums LZ4. El SHA-256 del archivo final se calcula localmente; no es un digest publicado por Samsung. Los enlaces FUS requieren sesión; la página ofrece descarga local y ficha del fabricante.

Xiaomi: descarga por rangos de una OTA completa desde `bigota.d.miui.com`. Se comprueban el dispositivo/build del paquete y el SHA-256 de cada bloque y de la partición final contra el manifiesto. `gold` incluye `preloader_raw`; `earth` usa internamente el build `V816.0.13.0.UCVINXM`, registrado junto al nombre comercial HyperOS.

Realme/OnePlus: paquetes públicos de los CDN del fabricante `allawnofs.com`. Para las OTA con payload se comprueban los hashes del manifiesto; para imágenes separadas dentro de ZIP se verifican tamaño y CRC32, y se calcula el SHA-256 local. En los ZIP stock se contrastan el modelo, dispositivo, firmware y build con `build.prop`. No se ejecutan los scripts incluidos en el firmware. Nord 2 conserva `preloader_ufs.img`; C67 y 12X conservan `IMAGES/preloader_raw.img`. No se publica la imagen alternativa `bootrom_off`. EX01 no se considera una autorización para usar el archivo en cualquier región.

La revisión del X7 Pro RMX2121 encontró un contenedor OFP, sin preloader directamente extraíble con el método implementado. El paquete revisado de Oppo A94 CPH2211 solo contiene el componente `my_manifest`, no un preloader. Ninguno se habilitó como descarga.

En ninguno de los casos se ha validado independientemente la firma criptográfica del paquete completo. Los archivos históricos no se presentan como la última versión disponible. Las demás descargas quedan pendientes, sin enlaces inventados.

## Reproducción y pruebas

La interfaz no requiere instalar nada. Para las herramientas: Node.js 24+, Edge en Windows; 7-Zip para extraer bloques XZ de las OTA. La única dependencia de desarrollo es `lz4js`, fijada en `package-lock.json`.

```powershell
npm.cmd ci --ignore-scripts
npm.cmd test
node scripts/acquire-xiaomi.cjs fire-global-miui14
node scripts/acquire-xiaomi.cjs gale-global-hyperos2
node scripts/acquire-xiaomi.cjs earth-india-hyperos1
node scripts/acquire-xiaomi.cjs gold-global-hyperos3
node scripts/acquire-xiaomi.cjs realme11-4g-ex01-1910
node scripts/acquire-xiaomi.cjs realme-c67-5g-a58
node scripts/acquire-xiaomi.cjs realme12x-in-c40
node scripts/acquire-xiaomi.cjs nord2-eea-f50 --inspect
node scripts/acquire-samsung-history.cjs
node scripts/acquire-xiaomi-history.cjs
node scripts/acquire-samsung.cjs SM-A055F XSG A055FXXSHDZF1/A055FOJMHDZF1/A055FXXSHDZF1
node scripts/acquire-samsung.cjs SM-A055M CHO A055MUBSJDZF1/A055MOWBJDZF1/A055MUBSJDZF1
```

Los scripts tienen límites de descarga y abortan ante discrepancias. No se conectan a teléfonos ni escriben particiones. `research/ota-sources.json` contiene las fuentes revisadas. `scripts/extract-preloader.cjs` reproduce la primera extracción gale desde los rangos temporales conservados en la raíz. Adquirir otro archivo no lo publica automáticamente: debe revisarse e incorporarse a `fileCatalog` en `index.html` con su procedencia.

`scripts/acquire-xiaomi.cjs` conserva su nombre histórico, pero también admite los CDN de Realme/OnePlus/Oppo indicados explícitamente. `--inspect` consulta el contenido sin guardar binarios. `scripts/scan-samsung-preloaders.cjs` recorre los códigos Samsung y conserva resultados para reanudar. Los scripts `acquire-*-history.cjs` reanudan sus auditorías, descartan duplicados y se detienen al alcanzar el límite configurado de 110 archivos en la biblioteca; no intentan descargar las OTA completas. `research/xiaomi-history-sources.json` conserva los candidatos para una revisión posterior.

`scripts/catalog-patch.cjs 25` comprueba tamaño/hash y correspondencia con modelos, rechaza duplicados y emite un parche de hasta 25 archivos para revisar y aplicar; `scripts/coverage-patch.cjs` hace lo mismo con los estados de la auditoría. No ejecutan ni aplican sus parches automáticamente. Después de publicar cambios, ejecuta `node scripts/library-index.cjs` para regenerar el inventario y `npm.cmd test` para comprobarlo. Las pruebas exigen más de 100 binarios distintos, todos presentes y con SHA-256 correcto.

Las pruebas verifican anchos de 320/390/768/1440 px, búsqueda, variantes, descarga real en Edge, hashes de todos los archivos, enlaces pendientes, teclado, paginación y ausencia de solicitudes externas de la página. Las capturas y descargas de prueba están en `.artifacts/`.

## Referencias técnicas

- Asociación de plataformas Xiaomi: [repositorio oficial MiCode](https://github.com/MiCode/Xiaomi_Kernel_OpenSource).
- Formato de OTA: [AOSP update_metadata.proto](https://android.googlesource.com/platform/system/update_engine/+/refs/heads/main/update_metadata.proto).
- Protocolo FUS actual: [samloader-rs](https://github.com/topjohnwu/samloader-rs), Copyright 2026 John “topjohnwu” Wu, Apache-2.0.
- Referencia histórica FUS: [samloader](https://github.com/samloader/samloader), Copyright 2020 nlscc, GPL-3.0. El ayudante `samsung-fus.cjs` conserva su aviso GPL-3.0-or-later.
- Descompresión: [lz4js](https://github.com/Benzinga/lz4js), licencia indicada en su paquete. El envoltorio añade controles de tamaño y checksum que la biblioteca no comprueba por sí sola.

Las herramientas de terceros no certifican el firmware ni están vinculadas oficialmente con Samsung, Xiaomi o TSM. Revisa las condiciones de redistribución del fabricante antes de publicar los binarios en un sitio público.
