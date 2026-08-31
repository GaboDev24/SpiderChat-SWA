'use strict';
const fs = require('fs').promises;
const path = require('path');

const CACHE_DIR = path.join(__dirname, '../data/rag_cache');

async function initCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
}

async function saveChunksLocal(chatId, chunks) {
  await initCache();
  if (!chunks || chunks.length === 0) return;

  const file = path.join(CACHE_DIR, `chat_${chatId}.json`);
  let existing = [];
  try {
    const data = await fs.readFile(file, 'utf8');
    existing = JSON.parse(data);
  } catch (e) {
    // Si no existe el archivo, está bien, lo creamos nuevo
  }

  existing.push(...chunks);
  
  // Guardamos usando writeFile temporal para evitar corrupción
  const tempFile = `${file}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(existing));
  await fs.rename(tempFile, file);
}

async function getChunksLocal(chatId) {
  const file = path.join(CACHE_DIR, `chat_${chatId}.json`);
  try {
    const data = await fs.readFile(file, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

module.exports = {
  saveChunksLocal,
  getChunksLocal
};
