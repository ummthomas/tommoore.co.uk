// The note wall in the foyer: visitors stick up a note that says hello from where they are.
//
// The notes live on the server (api/notes/server.mjs). Here they're drawn onto one canvas, which
// hangs on the wall as a single picture, and the reading panel becomes the place to make one.
// Each note has a fixed spot on the board, picked from its number, so the wall looks the same on
// every visit. New notes land on top of old ones, so the board fills up in layers.

import { MESSAGES, COLOURS, UNKNOWN_PLACE } from './notes-messages.js';
import { NOTES_API } from './notes-config.js';

const API = NOTES_API;
const NOTE = 40; // cm
const GAP = 4;
const HEADER = 44;
const MARGIN = 16;
const BOARD = '#F7F5F0';
const INK = '#1E1E1E';
const LOW = '#5D5A54';
const BRAND = '#1BA9DF';
const SERIF = '"Libre Baskerville", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", sans-serif';

const escapeHtml = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A steady pseudo-random number in [0, 1) from a note's id and a salt
function hash(id, salt) {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 1, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

function ago(iso) {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!(seconds >= 0)) return '';
  const units = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let value = seconds;
  for (const [size, name] of units) {
    if (value < size) {
      const n = Math.floor(value);
      if (name === 'second') return 'just now';
      return `${n} ${name}${n === 1 ? '' : 's'} ago`;
    }
    value /= size;
  }
  return '';
}

