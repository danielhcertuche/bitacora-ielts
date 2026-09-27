# Bitácora IELTS

Aplicación web estática para preparar el IELTS Academic: plan diario según el tiempo disponible,
práctica de Writing (Task 1 y Task 2) y Speaking (Parts 1–3), registro por voz y seguimiento del progreso.

Funciona sin conexión una vez abierta (service worker) y no necesita servidor.

## Almacenamiento

- **Dispositivo**: todo se guarda primero en `localStorage` e IndexedDB.
- **Google Drive** (opcional): la bitácora y los audios se sincronizan con el Drive de quien la usa,
  en la carpeta `Bitácora IELTS`. Usa el permiso `drive.file`, que sólo da acceso a los archivos que
  la propia app crea. La fusión une entradas de varios dispositivos y respeta los borrados. El avance de las tarjetas viaja con la bitácora y se fusiona carta por carta.
- **Contenido privado**: `privado/*.enc` va cifrado con AES-GCM 256; la clave se deriva de una frase
  de paso con PBKDF2-SHA256 (310 000 iteraciones). Sin la frase, esos archivos no se pueden leer.

## Registro por voz

El botón de micrófono transcribe con la Web Speech API del navegador y `voz.js` convierte la frase en
entradas («veinte minutos de task 2 y tarjetas quince» → dos actividades con sus minutos), que se
confirman antes de guardarse. Sin conexión, la nota se graba y se sube a Drive al recuperar la señal.

## Configuración

`config.js` recibe el identificador de cliente OAuth de Google (tipo *Aplicación web*, con el origen
de GitHub Pages autorizado). Vacío, la app funciona igual y guarda sólo en el dispositivo.

## Estructura

| Archivo | Función |
|---|---|
| `index.html`, `estilos.css` | interfaz |
| `app.js` | estado, sincronización, plan, Writing, Speaking, progreso |
| `contenido.js` | actividades, planes y consignas |
| `voz.js` | intérprete de notas dictadas |
| `metricas.js` | métricas de discurso (conectores, hedges, vaguedad, cierres) |
| `drive.js` | cliente de Google Drive |
| `cripto.js` | cifrado del contenido privado |
| `sw.js` | caché sin conexión |
