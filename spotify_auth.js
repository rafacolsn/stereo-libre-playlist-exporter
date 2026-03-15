require('dotenv').config();

const http = require('http');
const fs = require('fs');
const path = require('path');
const open = require('open').default;

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback';
const SCOPES = process.env.SPOTIFY_SCOPES || 'playlist-read-private playlist-read-collaborative';

if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
  console.error('Variables manquantes dans .env : SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REDIRECT_URI');
  process.exit(1);
}

const envPath = path.join(__dirname, '.env');

function upsertEnvVariable(key, value) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const escapedValue = String(value).replace(/\n/g, '');
  const line = `${key}=${escapedValue}`;

  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

function buildAuthorizeUrl(state) {
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('state', state);
  return url.toString();
}

async function exchangeCodeForTokens(code) {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }

  return response.json();
}

const state = Math.random().toString(36).slice(2);

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://127.0.0.1:8888');

    if (url.pathname !== '/callback') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Spotify auth error: ${error}`);
      server.close();
      return;
    }

    if (!code || returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Code ou state invalide.');
      server.close();
      return;
    }

    const tokenData = await exchangeCodeForTokens(code);

    upsertEnvVariable('SPOTIFY_ACCESS_TOKEN', tokenData.access_token);

    if (tokenData.refresh_token) {
      upsertEnvVariable('SPOTIFY_REFRESH_TOKEN', tokenData.refresh_token);
    }

    if (tokenData.expires_in) {
      upsertEnvVariable('SPOTIFY_TOKEN_EXPIRES_IN', tokenData.expires_in);
      upsertEnvVariable('SPOTIFY_TOKEN_OBTAINED_AT', Math.floor(Date.now() / 1000));
    }

    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Spotify autorisé. Tokens enregistrés dans .env. Tu peux fermer cette fenêtre.');

    console.log('✅ Tokens enregistrés dans .env');
    server.close();
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Erreur: ${err.message}`);
    console.error(err);
    server.close();
  }
});

server.listen(8888, '127.0.0.1', async () => {
  const authorizeUrl = buildAuthorizeUrl(state);
  console.log('Ouvre cette URL si le navigateur ne s’ouvre pas automatiquement :');
  console.log(authorizeUrl);
  await open(authorizeUrl);
});
