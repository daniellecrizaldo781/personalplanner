/**
 * Cloudflare Worker — Read AI proxy for "Danielle's Planner"
 * Holds OAuth tokens server-side, fetches meetings from api.read.ai,
 * and returns clean JSON to the static dashboard.
 */

const READAI_BASE = 'https://api.read.ai';

// Redirect users here to start OAuth
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const { pathname } = url;

  try {
    if (pathname === '/auth/start') return authStart(context, url);
    if (pathname === '/auth/callback') return authCallback(context, url);
    if (pathname === '/meetings') return getMeetings(context);
    return new Response('Not found', { status: 404 });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// Store tokens in WORKERS_KV: readai_oauth
const KV = 'WORKERS_KV';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*' },
  });
}

async function authStart(context, url) {
  const clientId = context.env.READAI_CLIENT_ID;
  const redirect = new URL('/auth/callback', url.origin).toString();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirect,
    scope: 'read',
  });
  // Read AI OAuth — adjust authorize URL per its current doc
  const authorizeUrl = context.env.READAI_AUTH_URL || 'https://api.read.ai/oauth/authorize';
  return Response.redirect(`${authorizeUrl}?${params}`);
}

async function authCallback(context, url) {
  const clientId = context.env.READAI_CLIENT_ID;
  const clientSecret = context.env.READAI_CLIENT_SECRET;
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'Missing code' }, 400);

  const redirect = new URL('/auth/callback', url.origin).toString();
  const tokenRes = await fetch('https://api.read.ai/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirect,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token) return json({ error: 'Token exchange failed', detail: tokens }, 502);

  await context.env[KV].put('access_token', tokens.access_token, { expirationTtl: tokens.expires_in || 3600 });
  await context.env[KV].put('refresh_token', tokens.refresh_token || '');

  return Response.redirect(url.origin + '?auth=success');
}

async function getMeetings(context) {
  const access = await context.env[KV].get('access_token');
  if (!access) return json({ error: 'Not connected. Start OAuth first.', needsAuth: true }, 401);

  const res = await fetch(`${READAI_BASE}/v1/meetings?expand[]=summary&expand[]=action_items`, {
    headers: { Authorization: `Bearer ${access}`, Accept: 'application/json' },
  });
  if (res.status === 401) return json({ error: 'Token expired, reconnect', needsAuth: true }, 401);
  const data = await res.json();

  const out = (Array.isArray(data) ? data : data.data || data.meetings || []).map(m => ({
    id: m.id,
    title: m.title || 'Untitled',
    date_time: m.start_time ? new Date(m.start_time).toISOString() : null,
    summary: m.summary || '',
    action_items: (m.action_items || []).map(a => ({ text: a.text || a.description || '', assignee: a.assignee || null })),
  }));

  return json({ meetings: out });
}
