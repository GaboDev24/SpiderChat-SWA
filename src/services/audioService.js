'use strict';

const fs = require('fs');
const FormData = require('form-data');

/**
 * Procesa un archivo de audio.
 * Actualmente SpiderIA no soporta transcripción de audio de forma nativa.
 */
async function processAudioBuffer(file) {
  throw new Error('La transcripción de audio no está soportada actualmente por el sistema (SpiderIA). Por favor sube el archivo en formato de texto (PDF/Imagen).');
}

module.exports = { processAudioBuffer };
