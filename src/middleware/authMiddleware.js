const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

console.log('=== AUTH MIDDLEWARE LOADED ===');
console.log('JWT_SECRET is set:', !!process.env.JWT_SECRET);
console.log('Using JWT_SECRET:', JWT_SECRET);

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  console.log('[MIDDLEWARE] Auth header present:', !!authHeader);
  
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  
  const token = authHeader.split(' ')[1];
  
  console.log('[MIDDLEWARE] Token extracted:', token ? `${token.substring(0, 20)}...` : 'none');
  
  if (!token) return res.status(401).json({ error: 'Missing token' });
  
  try {
    console.log('[MIDDLEWARE] Verifying token with secret:', JWT_SECRET);
    const payload = jwt.verify(token, JWT_SECRET);
    console.log('[MIDDLEWARE] Token verified successfully for user:', payload.id);
    req.user = payload;
    next();
  } catch (err) {
    console.error('[MIDDLEWARE] Token verification FAILED:', err.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};