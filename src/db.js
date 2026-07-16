'use strict';

/**
 * SpiderChat — Capa de Datos (SpiderWebARG SQL)
 *
 * Reemplaza el storage JSON local por la base de datos SQL remota
 * configurada en DATABASE_NAME del archivo .env.
 */

require('dotenv').config();
const { sql } = require('../api-client');

const DB = process.env.DATABASE_NAME;
const TOKEN_LIMIT      = parseInt(process.env.USER_TOKEN_LIMIT   || '50000', 10);
const DAILY_CALL_LIMIT = parseInt(process.env.USER_DAILY_CALL_LIMIT || '50', 10);

if (!DB) {
  throw new Error('[DB] Variable de entorno DATABASE_NAME no definida.');
}

// ── Helper ────────────────────────────────────────────────────────────────

/**
 * Ejecuta una query SQL y devuelve el resultado normalizado.
 * @param {string} sqlStr  Sentencia SQL
 * @param {Array}  params  Parámetros opcionales
 * @returns {Promise<{rows: Array, affectedRows: number, insertId: number}>}
 */
async function q(sqlStr, params = []) {
  const res = await sql.query(DB, sqlStr, params);
  // SELECT  → { success: true, result: [ {...row}, ... ] }
  // DML/DDL → { success: true, result: { affectedRows, insertId, changedRows } }
  const result = res?.result ?? res;
  const rows         = Array.isArray(result) ? result : [];
  const affectedRows = Array.isArray(result) ? rows.length : (result?.affectedRows ?? 0);
  const insertId     = Array.isArray(result) ? null       : (result?.insertId     ?? null);
  return { rows, affectedRows, insertId };
}

// ── Inicialización de tablas ──────────────────────────────────────────────

async function initDB() {
  const tables = [
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        email            VARCHAR(255) UNIQUE NOT NULL,
        password_hash    VARCHAR(255) NOT NULL,
        name             VARCHAR(255) NOT NULL,
        tokens_remaining INT     NOT NULL DEFAULT ${TOKEN_LIMIT},
        daily_calls_used INT     NOT NULL DEFAULT 0,
        last_call_date   DATE             DEFAULT NULL,
        created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )`,
    },
    {
      name: 'chats',
      sql: `CREATE TABLE IF NOT EXISTS chats (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT          NOT NULL,
        title      VARCHAR(255) NOT NULL DEFAULT 'Nueva conversacion',
        model_id   VARCHAR(255)          DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,
    },
    {
      name: 'chat_messages',
      sql: `CREATE TABLE IF NOT EXISTS chat_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        chat_id     INT  NOT NULL,
        role        VARCHAR(50)  NOT NULL,
        content     TEXT         NOT NULL,
        tokens_used INT  NOT NULL DEFAULT 0,
        created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )`,
    },
    {
      name: 'sessions',
      sql: `CREATE TABLE IF NOT EXISTS sessions (
        sid     VARCHAR(255) NOT NULL PRIMARY KEY,
        data    TEXT         NOT NULL,
        expires DATETIME     NOT NULL
      )`,
    },
  ];

  for (const table of tables) {
    try {
      await q(table.sql);
      console.log(`[DB] Tabla "${table.name}" verificada`);
    } catch (err) {
      console.error(`[DB] Error creando tabla "${table.name}":`, err.message);
      throw err; // propagar para que el server lo maneje
    }
  }

  console.log(`[DB] Todas las tablas verificadas en "${DB}"`);
}

// ── USUARIOS ─────────────────────────────────────────────────────────────

async function createUser(email, passwordHash, name) {
  const { insertId } = await q(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [email, passwordHash, name]
  );
  return getUserById(insertId);
}

