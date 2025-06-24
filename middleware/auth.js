// middleware/auth.js
const authenticate = (req, res, next) => {
  try {
    const userCookie = req.cookies.user_session;
    
    if (userCookie) {
      req.user = JSON.parse(userCookie);
    } else {
      req.user = null;
    }
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Login necessário',
      code: 'UNAUTHORIZED'
    });
  }
  next();
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Login necessário',
        code: 'UNAUTHORIZED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Permissão insuficiente',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  requireAuth,
  authorize
};