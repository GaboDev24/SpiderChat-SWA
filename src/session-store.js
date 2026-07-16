'use strict';

/**
 * SpiderChat — Session Store SQL
 *
 * Implementa un store de sesiones compatible con express-session
 * usando la misma base de datos SQL remota (SpiderWebARG API).
 * Esto resuelve el problema de sesiones perdidas en entornos
 * serverless como Vercel, donde el MemoryStore no persiste.
 */

require('dotenv').config();
const { Store } = require('express-session');
const { sql } = require('../api-client');

const DB = process.env.DATABASE_NAME;

// ── Helper ──────────────────────────────────────────────────────────────

async function sqlQuery(sqlStr, params = []) {
  const res = await sql.query(DB, sqlStr, params);
  const result = res?.result ?? res;
  return Array.isArray(result) ? result : [];
}

// ── SqlSessionStore ─────────────────────────────────────────────────────

class SqlSessionStore extends Store {
  constructor(options = {}) {
    super(options);
    // Limpieza automática de sesiones expiradas cada 15 minutos
    this._cleanupInterval = setInterval(() => this._cleanup(), 15 * 60 * 1000);
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  /**
   * Obtiene una sesión por ID.
   */
  get(sid, callback) {
    sqlQuery(
      'SELECT data FROM sessions WHERE sid = ? AND expires > NOW() LIMIT 1',
      [sid]
    )
      .then(rows => {
        if (!rows[0]) return callback(null, null);
        try {
          callback(null, JSON.parse(rows[0].data));
        } catch {
          callback(null, null);
        }
      })
      .catch(err => callback(err));
  }

  /**
   * Guarda o actualiza una sesión.
   */
  set(sid, session, callback) {
    const maxAge   = session.cookie?.maxAge   ?? 7 * 24 * 60 * 60 * 1000;
    const expires  = new Date(Date.now() + maxAge)
      .toISOString().slice(0, 19).replace('T', ' ');
    const data = JSON.stringify(session);

    sqlQuery(
      'REPLACE INTO sessions (sid, data, expires) VALUES (?, ?, ?)',
      [sid, data, expires]
    )
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  /**
   * Elimina una sesión.
   */
  destroy(sid, callback) {
    sqlQuery('DELETE FROM sessions WHERE sid = ?', [sid])
      .then(() => callback(null))
      .catch(err => callback(err));
  }

  /**
   * Renueva el TTL de una sesión existente.
   */
  touch(sid, session, callback) {
    this.set(sid, session, callback);
  }

  /**
   * Elimina sesiones expiradas de la BD.
   */
  _cleanup() {
    sqlQuery('DELETE FROM sessions WHERE expires <= NOW()')
      .catch(() => {});
  }
}

module.exports = SqlSessionStore;
