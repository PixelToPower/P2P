const User = require('../models/user');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client();

const requireDatabase = (res) => {
  if (mongoose.connection.readyState === 1) return true;
  res.status(503).json({
    error: 'Database unavailable',
    details: 'The authentication database is not connected. Please start the server database and try again.'
  });
  return false;
};

// --- 1. SIGNUP API LOGIC ---
const signupUser = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { username, email, password } = req.body;
    if (!username?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Full name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered. Please login instead.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username: username.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      authProvider: 'local',
      appPasswordSet: true,
      emailVerified: false
    });
    return res.status(201).json({
      message: 'Account created successfully!',
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ error: 'This email is already registered. Please login instead.' });
    }
    return res.status(500).json({ error: 'Server error during signup', details: error.message });
  }
};

// --- 2. LOGIN API LOGIC ---
const loginUser = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({ error: 'Account not found. Sign up with a verified Google account.' });
    }
    if (user.authProvider === 'google' || user.googleId || user.emailVerified) {
      return res.status(400).json({ error: 'Use Continue with Google to verify this account.' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Create JWT Token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    res.status(500).json({ error: 'Server error during login', details: error.message });
  }
};

const socialLogin = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { provider, credential } = req.body;
    if (provider !== 'Google' || !credential) {
      return res.status(400).json({ error: 'Invalid social sign-in request.' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured on this server.' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const googleUser = ticket.getPayload();
    if (!googleUser?.email || googleUser.email_verified !== true) {
      return res.status(401).json({ error: 'Google could not verify this email.' });
    }
    const email = googleUser.email.toLowerCase();
    let user = await User.findOne({ email });
    if (!user) {
      const randomPassword = await bcrypt.hash(
        `google:${googleUser.sub}:${crypto.randomBytes(24).toString('hex')}`,
        10
      );
      user = await User.create({
        username: googleUser.name || email.split('@')[0],
        email,
        password: randomPassword,
        googleId: googleUser.sub,
        authProvider: 'google',
        appPasswordSet: false,
        emailVerified: true,
        verifiedAt: new Date()
      });
    } else if (!user.googleId) {
      user.googleId = googleUser.sub;
      user.authProvider = 'google';
      user.emailVerified = true;
      user.verifiedAt = new Date();
      await user.save();
    }

    return res.json({
      message: `${provider} sign-in successful!`,
      appPasswordSet: Boolean(user.appPasswordSet),
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Social sign-in failed.', details: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { credential, password } = req.body;
    if (!credential || !password || password.length < 6) {
      return res.status(400).json({ error: 'Google verification and a new passkey are required.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured.' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const googleUser = ticket.getPayload();
    if (!googleUser?.email || googleUser.email_verified !== true) {
      return res.status(401).json({ error: 'Google could not verify this account.' });
    }
    const email = googleUser.email.toLowerCase();
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'No account exists with that email.' });
    }
    user.password = await bcrypt.hash(password, 10);
    await user.save();
    return res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to reset password.', details: error.message });
  }
};

const setAppPassword = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { credential, password } = req.body;
    if (!credential || !password || password.length < 6) {
      return res.status(400).json({ error: 'Your P2P passkey must be at least 6 characters.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured.' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const googleUser = ticket.getPayload();
    if (!googleUser?.email || googleUser.email_verified !== true) {
      return res.status(401).json({ error: 'Google could not verify this account.' });
    }
    const user = await User.findOne({ email: googleUser.email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    user.password = await bcrypt.hash(password, 10);
    user.appPasswordSet = true;
    await user.save();
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    return res.json({ message: 'P2P passkey created successfully.', token });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to set P2P passkey.', details: error.message });
  }
};

const verifyAppPassword = async (req, res) => {
  try {
    if (!requireDatabase(res)) return;
    const { credential, email, password } = req.body;
    if (!credential || !email || !password) {
      return res.status(400).json({ error: 'Email and P2P passkey are required.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in is not configured.' });
    }
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const googleUser = ticket.getPayload();
    if (!googleUser?.email || googleUser.email_verified !== true) {
      return res.status(401).json({ error: 'Google could not verify this account.' });
    }
    if (googleUser.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(401).json({ error: 'Verified Google account does not match this P2P account.' });
    }
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Incorrect P2P passkey.' });
    }
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    return res.json({ ok: true, token });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to verify P2P passkey.', details: error.message });
  }
};

// --- EXPORT BOTH FUNCTIONS ---
module.exports = {
  signupUser,
  loginUser,
  socialLogin,
  resetPassword,
  setAppPassword,
  verifyAppPassword
};

