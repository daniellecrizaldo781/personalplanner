# Danielle's Planner

A polished, personal productivity dashboard built as a self-contained static web application. Designed with a soft pastel pink aesthetic, Danielle's Planner provides task management, important notes, meeting notes, team cascades, and global search — all running entirely in your browser with no backend required.

## Features

- **Task Manager** — Add, edit, delete, organize, search, and filter tasks with priorities (Urgent, High, Normal, Low), statuses (Pending, In Progress, Completed), due dates, checklists, and recurring task support.
- **Completed Tasks** — Completed tasks automatically move to an archived view with completion timestamps. Tasks can be reopened, edited, or permanently deleted.
- **Important Notes** — Create, pin, tag, categorize, archive, and search notes. Link notes to tasks, meetings, or cascades.
- **Meeting Notes** — Record meeting details with attendees, agenda, discussion notes, decisions, and action items. Convert action items into tasks.
- **Team Cascades** — Track announcements and instructions with statuses (To Cascade, Scheduled, Cascaded, Archived), deadlines, and source links.
- **Global Search** — Search across tasks, notes, meetings, and cascades from the top bar.
- **Dark / Light Theme** — Toggle between light and dark modes.
- **Data Export / Import** — Back up your data as JSON and restore it at any time.
- **Responsive Layout** — Works on desktop, tablet, and mobile.

## Technology

- HTML, CSS (vanilla), and JavaScript (no frameworks)
- [Bootstrap 5](https://getbootstrap.com/) + [Bootstrap Icons](https://icons.getbootstrap.com/) from CDN for UI components
- [Day.js](https://day.js.org/) for date formatting
- [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) for all data persistence

## Data Storage

All data is stored in your browser's `localStorage` under the `pp_` prefix. This means:

- ✅ Data persists across page refreshes and browser restarts.
- ✅ Data stays on your device — nothing is sent to a server.
- ⚠️ Data is **not** synced across devices or browsers. To transfer data between devices, use the **Export Data** feature in Settings and import the JSON file on the other device.

## Deployment

Hosted via **GitHub Pages** at `https://personalplanner.daniellecrizaldo.com`.

The `CNAME` file configures the custom domain. The only external setup required is the Cloudflare DNS CNAME record pointing `personalplanner.daniellecrizaldo.com` to the GitHub Pages site.

## Development

No build step is required. Simply:

```bash
git clone https://github.com/daniellecrizaldo781/personalplanner.git
cd personalplanner
# Open index.html in your browser
```

## Environment Variables

This is a purely static application — no environment variables, API keys, or secrets are needed.
