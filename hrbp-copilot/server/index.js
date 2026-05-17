const express = require('express');
const dotenv = require('dotenv');
const fs = require('fs/promises');
const path = require('path');
const session = require('express-session');
const crypto = require('crypto');

dotenv.config();

const app = express();
app.use(express.json({ limit: '5mb' }));

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'hrbp-copilot-db.json');

const AUTH_USER_ID = process.env.HRBP_AUTH_USER_ID || '';
const AUTH_PASSWORD = process.env.HRBP_AUTH_PASSWORD || '';
const SESSION_SECRET = process.env.HRBP_SESSION_SECRET || '';

if (!AUTH_USER_ID || !AUTH_PASSWORD) {
  // eslint-disable-next-line no-console
  console.warn('Auth is not configured. Set HRBP_AUTH_USER_ID and HRBP_AUTH_PASSWORD in .env');
}
if (!SESSION_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('HRBP_SESSION_SECRET is not set. Set it in .env for better security.');
}

app.use(
  session({
    name: 'hrbp.sid',
    secret: SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 1000 * 60 * 60 * 12, // 12h
    },
  })
);

function safeEqual(a, b) {
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  const len = Math.max(aBuf.length, bBuf.length);
  const aP = Buffer.concat([aBuf, Buffer.alloc(len - aBuf.length)]);
  const bP = Buffer.concat([bBuf, Buffer.alloc(len - bBuf.length)]);
  return crypto.timingSafeEqual(aP, bP) && aBuf.length === bBuf.length;
}

function requireAuth(req, res, next) {
  const ok = req.session && req.session.user && req.session.user.userId;
  if (!ok) return res.status(401).json({ ok: false, error: 'Unauthorized' });
  next();
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readDbFile() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (e) {
    if (e && e.code === 'ENOENT') return null;
    throw e;
  }
}

async function writeDbFile(payload) {
  await ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

function isValidPayload(p) {
  if (!p || typeof p !== 'object') return false;
  if (!Array.isArray(p.employees)) return false;
  if (!p.db || typeof p.db !== 'object') return false;
  return true;
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const userId = req.session && req.session.user ? req.session.user.userId : null;
  res.json({ ok: true, authed: Boolean(userId), userId });
});

app.post('/api/auth/login', (req, res) => {
  const userId = (req.body && req.body.userId) ? String(req.body.userId) : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';

  if (!AUTH_USER_ID || !AUTH_PASSWORD) {
    return res.status(500).json({ ok: false, error: 'Auth not configured on server' });
  }

  const userOk = safeEqual(userId, AUTH_USER_ID);
  const passOk = safeEqual(password, AUTH_PASSWORD);
  if (!userOk || !passOk) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

  req.session.user = { userId };
  res.json({ ok: true, userId });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/localdb', async (req, res) => {
  try {
    if (!req.session || !req.session.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const data = await readDbFile();
    res.json({ ok: true, data: data || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Failed to read local DB file' });
  }
});

app.post('/api/localdb', async (req, res) => {
  try {
    if (!req.session || !req.session.user) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const payload = req.body;
    if (!isValidPayload(payload)) {
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }
    await writeDbFile(payload);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message || 'Failed to write local DB file' });
  }
});

// Serve React build
app.use(express.static(path.join(__dirname, '..', 'build')));
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

const port = Number(process.env.PORT || process.env.LOCAL_DB_PORT || 5050);
app.listen(port, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Local DB server listening on http://0.0.0.0:${port}`);
  // eslint-disable-next-line no-console
  console.log(`DB file: ${DB_FILE}`);
});

