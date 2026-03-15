```markdown
# Stereo Libre Spotify Playlist Exporter

![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Spotify API](https://img.shields.io/badge/API-Spotify-1DB954)

A small Node.js tool used for the **Stereo Libre radio show**.

It automatically:

- fetches the show playlist from Spotify
- exports the playlist to a `.txt` file
- sends the playlist by email

Perfect for archiving radio playlists or sharing them after a broadcast.

---

# Features

- Spotify API integration
- automatic token refresh
- playlist export to text file
- email delivery via SMTP
- cron-friendly execution
- lightweight (no database required)

---

# Example Output

```

Stereo Libre — 2026-03-08

1. Massive Attack — Teardrop
2. PJ Harvey — Down By The Water
3. Nick Cave & The Bad Seeds — Red Right Hand
4. Portishead — Roads

````

The same content is also sent in the email body.

---

# Installation

## Clone the repository

```bash
git clone https://github.com/YOUR_USER/stereo-libre-playlist-exporter.git
cd stereo-libre-playlist-exporter
````

## Install dependencies

```bash
npm install
```

---

# Configuration

Create a `.env` file at the root of the project.

```
touch .env
```

Example configuration:

```env
SPOTIFY_CLIENT_ID=xxxxxxxx
SPOTIFY_CLIENT_SECRET=xxxxxxxx
SPOTIFY_ACCESS_TOKEN=xxxxxxxx
SPOTIFY_REFRESH_TOKEN=xxxxxxxx
PLAYLIST_ID=xxxxxxxx

MAIL_HOST=smtp.gmail.com
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=your@email.com
MAIL_PASS=app_password
MAIL_FROM="Stereo Libre <your@email.com>"
MAIL_TO=destination@email.com
```

⚠️ The `.env` file should **never be committed to Git**.

---

# Spotify Setup

1. Go to the Spotify developer dashboard

[https://developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)

2. Create a new application.

3. Add the redirect URI:

```
http://127.0.0.1:8888/callback
```

4. Run the authentication script:

```bash
node spotify_auth.js
```

This will generate:

```
SPOTIFY_ACCESS_TOKEN
SPOTIFY_REFRESH_TOKEN
```

---

# Usage

Run the exporter:

```bash
node export_playlist.js
```

The script will:

1. refresh the Spotify access token
2. fetch all playlist tracks
3. export the playlist to

```
exports/playlist-YYYY-MM-DD.txt
```

4. send the playlist by email

---

# Automation

You can automate the script with a cron job.

Example:

```bash
crontab -e
```

Add:

```
15 22 * * 0 node /path/to/export_playlist.js
```

This will run the script every **Sunday at 22:15**.

---

# Project Structure

```
stereo-libre-playlist-exporter
│
├── export_playlist.js
├── spotify_auth.js
├── package.json
├── .gitignore
├── README.md
└── exports/
```

---

# Use Case

This project was created for the **Stereo Libre radio show** to:

* automatically archive playlists
* share the playlist after each episode
* keep a simple historical record of broadcasts

---
