# SpiderChat

Plataforma de Chat impulsada por IA utilizando la **SpiderWebARG API** como backend de inteligencia artificial y almacenamiento seguro de datos en la nube.

## Características Principales
- **Autenticación Segura**: Utiliza credenciales cifradas, permitiendo el acceso de forma controlada a cuentas de correo predefinidas.
- **Control de Consumo**: 
  - Gestión eficiente de recursos con límite total de tokens por usuario.
  - Límite diario de llamadas a la IA (renovable automáticamente).
- **Diseño Moderno e Intuitivo**: Interfaz fluida, de aspecto profesional y soporte nativo para modos claro y oscuro.
- **Auto-Guardado en la Nube**: Las conversaciones se guardan de forma automática en nuestra base de datos remota y pueden ser consultadas o retomadas en cualquier momento.
- **Arquitectura Escalable**: Módulos limpios e integrados para interactuar fluidamente con la infraestructura de SpiderWebARG (Bases de datos SQL e IA).

---

## Estructura del Sistema

El sistema consta de dos componentes principales:
1. **Cliente API / SDK**: Módulos dedicados en `api-client/` para la comunicación segura con los servicios de SpiderWebARG.
2. **Aplicación Web**: 
   - Backend robusto construido con Node.js y Express (`src/server.js`).
   - Capa de datos conectada mediante SQL remoto (`src/db.js`).
   - Frontend optimizado, con un diseño inspirado en paneles de control y gestión profesionales.

---

## Requisitos Previos

1. **Node.js**: Versión 18.0.0 o superior.
2. **API Key de SpiderWebARG**: Necesaria para interactuar con los modelos de IA y la base de datos remota.

---

## Instalación y Configuración

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
   - Añade tu `API_KEY` proporcionada por SpiderWebARG.
   - Define el `DATABASE_NAME` asignado a tu proyecto.
   - Genera una clave segura para `SESSION_SECRET` (puedes usar `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` en tu terminal).

---

## Ejecución

Para iniciar el servidor en entorno de desarrollo:
```bash
npm run dev
```

Para entorno de producción:
```bash
npm start
```

Accede desde tu navegador a: **http://localhost:3000**

---

## Gestión de la Base de Datos

La aplicación utiliza la infraestructura de datos SQL remota provista por SpiderWebARG. Las tablas necesarias (`users`, `chats`, `chat_messages`, `sessions`) se inicializan automáticamente al iniciar el servidor por primera vez, garantizando una puesta en marcha rápida y sin complicaciones para el usuario.
