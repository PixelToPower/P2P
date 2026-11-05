const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  try {
    // 1. Get the Authorization header from the incoming request
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // 2. Extract the token (split "Bearer <TOKEN>")
    const token = authHeader.split(' ')[1];

    // 3. Verify the token using your secret key
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Attach user info to the request object so controllers can use it
    req.user = decoded;

    // 5. Move on to the next function (the controller)
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

module.exports = verifyToken;