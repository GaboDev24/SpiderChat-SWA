'use strict';

/**
 * SpiderWebARG API — Submodulo SQL
 *
 * Expone funciones para interactuar con el modulo de bases de datos:
 * - listDatabases()
 * - listTables(db)
 * - query(db, sql, params)
 */

const { request } = require('./client');

/**
 * Lista todas las bases de datos disponibles para la API Key activa.
 *
 * @returns {Promise<Array>} Arreglo de nombres de bases de datos
 */
async function listDatabases() {
  return request('/databases', { method: 'GET' });
}

/**
 * Lista todas las tablas de una base de datos.
 *
 * @param {string} db - Nombre de la base de datos
 * @returns {Promise<Array>} Arreglo de nombres de tablas
 */
async function listTables(db) {
  if (!db) throw new Error('[SQL] El parametro "db" es obligatorio.');
  return request(`/databases/${encodeURIComponent(db)}/tables`, { method: 'GET' });
}

/**
 * Ejecuta una consulta SQL en la base de datos indicada.
 *
 * @param {string} db - Nombre de la base de datos
 * @param {string} sql - Sentencia SQL a ejecutar
 * @param {Array} [params=[]] - Parametros opcionales para consultas preparadas
 * @returns {Promise<object>} Resultado de la consulta (rows, affected, etc.)
 */
async function query(db, sql, params = []) {
  if (!db) throw new Error('[SQL] El parametro "db" es obligatorio.');
  if (!sql) throw new Error('[SQL] El parametro "sql" es obligatorio.');

  return request('/query', {
    method: 'POST',
    body: {
      database: db,
      query: sql,
      params,
    },
  });
}

module.exports = { listDatabases, listTables, query };
