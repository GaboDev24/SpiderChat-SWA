'use strict';

const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

/**
 * Procesa un archivo para extraer texto.
 * Soporta PDF (texto nativo) y formatos de imagen básicos (usando OCR).
 */
async function processFileBuffer(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    try {
      const buffer = await fs.readFile(filePath);
      const data = await pdfParse(buffer);
      const cleanedText = data.text ? data.text.trim() : '';
      
      if (cleanedText.length > 50) {
        console.log('[FileProcessor] Texto extraído del PDF exitosamente.');
        return cleanedText;
      } else {
        throw new Error('El PDF parece estar escaneado (sin texto nativo). Para extraer texto de PDFs escaneados en Vercel, se requiere configurar una API de OCR en la nube.');
      }
    } catch (e) {
      console.error('[FileProcessor Error]', e.message);
      throw new Error(`Fallo al procesar el PDF: ${e.message}`);
    }
  } 
  
  if (mimeType.startsWith('image/')) {
    console.log('[FileProcessor] Imagen detectada, iniciando OCR...');
    try {
      const { data: { text } } = await Tesseract.recognize(
        filePath, // Tesseract accepts file paths directly
        'spa+eng',
        { logger: () => {} } // silenciar logs
      );
      if (!text.trim()) {
        throw new Error('No se pudo leer texto en la imagen.');
      }
      return text.trim();
    } catch (e) {
      console.error('[FileProcessor OCR Error]', e);
      throw new Error('Fallo al procesar OCR de la imagen.');
    }
  }

  throw new Error('Formato de archivo no soportado para lectura de texto.');
}

module.exports = { processFileBuffer };
