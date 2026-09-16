# Contribuir a UnLockPre

Gracias por ayudar a mejorar la biblioteca. Las contribuciones deben mantener trazabilidad y no deben incluir archivos modificados o de procedencia desconocida.

## Para proponer un archivo

1. Abre un Issue indicando marca, modelo/variante, región, firmware y fuente.
2. Incluye el SHA-256 y tamaño del archivo.
3. Adjunta o referencia el JSON de procedencia correspondiente.
4. No reemplaces un archivo existente sin explicar por qué cambia el hash.

## Reglas

- No publiques datos personales, credenciales, tokens ni claves.
- No presentes compatibilidad con UnlockTool/TSM Tool como verificada si no existe una prueba documentada.
- No elimines advertencias, procedencia ni hashes.
- Un Pull Request debe pasar `npm test` y `npm run catalog:build` sin inconsistencias.

Los mantenedores pueden rechazar archivos duplicados, incompletos o sin trazabilidad suficiente.
