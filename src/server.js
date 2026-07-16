'use strict';

/**
 * SpiderChat — Servidor Principal Express
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('./auth');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Validar variables criticas al inicio
if (!process.env.SESSION_SECRET) {
  console.warn('[Server] ADVERTENCIA: SESSION_SECRET no definida. Usando valor inseguro por defecto.');
}

// ── Middlewares globales ──────────────────────────────────────────────────

// Parsear JSON y urlencoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const SqlSessionStore = require('./session-store');

// Sesiones
app.use(session({
  store: new SqlSessionStore(),
  secret: process.env.SESSION_SECRET || 'spiderchat-dev-secret-inseguro',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
  },
}));

// Inicializar Passport con soporte de sesion
app.use(passport.initialize());
app.use(passport.session());

// Servir archivos estaticos desde /public
app.use(express.static(path.join(__dirname, '..', 'public')));

// ── Rutas ─────────────────────────────────────────────────────────────────

const { router: authRouter, requireAuth } = require('./routes/auth');
const chatRouter = require('./routes/chat');
const userRouter = require('./routes/user');

app.use('/auth', authRouter);
app.use('/api/chat', chatRouter);
app.use('/api/user', userRouter);

// ── Paginas HTML ──────────────────────────────────────────────────────────

const viewsDir = path.join(__dirname, '..', 'views');

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(viewsDir, 'index.html'));
});

app.get('/login', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(viewsDir, 'login.html'));
});

app.get('/register', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/chat');
  res.sendFile(path.join(viewsDir, 'register.html'));
});

app.get('/chat', requireAuth, (req, res) => {
  res.sendFile(path.join(viewsDir, 'chat.html'));
});

// ── Manejo de errores ─────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  const isDev = process.env.NODE_ENV !== 'production';
  console.error('[Server Error]', err.message);
  res.status(err.status || 500).json({
    error: 'Error interno del servidor',
    detalle: isDev ? err.message : undefined,
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ── Inicio del servidor ───────────────────────────────────────────────────

const { initDB } = require('./db');

// Inicializar tablas al arrancar — en Vercel se ejecuta en cada cold start.
// Si falla, el servidor sigue iniciando (las rutas de DB devolverán 500
// hasta que se corrijan las variables de entorno en el panel de Vercel).
initDB()
  .then(() => console.log('[DB] Listo.'))
  .catch(err => console.error('[DB] initDB falló (verificar env vars en Vercel):', err.message));

app.listen(PORT, () => {
  console.log(`[SpiderChat] Servidor corriendo en http://localhost:${PORT}`);
  console.log(`[SpiderChat] Entorno: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
