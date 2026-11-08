// Where the note wall's API lives. api/notes/setup.sh fills in the live address when it publishes
// the API to Cloudflare. Working locally, `npm run dev` in api/notes runs it on port 8787.

const local = ['localhost', '127.0.0.1'].includes(location.hostname);

export const NOTES_API = local
  ? 'http://localhost:8787/api/notes'
  : 'https://tommoore-notes.tom-moore292.workers.dev/api/notes';
