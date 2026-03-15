require('dotenv').config();

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_ID = process.env.PLAYLIST_ID;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;
let ACCESS_TOKEN = process.env.SPOTIFY_ACCESS_TOKEN;

const MAIL_HOST = process.env.MAIL_HOST;
const MAIL_PORT = Number(process.env.MAIL_PORT || 465);
const MAIL_SECURE = String(process.env.MAIL_SECURE || 'true') === 'true';
const MAIL_USER = process.env.MAIL_USER;
const MAIL_PASS = process.env.MAIL_PASS;
const MAIL_FROM = process.env.MAIL_FROM || MAIL_USER;
const MAIL_TO = process.env.MAIL_TO;

if (!CLIENT_ID || !CLIENT_SECRET || !PLAYLIST_ID || !REFRESH_TOKEN) {
  console.error('Variables manquantes dans .env');
  process.exit(1);
}

if (!MAIL_HOST || !MAIL_USER || !MAIL_PASS || !MAIL_TO) {
  console.error('Variables email manquantes dans .env');
  process.exit(1);
}

const envPath = path.join(__dirname, '.env');
const exportDir = path.join(__dirname, 'exports');

function upsertEnvVariable(key, value) {
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  const line = `${key}=${String(value).replace(/\n/g, '')}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    content = content.trimEnd() + `\n${line}\n`;
  }

  fs.writeFileSync(envPath, content, 'utf8');
}

async function refreshAccessToken() {
  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: REFRESH_TOKEN,
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
    throw new Error(`Refresh token failed: ${response.status} ${text}`);
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Aucun access_token renvoyé');
  }

  ACCESS_TOKEN = data.access_token;
  upsertEnvVariable('SPOTIFY_ACCESS_TOKEN', data.access_token);

  if (data.expires_in) {
    upsertEnvVariable('SPOTIFY_TOKEN_EXPIRES_IN', data.expires_in);
    upsertEnvVariable('SPOTIFY_TOKEN_OBTAINED_AT', Math.floor(Date.now() / 1000));
  }

  return data.access_token;
}

async function spotifyGet(url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
    },
  });

  if (response.status === 401) {
    await refreshAccessToken();

    const retry = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
      },
    });

    const retryText = await retry.text();

    if (!retry.ok) {
      throw new Error(`Spotify GET failed after refresh: ${retry.status} ${retryText}`);
    }

    return JSON.parse(retryText);
  }

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Spotify GET failed: ${response.status} ${text}`);
  }

  return JSON.parse(text);
}
async function getAllPlaylistTracks(playlistId) {
  let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100`;
  const items = [];

  while (url) {
    const data = await spotifyGet(url);

    if (!Array.isArray(data.tracks.items)) {
      console.error('Réponse Spotify inattendue :');
      console.error(JSON.stringify(data, null, 2));
      throw new Error('data.items n’est pas un tableau');
    }

    items.push(...data.tracks.items);
    url = data.next;
  }

  return items;
}
function formatTrack(item, index) {
  const track = item.track;
  if (!track) {
    return `${String(index + 1).padStart(2, '0')}. [Piste indisponible]`;
  }

  const artists = (track.artists || []).map(a => a.name).join(', ');
  return `${String(index + 1).padStart(2, '0')}. ${artists} — ${track.name}`;
}

async function sendEmail({ subject, text, attachmentPath }) {
  const transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: MAIL_PORT,
    secure: MAIL_SECURE,
    auth: {
      user: MAIL_USER,
      pass: MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: MAIL_FROM,
    to: MAIL_TO,
    subject,
    text
  });
}

async function main() {
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  await refreshAccessToken();

  const tracks = await getAllPlaylistTracks(PLAYLIST_ID);
  const lines = tracks.map(formatTrack);

  const now = new Date();
  const date = now.toISOString().slice(0, 10);

  const content = [
    `Stéréo Libre — ${date}`,
    '',
    ...lines,
    '',
  ].join('\n');

  const outputPath = path.join(exportDir, `playlist-${date}.txt`);
  fs.writeFileSync(outputPath, content, 'utf8');

  await sendEmail({
    subject: `Playlist Diffusion - Stéréo Libre — ${date}`,
    text: `Voici la playlist exportée de Stéréo Libre pour le ${date}.`,
    text: content,
  });

  console.log(`✅ Export créé : ${outputPath}`);
  console.log(`✅ Email envoyé à : ${MAIL_TO}`);

  console.log(`✅ Export créé : ${outputPath}`);
}

main().catch(err => {
  console.error('❌ Erreur :', err.message);
  process.exit(1);
});