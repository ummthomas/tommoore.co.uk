// The note wall in the foyer: visitors stick up a note that says hello from where they are.
//
// The notes live on Cloudflare (api/notes). Here they're drawn onto one see-through canvas laid
// straight onto the wall, and the reading panel becomes the place to make one. Visitors put their
// note anywhere in the wall's note area (BOARD in notes-messages.js), and a newer note covers an
// older one, so it fills up in layers. Notes you've left carry a blue pin, so you can find yours
// again (remembered in this browser only).

import { MESSAGES, COLOURS, UNKNOWN_PLACE, BOARD, BOUNDS } from './notes-messages.js';
import { NOTES_API } from './notes-config.js';

const API = NOTES_API;
const { note: NOTE, top: HEADER, margin: MARGIN, snap: SNAP } = BOARD;
// The most notes drawn at once: older ones are long covered by then
const SHOWN = 400;
const INK = '#1E1E1E';
const LOW = '#5D5A54';
const BRAND = '#1BA9DF';
const SERIF = '"Libre Baskerville", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", sans-serif';

const MINE_KEY = 'gallery-notes-mine';

function loadMine() {
  try { return new Set(JSON.parse(localStorage.getItem(MINE_KEY) || '[]')); } catch { return new Set(); }
}

function saveMine(mine) {
  try { localStorage.setItem(MINE_KEY, JSON.stringify([...mine].slice(-50))); } catch { /* private browsing */ }
}

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

  if (Math.abs(width - BOARD.width) > 1 || Math.abs(height - BOARD.height) > 1) {
    console.warn('Gallery: the note wall in content.js should be', BOARD.width / 100, 'by', BOARD.height / 100, 'metres');
  }

  const wall = {
    notes: [],
    total: 0,
    places: 0,
    more: false,
    me: null,
    status: 'loading', // loading, ready, offline
    pick: { m: Math.floor(Math.random() * MESSAGES.length), c: Math.floor(Math.random() * COLOURS.length) },
    posting: false,
    pending: null,
    mine: loadMine(),
    panel: null,
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const snap = (v, lo) => lo + Math.round((v - lo) / SNAP) * SNAP;

  // Keeps a point in the note area, on the snapping steps
  function tidy({ x, y }) {
    return {
      x: clamp(snap(x, BOUNDS.x0), BOUNDS.x0, BOUNDS.x1),
      y: clamp(snap(y, BOUNDS.y0), BOUNDS.y0, BOUNDS.y1),
    };
  }

  // Where a note sits, with just a hint of a tilt, as if pressed on by hand. Notes from before
  // visitors chose get a place from their number.
  function spot(note) {
    const angle = (hash(note.id, 3) - 0.5) * 0.06;
    if (Number.isInteger(note.x) && Number.isInteger(note.y)) return { x: note.x, y: note.y, angle };
    return {
      ...tidy({ x: BOUNDS.x0 + hash(note.id, 1) * (BOUNDS.x1 - BOUNDS.x0), y: BOUNDS.y0 + hash(note.id, 2) * (BOUNDS.y1 - BOUNDS.y0) }),
      angle,
    };
  }

  // The notes drawn on the wall, oldest first, so the newest end up on top
  function shownNotes() {
    return wall.notes.slice(0, SHOWN).filter((note) => note !== wall.pending).reverse();
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

    if (note.mine || wall.mine.has(note.id)) {
      // A blue pin on your own notes
      c.save();
      c.shadowColor = 'rgba(0, 0, 0, .3)';
      c.shadowBlur = 1.2;
      c.shadowOffsetY = 0.6;
      c.fillStyle = BRAND;
      c.beginPath();
      c.arc(0, -half + 3.4, 2.5, 0, Math.PI * 2);
      c.fill();
      c.restore();
      c.fillStyle = 'rgba(255, 255, 255, .55)';
      c.beginPath();
      c.arc(-0.8, -half + 2.6, 0.8, 0, Math.PI * 2);
      c.fill();
    }
  }

  function drawBoard() {
    const limit = Math.min(renderer.capabilities.maxTextureSize, 4096);
    const ppcm = Math.min(pixelsPerMetre / 100, limit / width, limit / height);
    const [canvas, c] = canvasOf(Math.ceil(width * ppcm), Math.ceil(height * ppcm));
    c.scale(ppcm, ppcm);

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

    // While someone's choosing, the area they can use shows as a faint dashed outline
    if (wall.choosing) {
      c.save();
      c.strokeStyle = 'rgba(27, 169, 223, .5)';
      c.lineWidth = 0.6;
      c.setLineDash([2.4, 1.6]);
      c.strokeRect(BOUNDS.x0 - NOTE / 2, BOUNDS.y0 - NOTE / 2, BOUNDS.x1 - BOUNDS.x0 + NOTE, BOUNDS.y1 - BOUNDS.y0 + NOTE);
      c.restore();
    }

    const shown = shownNotes();
    shown.forEach((note) => {
      const { x, y, angle } = spot(note);
      c.save();
      c.translate(x, y);
      c.rotate(angle);
      drawNote(c, note);
      c.restore();
    });

    if (!shown.length && !wall.choosing && wall.status !== 'loading') {
      // A space waiting for the first note
      const x = (BOUNDS.x0 + BOUNDS.x1) / 2;
      const y = (BOUNDS.y0 + BOUNDS.y1) / 2;
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
    // It's see-through, laid on the wall like the lettering, so it needs the same clean edges
    texture.premultiplyAlpha = true;
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
      // Keep the thank-you showing after posting, rather than "come back tomorrow"
      wall.me = { ...me, justPosted: Boolean(wall.me?.justPosted) };
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

  // Ask the gallery to let the visitor choose where on the wall
  function choose() {
    if (wall.posting || !wall.me?.canPost) return;
    wall.problem = null;
    if (kit.onChoose) kit.onChoose();
  }

  // Sticks the visitor's note up at a point. Resolves to the saved note, or throws.
  async function post(point) {
    wall.posting = true;
    try {
      const { note } = await getJson(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...wall.pick, ...tidy(point) }),
      });
      wall.notes.unshift(note);
      wall.total += 1;
      if (!wall.notes.slice(1).some((other) => (other.place || '') === (note.place || ''))) wall.places += 1;
      wall.me = { ...wall.me, canPost: false, justPosted: true };
      wall.mine.add(note.id);
      saveMine(wall.mine);
      // The note stays off the wall's picture until it's been pressed on
      wall.pending = note;
      return note;
    } catch (error) {
      if (error.code === 'tomorrow') wall.me = { ...wall.me, canPost: false };
      else wall.problem = error.code === 'full' ? 'The wall’s had a busy day and is full until tomorrow.' : 'That didn’t stick. Try again in a moment.';
      throw error;
    } finally {
      wall.posting = false;
    }
  }

  // The visitor's note before it's saved, to carry around while choosing
  function draft() {
    return { id: 0, m: wall.pick.m, c: wall.pick.c, place: wall.me?.place, mine: true };
  }

  // Turns the outline of the note area on and off
  function showArea(on) {
    wall.choosing = on;
    refresh();
  }

  // Where to start: the clearest space, leaning towards the middle
  function startPoint() {
    const notes = shownNotes().map(spot);
    let best = null;
    for (let y = BOUNDS.y0; y <= BOUNDS.y1; y += SNAP * 4) {
      for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += SNAP * 4) {
        const room = notes.reduce((nearest, n) => Math.min(nearest, Math.hypot(n.x - x, n.y - y)), NOTE * 3);
        const middle = Math.hypot(x - (BOUNDS.x0 + BOUNDS.x1) / 2, y - (BOUNDS.y0 + BOUNDS.y1) / 2);
        const score = room - middle * 0.08;
        if (!best || score > best.score) best = { x, y, score };
      }
    }
    return tidy(best);
  }

  // The point on the wall under a spot in metres from the wall's middle (y up), or null if it's
  // well off the note area
  function pointAt(x, y) {
    const point = { x: (x + ex.w / 2) * 100, y: (ex.h / 2 - y) * 100 };
    const slack = NOTE;
    if (point.x < BOUNDS.x0 - slack || point.x > BOUNDS.x1 + slack || point.y < BOUNDS.y0 - slack || point.y > BOUNDS.y1 + slack) return null;
    return tidy(point);
  }

  // Moves a point by a number of steps, staying in the note area
  function nudge(point, dx, dy) {
    return tidy({ x: point.x + dx * SNAP * 2, y: point.y + dy * SNAP * 2 });
  }

  // The top note a note at this point would mostly cover, if any
  function covers(point) {
    return shownNotes().reverse().find((note) => {
      const at = spot(note);
      return Math.abs(at.x - point.x) < NOTE * 0.6 && Math.abs(at.y - point.y) < NOTE * 0.6;
    }) || null;
  }

  /* -------------------------------------------------------------- Putting a new note up */

  // The new note as its own little picture, for the gallery to carry onto the wall
  function noteMesh(note) {
    const scale = 6;
    const [canvas, c] = canvasOf(Math.ceil(NOTE * 1.2 * scale), Math.ceil(NOTE * 1.2 * scale));
    c.scale(scale, scale);
    c.translate(NOTE * 0.6, NOTE * 0.6);
    drawNote(c, note);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = lift(new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }), layer);
    const mesh = new THREE.Mesh(planeGeometry, material);
    mesh.scale.set(NOTE * 1.2 / 100, NOTE * 1.2 / 100, 1);
    mesh.renderOrder = layer + 1;
    return mesh;
  }

  // Where a note sits on the wall, in the world: its middle, and which way it faces
  function pose(note) {
    const { x, y, angle } = spot(note);
    const position = ex.group.localToWorld(new THREE.Vector3(x / 100 - ex.w / 2, ex.h / 2 - y / 100, ex.faceZ + 0.004));
    const quaternion = ex.group.getWorldQuaternion(new THREE.Quaternion())
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -angle));
    return { position, quaternion, size: NOTE / 100 };
  }

  // The note is on: it joins the wall's picture
  function settle() {
    wall.pending = null;
    refresh();
  }

  /* ----------------------------------------------------------------------------- The panel */

  function makerHtml() {
    if (wall.status === 'loading') return '<p class="body g-note-status" tabindex="-1">Finding the pins…</p>';
    if (wall.status === 'offline') return '<p class="body g-note-status" tabindex="-1">The wall isn’t taking notes just now. Come back a little later.</p>';
    const { me, pick } = wall;
    if (!me.canPost || me.justPosted) {
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
      <button class="btn btn--primary g-note-stick" type="button">Choose a spot on the wall</button>
      ${wall.problem ? `<p class="caption-regular g-note-problem" role="alert">${escapeHtml(wall.problem)}</p>` : ''}`;
  }

  function listHtml() {
    if (!wall.notes.length) return '';
    const items = wall.notes.map((note) => `
      <li>
        <span class="g-note-dot" style="--note: ${COLOURS[note.c] || COLOURS[0]}" aria-hidden="true"></span>
        <span>${escapeHtml(MESSAGES[note.m] || MESSAGES[0])} from ${escapeHtml(note.place || UNKNOWN_PLACE)}${wall.mine.has(note.id) ? ' <span class="g-note-yours">Yours</span>' : ''}</span>
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
      <p class="caption-regular g-reader-caption g-note-small">Where you are is worked out from your connection, and your IP address isn’t kept. Your notes have a blue pin.</p>`;
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
        choose();
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

  return {
    draw: drawBoard, load, html, bind, noteMesh, pose, settle, post, draft, showArea, startPoint, pointAt, nudge, covers,
    get problem() { return wall.problem; },
  };
}
