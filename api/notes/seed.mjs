// Writes SQL for some made-up notes, for working on the wall locally (npm run seed does the rest).
//   node seed.mjs [count] > seed.sql

import { MESSAGES, COLOURS } from '../../gallery/notes-messages.js';

const count = Number(process.argv[2] || 70);
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
  return `(${Math.floor(Math.random() * MESSAGES.length)}, ${Math.floor(Math.random() * COLOURS.length)}, ${place ? `'${place.replace(/'/g, "''")}'` : 'NULL'}, '${at}')`;
});
console.log(`INSERT INTO notes (message, colour, place, created_at) VALUES\n${rows.join(',\n')};`);
