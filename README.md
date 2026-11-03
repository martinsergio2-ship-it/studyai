# StudyAI v4 — Horario + Google

Aplicación web de estudio para móvil y ordenador. Incluye:

- Inicio de sesión con Google o correo y contraseña mediante Firebase Authentication.
- Sincronización con Cloud Firestore.
- Asignaturas, temas, exámenes, entregas y seguimiento del progreso.
- Entrevista por asignatura sobre temas difíciles, dominio, énfasis del profesor y horas estimadas hasta la próxima evaluación.
- Planificador que coloca el estudio antes de los exámenes y el trabajo antes de las entregas.
- Horario semanal con disponibilidad y actividades fijas, descansos configurables y límite diario de estudio.
- Asistente académico gratuito con chat local basado en reglas.
- Apariencia clara u oscura y PWA instalable.

## Qué significa «Asistente IA»

El planificador y el chat aplican reglas locales deterministas a los datos de la cuenta. **No usan un LLM generativo como ChatGPT**, no envían los datos académicos a un proveedor de IA y no requieren una clave API. Organizan la carga y responden consultas sencillas sobre el progreso; no redactan explicaciones abiertas de cualquier asignatura.

## Firebase y conservación de datos

La aplicación conserva el proyecto Firebase `studyai-39d68`, Firebase Authentication y la ruta de Firestore existente `users/{uid}/appData/main`. La actualización no crea otra base de datos, no borra documentos y no ejecuta migraciones destructivas. Las nuevas respuestas de entrevista, la estimación de trabajo y las preferencias se guardan junto con los datos existentes.

En Firebase Console comprueba que estén activos los proveedores **Google** y **Correo electrónico/contraseña**. En Authentication → Settings, añade el dominio de GitHub Pages (por ejemplo, `tuusuario.github.io`) a los dominios autorizados. Firebase recomienda autorizar el dominio desde el que se sirve la aplicación para los flujos de inicio de sesión con Google: [documentación de Firebase](https://firebase.google.com/docs/auth/web/google-signin).

Reglas de Firestore de referencia para que cada cuenta acceda solamente a sus propios datos:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

Las reglas existentes deben mantener la comprobación del usuario autenticado y su UID, según la [guía de seguridad de Firebase](https://firebase.google.com/docs/firestore/security/rules-conditions). No uses reglas abiertas para publicar la aplicación.

## Publicar en GitHub Pages

1. Descarga y descomprime el ZIP actualizado.
2. Abre la carpeta `StudyAI` que contiene `index.html`.
3. Sube **el contenido de esa carpeta** a la raíz del repositorio existente de StudyAI en GitHub, incluyendo `index.html`, `app.js`, `planner.mjs`, `sw.js`, `manifest.webmanifest` e `icon.svg`. Conserva los archivos del repositorio que no formen parte de esta app.
4. Confirma los cambios en la rama `main`.
5. En el repositorio, ve a **Settings → Pages**. En **Build and deployment**, selecciona **Deploy from a branch**, elige `main` y `/(root)`, y pulsa **Save**. GitHub Pages publicará el contenido de la rama y carpeta elegidas; consulta la [guía oficial de publicación](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
6. Espera a que el despliegue termine y abre la dirección que aparece en Settings → Pages. Si el sitio ya estaba publicado desde `main` y la raíz, el nuevo commit activa el despliegue.
7. En Firebase Authentication, confirma que el dominio `tuusuario.github.io` está autorizado. Después, recarga la aplicación con `Ctrl + Shift + R`.

GitHub Pages publica un sitio estático. En un repositorio de proyecto la dirección suele tener la forma `https://tuusuario.github.io/nombre-del-repositorio/`; el dominio permitido en Firebase es el host `tuusuario.github.io`.

## Pruebas locales del planificador

Con Node.js instalado, desde la carpeta `StudyAI` ejecuta:

```bash
node --test tests/planner.test.mjs
node --check app.js
node --check planner.mjs
```

Las pruebas incluyen un examen de Química el jueves, una tarea que se entrega el jueves, actividades fijas, pausas, carga diaria máxima y conservación de los datos de entrada.
