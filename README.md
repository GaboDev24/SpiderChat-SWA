# SpiderWeb Chat

Aplicacion de Chat impulsada por IA utilizando la **SpiderWebARG API** como backend de inteligencia artificial y almacenamiento (opcional) y SQLite local para la persistencia de usuarios y limites.

Implementa un sistema tactico de autenticacion restringido unicamente a cuentas de `@gmail.com` via Google OAuth 2.0.

## Caracteristicas
- **Autenticacion Segura**: Utiliza `passport-local` con contraseñas cifradas con `bcryptjs`, restringido únicamente a cuentas de `@gmail.com`.
- **Control de Limites**: 
  - Limite total de 50.000 tokens por usuario.
  - Limite de 50 llamadas a la IA por dia (renovables a la medianoche).
- **Diseño Tactico**: Interfaz fluida, de aspecto tactico y dark mode/light mode nativo.
- **Auto-Guardado**: Las conversaciones se guardan automaticamente en SQLite y pueden consultarse desde el sidebar.
- **SDK Integrado**: Modulos limpios para interactuar con SpiderWebARG API (SQL, Storage, IA).

---

## Estructura

El sistema consta de dos grandes partes:
1. **SDK / Cliente API**: Modulos en `api-client/` (client, sql, storage, ia) para comunicarse con SpiderWebARG.
2. **Aplicacion Web**: 
   - Backend con Node.js y Express (`src/server.js`)
   - Capa de datos en SQLite local (`src/db.js`)
   - Frontend con Javascript vanilla, diseño inspirado en un "Centro de Comando" (tactico).

---

## Requisitos Previos

1. **Node.js**: Version 18.0.0 o superior.
2. **API Key de SpiderWebARG**: Necesaria para interactuar con los modelos de IA.

---

## Instalacion y Configuracion

1. **Clonar e instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   Copia el archivo de ejemplo `.env.example` a un nuevo archivo `.env`:
   ```bash
   cp .env.example .env
   ```

3. **Completar el `.env`:**
   - Añade tu `API_KEY` de SpiderWebARG.
   - Genera una clave segura para `SESSION_SECRET`. (Puedes usar `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` en tu terminal).

---

## Ejecucion

Para iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

Para entorno de produccion:
```bash
npm start
```

Ingresa en tu navegador a: **http://localhost:3000**

---

## Sobre la Base de Datos
La aplicacion utiliza SQLite (`better-sqlite3`) y crea un archivo de forma automatica en la ruta `data/spiderchat.db`.
Si deseas reiniciar la base de datos o todos los usuarios, basta con detener el servidor y eliminar ese archivo.
