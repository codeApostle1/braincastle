/**
 * Authentication & Authorization Middleware
 * Protects creator/admin routes using secure server-side session checks
 */

/**
 * Middleware: Requires the user to have an active session
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to continue.'
    });
  }
  next();
}

/**
 * Middleware: Attaches user session information to response locals for templates or logging
 */
function attachUserToLocals(req, res, next) {
  res.locals.isAuthenticated = Boolean(req.session && req.session.userId);
  res.locals.currentUser = req.session ? req.session.user : null;
  next();
}

module.exports = {
  requireAuth,
  attachUserToLocals
};
