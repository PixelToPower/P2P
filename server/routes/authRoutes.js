const express = require('express');
const { signup } = require('../controllers/authController');

const router = express.Router();

// POST request to /api/auth/signup
router.post('/signup', signup);

module.exports = router;