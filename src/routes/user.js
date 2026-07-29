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

module.exports = router;
