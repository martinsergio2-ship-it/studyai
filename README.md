# StudyAI v3 — Firebase + planificador gratuito

Aplicación web adaptable a móvil y ordenador. Incluye:
- Panel de inicio y estadísticas.
- Asignaturas, temas y seguimiento de progreso.
- Registro de exámenes y tareas.
- Horario semanal y preferencias de estudio.
- Chat académico local basado en tus datos.
- Generador y reorganizador de sesiones de estudio.
- Firebase Authentication y Cloud Firestore para sincronizar tu cuenta entre dispositivos.
- Modo claro/oscuro y PWA instalable.

## Qué hace el asistente gratuito

El chat analiza los datos que ya están guardados en tu cuenta: asignaturas, temas pendientes, exámenes, tareas y disponibilidad. Puede resumir el progreso, listar próximos exámenes, sugerir qué hacer hoy y generar/reorganizar sesiones. El planificador prioriza las materias con exámenes próximos y crea tareas con fecha y hora dentro de los bloques de disponibilidad configurados.

**Limitación importante:** esta versión no conecta con un modelo generativo como ChatGPT. Utiliza reglas locales deterministas; por tanto, no puede explicar cualquier materia con la flexibilidad de un modelo de lenguaje. No realiza llamadas de pago ni necesita una clave API.

## Configuración Firebase

La aplicación está configurada para el proyecto Firebase `studyai-39d68` y usa Firebase JS SDK modular 13.2.0. En Firebase Console:
1. Authentication → Proveedores de acceso → activa Correo electrónico/contraseña.
2. Firestore Database → Reglas: permite a cada usuario acceder solo a `users/{uid}/...` cuando `request.auth.uid == uid`.
3. Authentication → Settings → Authorized domains: incluye el host de GitHub Pages (por ejemplo, `tuusuario.github.io`).

Reglas de referencia:

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

La configuración web de Firebase identifica el proyecto; la protección real de los datos depende de Authentication y las reglas de Firestore. No añadas claves privadas de servicios externos al JavaScript público.

## Publicar la actualización

1. Descomprime el ZIP.
2. Abre la carpeta `StudyAI` y sube sus archivos directamente a la raíz del repositorio GitHub `studyai`, reemplazando los anteriores.
3. Confirma los cambios (Commit changes) en la rama `main`.
4. Espera a que GitHub Pages termine el despliegue.
5. Abre la web y fuerza la recarga con `Ctrl + Shift + R`.

El service worker usa la caché `studyai-v3-planner` para evitar servir los archivos antiguos.

## Datos y privacidad

Los datos académicos se guardan en Firestore en `users/{uid}/appData/main`. El chat local no envía el contenido de la cuenta a ningún proveedor de IA. No introduzcas contraseñas ni información personal sensible en los campos académicos.
