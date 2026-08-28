'use strict';

/**
 * SpiderChat — Rutas de Usuario
 *
 * GET /api/user/stats -> Tokens restantes y llamadas del dia
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('./auth');
const multer = require('multer');
const { storage } = require('../../api-client');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

router.use(requireAuth);

// Estadisticas del usuario: tokens y llamadas diarias
router.get('/stats', async (req, res, next) => {
  try {
    // Refrescar datos desde la BD remota y verificar reinicio diario de llamadas y tokens
    const { user } = await db.checkUserLimits(req.user.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const llamadasHoy = user.daily_calls_used;
    const tokensRemaining = user.tokens_remaining;
    const tokensUsed = Math.max(0, db.TOKEN_LIMIT - tokensRemaining);

    res.json({
      tokens_remaining:       tokensRemaining,
      tokens_total:           db.TOKEN_LIMIT,
      tokens_used:            tokensUsed,
      daily_calls_used:       llamadasHoy,
      daily_calls_limit:      db.DAILY_CALL_LIMIT,
      daily_calls_remaining:  Math.max(0, db.DAILY_CALL_LIMIT - llamadasHoy),
    });
  } catch (err) {
    next(err);
  }
});

// Actualizar perfil
router.put('/profile', upload.single('avatarFile'), async (req, res, next) => {
  try {
    const { name } = req.body;
    let finalAvatar = req.body.avatar || null;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    
    // Subir archivo al Storage si existe
    if (req.file) {
      let projectId = process.env.STORAGE_PROJECT_ID;

      if (!projectId) {
        const { projects } = await storage.listProjects();
        let proj = projects.find(p => p.name === 'SpiderChat');
        if (!proj) {
          proj = await storage.createProject({ name: 'SpiderChat', description: 'Archivos de la aplicacion SpiderChat' });
        }
        projectId = proj.id;
      }
      
      const uploadRes = await storage.uploadFile(projectId, [{
        name: `${req.user.id}-${Date.now()}-${req.file.originalname}`,
        buffer: req.file.buffer,
        mimeType: req.file.mimetype
      }]);
      
      if (uploadRes && uploadRes.success && uploadRes.files && uploadRes.files.length > 0) {
        finalAvatar = '/api/proxy/image?url=' + encodeURIComponent(uploadRes.files[0].url);
      }
    }
    
    const success = await db.updateUserProfile(req.user.id, name.trim(), finalAvatar ? finalAvatar.trim() : null);
    if (!success) {
      return res.status(500).json({ error: 'No se pudo actualizar el perfil.' });
    }
    
    res.json({ success: true, message: 'Perfil actualizado correctamente.', avatar: finalAvatar });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
