// Inside server/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  signupUser,
  loginUser,
  socialLogin,
  resetPassword,
  setAppPassword,
  verifyAppPassword
} = require('../controllers/authController');

router.post('/signup', signupUser);
router.post('/login', loginUser);
router.post('/social-login', socialLogin);
router.post('/reset-password', resetPassword);
router.post('/set-app-password', setAppPassword);
router.post('/verify-app-password', verifyAppPassword);

module.exports = router;