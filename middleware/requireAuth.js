// Blocks access to pages/API routes unless the visitor has an active session.
// API requests (fetch/XHR) get a 401 JSON response; normal page loads get
// redirected to the login page.
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();

  const isApi = req.path.startsWith('/api/') || req.headers.accept?.includes('application/json');
  if (isApi) {
    return res.status(401).json({ error: 'not_logged_in' });
  }
  return res.redirect('/auth/login.html');
}

module.exports = requireAuth;