export function createNoteWall(ex, kit) {
  const { THREE, renderer, canvasOf, setFont, wrap, lift, revealTexture, planeGeometry, layer, pixelsPerMetre } = kit;
  const width = ex.w * 100;
  const height = ex.h * 100;

  // Spots on the board, in a grid with a little play
  const cols = Math.floor((width - MARGIN * 2 + GAP) / (NOTE + GAP));
  const rows = Math.floor((height - HEADER - MARGIN + GAP) / (NOTE + GAP));
  const slots = cols * rows;
  const stepX = (width - MARGIN * 2 - NOTE) / Math.max(cols - 1, 1);
  const stepY = (height - HEADER - MARGIN - NOTE) / Math.max(rows - 1, 1);
  // Walk the grid in big strides, so a run of new notes spreads across the board
  let stride = Math.round(slots * 0.618);
  while (gcd(stride, slots) !== 1) stride++;

  const wall = {
    notes: [],
    total: 0,
    places: 0,
    more: false,
    me: null,
    status: 'loading', // loading, ready, offline
    pick: { m: Math.floor(Math.random() * MESSAGES.length), c: Math.floor(Math.random() * COLOURS.length) },
    posting: false,
    landing: null,
    panel: null,
  };

  function spot(note) {
    const slot = (note.id * stride) % slots;
    const col = slot % cols;
    const row = Math.floor(slot / cols);
    return {
      x: MARGIN + NOTE / 2 + col * stepX + (hash(note.id, 1) - 0.5) * 7,
      y: HEADER + NOTE / 2 + row * stepY + (hash(note.id, 2) - 0.5) * 7,
      angle: (hash(note.id, 3) - 0.5) * 0.14,
    };
  }

  function drawNote(c, note) {
    const half = NOTE / 2;
    c.save();
    c.shadowColor = 'rgba(30, 24, 10, .2)';
    c.shadowBlur = 2.4;
    c.shadowOffsetY = 1.1;
    c.fillStyle = COLOURS[note.c] || COLOURS[0];
    c.fillRect(-half, -half, NOTE, NOTE);
    c.restore();
    // The sticky strip along the top is a shade darker
    c.fillStyle = 'rgba(0, 0, 0, .05)';
    c.fillRect(-half, -half, NOTE, 6);

    const left = -half + 4;
    let y = -half + 12.5;
    setFont(c, `500 3.6px ${SANS}`);
    c.fillStyle = LOW;
    c.fillText(`${MESSAGES[note.m] || MESSAGES[0]} from`, left, y);

    // Long places get smaller type, so the whole name fits on three lines
    const place = note.place || UNKNOWN_PLACE;
    let size;
    let lines;
    for (size of [5.4, 4.6, 3.9]) {
      lines = wrap(place, `400 ${size}px ${SERIF}`, NOTE - 8, -0.05);
      if (lines.length <= 3) break;
    }
    setFont(c, `400 ${size}px ${SERIF}`, -0.05);
    c.fillStyle = INK;
    lines.slice(0, 4).forEach((line) => {
      y += size * 1.37;
      c.fillText(line, left, y);
    });
  }

  function drawBoard() {
    const limit = Math.min(renderer.capabilities.maxTextureSize, 4096);
    const ppcm = Math.min(pixelsPerMetre / 100, limit / width, limit / height);
    const [canvas, c] = canvasOf(Math.ceil(width * ppcm), Math.ceil(height * ppcm));
    c.scale(ppcm, ppcm);
    c.fillStyle = BOARD;
    c.fillRect(0, 0, width, height);

    setFont(c, `400 15px ${SERIF}`, -0.2);
    c.fillStyle = INK;
    c.fillText('Notes from visitors', MARGIN, 26);
    setFont(c, `400 8px ${SANS}`);
    c.fillStyle = LOW;
    c.textAlign = 'right';
    const count = wall.total
      ? `${wall.total} ${wall.total === 1 ? 'note' : 'notes'} from ${wall.places} ${wall.places === 1 ? 'place' : 'places'}. Leave yours.`
      : 'Leave a note';
    c.fillText(count, width - MARGIN, 25);
    c.textAlign = 'left';
    c.save();
    c.strokeStyle = 'rgba(27, 169, 223, .7)';
    c.lineWidth = 0.8;
    c.setLineDash([2.4, 1.6]);
    c.beginPath();
    c.moveTo(MARGIN, 34);
    c.lineTo(width - MARGIN, 34);
    c.stroke();
    c.restore();

    // Two layers' worth, oldest first, so the newest sit on top
    const shown = wall.notes.slice(0, slots * 2).filter((note) => note !== wall.landing?.note).reverse();
    shown.forEach((note) => {
      const { x, y, angle } = spot(note);
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      drawNote(c, note);
      c.restore();
    });

    if (!shown.length && wall.status !== 'loading') {
      // An empty spot, waiting for the first note
      const { x, y } = spot({ id: 1 });
      c.save();
      c.translate(x, y);
      c.strokeStyle = BRAND;
      c.lineWidth = 0.8;
      c.setLineDash([2.4, 1.6]);
      c.strokeRect(-NOTE / 2, -NOTE / 2, NOTE, NOTE);
      setFont(c, `400 5px ${SERIF}`);
      c.fillStyle = INK;
      wrap('Be the first to leave a note', `400 5px ${SERIF}`, NOTE - 8).forEach((line, i) => c.fillText(line, -NOTE / 2 + 4, -NOTE / 2 + 13 + i * 7));
      c.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  function refresh() {
    const old = ex.material.map;
    revealTexture(ex.material, drawBoard());
    if (old) old.dispose();
  }

  async function getJson(url, options) {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || response.statusText), { code: body.error, status: response.status });
    return body;
  }

  async function load() {
    try {
      const [list, me] = await Promise.all([getJson(API), getJson(`${API}/me`)]);
      wall.notes = list.notes;
      wall.total = list.total;
      wall.places = list.places;
      wall.more = list.more;
      wall.me = me;
      wall.status = 'ready';
    } catch (error) {
      console.warn('Gallery: the note wall is offline', error);
      wall.status = 'offline';
    }
    refresh();
    renderPanel();
  }

  async function loadOlder() {
    const last = wall.notes[wall.notes.length - 1];
    if (!last) return;
    try {
      const list = await getJson(`${API}?before=${last.id}`);
      wall.notes.push(...list.notes);
      wall.more = list.more;
    } catch {
      wall.more = false;
    }
    renderPanel();
  }

  async function stick() {
    if (wall.posting || !wall.me?.canPost) return;
    wall.posting = true;
    renderPanel();
    try {
      const { note } = await getJson(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(wall.pick),
      });
      wall.notes.unshift(note);
      wall.total += 1;
      if (!wall.notes.slice(1).some((other) => (other.place || '') === (note.place || ''))) wall.places += 1;
      wall.me = { ...wall.me, canPost: false, justPosted: true };
      land(note);
    } catch (error) {
      if (error.code === 'tomorrow') wall.me = { ...wall.me, canPost: false };
      else wall.problem = error.code === 'full' ? 'The wall’s had a busy day and is full until tomorrow.' : 'That didn’t stick. Try again in a moment.';
    }
    wall.posting = false;
    renderPanel();
  }

  /* -------------------------------------------------------------------- A new note landing */

  // The new note is its own little picture for a moment, dropping onto the board, then joins it
  function land(note) {
    const [canvas, c] = canvasOf(Math.ceil(NOTE * 1.2 * 6), Math.ceil(NOTE * 1.2 * 6));
    c.scale(6, 6);
    c.translate(NOTE * 0.6, NOTE * 0.6);
    drawNote(c, note);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = lift(new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), layer);
    const mesh = new THREE.Mesh(planeGeometry, material);
    mesh.renderOrder = layer;
    const { x, y, angle } = spot(note);
    mesh.position.set(x / 100 - ex.w / 2, ex.h / 2 - y / 100, ex.faceZ + 0.03);
    ex.group.add(mesh);
    wall.landing = { note, mesh, angle, t: 0 };
    refresh();
  }

  function update(dt) {
    const landing = wall.landing;
    if (!landing) return;
    landing.t = Math.min(1, landing.t + dt / 0.55);
    const e = 1 - (1 - landing.t) ** 3;
    const size = (NOTE * 1.2 / 100) * (1.35 - 0.35 * e);
    landing.mesh.scale.set(size, size, 1);
    landing.mesh.rotation.z = -(landing.angle + (1 - e) * 0.35);
    landing.mesh.material.opacity = Math.min(1, landing.t * 3);
    if (landing.t === 1) {
      wall.landing = null;
      refresh();
      ex.group.remove(landing.mesh);
      landing.mesh.material.map.dispose();
      landing.mesh.material.dispose();
    }
  }

  /* ----------------------------------------------------------------------------- The panel */

  function makerHtml() {
    if (wall.status === 'loading') return '<p class="body g-note-status" tabindex="-1">Finding the pins…</p>';
    if (wall.status === 'offline') return '<p class="body g-note-status" tabindex="-1">The wall isn’t taking notes just now. Come back a little later.</p>';
    const { me, pick } = wall;
    if (!me.canPost) {
      return me.justPosted
        ? '<p class="body g-note-status" tabindex="-1"><strong>You’re on the wall.</strong> Thanks for stopping by. You can leave another tomorrow.</p>'
        : '<p class="body g-note-status" tabindex="-1">You’ve left a note today already. Come back tomorrow to leave another.</p>';
    }
    const colours = COLOURS.map((colour, i) => `
      <label class="g-note-swatch" style="--note: ${colour}">
        <input type="radio" name="note-colour" value="${i}" ${i === pick.c ? 'checked' : ''} aria-label="Colour ${i + 1}">
        <span aria-hidden="true"></span>
      </label>`).join('');
    return `
      <div class="g-note-maker">
        <div class="g-note" style="--note: ${COLOURS[pick.c]}">
          <span class="g-note-lead">${escapeHtml(MESSAGES[pick.m])} from</span>
          <span class="g-note-place">${escapeHtml(me.place || UNKNOWN_PLACE)}</span>
        </div>
        <div class="g-note-controls">
          <button class="btn btn--secondary g-note-shuffle" type="button">Another message</button>
          <fieldset class="g-note-colours"><legend class="caption-regular">Colour</legend>${colours}</fieldset>
        </div>
      </div>
      <button class="btn btn--primary g-note-stick" type="button" ${wall.posting ? 'aria-disabled="true"' : ''}>${wall.posting ? 'Sticking…' : 'Stick it on the wall'}</button>
      ${wall.problem ? `<p class="caption-regular g-note-problem" role="alert">${escapeHtml(wall.problem)}</p>` : ''}`;
  }

  function listHtml() {
    if (!wall.notes.length) return '';
    const items = wall.notes.map((note) => `
      <li>
        <span class="g-note-dot" style="--note: ${COLOURS[note.c] || COLOURS[0]}" aria-hidden="true"></span>
        <span>${escapeHtml(MESSAGES[note.m] || MESSAGES[0])} from ${escapeHtml(note.place || UNKNOWN_PLACE)}</span>
        <time datetime="${escapeHtml(note.at)}">${ago(note.at)}</time>
      </li>`).join('');
    return `
      <h3 class="headlineSecondary g-note-heading">On the wall</h3>
      <ul class="g-note-list">${items}</ul>
      ${wall.more ? '<button class="btn btn--secondary g-note-older" type="button">Show older notes</button>' : ''}`;
  }

  function html() {
    return `
      <p class="overline g-reader-over">Visitors’ wall</p>
      <h2 class="headlinePrimary">Leave a note on the wall</h2>
      <p class="body">Say hello to whoever wanders through next. Pick a message and a colour, and your note says roughly where you are.</p>
      <div class="g-note-make" aria-live="polite">${makerHtml()}</div>
      <div class="g-note-all">${listHtml()}</div>
      <p class="caption-regular g-reader-caption g-note-small">Where you are is worked out from your connection, and your IP address isn’t kept. <a class="link" href="https://db-ip.com" target="_blank" rel="noopener"><span class="link-text">IP geolocation by DB-IP</span></a></p>`;
  }

  const FOCUSABLE = ['.g-note-shuffle', '.g-note-stick', '.g-note-older'];

  function renderPanel() {
    const panel = wall.panel;
    const make = panel && panel.querySelector('.g-note-make');
    // The reading panel may be showing something else by now
    if (!make) return;
    const active = document.activeElement;
    const focused = active && panel.contains(active) ? FOCUSABLE.find((selector) => active.matches(selector)) : null;
    make.innerHTML = makerHtml();
    panel.querySelector('.g-note-all').innerHTML = listHtml();
    // Keep focus where it was, as the buttons are drawn afresh
    if (focused) {
      const again = panel.querySelector(focused) || panel.querySelector('.g-note-stick') || panel.querySelector('.g-note-status');
      if (again) again.focus({ preventScroll: true });
    }
  }

  function bind(panel) {
    wall.problem = null;
    if (wall.status !== 'loading') load();
    if (wall.panel === panel) return;
    wall.panel = panel;
    panel.addEventListener('click', (event) => {
      if (event.target.closest('.g-note-shuffle')) {
        let next = wall.pick.m;
        while (MESSAGES.length > 1 && next === wall.pick.m) next = Math.floor(Math.random() * MESSAGES.length);
        wall.pick.m = next;
        renderPanel();
      } else if (event.target.closest('.g-note-stick')) {
        stick();
      } else if (event.target.closest('.g-note-older')) {
        loadOlder();
      }
    });
    panel.addEventListener('change', (event) => {
      if (event.target.name !== 'note-colour') return;
      wall.pick.c = Number(event.target.value);
      const note = panel.querySelector('.g-note');
      if (note) note.style.setProperty('--note', COLOURS[wall.pick.c]);
    });
  }

  return { draw: drawBoard, load, update, html, bind };
}
