'use strict';
require('dotenv').config();

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

// 2. OpenAI Embeddings con Lotes (Batches) para archivos grandes
async function getEmbeddings(texts) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY no definida');
  const { default: fetch } = await import('node-fetch');
  
  const allEmbeddings = [];
  const BATCH_SIZE = 50; // Agrupamos de a 50 párrafos para no estallar el rate limit de tokens
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        input: batch,
        model: 'text-embedding-3-small'
      })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI Error: ${errText}`);
    }
    const data = await res.json();
    const batchEmbeddings = data.data.map(d => d.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }
  
  return allEmbeddings;
}

// 3. Similitud de Coseno
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 4. Búsqueda de Chunks (Top K)
async function findTopKChunks(queryText, allChunks, k = 3) {
  if (allChunks.length === 0) return [];
  const queryEmbedding = (await getEmbeddings([queryText]))[0];
  
  const scoredChunks = allChunks.map(chunk => ({
    text: chunk.text,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  scoredChunks.sort((a, b) => b.score - a.score);
  return scoredChunks.slice(0, k).map(c => c.text);
}

module.exports = { chunkText, getEmbeddings, findTopKChunks };
