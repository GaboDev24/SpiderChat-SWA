'use strict';

/**
 * SpiderChat — Rutas de Chat
 *
 * POST   /api/chat/send         -> Envia un mensaje y obtiene respuesta de SpiderIA
 * GET    /api/chat/history      -> Lista todos los chats del usuario
 * GET    /api/chat/models       -> Lista los modelos de IA disponibles
 * GET    /api/chat/:id          -> Obtiene un chat con sus mensajes
 * PATCH  /api/chat/:id/title    -> Actualiza el titulo de un chat
 * DELETE /api/chat/:id          -> Elimina un chat
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { ia, ApiError } = require('../../api-client');
const { requireAuth } = require('./auth');

// Todos los endpoints de chat requieren autenticacion
router.use(requireAuth);

// ── Modelos disponibles ───────────────────────────────────────────────────

router.get('/models', async (req, res, next) => {
  try {
    const modelos = await ia.listModels();
    res.json(modelos);
  } catch (err) {
    next(err);
  }
});

// ── Historial de chats ────────────────────────────────────────────────────

router.get('/history', (req, res) => {
  const chats = db.getUserChats(req.user.id);
  res.json(chats);
});

// ── Obtener un chat especifico con mensajes ───────────────────────────────

router.get('/:id', (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

  const chat = db.getChatWithMessages(chatId, req.user.id);
  if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

  res.json(chat);
});

// ── Actualizar titulo de chat ─────────────────────────────────────────────

router.patch('/:id/title', (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

  const { title } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Titulo invalido' });
  }

  db.updateChatTitle(chatId, req.user.id, title.trim().slice(0, 100));
  res.json({ ok: true });
});

// ── Eliminar chat ─────────────────────────────────────────────────────────

router.delete('/:id', (req, res) => {
  const chatId = parseInt(req.params.id, 10);
  if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

  const eliminado = db.deleteChat(chatId, req.user.id);
  if (!eliminado) return res.status(404).json({ error: 'Chat no encontrado' });

  res.json({ ok: true });
});

// ── Enviar mensaje ────────────────────────────────────────────────────────

router.post('/send', async (req, res, next) => {
  try {
    const { message, model_id, chat_id } = req.body;

    // Validaciones basicas
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El campo "message" es obligatorio.' });
    }
    if (!model_id) {
      return res.status(400).json({ error: 'El campo "model_id" es obligatorio.' });
    }

    // Verificar limites del usuario
    const { ok, reason, user } = db.checkUserLimits(req.user.id);
    if (!ok) {
      const mensajes = {
        tokens_agotados: 'Has agotado tus 50.000 tokens disponibles. Contacta con soporte para recargar.',
        llamadas_diarias_agotadas: `Has alcanzado el limite de ${db.DAILY_CALL_LIMIT} llamadas por dia. Vuelve manana.`,
      };
      return res.status(429).json({ error: mensajes[reason] || 'Limite alcanzado', reason });
    }

    // Obtener o crear el chat
    let chat;
    if (chat_id) {
      chat = db.getChatWithMessages(parseInt(chat_id, 10), req.user.id);
      if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    } else {
      // Titulo automatico con las primeras palabras del mensaje
      const titulo = message.trim().slice(0, 50) + (message.trim().length > 50 ? '...' : '');
      chat = db.createChat(req.user.id, titulo, model_id);
      chat.messages = [];
    }

    // Guardar el mensaje del usuario
    db.addMessage(chat.id, 'user', message.trim(), 0);

    // Construir el historial completo de mensajes para enviar a la IA
    const historial = [
      ...chat.messages,
      { role: 'user', content: message.trim() },
    ].map(m => ({ role: m.role, content: m.content }));

    // Llamar a SpiderIA
    let respuestaIA;
    try {
      respuestaIA = await ia.chat(model_id, historial);
    } catch (iaErr) {
      // Si la API de IA falla, no consumir tokens
      if (iaErr instanceof ApiError) {
        return res.status(502).json({
          error: 'Error al comunicarse con SpiderIA',
          detalle: iaErr.message,
        });
      }
      throw iaErr;
    }

    // Extraer el contenido de la respuesta segun el formato detectado
    let contenidoRespuesta = 'Sin respuesta';
    if (respuestaIA?.message && typeof respuestaIA.message === 'object') {
      contenidoRespuesta = respuestaIA.message.content;
    } else if (typeof respuestaIA?.message === 'string') {
      contenidoRespuesta = respuestaIA.message;
    } else if (respuestaIA?.content) {
      contenidoRespuesta = respuestaIA.content;
    } else if (respuestaIA?.choices?.[0]?.message?.content) {
      contenidoRespuesta = respuestaIA.choices[0].message.content;
    } else if (respuestaIA?.response) {
      contenidoRespuesta = respuestaIA.response;
    }

    const tokensUsados = respuestaIA?.tokens_used || respuestaIA?.usage?.total_tokens || 0;

    // Guardar la respuesta del asistente
    db.addMessage(chat.id, 'assistant', contenidoRespuesta, tokensUsados);

    // Descontar tokens y registrar la llamada
    db.consumeTokens(req.user.id, tokensUsados);

    // Obtener datos actualizados del usuario
    const usuarioActualizado = db.getUserById(req.user.id);

    res.json({
      chat_id: chat.id,
      message: contenidoRespuesta,
      tokens_used: tokensUsados,
      tokens_remaining: usuarioActualizado.tokens_remaining,
      daily_calls_used: usuarioActualizado.daily_calls_used,
      daily_calls_limit: db.DAILY_CALL_LIMIT,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
