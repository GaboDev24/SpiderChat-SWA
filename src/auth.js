'use strict';

/**
 * SpiderChat — Configuración de Autenticación Local
 *
 * Usa Passport.js con la estrategia Local.
 * Se validan credenciales (email y password) usando bcryptjs.
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./db');

// Guarda solo el ID en la cookie de sesion
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Recupera el usuario completo de la BD (async via callback)
passport.deserializeUser(async (id, done) => {
  try {
    const user = await db.getUserById(id);
    if (!user) return done(null, false);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// Estrategia Local
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        const user = await db.getUserByEmail(email);
        if (!user) {
          return done(null, false, { message: 'Correo o contraseña incorrectos' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
          return done(null, false, { message: 'Correo o contraseña incorrectos' });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