async function getUserByEmail(email) {
  const { rows } = await q('SELECT * FROM users WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

async function getUserById(userId) {
  const { rows } = await q('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
  return rows[0] || null;
}

async function checkUserLimits(userId) {
  const user = await getUserById(userId);
  if (!user) return { ok: false, reason: 'usuario_no_encontrado', user: null };

  const hoy = new Date().toISOString().split('T')[0];

  // Resetear contador diario si cambió el día
  if (user.last_call_date && user.last_call_date !== hoy) {
    await q(
      'UPDATE users SET daily_calls_used = 0, updated_at = NOW() WHERE id = ?',
      [userId]
    );
    user.daily_calls_used = 0;
  }

  if (user.tokens_remaining <= 0)              return { ok: false, reason: 'tokens_agotados',         user };
  if (user.daily_calls_used >= DAILY_CALL_LIMIT) return { ok: false, reason: 'llamadas_diarias_agotadas', user };

  return { ok: true, reason: null, user };
}

async function consumeTokens(userId, tokensUsed) {
  const hoy = new Date().toISOString().split('T')[0];
  await q(
    `UPDATE users
       SET tokens_remaining = GREATEST(0, tokens_remaining - ?),
           daily_calls_used = daily_calls_used + 1,
           last_call_date   = ?,
           updated_at       = NOW()
     WHERE id = ?`,
    [tokensUsed || 0, hoy, userId]
  );
}

// ── CHATS ─────────────────────────────────────────────────────────────────

async function createChat(userId, title, modelId) {
  const safeTitle = (title || 'Nueva conversacion').slice(0, 255);
  const { insertId } = await q(
    'INSERT INTO chats (user_id, title, model_id) VALUES (?, ?, ?)',
    [userId, safeTitle, modelId || null]
  );
  const { rows } = await q('SELECT * FROM chats WHERE id = ?', [insertId]);
  return rows[0];
}

async function getUserChats(userId) {
  const { rows } = await q(
    `SELECT c.*,
            COUNT(m.id) AS message_count
       FROM chats c
       LEFT JOIN chat_messages m ON m.chat_id = c.id
      WHERE c.user_id = ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC`,
    [userId]
  );
  return rows;
}

async function getChatWithMessages(chatId, userId) {
  const { rows: chatRows } = await q(
    'SELECT * FROM chats WHERE id = ? AND user_id = ? LIMIT 1',
    [chatId, userId]
  );
  if (!chatRows[0]) return null;

  const chat = chatRows[0];
  const { rows: messages } = await q(
    'SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY created_at ASC',
    [chatId]
  );
  chat.messages = messages;
  return chat;
}

async function updateChatTitle(chatId, userId, title) {
  await q(
    'UPDATE chats SET title = ?, updated_at = NOW() WHERE id = ? AND user_id = ?',
    [title.slice(0, 255), chatId, userId]
  );
}

async function deleteChat(chatId, userId) {
  const { affectedRows } = await q(
    'DELETE FROM chats WHERE id = ? AND user_id = ?',
    [chatId, userId]
  );
  return affectedRows > 0;
}

// ── MENSAJES ──────────────────────────────────────────────────────────────

async function addMessage(chatId, role, content, tokensUsed = 0) {
  const { insertId } = await q(
    'INSERT INTO chat_messages (chat_id, role, content, tokens_used) VALUES (?, ?, ?, ?)',
    [chatId, role, content, tokensUsed]
  );

  // Actualizar timestamp del chat padre
  await q('UPDATE chats SET updated_at = NOW() WHERE id = ?', [chatId]);

  const { rows } = await q('SELECT * FROM chat_messages WHERE id = ?', [insertId]);
  return rows[0];
}

// ── Exports ───────────────────────────────────────────────────────────────

module.exports = {
  initDB,
  createUser,
  getUserByEmail,
  getUserById,
  checkUserLimits,
  consumeTokens,
  createChat,
  getUserChats,
  getChatWithMessages,
  updateChatTitle,
  deleteChat,
  addMessage,
  TOKEN_LIMIT,
  DAILY_CALL_LIMIT,
};
