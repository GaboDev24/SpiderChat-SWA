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
router.get('/stats', (req, res) => {
  // Refrescar datos desde la DB para tener los valores mas actualizados
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  // Verificar si hay que reiniciar el contador diario
  const hoy = new Date().toISOString().split('T')[0];
  let llamadasHoy = user.daily_calls_used;
  if (user.last_call_date && user.last_call_date !== hoy) {
    llamadasHoy = 0;
  }

  res.json({
    tokens_remaining: user.tokens_remaining,
    tokens_total: db.TOKEN_LIMIT,
    tokens_used: db.TOKEN_LIMIT - user.tokens_remaining,
    daily_calls_used: llamadasHoy,
    daily_calls_limit: db.DAILY_CALL_LIMIT,
    daily_calls_remaining: Math.max(0, db.DAILY_CALL_LIMIT - llamadasHoy),
  });
});

module.exports = router;
