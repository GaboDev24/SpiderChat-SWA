'use strict';

/**
 * SpiderWebARG API — Submodulo Storage
 *
 * Expone funciones para gestionar proyectos y archivos en el storage:
 * Proyectos: listProjects, createProject, updateProject, deleteProject
 * Archivos: listFiles, uploadFile, downloadFile, fileInfo, replaceFile, deleteFile
 */

const { request } = require('./client');

// ── PROYECTOS ──────────────────────────────────────────────────────────────

/**
 * Lista todos los proyectos de storage.
 * @returns {Promise<Array>}
 */
async function listProjects() {
  return request('/storage/projects', { method: 'GET' });
}

/**
 * Crea un nuevo proyecto de storage.
 * @param {object} data - Datos del proyecto (nombre, descripcion, etc.)
 * @returns {Promise<object>}
 */
async function createProject(data) {
  if (!data) throw new Error('[Storage] El parametro "data" es obligatorio.');
  return request('/storage/projects', {
    method: 'POST',
    body: data,
  });
}

/**
 * Actualiza un proyecto de storage existente.
 * @param {string|number} id - ID del proyecto
 * @param {object} data - Campos a actualizar
 * @returns {Promise<object>}
 */
async function updateProject(id, data) {
  if (!id) throw new Error('[Storage] El parametro "id" es obligatorio.');
  return request(`/storage/projects/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Elimina un proyecto de storage.
 * @param {string|number} id - ID del proyecto
 * @returns {Promise<object>}
 */
async function deleteProject(id) {
  if (!id) throw new Error('[Storage] El parametro "id" es obligatorio.');
  return request(`/storage/projects/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

// ── ARCHIVOS ───────────────────────────────────────────────────────────────

/**
 * Lista todos los archivos dentro de un proyecto.
 * @param {string|number} projectId - ID del proyecto
 * @returns {Promise<Array>}
 */
async function listFiles(projectId) {
  if (!projectId) throw new Error('[Storage] El parametro "projectId" es obligatorio.');
  return request(`/storage/projects/${encodeURIComponent(projectId)}/files`, {
    method: 'GET',
  });
}

/**
 * Sube uno o varios archivos a un proyecto.
 * Usa multipart/form-data con el campo "files".
 *
 * @param {string|number} projectId - ID del proyecto
 * @param {Array<{name: string, buffer: Buffer, mimeType: string}>} files - Archivos a subir
 * @returns {Promise<object>}
 */
async function uploadFile(projectId, files) {
  if (!projectId) throw new Error('[Storage] El parametro "projectId" es obligatorio.');
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('[Storage] El parametro "files" debe ser un arreglo no vacio.');
  }

  const FormData = require('form-data');
  const form = new FormData();

  for (const file of files) {
    form.append('files', file.buffer, {
      filename: file.name,
      contentType: file.mimeType || 'application/octet-stream',
    });
  }

  return request(`/storage/projects/${encodeURIComponent(projectId)}/files`, {
    method: 'POST',
    headers: form.getHeaders(),
    body: form,
  });
}

/**
 * Descarga un archivo por su ID. Retorna un Buffer con el contenido binario.
 *
 * @param {string|number} fileId - ID del archivo
 * @returns {Promise<{data: Buffer, contentType: string, contentDisposition: string}>}
 */
async function downloadFile(fileId) {
  if (!fileId) throw new Error('[Storage] El parametro "fileId" es obligatorio.');
  return request(
    `/storage/files/${encodeURIComponent(fileId)}`,
    { method: 'GET' },
    true // indicar respuesta binaria
  );
}

/**
 * Obtiene los metadatos de un archivo (sin descargar el contenido).
 * @param {string|number} fileId - ID del archivo
 * @returns {Promise<object>}
 */
async function fileInfo(fileId) {
  if (!fileId) throw new Error('[Storage] El parametro "fileId" es obligatorio.');
  return request(`/storage/files/${encodeURIComponent(fileId)}/info`, {
    method: 'GET',
  });
}

/**
 * Reemplaza el contenido de un archivo existente.
 * @param {string|number} fileId - ID del archivo a reemplazar
 * @param {object} data - Nuevos datos del archivo
 * @returns {Promise<object>}
 */
async function replaceFile(fileId, data) {
  if (!fileId) throw new Error('[Storage] El parametro "fileId" es obligatorio.');
  return request(`/storage/files/${encodeURIComponent(fileId)}`, {
    method: 'PUT',
    body: data,
  });
}

/**
 * Elimina un archivo del storage.
 * @param {string|number} fileId - ID del archivo
 * @returns {Promise<object>}
 */
async function deleteFile(fileId) {
  if (!fileId) throw new Error('[Storage] El parametro "fileId" es obligatorio.');
  return request(`/storage/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
  });
}

module.exports = {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  listFiles,
  uploadFile,
  downloadFile,
  fileInfo,
  replaceFile,
  deleteFile,
};
