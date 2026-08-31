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
const multer = require('multer');
const pdfParse = require('pdf-parse');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');

const upload = multer({ storage: multer.memoryStorage() });

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

router.get('/history', async (req, res, next) => {
  try {
    const chats = await db.getUserChats(req.user.id);
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

// ── Obtener un chat especifico con mensajes ───────────────────────────────

router.get('/:id', async (req, res, next) => {
  try {
    const chatId = parseInt(req.params.id, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

    const chat = await db.getChatWithMessages(chatId, req.user.id);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });

    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// ── Actualizar titulo de chat ─────────────────────────────────────────────

router.patch('/:id/title', async (req, res, next) => {
  try {
    const chatId = parseInt(req.params.id, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

    const { title } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Titulo invalido' });
    }

    await db.updateChatTitle(chatId, req.user.id, title.trim().slice(0, 100));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Eliminar chat ─────────────────────────────────────────────────────────

router.delete('/:id', async (req, res, next) => {
  try {
    const chatId = parseInt(req.params.id, 10);
    if (isNaN(chatId)) return res.status(400).json({ error: 'ID invalido' });

    const eliminado = await db.deleteChat(chatId, req.user.id);
    if (!eliminado) return res.status(404).json({ error: 'Chat no encontrado' });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// ── Enviar mensaje ────────────────────────────────────────────────────────

router.post('/send', upload.single('file'), async (req, res, next) => {
  try {
    let { message, model_id, chat_id } = req.body;

    // Validaciones basicas
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'El campo "message" es obligatorio.' });
    }
    if (!model_id) {
      return res.status(400).json({ error: 'El campo "model_id" es obligatorio.' });
    }
    
    // Obtener o crear el chat
    let chat;
    if (chat_id) {
      chat = await db.getChatWithMessages(parseInt(chat_id, 10), req.user.id);
      if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    } else {
      const titulo = message.trim().slice(0, 50) + (message.trim().length > 50 ? '...' : '');
      chat = await db.createChat(req.user.id, titulo, model_id);
      chat.messages = [];
    }

    let finalMessage = message.trim();

    // Procesar archivo adjunto si existe
    if (req.file) {
      const mimeType = req.file.mimetype;
      if (mimeType === 'application/pdf') {
        try {
          const pdfData = await pdfParse(req.file.buffer);
          finalMessage = `Contexto del documento adjunto:\n\n${pdfData.text}\n\nPregunta: ${finalMessage}`;
        } catch (e) {
          console.error(e);
          return res.status(400).json({ error: `No se pudo procesar el PDF: ${e.message}` });
        }
      } else if (mimeType.startsWith('audio/')) {
        try {
          if (!process.env.OPENAI_API_KEY) {
            return res.status(500).json({ error: 'Transcipción de audio requiere configurar OPENAI_API_KEY en .env' });
          }
          
          const form = new FormData();
          form.append('file', req.file.buffer, { filename: req.file.originalname || 'audio.mp3', contentType: mimeType });
          form.append('model', 'whisper-1');
          
          const { default: fetch } = await import('node-fetch');
          const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              ...form.getHeaders()
            },
            body: form
          });
          
          if (!sttRes.ok) {
            throw new Error(await sttRes.text());
          }
          
          const sttData = await sttRes.json();
          finalMessage = `Transcripción del audio enviado:\n\n${sttData.text}\n\nInstrucción del usuario: ${finalMessage}`;
        } catch (e) {
          console.error('Error Whisper:', e);
          return res.status(502).json({ error: 'Fallo al transcribir el audio usando Whisper API.' });
        }
      } else {
        return res.status(400).json({ error: 'Formato de archivo no soportado. Solo PDF y Audio.' });
      }
    }

    // Verificar limites del usuario
    const { ok, reason, user } = await db.checkUserLimits(req.user.id);
    if (!ok) {
      const mensajes = {
        tokens_agotados:          'Has agotado tus 50.000 tokens disponibles. Contacta con soporte para recargar.',
        llamadas_diarias_agotadas: `Has alcanzado el limite de ${db.DAILY_CALL_LIMIT} llamadas por dia. Vuelve manana.`,
      };
      return res.status(429).json({ error: mensajes[reason] || 'Limite alcanzado', reason });
    }

    // Guardar el mensaje original (limpio) del usuario en la Base de Datos para el historial visual
    await db.addMessage(chat.id, 'user', message.trim(), 0);

    // Construir historial completo para enviar a la IA (inyectando el texto del PDF si existe)
    const historial = [
      ...chat.messages,
      { role: 'user', content: finalMessage },
    ].map(m => ({ role: m.role, content: m.content }));

    // Llamar a SpiderIA
    let respuestaIA;
    try {
      respuestaIA = await ia.chat(model_id, historial);
      
      // LOG DE DEPURACIÓN (ÉXITO)
      const logEntry = {
        timestamp: new Date().toISOString(),
        chat_id: chat.id,
        user_id: req.user.id,
        model: model_id,
        messages: historial,
        raw_response: respuestaIA,
        error: null
      };
      await fs.appendFile(path.join(__dirname, '../../data/chat_debug.log'), JSON.stringify(logEntry) + '\n').catch(() => {});
      
    } catch (iaErr) {
      // LOG DE DEPURACIÓN (ERROR)
      const logEntry = {
        timestamp: new Date().toISOString(),
        chat_id: chat.id,
        user_id: req.user.id,
        model: model_id,
        messages: historial,
        raw_response: null,
        error: iaErr.message || String(iaErr)
      };
      await fs.appendFile(path.join(__dirname, '../../data/chat_debug.log'), JSON.stringify(logEntry) + '\n').catch(() => {});

      const errorMsg = iaErr instanceof ApiError ? `Error al comunicarse con la IA: ${iaErr.message}` : 'Error interno al procesar tu solicitud.';
      await db.addMessage(chat.id, 'assistant', errorMsg, 0);
      
      if (iaErr instanceof ApiError) {
        return res.status(502).json({
          error: 'Error al comunicarse con SpiderIA',
          detalle: iaErr.message,
        });
      }
      throw iaErr;
    }

    // Extraer contenido de la respuesta
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

    const tokensUsados = respuestaIA?.usage?.total_tokens || respuestaIA?.tokens_used || 0;

    // Guardar respuesta del asistente y descontar tokens
    await db.addMessage(chat.id, 'assistant', contenidoRespuesta, tokensUsados);
    await db.consumeTokens(req.user.id, tokensUsados);

    // Obtener datos actualizados del usuario
    const usuarioActualizado = await db.getUserById(req.user.id);

    res.json({
      chat_id:          chat.id,
      message:          contenidoRespuesta,
      tokens_used:      tokensUsados,
      tokens_remaining: usuarioActualizado.tokens_remaining,
      daily_calls_used: usuarioActualizado.daily_calls_used,
      daily_calls_limit: db.DAILY_CALL_LIMIT,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
