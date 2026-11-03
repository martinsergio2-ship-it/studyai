# StudyAI — primera versión

Aplicación web adaptable a móvil y ordenador. Incluye:
- Panel de inicio y estadísticas.
- Asignaturas y temas con seguimiento.
- Registro de exámenes y tareas.
- Horario semanal y preferencias de estudio.
- Selector de modo claro/oscuro.
- PWA instalable.
- Guardado local en el navegador.

## Probarla
Abre `index.html` en un navegador moderno. Para probar la instalación PWA y el modo offline, publícala en GitHub Pages o utiliza un servidor local HTTPS/localhost.

## Importante sobre los datos
Esta primera versión guarda los datos en el navegador del dispositivo (localStorage). No se sincronizan todavía entre iPhone y ordenador. La sincronización Firebase y la IA conectada son la siguiente fase. No introduzcas claves API en `app.js` ni en ningún archivo público.

## Publicar en GitHub Pages
1. Crea un repositorio nuevo llamado `studyai`.
2. Sube todos los archivos de esta carpeta a la raíz del repositorio.
3. En Settings → Pages, selecciona Deploy from a branch, `main` y `/ (root)`.
4. Abre la URL que GitHub Pages te proporcione.

## Próxima fase
- Firebase Authentication + Firestore para sincronización entre dispositivos.
- Reglas de seguridad de Firestore para que cada usuario solo lea y escriba sus datos.
- Backend seguro (por ejemplo, Cloud Functions) para conectar el modelo de IA sin exponer secretos.
- IA con herramientas para crear, modificar y reprogramar tareas a partir del horario, los exámenes y los temarios.
