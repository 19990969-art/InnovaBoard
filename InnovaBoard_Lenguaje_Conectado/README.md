# InnovaBoard - Área de Lenguaje conectada a SQLite

Esta versión reemplaza `localStorage` por la API de Express y SQLite.

## Ejecutar

```powershell
npm.cmd install
npm.cmd start
```

Abrir: http://localhost:3000/

## Usuario demo

Correo: `estudiante@innovaboard.local`
Contraseña: `123456`

## Qué queda guardado en SQLite

- Usuario y sesión.
- Lecciones completadas.
- Actividades realizadas.
- Puntos calculados desde el progreso.
- Insignias calculadas desde el progreso.
- Tiempo de estudio.
- Asistencia a clases.

## Integración con el InnovaBoard principal

El archivo `database.js` de esta demo define las tablas necesarias. Para conectar al proyecto principal, hay que conservar la base de datos principal y adaptar las consultas de `server.js` a sus nombres de tablas/campos reales. No se debe reemplazar la base principal sin respaldo.
