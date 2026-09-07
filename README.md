# starseeked

Primera versión web de un reproductor de música personalizable con temática de cielo.

## Cómo abrirlo

Abre `index.html` en un navegador moderno. No necesita instalación ni servidor.

## Qué incluye esta versión

- Diseño responsive para ordenador y móvil.
- Importación de archivos de audio y vídeo locales, incluidos MP3 y MP4 compatibles con el navegador.
- Copia automática de las canciones al almacenamiento privado de la app mediante IndexedDB para conservar la biblioteca al recargar.
- Reproducción, pausa, anterior, siguiente, progreso y volumen.
- Reproducción aleatoria y repetición.
- Búsqueda dentro de la biblioteca.
- Favoritos y listas de reproducción persistentes: crea listas, filtra su contenido y añade canciones desde la biblioteca.
- Edición local del título, artista y álbum de cada canción.
- Portadas personalizadas por canción, guardadas en la biblioteca local y visibles en el reproductor y controles multimedia.
- Borrado de canciones desde la biblioteca: elimina la copia interna y sus referencias en listas y cola, sin tocar el archivo original.
- Cola de reproducción completa: añadir, quitar, reordenar con flechas, vaciar y reproducir desde la cola.
- Ocho atmósferas: despejado, amanecer, noche, aurora, nublado, violeta, fucsia y tiempo real.
- Modo “Tiempo real”: cambia entre cielo despejado, nublado, amanecer y noche según la hora del dispositivo, actualizándose automáticamente.
- Editor de color de acento, fondo animado y reducción de movimiento.
- Creador de temas personalizados con colores, imagen de fondo y guardado local.
- Guardado del tema elegido en el navegador.
- Widget de reproducción móvil táctil con progreso, volumen, anterior, siguiente y reproducir/pausar.
- Media Session para mostrar título y controles en la pantalla bloqueada y en las notificaciones del móvil.
- Estructura PWA instalable con `manifest.webmanifest` y caché offline del interfaz.

La música se mantiene local: el navegador necesita que el usuario seleccione los archivos y no sube nada a internet. La app guarda una copia en su almacenamiento privado, pero no borra el archivo original de la carpeta del dispositivo.

El APK Android se genera mediante Capacitor desde GitHub Actions. La versión web y la versión Android comparten la misma biblioteca local del dispositivo.

Para instalarla como PWA y usar los controles de bloqueo, debe abrirse desde una dirección `https://` o desde `localhost`; al abrir `index.html` directamente como archivo local, los navegadores bloquean el service worker. La reproducción con pantalla apagada depende del soporte del navegador y del sistema operativo.
