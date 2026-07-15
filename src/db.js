'use strict';

/**
 * SpiderChat — Capa de Datos (JSON Database)
 *
 * Se ha reemplazado better-sqlite3 por un storage JSON síncrono
 * debido a incompatibilidades de compilación nativa en Node v26+.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'spiderchat.json');

const TOKEN_LIMIT = parseInt(process.env.USER_TOKEN_LIMIT || '50000', 10);
const DAILY_CALL_LIMIT = parseInt(process.env.USER_DAILY_CALL_LIMIT || '50', 10);

// Asegurar carpeta data/
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Inicializar BD si no existe
if (!fs.existsSync(DB_PATH)) {
  const initialData = {
    users: [],
    chats: [],
    chat_messages: []
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(initialData), 'utf-8');
}

/**
 * Carga todos los datos a memoria (Sincrónico)
 */
function readDB() {
  try {
    const content = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return { users: [], chats: [], chat_messages: [] };
  }
}

/**
 * Guarda los datos desde la memoria al disco (Sincrónico)
 */
function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ── UTILIDADES DE ID ──────────────────────────────────────────────────────

function getNextId(table) {
  if (!table || table.length === 0) return 1;
  const maxId = table.reduce((max, item) => (item.id > max ? item.id : max), 0);
  return maxId + 1;
}

// ── USUARIOS ─────────────────────────────────────────────────────────────

function createUser(email, passwordHash, name) {
  const db = readDB();
  const newUser = {
    id: getNextId(db.users),
    email,
    password_hash: passwordHash,
    name,
    tokens_remaining: TOKEN_LIMIT,
    daily_calls_used: 0,
    last_call_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.users.push(newUser);
  writeDB(db);
  return newUser;
}

function getUserByEmail(email) {
  const db = readDB();
  return db.users.find((u) => u.email === email) || null;
}

function getUserById(userId) {
  const db = readDB();
  return db.users.find((u) => u.id === userId) || null;
}

function checkUserLimits(userId) {
  const db = readDB();
  const user = db.users.find((u) => u.id === userId);
  
  if (!user) return { ok: false, reason: 'Usuario no encontrado', user: null };

  const hoy = new Date().toISOString().split('T')[0];
  let updated = false;

  if (user.last_call_date && user.last_call_date !== hoy) {
    user.daily_calls_used = 0;
    user.updated_at = new Date().toISOString();
    updated = true;
  }

  if (updated) {
    writeDB(db);
  }

  if (user.tokens_remaining <= 0) {
    return { ok: false, reason: 'tokens_agotados', user };
  }
  if (user.daily_calls_used >= DAILY_CALL_LIMIT) {
    return { ok: false, reason: 'llamadas_diarias_agotadas', user };
  }

  return { ok: true, reason: null, user };
}

function consumeTokens(userId, tokensUsed) {
  const db = readDB();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return;

  const hoy = new Date().toISOString().split('T')[0];
  user.tokens_remaining = Math.max(0, user.tokens_remaining - (tokensUsed || 0));
  user.daily_calls_used += 1;
  user.last_call_date = hoy;
  user.updated_at = new Date().toISOString();

  writeDB(db);
}

// ── CHATS ────────────────────────────────────────────────────────────────

function createChat(userId, title, modelId) {
  const db = readDB();
  const newChat = {
    id: getNextId(db.chats),
    user_id: userId,
    title: title || 'Nueva conversacion',
    model_id: modelId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.chats.push(newChat);
  writeDB(db);
  return newChat;
}

function getUserChats(userId) {
  const db = readDB();
  const userChats = db.chats
    .filter((c) => c.user_id === userId)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  // Agregar el conteo de mensajes a cada chat
  return userChats.map((chat) => {
    const count = db.chat_messages.filter((m) => m.chat_id === chat.id).length;
    return { ...chat, message_count: count };
  });
}

function getChatWithMessages(chatId, userId) {
  const db = readDB();
  const chat = db.chats.find((c) => c.id === chatId && c.user_id === userId);
  if (!chat) return null;

  chat.messages = db.chat_messages
    .filter((m) => m.chat_id === chatId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return chat;
}

function updateChatTitle(chatId, userId, title) {
  const db = readDB();
  const chat = db.chats.find((c) => c.id === chatId && c.user_id === userId);
  if (chat) {
    chat.title = title;
    chat.updated_at = new Date().toISOString();
    writeDB(db);
  }
}

function deleteChat(chatId, userId) {
  const db = readDB();
  const chatIndex = db.chats.findIndex((c) => c.id === chatId && c.user_id === userId);
  if (chatIndex !== -1) {
    db.chats.splice(chatIndex, 1);
    // Eliminar también los mensajes asociados
    db.chat_messages = db.chat_messages.filter((m) => m.chat_id !== chatId);
    writeDB(db);
    return true;
  }
  return false;
}

// ── MENSAJES ─────────────────────────────────────────────────────────────

function addMessage(chatId, role, content, tokensUsed = 0) {
  const db = readDB();
  const newMessage = {
    id: getNextId(db.chat_messages),
    chat_id: chatId,
    role,
    content,
    tokens_used: tokensUsed,
    created_at: new Date().toISOString()
  };
  db.chat_messages.push(newMessage);

  // Actualizar la fecha del chat
  const chat = db.chats.find((c) => c.id === chatId);
  if (chat) {
    chat.updated_at = new Date().toISOString();
  }

  writeDB(db);
  return newMessage;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,
  checkUserLimits,
  consumeTokens,
  createChat,
  getUserChats,
  getChatWithMessages,
  addMessage,
  updateChatTitle,
  deleteChat,
  TOKEN_LIMIT,
  DAILY_CALL_LIMIT,
};
