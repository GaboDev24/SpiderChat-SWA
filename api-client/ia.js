'use strict';

/**
 * SpiderWebARG API — Submodulo SpiderIA
 *
 * Expone funciones para interactuar con el modulo de inteligencia artificial:
 * - listModels()
 * - chat(modelId, messages)
 * - getUsage()
 */

const { request } = require('./client');

/**
 * Lista todos los modelos de IA disponibles.
 * @returns {Promise<Array>} Lista de modelos con id, nombre, etc.
 */
async function listModels() {
  return request('/ia/models', { method: 'GET' });
}

/**
 * Envia una conversacion al modelo de IA seleccionado.
 *
 * @param {string} modelId - Identificador del modelo a usar
 * @param {Array<{role: string, content: string}>} messages - Historial de mensajes
 *   Cada mensaje debe tener:
 *   - role: 'user' | 'assistant' | 'system'
 *   - content: texto del mensaje
 * @returns {Promise<object>} Respuesta del modelo (message, tokens_used, etc.)
 */
async function chat(modelId, messages) {
  if (!modelId) throw new Error('[SpiderIA] El parametro "modelId" es obligatorio.');
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('[SpiderIA] El parametro "messages" debe ser un arreglo no vacio.');
  }

  // Validar estructura basica de los mensajes
  for (const msg of messages) {
    if (!msg.role || !msg.content) {
      throw new Error('[SpiderIA] Cada mensaje debe tener los campos "role" y "content".');
    }
  }

  return request('/ia/chat', {
    method: 'POST',
    body: {
      model_id: modelId,
      messages,
    },
  });
}

/**
 * Obtiene el resumen de uso actual (tokens consumidos, llamadas realizadas, etc.).
 * @returns {Promise<object>} Datos de uso de la API Key activa
 */
async function getUsage() {
  return request('/ia/usage', { method: 'GET' });
}

module.exports = { listModels, chat, getUsage };
