'use strict';

/**
 * SpiderWebARG API — Cliente HTTP Centralizado
 *
 * Responsabilidades:
 * - Leer API_KEY desde variable de entorno (nunca la expone en logs)
 * - Agregar header X-API-KEY a todas las peticiones
 * - Manejar errores HTTP 4xx / 5xx con mensajes descriptivos
 * - Aplicar timeout configurable
 * - Soportar respuestas binarias (descargas de archivos)
 */

require('dotenv').config();

// Validacion temprana de variables de entorno criticas
const API_KEY = process.env.API_KEY;
const API_BASE_URL = process.env.API_BASE_URL || 'https://spiderwebargapi.com.ar/api/v1';
const TIMEOUT_MS = 30_000; // 30 segundos por defecto

if (!API_KEY) {
  throw new Error(
    '[SpiderWebARG SDK] Variable de entorno API_KEY no definida. ' +
    'Configurarla en el archivo .env antes de usar el cliente.'
  );
}

/**
 * Error personalizado para respuestas de la API
 */
class ApiError extends Error {
  constructor(status, message, body) {
    super(`[SpiderWebARG API] HTTP ${status}: ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Realiza una peticion HTTP a la API de SpiderWebARG.
 *
 * @param {string} endpoint - Ruta relativa, ej: '/databases' o '/query'
 * @param {object} options - Opciones de fetch (method, headers, body, etc.)
 * @param {boolean} binary - Si true, retorna un Buffer en lugar de JSON
 * @returns {Promise<object|Buffer>} Respuesta parseada
 */
async function request(endpoint, options = {}, binary = false) {
  // Importacion dinamica de node-fetch (ESM en Node 18+)
  const { default: fetch } = await import('node-fetch');

  const url = `${API_BASE_URL}${endpoint}`;

  // Construir headers base. La API_KEY nunca aparece en logs de consola.
  const headers = {
    'X-API-KEY': API_KEY,
    ...(options.headers || {}),
  };

  // Si hay body y es un objeto plano, serializar como JSON
  let body = options.body;
  if (body && typeof body === 'object' && !(body.constructor?.name === 'FormData')) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  // Controlador de timeout usando AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new ApiError(408, `Timeout al conectar con ${url} (${TIMEOUT_MS}ms)`, null);
    }
    throw new ApiError(0, `Error de red: ${err.message}`, null);
  } finally {
    clearTimeout(timeoutId);
  }

  // Respuesta binaria (descarga de archivos)
  if (binary) {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(response.status, response.statusText, text);
    }
    const buffer = await response.arrayBuffer();
    return {
      data: Buffer.from(buffer),
      contentType: response.headers.get('content-type') || 'application/octet-stream',
      contentDisposition: response.headers.get('content-disposition') || '',
    };
  }

  // Respuesta JSON
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const mensaje = (typeof data === 'object' && data?.message) ? data.message : String(data);
    throw new ApiError(response.status, mensaje, data);
  }

  return data;
}

module.exports = { request, ApiError };
