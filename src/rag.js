'use strict';

// 1. Fragmentación de texto (Chunking simple)
function chunkText(text, maxChars = 1000) {
  const paragraphs = text.split(/\n\s*\n/);
  const chunks = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if ((currentChunk.length + p.length) > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += p + '\n\n';
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

// 2. Extracción de palabras para búsqueda local
function getWords(text) {
  // Extrae palabras alfanuméricas, ignorando tildes de forma básica
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/\w+/g) || [];
}

// 3. Puntuación de similitud (Frecuencia de términos básica)
function calculateScore(query, chunk) {
  const queryWords = new Set(getWords(query));
  const chunkWords = getWords(chunk);
  
  let score = 0;
  for (const word of chunkWords) {
    // Si la palabra de la consulta está en el chunk, sumamos puntos
    if (queryWords.has(word) && word.length > 3) { // ignorar conectores cortos
      score += 1; 
    }
  }
  
  // Normalizar la puntuación por la longitud del chunk para no favorecer chunks gigantes
  return score / (chunkWords.length + 1);
}

// 4. Búsqueda de Chunks Locales (Top K) sin API Externa
async function findTopKChunks(queryText, allChunks, k = 3) {
  if (allChunks.length === 0) return [];
  
  const scoredChunks = allChunks.map(chunk => {
    // Soportar tanto objetos {text: '...'} como strings
    const text = typeof chunk === 'string' ? chunk : chunk.text;
    return {
      text,
      score: calculateScore(queryText, text)
    };
  });
  
  // Ordenar de mayor a menor puntuación
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, k).map(c => c.text);
}

module.exports = { chunkText, findTopKChunks };
