'use strict';

/**
 * SpiderWebARG API — SDK
 * Punto de entrada unificado para los tres submodulos.
 *
 * Uso:
 *   const { sql, storage, ia } = require('./api-client');
 *
 *   // SQL
 *   const bases = await sql.listDatabases();
 *   const resultado = await sql.query('mi_db', 'SELECT * FROM usuarios');
 *
 *   // Storage
 *   const proyectos = await storage.listProjects();
 *   const descarga = await storage.downloadFile('archivo-id-123');
 *
 *   // SpiderIA
 *   const modelos = await ia.listModels();
 *   const respuesta = await ia.chat('gpt-4o', [{ role: 'user', content: 'Hola' }]);
 */

const sql = require('./sql');
const storage = require('./storage');
const ia = require('./ia');
const { ApiError } = require('./client');

module.exports = { sql, storage, ia, ApiError };
