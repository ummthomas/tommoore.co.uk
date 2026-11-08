// Writes SQL for some made-up notes, for working on the wall locally (npm run seed does the rest).
//   node seed.mjs [count] > seed.sql

import { MESSAGES, COLOURS, BOARD, BOUNDS } from '../../gallery/notes-messages.js';

const count = Number(process.argv[2] || 50);
const PLACES = [
  'London, UK', 'Leeds, UK', 'Glasgow, UK', 'Bristol, UK', 'Manchester, UK', 'Lisbon, Portugal', 'Berlin, Germany',
  'Paris, France', 'Amsterdam, the Netherlands', 'New York, USA', 'Toronto, Canada', 'Osaka, Japan',
  'Melbourne, Australia', 'Cape Town, South Africa', 'São Paulo, Brazil', 'Dublin, Ireland', null,
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const start = Date.now() - count * 6 * 3600e3;
const rows = Array.from({ length: count }, (_, i) => {
  const place = pick(PLACES);
  const at = new Date(start + i * 6 * 3600e3).toISOString().slice(0, 19) + 'Z';
  const snap = (lo, hi) => lo + Math.floor(Math.random() * ((hi - lo) / BOARD.snap + 1)) * BOARD.snap;
  const where = `${snap(BOUNDS.x0, BOUNDS.x1)}, ${snap(BOUNDS.y0, BOUNDS.y1)}`;
  return `(${Math.floor(Math.random() * MESSAGES.length)}, ${Math.floor(Math.random() * COLOURS.length)}, ${where}, ${place ? `'${place.replace(/'/g, "''")}'` : 'NULL'}, '${at}')`;
});
console.log(`INSERT INTO notes (message, colour, x, y, place, created_at) VALUES\n${rows.join(',\n')};`);
