# PersonalPlanner

A personal productivity dashboard for managing tasks, notes, meetings, team cascades, and push notifications — built as a single Node.js web application with a soft pink aesthetic.

## Features

- **Task Manager** — CRUD tasks with priorities (Urgent/High/Normal/Low), statuses (Pending/In Progress/Completed), due dates, reminders, checklists, recurring tasks, search, filters, and task history
- **Completed/Archived Tasks** — Completed tasks are preserved with full details and timestamps; can be reopened or permanently deleted
- **Desktop Alerts** — Full-window pink overlay for urgent and overdue tasks when the dashboard is active
- **Push Notifications** — Web Push via VAPID keys for phone notifications (Android/iOS PWA)
- **Background Reminders** — Server-side scheduling checks every minute for overdue tasks, upcoming deadlines, and recurring task generation
- **Notification Settings** — Fine-grained controls for notification types, quiet hours, timezone, snooze duration, sounds, and connected devices
- **Important Notes** — CRUD notes with pinning, categories, tags, important flag, archive/restore
- **Meeting Notes** — Full meeting records with attendees, agenda, decisions, action items; convert action items to tasks
- **Team Cascades** — Track announcements with statuses (To Cascade, Scheduled, Cascaded, Archived), deadlines, and reminders
- **Dashboard Overview** — Widgets for pending/urgent/overdue tasks, due today, upcoming deadlines, pinned notes, active cascades, and upcoming meetings
- **Global Search** — Search across tasks, notes, meetings, and cascades
- **Export/Import** — Full data backup and restore

## Architecture

- **Backend**: Node.js + Express
- **Database**: JSON file-based storage (`data/personalplanner.db.json`)
- **Frontend**: Vanilla JavaScript with Bootstrap 5
- **Push**: `web-push` library with VAPID keys
- **PWA**: Manifest + Service Worker for installable experience

## Setup

```bash
# 1. Clone the repository
git clone https://github.com/daniellecrizaldo781/personalplanner.git
cd personalplanner

# 2. Install dependencies
npm install

# 3. Generate VAPID keys for push notifications
node -e "const webpush = require('web-push'); const k = webpush.generateVAPIDKeys(); console.log('VAPID_PUBLIC_KEY=' + k.publicKey); console.log('VAPID_PRIVATE_KEY=' + k.privateKey);"

# 4. Create .env file from .env.example
cp .env.example .env
# Edit .env and paste your VAPID keys

# 5. Start the server
npm start
# For development with auto-restart:
npm run dev

# 6. Open http://localhost:3000
```

### Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3000) |
| `DATABASE_PATH` | Path to JSON database file |
| `SESSION_SECRET` | Session secret |
| `JWT_SECRET` | JWT secret |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |
| `BASE_URL` | Base URL for the app (e.g., https://personalplanner.daniellecrizaldo.com) |
| `AUTH_ENABLED` | Enable authentication (future) |

## Deployment

### Deploying to Render / Railway / Fly.io

1. Create a `web` service pointing to this repo
2. Set the build command: `npm install`
3. Set the start command: `node server.js`
4. Set the following environment variables:
   - `BASE_URL` → `https://personalplanner.daniellecrizaldo.com`
   - `VAPID_PUBLIC_KEY` → your VAPID public key
   - `VAPID_PRIVATE_KEY` → your VAPID private key
   - `SESSION_SECRET` → a random string
   - `JWT_SECRET` → a random string

### Custom Domain

Configure your DNS with a CNAME record:
```
personalplanner.daniellecrizaldo.com → CNAME → your-app-url
```

Set `BASE_URL=https://personalplanner.daniellecrizaldo.com` in production so push notifications and links resolve correctly.

### HTTPS

Push notifications require HTTPS. Any production deployment (Render, Railway, etc.) provides HTTPS automatically.

## Security Notes

- Secrets are loaded from environment variables — never committed to Git
- `.env` is in `.gitignore`
- `.env.example` contains placeholder values only
- API requests are rate-limited
- The JSON database file is in the `data/` directory (also gitignored)
- VAPID keys should be kept on the server side

## Data Storage

All data is persisted in a single JSON file (`data/personalplanner.db.json`), written atomically on every change. The file is never committed to Git.

## License

MIT
