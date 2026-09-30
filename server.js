const express = require('express');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const itemsRouter = require('./routes/items');
const authRouter = require('./routes/auth');
const reportsRouter = require('./routes/reports');
const feedbackRouter = require('./routes/feedback');
const feedbackAdminRouter = require('./routes/feedbackAdmin');
const requireAuth = require('./middleware/requireAuth');
require('./db/init'); // ensures tables exist on boot

const app = express();
// Port 80 is the standard web port, so staff can open the app without typing
// a port number at all. If something else on the PC is already using port 80,
// we fall back to 3000 automatically instead of failing to start.
const PREFERRED_PORT = process.env.PORT ? Number(process.env.PORT) : 80;
const FALLBACK_PORT = 3000;

// Same persistent-disk-friendly data directory as db/init.js.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'db');
require('fs').mkdirSync(DATA_DIR, { recursive: true });

// A session secret is generated once and reused on future restarts, so
// logged-in staff aren't signed out every time the app restarts.
const SESSION_SECRET_PATH = path.join(DATA_DIR, 'session-secret.txt');
let sessionSecret;
try {
  sessionSecret = require('fs').readFileSync(SESSION_SECRET_PATH, 'utf8').trim();
} catch {
  sessionSecret = crypto.randomBytes(32).toString('hex');
  require('fs').writeFileSync(SESSION_SECRET_PATH, sessionSecret);
}

app.set('trust proxy', 1);
app.use(express.json());
app.use(session({
  store: new FileStore({ path: path.join(DATA_DIR, 'sessions'), logFn: () => {} }),
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
    // 'auto' means: require HTTPS for the cookie when the request came in over
    // HTTPS (true on real hosting, which terminates TLS in front of the app),
    // but allow plain HTTP locally (localhost / iuk-inventory on this PC).
    secure: 'auto',
  },
}));

app.get('/health', (req, res) => res.json({ ok: true }));

// Login page + its assets are reachable without being logged in.
app.use('/auth', express.static(path.join(__dirname, 'public', 'auth')));
app.use('/api/auth', authRouter);

// Cafeteria feedback form + its submission endpoint are public too, so
// students can reach them straight from a QR code without logging in.
app.use('/feedback', express.static(path.join(__dirname, 'public', 'feedback')));
app.use('/api/feedback', feedbackRouter);

// Everything below this line requires a logged-in session.
app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/items', itemsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/feedback/admin', feedbackAdminRouter);

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

function startServer(port, isFallbackAttempt) {
  const server = app.listen(port, '0.0.0.0', () => {
    const suffix = port === 80 ? '' : `:${port}`;
    console.log(`Inventory app running:`);
    console.log(`  On this computer:  http://localhost${suffix}`);
    console.log(`  Or just:           http://iuk-inventory${suffix}  (after the one-time setup step)`);
    const lanAddresses = getLanAddresses();
    if (lanAddresses.length > 0) {
      for (const addr of lanAddresses) {
        console.log(`  On your network:   http://${addr}${suffix}`);
      }
    } else {
      console.log(`  On your network:   (no network connection detected)`);
    }
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && !isFallbackAttempt && port !== FALLBACK_PORT) {
      console.log(`Port ${port} is already in use on this PC, so switching to port ${FALLBACK_PORT} instead...`);
      startServer(FALLBACK_PORT, true);
    } else if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is also already in use. Close whatever is using it, or set a different PORT and try again.`);
      process.exit(1);
    } else {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    }
  });
}

startServer(PREFERRED_PORT, PREFERRED_PORT === FALLBACK_PORT);
