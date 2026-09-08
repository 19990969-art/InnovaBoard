# InnovaBoard – Área de Lenguaje

Versión preparada para subir a GitHub y desplegar como aplicación Node/Express.

## 1. Probar en VS Code

```bash
npm install
npm start
```

Abrir: `http://localhost:3000`

## 2. Subir a GitHub

Crea un repositorio nuevo en GitHub y sube **el contenido de esta carpeta**.

Desde la terminal:

```bash
git init
git add .
git commit -m "InnovaBoard Lenguaje"
git branch -M main
git remote add origin TU_REPOSITORIO_DE_GITHUB
git push -u origin main
```

## 3. Obtener un enlace público

GitHub por sí solo no ejecuta `server.js`. Para tener un enlace que abra la aplicación, conecta este repositorio a un servicio de hosting Node/Express (por ejemplo, Render).

La configuración `render.yaml` ya incluye:
- Build: `npm install`
- Start: `npm start`
- Health check: `/`

En el hosting, selecciona el repositorio y despliega. El servicio generará una URL pública `https://...`.

## Importante sobre SQLite

SQLite funciona para una demostración, pero muchos hostings pueden usar almacenamiento efímero. Si necesitas que el progreso permanezca después de reinicios o nuevos despliegues, conviene migrar la base de datos a un servicio persistente.

## Nota

Esta versión corresponde únicamente al Área de Lenguaje y usa su propia base SQLite de demostración. No reemplaza ni modifica la base de datos principal de InnovaBoard.
