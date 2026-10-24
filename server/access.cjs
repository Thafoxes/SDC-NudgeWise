const { createHash, createHmac, timingSafeEqual } = require('node:crypto');

const COOKIE = 'nudgewise_demo';
const SESSION_SECONDS = 12 * 60 * 60;
const digest = value => createHash('sha256').update(String(value)).digest();
const equal = (a, b) => timingSafeEqual(digest(a), digest(b));

function createAccessGuard() {
  const key = process.env.DEMO_ACCESS_KEY || '';
  const publicKeyMissing = !!process.env.PORT && !key.trim();
  let attempts = 0, windowEnds = 0;
  const sign = payload => createHmac('sha256', key).update(payload).digest('hex');
  function authenticated(req) {
    if (!key || equal(req.headers['x-demo-key'] || '', key)) return true;
    const token = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    if (!token) return false;
    const [expires, signature, extra] = token.split('.');
    return !extra && /^\d+$/.test(expires) && Number(expires) > Date.now()
      && Number(expires) <= Date.now() + SESSION_SECONDS * 1000
      && !!signature && equal(signature, sign(expires));
  }
  return async function guard(req, res, json) {
    if (publicKeyMissing) {
      json(503, { error: 'Public demo access is not configured' });
      return false;
    }
    if (req.url !== '/api/access') {
      if (authenticated(req)) return true;
      json(401, { error: 'Demo access required' });
      return false;
    }
    if (req.method === 'GET') {
      json(200, { required: !!key, authenticated: authenticated(req) });
      return false;
    }
    if (req.method !== 'POST') { json(405, { error: 'Method not allowed' }); return false; }
    // One bounded, process-wide window; do not trust spoofable forwarded IPs.
    if (Date.now() >= windowEnds) { attempts = 0; windowEnds = Date.now() + 60000; }
    if (++attempts > 30) {
      res.setHeader('Retry-After', Math.ceil((windowEnds - Date.now()) / 1000));
      json(429, { error: 'Too many attempts. Please wait one minute.' });
      return false;
    }
    if (!req.headers['content-type']?.startsWith('application/json')) {
      json(415, { error: 'JSON required' }); return false;
    }
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 4096) { json(413, { error: 'Request too large' }); return false; }
    }
    let supplied;
    try { supplied = JSON.parse(raw).key; } catch { json(400, { error: 'Invalid JSON' }); return false; }
    if (key && (typeof supplied !== 'string' || !equal(supplied, key))) {
      json(401, { error: 'Incorrect passcode' }); return false;
    }
    const expires = String(Date.now() + SESSION_SECONDS * 1000);
    // Replit terminates HTTPS at its trusted proxy.
    const secure = req.socket.encrypted || req.headers['x-forwarded-proto']?.split(',')[0].trim() === 'https';
    // Partition HTTPS sessions so access also works inside the workspace preview
    // iframe. The API origin check still rejects cross-origin login/commands.
    const cookiePolicy = secure ? 'SameSite=None; Secure; Partitioned' : 'SameSite=Strict';
    res.setHeader('Set-Cookie', `${COOKIE}=${expires}.${sign(expires)}; Path=/api; HttpOnly; ${cookiePolicy}; Max-Age=${SESSION_SECONDS}`);
    json(200, { authenticated: true, required: !!key });
    return false;
  };
}

module.exports = { createAccessGuard };
