// server/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');

// GET /api/users/me (Protected Route)
router.get('/me', verifyToken, async (req, res) => {
  try {
    // req.user was attached inside our verifyToken middleware!
    res.status(200).json({
      message: 'You have accessed a protected route!',
      user: req.user
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;