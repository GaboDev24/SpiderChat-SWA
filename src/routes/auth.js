'use strict';

/**
 * SpiderChat — Rutas de Autenticacion Local
 *
 * POST /auth/login    -> Inicia sesión
 * POST /auth/register -> Registra nuevo usuario
 * GET  /auth/logout   -> Cierra la sesion
 * GET  /auth/me       -> Datos del usuario actual
 */

const express = require('express');
const passport = require('../auth');
const bcrypt = require('bcryptjs');
const db = require('../db');
const router = express.Router();

function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'No autenticado' });
}

// Registro
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (!email.endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Solo se permiten cuentas de Gmail (@gmail.com)' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const existingUser = db.getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = db.createUser(email, passwordHash, name);

    req.login(newUser, (err) => {
      if (err) return next(err);
      res.json({ ok: true, user: { id: newUser.id, name: newUser.name, email: newUser.email } });
    });
  } catch (err) {
    next(err);
  }
});

// Login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      return res.status(401).json({ error: info?.message || 'Acceso denegado' });
    }
    
    // Validación de gmail (por si algún usuario entró saltándose en versiones pasadas)
    if (!user.email.endsWith('@gmail.com')) {
      return res.status(401).json({ error: 'Solo se permiten cuentas de Gmail (@gmail.com)' });
    }

    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
    });
  })(req, res, next);
});

// Logout
router.get('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.redirect('/login');
    });
  });
});

// Retorna los datos del usuario actual
router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: null, // Ya no hay avatar de Google
    tokens_remaining: user.tokens_remaining,
    daily_calls_used: user.daily_calls_used,
  });
});

module.exports = { router, requireAuth };
