// A walkable gallery of the case studies, drawn with Three.js from the plan in content.js.
//
// Everything is unlit on purpose: soft gradients stand in for light, so it stays crisp, matches
// the flat look of the site and runs on modest laptops. The floor is a see-through sheet over a
// mirrored copy of the building, which gives polished reflections for very little work.

import * as THREE from 'three';
import { ROOMS, DOORS, ROUTE } from './content.js';
import { loadContent } from './pages.js';
import { createNoteWall } from './notes.js';

// Plan
const WALL = 0.3;
const DOOR_W = 3.2;
const DOOR_H = 3.1;

// Player
const EYE = 1.65;
const RADIUS = 0.38;
const WALK = 3.4;
const RUN = 6.4;
const REACH = 7;

// The site's colour tokens, plus the wall and floor tints derived from them
const INK = '#1E1E1E';
const BRAND = '#1BA9DF';
const THEMES = {
  light: { wall: '#ECEEEF', floor: '#C9CFD3', ceil: '#E4E7E9', slot: '#FFFFFF', ink: INK, low: '#626262', refl: 0.2, ao: 0.2, pool: 0.9, track: '#343434' },
  foyer: { wall: '#DFEDF3', floor: '#B9D0DA', ceil: '#E0ECF1', slot: '#FFFFFF', ink: INK, low: '#4F5F66', refl: 0.2, ao: 0.16, pool: 0.75, track: '#343434' },
  dark: { wall: '#1E1E1E', floor: '#0E0E0E', ceil: '#131313', slot: '#2C2C2C', ink: '#FFFFFF', low: '#A8A8A8', refl: 0.42, ao: 0.45, pool: 0.05, track: '#0B0B0B' },
};

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
const PIXELS_PER_METRE = isTouch ? 200 : 340;
const IMAGE_MAX = isTouch ? 1100 : 2048;

const SERIF = '"Libre Baskerville", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", sans-serif';

const $ = (selector) => document.querySelector(selector);
const dom = {
  body: document.body,
  canvas: $('#world'),
  intro: $('#intro'),
  enter: $('#enter'),
  introNote: $('#intro-note'),
  room: $('#room'),
  introRooms: $('#intro-rooms'),
  mini: $('#mini'),
  hint: $('#hint'),
  reticle: $('#reticle'),
  reader: $('#reader'),
  readerBody: $('#reader-body'),
  readerRoom: $('#reader-room'),
  readerCount: $('#reader-count'),
  readerCta: $('#reader-cta'),
  map: $('#map'),
  mapPlan: $('#map-plan'),
  mapRooms: $('#map-rooms'),
  stick: $('#stick'),
  veil: $('#veil'),
};

const roomById = Object.fromEntries(ROOMS.map((room) => [room.id, room]));
ROOMS.forEach((room) => {
  [room.x0, room.x1, room.z0, room.z1] = room.bounds;
  room.theme = THEMES[room.theme];
  room.neighbours = [];
});
DOORS.forEach((door) => {
  roomById[door.a].neighbours.push(roomById[door.b]);
  roomById[door.b].neighbours.push(roomById[door.a]);
});

/* ------------------------------------------------------------------------- Plan: walls and doors */

// Each side of a room, walked clockwise so that "right" is right for someone facing the wall
const SIDES = {
  N: { n: [0, 1], right: [1, 0], start: (r) => [r.x0 + WALL / 2, r.z0 + WALL / 2], len: (r) => r.x1 - r.x0 - WALL },
  E: { n: [-1, 0], right: [0, 1], start: (r) => [r.x1 - WALL / 2, r.z0 + WALL / 2], len: (r) => r.z1 - r.z0 - WALL },
  S: { n: [0, -1], right: [-1, 0], start: (r) => [r.x1 - WALL / 2, r.z1 - WALL / 2], len: (r) => r.x1 - r.x0 - WALL },
  W: { n: [1, 0], right: [0, -1], start: (r) => [r.x0 + WALL / 2, r.z1 - WALL / 2], len: (r) => r.z1 - r.z0 - WALL },
};

function doorsOnSide(room, side) {
  const { x0, x1, z0, z1 } = room;
  return DOORS.filter((door) => {
    if (side === 'N') return door.axis === 'z' && door.at === z0 && door.c > x0 && door.c < x1;
    if (side === 'S') return door.axis === 'z' && door.at === z1 && door.c > x0 && door.c < x1;
    if (side === 'E') return door.axis === 'x' && door.at === x1 && door.c > z0 && door.c < z1;
    return door.axis === 'x' && door.at === x0 && door.c > z0 && door.c < z1;
  });
}

// Split each side at its doors into runs of wall to hang things on
function buildRuns(room) {
  room.runs = {};
  room.doorSpans = [];
  Object.entries(SIDES).forEach(([name, side]) => {
    const start = side.start(room);
    const length = side.len(room);
    const doors = doorsOnSide(room, name).map((door) => {
      const at = door.axis === 'x' ? [door.at, door.c] : [door.c, door.at];
      const s = (at[0] - start[0]) * side.right[0] + (at[1] - start[1]) * side.right[1];
      return { door, s0: s - DOOR_W / 2, s1: s + DOOR_W / 2, side, start };
    }).sort((a, b) => a.s0 - b.s0);

    let from = 0;
    const spans = [];
    doors.forEach((d) => {
      spans.push([from, d.s0]);
      from = d.s1;
      room.doorSpans.push(d);
    });
    spans.push([from, length]);

    spans.forEach(([s0, s1], i) => {
      const id = spans.length > 1 ? `${name}.${i}` : name;
      room.runs[id] = {
        id,
        n: side.n,
        right: side.right,
        origin: [start[0] + side.right[0] * s0, start[1] + side.right[1] * s0],
        length: s1 - s0,
        cornerStart: i === 0,
        cornerEnd: i === spans.length - 1,
        height: room.h,
      };
    });
  });

  if (room.partition) {
    const { x0, x1, z, h } = room.partition;
    room.runs['P.N'] = { id: 'P.N', n: [0, -1], right: [-1, 0], origin: [x1, z - WALL / 2], length: x1 - x0, height: h };
    room.runs['P.S'] = { id: 'P.S', n: [0, 1], right: [1, 0], origin: [x0, z + WALL / 2], length: x1 - x0, height: h };
  }
}
ROOMS.forEach(buildRuns);

/* ------------------------------------------------------------------------------ Mesh helpers */

// Collects quads into one big mesh, so the whole shell of the building is a single draw call
class Shell {
  constructor() {
    this.position = [];
    this.color = [];
    this.top = [];
    this.index = [];
  }

  quad(a, b, c, d, color, top) {
    const base = this.position.length / 3;
    [a, b, c, d].forEach((p) => {
      this.position.push(...p);
      this.color.push(color.r, color.g, color.b);
      this.top.push(top);
    });
    this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  // A box with each face slightly shaded, for benches, desks and the like
  box(x0, x1, y0, y1, z0, z1, hex, top = 99, flat = false) {
    const shade = (k) => new THREE.Color(hex).multiplyScalar(flat ? 1 : k);
    this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], shade(1), top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], shade(0.55), top);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], shade(0.9), top);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], shade(0.8), top);
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], shade(0.72), top);
    this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], shade(0.78), top);
  }

  geometry() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.position, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    geometry.setAttribute('aTop', new THREE.Float32BufferAttribute(this.top, 1));
    geometry.setIndex(this.index);
    return geometry;
  }
}

// Walls fall off gently towards the floor and ceiling, the way they do in a lit room
const shellMaterial = new THREE.ShaderMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
  vertexShader: `
    attribute float aTop;
    varying vec3 vColor;
    varying float vY;
    varying float vTop;
    void main() {
      vColor = color;
      vTop = aTop;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vY = abs(world.y);
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: `
    varying vec3 vColor;
    varying float vY;
    varying float vTop;
    void main() {
      float shade = 1.0 - 0.28 * exp(-vY / 0.28) - 0.16 * exp(-(vTop - vY) / 0.55) + 0.05 * smoothstep(0.0, 3.0, vY);
      gl_FragColor = vec4(vColor * shade, 1.0);
      #include <colorspace_fragment>
    }`,
});

// See-through floor: more mirror at a glancing angle, more floor when looking down
const floorMaterial = new THREE.ShaderMaterial({
  transparent: true,
  vertexColors: true,
  side: THREE.DoubleSide,
  uniforms: { uRefl: { value: 1 } },
  vertexShader: `
    attribute float aRefl;
    varying vec3 vColor;
    varying vec3 vView;
    varying float vRefl;
    void main() {
      vColor = color;
      vRefl = aRefl;
      vec4 world = modelMatrix * vec4(position, 1.0);
      vView = cameraPosition - world.xyz;
      gl_Position = projectionMatrix * viewMatrix * world;
    }`,
  fragmentShader: `
    uniform float uRefl;
    varying vec3 vColor;
    varying vec3 vView;
    varying float vRefl;
    void main() {
      // Clamped: rounding can push this a hair past 1, and pow() of a negative is undefined on
      // many phone GPUs, which shows up as black speckles on the floor
      float facing = clamp(abs(normalize(vView).y), 0.0, 1.0);
      float fresnel = pow(1.0 - facing, 2.5);
      float mirror = uRefl * vRefl * (0.28 + 0.72 * fresnel);
      gl_FragColor = vec4(vColor, 1.0 - mirror);
      #include <colorspace_fragment>
    }`,
});

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

// Soft textures shared by every pool of light, shadow and corner
const softTextures = (() => {
  const [poolCanvas, pool] = canvasOf(256, 256);
  const glow = pool.createRadialGradient(128, 128, 0, 128, 128, 128);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.55, 'rgba(255,255,255,.55)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  pool.fillStyle = glow;
  pool.fillRect(0, 0, 256, 256);

  const [shadowCanvas, shadow] = canvasOf(128, 128);
  shadow.shadowColor = '#000';
  shadow.shadowBlur = 22;
  shadow.shadowOffsetX = 256;
  shadow.fillStyle = '#000';
  shadow.fillRect(24 - 256, 24, 80, 80);

  const [fadeCanvas, fade] = canvasOf(64, 4);
  const ramp = fade.createLinearGradient(0, 0, 64, 0);
  ramp.addColorStop(0, 'rgba(255,255,255,1)');
  ramp.addColorStop(0.35, 'rgba(255,255,255,.45)');
  ramp.addColorStop(1, 'rgba(255,255,255,0)');
  fade.fillStyle = ramp;
  fade.fillRect(0, 0, 64, 4);

  return {
    pool: new THREE.CanvasTexture(poolCanvas),
    shadow: new THREE.CanvasTexture(shadowCanvas),
    fade: new THREE.CanvasTexture(fadeCanvas),
  };
})();

const planeGeometry = new THREE.PlaneGeometry(1, 1);

// See-through things are normally drawn furthest first, and that order flips as you walk around.
// These all sit a hair apart on the same wall, so they get a fixed order instead: otherwise a pool
// of light can land on top of the lettering and wash it out from some angles.
const LAYER = { floor: 0, light: 1, edges: 2, shadow: 3, route: 3, lettering: 4 };
const MIRROR_OFFSET = -10;

// Phones and tablets have coarse depth buffers, so a few millimetres between a wall and what's on
// it isn't enough: the two flicker through each other in stripes. Polygon offset also nudges each
// layer towards the camera in depth, by a step that scales with the buffer's own precision.
function lift(material, layer) {
  material.polygonOffset = true;
  material.polygonOffsetFactor = -1;
  material.polygonOffsetUnits = -4 * (layer + 1);
  return material;
}

function decal(texture, color, opacity, layer = LAYER.light) {
  const mesh = new THREE.Mesh(planeGeometry, lift(new THREE.MeshBasicMaterial({
    map: texture, color, opacity, transparent: true, depthWrite: false, toneMapped: false,
  }), layer));
  mesh.renderOrder = layer;
  return mesh;
}

/* ------------------------------------------------------------------------------- Wall lettering */

// Text is laid out in centimetres, then drawn to a canvas at whatever resolution suits the device
function setFont(c, font, spacing = 0) {
  c.font = font;
  if ('letterSpacing' in c) c.letterSpacing = `${spacing}px`;
}

const measure = canvasOf(4, 4)[1];

function wrap(text, font, width, spacing) {
  setFont(measure, font, spacing);
  const lines = [];
  let line = '';
  text.split(/\s+/).forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (measure.measureText(next).width > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  lines.push(line);
  return lines;
}

function dashedRule(c, x0, y0, x1, y1, color, weight) {
  c.save();
  c.strokeStyle = color;
  c.lineWidth = weight;
  c.setLineDash([weight * 3, weight * 2]);
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
  c.restore();
}

// Long copy stays in the reading panel: the wall shows the opening sentences
function clip(copy, limit) {
  if (!copy || copy.length <= limit) return copy;
  const [first, ...rest] = copy.replace(/([.!?])\s+(?=[A-Z“‘"'])/g, '$1\u0001').split('\u0001');
  let shown = first;
  for (const sentence of rest) {
    if (shown.length + sentence.length + 1 > limit) break;
    shown += ` ${sentence}`;
  }
  return shown;
}

function layoutPanel(ex, theme) {
  const k = ex.scale || 1;
  const total = ex.w * 100;
  const pad = ex.bg ? 16 * Math.max(k, 0.45) : 0;
  const width = total - pad * 2;
  const ops = [];
  let y = pad;

  const para = (text, size, lineHeight, font, color, spacing = 0, x = pad, w = width) => {
    wrap(text, font, w, spacing).forEach((line) => {
      y += size * lineHeight;
      const baseline = y - size * (lineHeight - 1) / 2 - size * 0.18;
      ops.push((c) => {
        setFont(c, font, spacing);
        c.fillStyle = color;
        c.fillText(line, x, baseline);
      });
    });
  };
  const gap = (amount) => { y += amount * k; };

  if (ex.over) {
    para(ex.over, 9.5 * k, 1.4, `400 ${9.5 * k}px ${SANS}`, theme.low);
    gap(8);
  }

  if (ex.title) {
    const size = { display: 46, h1: 42, h2: 27, h3: 20 }[ex.size || 'h2'] * k;
    para(ex.title, size, 1.22, `400 ${size}px ${SERIF}`, theme.ink, -size * 0.015);
    gap(ex.size === 'display' ? 26 : 12);
  }

  if (ex.lede) {
    para(clip(ex.lede, ex.wallMax || 230), 11.5 * k, 1.55, `400 ${11.5 * k}px ${SANS}`, theme === THEMES.dark || ex.bg ? '#D6D6D6' : '#343434');
    gap(10);
  }

  if (ex.quote) {
    const top = y;
    const size = 20 * k;
    const indent = 12 * k;
    if (ex.quoteLabel) {
      para(ex.quoteLabel, 9.5 * k, 1.4, `400 ${9.5 * k}px ${SANS}`, theme.low, 0, pad + indent, width - indent);
      gap(7);
    }
    para(ex.quote, size, 1.42, `400 ${size}px ${SERIF}`, theme.ink, -size * 0.015, pad + indent, width - indent);
    const bottom = y;
    ops.push((c) => dashedRule(c, pad + 1, top, pad + 1, bottom, BRAND, 1.1 * k));
  }

  const rows = ex.grid ? ex.grid.slice(0, ex.wallRows ?? ex.grid.length) : [];
  if (rows.length) {
    const columns = ex.columns || (ex.w >= 8 ? rows.length : 1);
    const spacing = 14 * k;
    const g = k * (ex.gridScale || 1);
    const columnWidth = (width - spacing * (columns - 1)) / columns;
    const start = y;
    let rowBottom = y;
    rows.forEach(([term, detail], i) => {
      const column = i % columns;
      if (column === 0) y = rowBottom;
      const rowTop = y;
      const x = pad + column * (columnWidth + spacing);
      ops.push((c) => dashedRule(c, x, rowTop + 1, x + columnWidth, rowTop + 1, 'rgba(27,169,223,.6)', 0.7 * k));
      y += 7 * g;
      para(term, 9.5 * g, 1.4, `500 ${9.5 * g}px ${SANS}`, BRAND, 0, x, columnWidth);
      y += 3 * g;
      para(clip(detail, 190), 10.5 * g, 1.5, `400 ${10.5 * g}px ${SANS}`, theme.ink, 0, x, columnWidth);
      y += 10 * g;
      rowBottom = Math.max(rowBottom, y);
      y = rowTop;
    });
    y = Math.max(rowBottom, start);
  }

  if (ex.stats && ex.stats.length) {
    // The site's results band: big numbers on a dark card, dashed rules between them
    const inset = 16 * k;
    const top = y;
    const inDark = theme === THEMES.dark;
    const rows = [];
    let rowY = top + inset;
    ex.stats.forEach(([value, label]) => {
      const valueSize = 34 * k;
      const lines = wrap(label, `400 ${9.5 * k}px ${SANS}`, width - inset * 2, 0);
      rows.push({ value, lines, y: rowY, valueSize });
      rowY += valueSize * 1.12 + lines.length * 9.5 * k * 1.45 + 12 * k;
    });
    const bottom = rowY - 12 * k + inset;
    ops.push((c) => {
      c.fillStyle = inDark ? '#2A2A2A' : INK;
      c.beginPath();
      if (c.roundRect) c.roundRect(pad, top, width, bottom - top, 2);
      else c.rect(pad, top, width, bottom - top);
      c.fill();
      rows.forEach((row, i) => {
        if (i) dashedRule(c, pad + inset, row.y - 6 * k, pad + width - inset, row.y - 6 * k, 'rgba(255,255,255,.22)', 0.6 * k);
        setFont(c, `500 ${row.valueSize}px ${SANS}`, -row.valueSize * 0.02);
        c.fillStyle = '#FFF';
        c.fillText(row.value, pad + inset, row.y + row.valueSize * 0.86);
        setFont(c, `400 ${9.5 * k}px ${SANS}`);
        c.fillStyle = 'rgba(255,255,255,.72)';
        row.lines.forEach((line, n) => c.fillText(line, pad + inset, row.y + row.valueSize * 1.12 + (n + 0.72) * 9.5 * k * 1.45));
      });
    });
    y = bottom;
  }

  if (ex.plan) {
    const height = total * 0.47;
    const top = y;
    ops.push((c) => drawPlan(c, pad, top + 2, width, height - 4, theme));
    y += height;
  }

  let height = y + pad;
  let shift = 0;
  if (ex.fixedH) {
    height = ex.fixedH * 100;
    if (ex.centred) shift = (height - y - pad) / 2;
  }
  return { ops, width: total, height, shift };
}

// The floor plan, used on the foyer wall
function drawPlan(c, x, y, width, height, theme) {
  const x0 = -12; const x1 = 46; const z0 = -14; const z1 = 14;
  const scale = Math.min(width / (x1 - x0), height / (z1 - z0));
  const px = (v) => x + (v - x0) * scale;
  const pz = (v) => y + (v - z0) * scale;

  c.save();
  c.lineCap = 'round';
  c.strokeStyle = INK;
  c.lineWidth = 1.1;
  ROOMS.forEach((room) => Object.values(room.runs).forEach((run) => {
    c.beginPath();
    c.moveTo(px(run.origin[0]), pz(run.origin[1]));
    c.lineTo(px(run.origin[0] + run.right[0] * run.length), pz(run.origin[1] + run.right[1] * run.length));
    c.stroke();
  }));

  c.strokeStyle = BRAND;
  c.lineCap = 'butt';
  c.lineWidth = 2;
  c.setLineDash([5, 3.4]);
  c.beginPath();
  routePoints.forEach((p, i) => (i ? c.lineTo(px(p.x), pz(p.z)) : c.moveTo(px(p.x), pz(p.z))));
  c.stroke();
  c.setLineDash([]);

  setFont(c, `500 ${12}px ${SANS}`);
  c.textAlign = 'center';
  c.fillStyle = theme.ink;
  ROOMS.forEach((room) => {
    const offset = room.id === 'foyer' ? 0 : (room.z0 < 0 ? -3.4 : 3.4);
    c.fillText(room.name, px((room.x0 + room.x1) / 2), pz((room.z0 + room.z1) / 2 + offset));
  });
  c.textAlign = 'left';

  c.fillStyle = BRAND;
  c.beginPath();
  c.arc(px(-5.84), pz(13.2), 3.2, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function panelTexture({ ops, width, height, shift }, bg) {
  const limit = Math.min(renderer.capabilities.maxTextureSize, 4096);
  const ppcm = Math.min(PIXELS_PER_METRE / 100, limit / width, limit / height);
  const [canvas, c] = canvasOf(Math.ceil(width * ppcm), Math.ceil(height * ppcm));
  c.scale(ppcm, ppcm);
  if (bg) {
    c.fillStyle = bg;
    c.fillRect(0, 0, width, height);
  }
  c.translate(0, shift);
  ops.forEach((op) => op(c));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  // Premultiply so the edges of pale letters stay clean as they shrink into the distance
  texture.premultiplyAlpha = true;
  return texture;
}

function lettering(bg) {
  return lift(new THREE.MeshBasicMaterial({
    transparent: !bg,
    depthWrite: Boolean(bg),
    toneMapped: false,
    blending: bg ? THREE.NormalBlending : THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  }), LAYER.lettering);
}

function loadPicture(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, IMAGE_MAX / image.naturalWidth);
      const [canvas, c] = canvasOf(Math.round(image.naturalWidth * scale), Math.round(image.naturalHeight * scale));
      c.imageSmoothingQuality = 'high';
      c.drawImage(image, 0, 0, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      resolve(texture);
    };
    image.onerror = reject;
    image.src = url;
  });
}

/* ----------------------------------------------------------------------------- Building the world */

let renderer;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.2, 120);
camera.rotation.order = 'YXZ';
const world = new THREE.Group();
const overlay = new THREE.Group();
const shell = new Shell();
const colliders = [];
const exhibits = [];
const trackLights = [];
const signs = [];
const noteWalls = [];

// The dashed line: a sine wave rolling along the loop, like the wave lines on the home page. It
// settles down at each door so that it always passes through the middle of the opening.
const WAVE_HEIGHT = 1.15;
const WAVE_LENGTH = 7.5;

const routePoints = (() => {
  const curve = new THREE.CatmullRomCurve3(ROUTE.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  const count = 1000;
  // A whole number of waves, so the line meets itself cleanly where the loop closes
  const cycles = Math.round(curve.getLength() / WAVE_LENGTH);
  const doors = DOORS.map((door) => (door.axis === 'x' ? [door.at, door.c] : [door.c, door.at]));
  const smooth = (t) => t * t * (3 - 2 * t);
  return curve.getSpacedPoints(count).map((point, i) => {
    const t = i / count;
    const tangent = curve.getTangentAt(t);
    const nearestDoor = Math.min(...doors.map(([x, z]) => Math.hypot(point.x - x, point.z - z)));
    const settle = smooth(Math.min(1, Math.max(0, (nearestDoor - 0.6) / 2.6)));
    const offset = Math.sin(t * cycles * Math.PI * 2) * WAVE_HEIGHT * settle;
    return new THREE.Vector3(point.x - tangent.z * offset, 0, point.z + tangent.x * offset);
  });
})();

// Queue of slow jobs (drawing lettering, decoding images), spread out so walking never hitches
const jobs = [];
const loaded = new Set();

function addCollider(x0, x1, z0, z1, { occludes = false, low = false } = {}) {
  colliders.push({ x0, x1, z0, z1, occludes, low });
}

function buildShell() {
  const floor = { position: [], color: [], refl: [], index: [] };
  const ao = { position: [], uv: [], color: [], index: [] };

  const floorQuad = (x0, x1, z0, z1, hex, refl) => {
    const base = floor.position.length / 3;
    const color = new THREE.Color(hex);
    [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].forEach(([x, z]) => {
      floor.position.push(x, 0, z);
      floor.color.push(color.r, color.g, color.b);
      floor.refl.push(refl);
    });
    floor.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  // A strip that fades out across its width, for the soft dark edge where surfaces meet
  const aoQuad = (a, b, c, d, strength) => {
    const base = ao.position.length / 3;
    [a, b, c, d].forEach((p, i) => {
      ao.position.push(...p);
      ao.uv.push(i === 0 || i === 1 ? 0 : 1, 0.5);
      ao.color.push(0, 0, 0, strength);
    });
    ao.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  ROOMS.forEach((room) => {
    const { theme, h } = room;
    const wall = new THREE.Color(theme.wall);
    const skirting = new THREE.Color(theme === THEMES.dark ? '#0B0B0B' : '#8A9196');
    const xi0 = room.x0 + WALL / 2;
    const xi1 = room.x1 - WALL / 2;
    const zi0 = room.z0 + WALL / 2;
    const zi1 = room.z1 - WALL / 2;

    floorQuad(xi0, xi1, zi0, zi1, theme.floor, theme.refl);
    shell.quad([xi0, h, zi0], [xi1, h, zi0], [xi1, h, zi1], [xi0, h, zi1], new THREE.Color(theme.ceil), h);

    // Skylights: long slots down the middle of the ceiling
    const across = (xi1 - xi0) >= (zi1 - zi0);
    const count = Math.max(2, Math.round((across ? xi1 - xi0 : zi1 - zi0) / 5));
    const slot = new THREE.Color(theme.slot);
    for (let i = 0; i < count; i++) {
      const t0 = (i + 0.18) / count;
      const t1 = (i + 0.82) / count;
      if (across) {
        const mid = (zi0 + zi1) / 2;
        const a = xi0 + (xi1 - xi0) * t0;
        const b = xi0 + (xi1 - xi0) * t1;
        shell.quad([a, h - 0.01, mid - 0.7], [b, h - 0.01, mid - 0.7], [b, h - 0.01, mid + 0.7], [a, h - 0.01, mid + 0.7], slot, 999);
      } else {
        const mid = (xi0 + xi1) / 2;
        const a = zi0 + (zi1 - zi0) * t0;
        const b = zi0 + (zi1 - zi0) * t1;
        shell.quad([mid - 0.7, h - 0.01, a], [mid + 0.7, h - 0.01, a], [mid + 0.7, h - 0.01, b], [mid - 0.7, h - 0.01, b], slot, 999);
      }
    }

    // A slim lighting track around the room
    const inset = 1.3;
    const trackColour = new THREE.Color(theme.track);
    const bar = (x0, x1, z0, z1) => shell.quad([x0, h - 0.02, z0], [x1, h - 0.02, z0], [x1, h - 0.02, z1], [x0, h - 0.02, z1], trackColour, 999);
    bar(xi0 + inset, xi1 - inset, zi0 + inset - 0.02, zi0 + inset + 0.02);
    bar(xi0 + inset, xi1 - inset, zi1 - inset - 0.02, zi1 - inset + 0.02);
    bar(xi0 + inset - 0.02, xi0 + inset + 0.02, zi0 + inset, zi1 - inset);
    bar(xi1 - inset - 0.02, xi1 - inset + 0.02, zi0 + inset, zi1 - inset);

    Object.values(room.runs).forEach((run) => {
      if (run.id.startsWith('P.')) return;
      const [ox, oz] = run.origin;
      const ex = ox + run.right[0] * run.length;
      const ez = oz + run.right[1] * run.length;
      shell.quad([ox, 0, oz], [ex, 0, ez], [ex, h, ez], [ox, h, oz], wall, h);

      // A dark shadow gap where the wall meets the floor
      const gx = run.n[0] * 0.008;
      const gz = run.n[1] * 0.008;
      shell.quad([ox + gx, 0, oz + gz], [ex + gx, 0, ez + gz], [ex + gx, 0.07, ez + gz], [ox + gx, 0.07, oz + gz], skirting, 99);

      // Physically the wall is half its thickness either side of the plan line
      const bx = run.n[0] * -WALL / 2;
      const bz = run.n[1] * -WALL / 2;
      addCollider(Math.min(ox, ex, ox + bx), Math.max(ox, ex, ex + bx), Math.min(oz, ez, oz + bz), Math.max(oz, ez, ez + bz));

      const out = 0.9;
      const nx = run.n[0] * out;
      const nz = run.n[1] * out;
      aoQuad([ox, 0.003, oz], [ex, 0.003, ez], [ex + nx, 0.003, ez + nz], [ox + nx, 0.003, oz + nz], theme.ao);
      const wx = run.n[0] * 0.004;
      const wz = run.n[1] * 0.004;
      const along = 0.8;
      if (run.cornerStart) {
        const rx = run.right[0] * along;
        const rz = run.right[1] * along;
        aoQuad([ox + wx, 0, oz + wz], [ox + wx, h, oz + wz], [ox + wx + rx, h, oz + wz + rz], [ox + wx + rx, 0, oz + wz + rz], theme.ao * 0.7);
      }
      if (run.cornerEnd) {
        const rx = -run.right[0] * along;
        const rz = -run.right[1] * along;
        aoQuad([ex + wx, 0, ez + wz], [ex + wx, h, ez + wz], [ex + wx + rx, h, ez + wz + rz], [ex + wx + rx, 0, ez + wz + rz], theme.ao * 0.7);
      }
    });

    // Above each door
    room.doorSpans.forEach(({ s0, s1, side, start }) => {
      const a = [start[0] + side.right[0] * s0, start[1] + side.right[1] * s0];
      const b = [start[0] + side.right[0] * s1, start[1] + side.right[1] * s1];
      shell.quad([a[0], DOOR_H, a[1]], [b[0], DOOR_H, b[1]], [b[0], h, b[1]], [a[0], h, a[1]], wall, h);
    });

    if (room.partition) {
      const { x0, x1, z, h: top } = room.partition;
      shell.box(x0, x1, 0, top, z - WALL / 2, z + WALL / 2, theme.wall, top + 3, true);
      // Its lights need a track to hang from too
      bar(x0, x1, z - 1.32, z - 1.28);
      bar(x0, x1, z + 1.28, z + 1.32);
      addCollider(x0, x1, z - WALL / 2, z + WALL / 2, { occludes: true });
    }
  });

  // Door reveals and thresholds
  DOORS.forEach((door) => {
    const dark = roomById[door.a].theme === THEMES.dark || roomById[door.b].theme === THEMES.dark;
    const colour = new THREE.Color(dark ? '#262626' : '#F7F8F8');
    const floorColour = dark ? '#191919' : '#EEF0F1';
    const half = DOOR_W / 2;
    const thick = WALL / 2;
    if (door.axis === 'x') {
      const x0 = door.at - thick; const x1 = door.at + thick; const z0 = door.c - half; const z1 = door.c + half;
      shell.quad([x0, 0, z0], [x1, 0, z0], [x1, DOOR_H, z0], [x0, DOOR_H, z0], colour, 20);
      shell.quad([x0, 0, z1], [x1, 0, z1], [x1, DOOR_H, z1], [x0, DOOR_H, z1], colour, 20);
      shell.quad([x0, DOOR_H, z0], [x1, DOOR_H, z0], [x1, DOOR_H, z1], [x0, DOOR_H, z1], colour, DOOR_H + 2);
      floorQuad(x0, x1, z0, z1, floorColour, 0.1);
    } else {
      const z0 = door.at - thick; const z1 = door.at + thick; const x0 = door.c - half; const x1 = door.c + half;
      shell.quad([x0, 0, z0], [x0, 0, z1], [x0, DOOR_H, z1], [x0, DOOR_H, z0], colour, 20);
      shell.quad([x1, 0, z0], [x1, 0, z1], [x1, DOOR_H, z1], [x1, DOOR_H, z0], colour, 20);
      shell.quad([x0, DOOR_H, z0], [x1, DOOR_H, z0], [x1, DOOR_H, z1], [x0, DOOR_H, z1], colour, DOOR_H + 2);
      floorQuad(x0, x1, z0, z1, floorColour, 0.1);
    }
  });

  const floorGeometry = new THREE.BufferGeometry();
  floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floor.position, 3));
  floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(floor.color, 3));
  floorGeometry.setAttribute('aRefl', new THREE.Float32BufferAttribute(floor.refl, 1));
  floorGeometry.setIndex(floor.index);
  const floorMesh = new THREE.Mesh(floorGeometry, floorMaterial);
  floorMesh.renderOrder = LAYER.floor;
  scene.add(floorMesh);

  const aoGeometry = new THREE.BufferGeometry();
  aoGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ao.position, 3));
  aoGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(ao.uv, 2));
  aoGeometry.setAttribute('color', new THREE.Float32BufferAttribute(ao.color, 4));
  aoGeometry.setIndex(ao.index);
  const aoMesh = new THREE.Mesh(aoGeometry, lift(new THREE.MeshBasicMaterial({
    map: softTextures.fade, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), LAYER.edges));
  aoMesh.renderOrder = LAYER.edges;
  overlay.add(aoMesh);
}

function buildRoute() {
  const samples = routePoints;
  const halfWidth = 0.038;
  const dashLength = 0.36;
  const position = [];
  const uv = [];
  const index = [];
  let travelled = 0;
  samples.forEach((p, i) => {
    const next = samples[(i + 1) % samples.length];
    const prev = samples[(i - 1 + samples.length) % samples.length];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    if (i) travelled += p.distanceTo(samples[i - 1]);
    position.push(p.x + nx * halfWidth, 0.006, p.z + nz * halfWidth, p.x - nx * halfWidth, 0.006, p.z - nz * halfWidth);
    uv.push(travelled / dashLength, 0, travelled / dashLength, 1);
    if (i < samples.length - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);

  // Same proportions as the site's flowing dashes: 44 on, 28 off
  const [canvas, c] = canvasOf(144, 32);
  c.fillStyle = '#fff';
  c.fillRect(0, 0, 88, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = 8;

  const mesh = new THREE.Mesh(geometry, lift(new THREE.MeshBasicMaterial({
    map: texture, color: BRAND, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), LAYER.route));
  mesh.renderOrder = LAYER.route;
  overlay.add(mesh);
  return texture;
}

function floorShadow(x, z, width, depth, opacity = 0.3) {
  const mesh = decal(softTextures.shadow, 0x000000, opacity, LAYER.edges);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.004, z);
  mesh.scale.set(width * 1.5, depth * 1.5, 1);
  overlay.add(mesh);
}

function addBench({ x, z }, theme) {
  const dark = theme === THEMES.dark;
  const seat = dark ? '#3A3A3A' : INK;
  const legs = dark ? '#0B0B0B' : '#626262';
  shell.box(x - 1.3, x + 1.3, 0.4, 0.47, z - 0.3, z + 0.3, seat);
  shell.box(x - 1.15, x - 1.09, 0, 0.4, z - 0.26, z + 0.26, legs);
  shell.box(x + 1.09, x + 1.15, 0, 0.4, z - 0.26, z + 0.26, legs);
  floorShadow(x, z, 2.7, 0.75, dark ? 0.5 : 0.28);
  addCollider(x - 1.3, x + 1.3, z - 0.3, z + 0.3, { low: true });
}

// A work table with a monitor on it. The monitor is hung as an exhibit.
function addDesk(ex) {
  const { x, z } = ex.desk;
  shell.box(x - 1.4, x + 1.4, 0.72, 0.76, z - 0.5, z + 0.5, '#FFFFFF');
  [[-1.32, -0.42], [1.32, -0.42], [-1.32, 0.42], [1.32, 0.42]].forEach(([dx, dz]) => {
    shell.box(x + dx - 0.025, x + dx + 0.025, 0, 0.72, z + dz - 0.025, z + dz + 0.025, INK);
  });
  shell.box(x - 0.04, x + 0.04, 0.76, 0.98, z - 0.2, z - 0.14, INK);
  shell.box(x - 0.16, x + 0.16, 0.76, 0.775, z - 0.26, z - 0.08, INK);
  shell.box(x - 0.24, x + 0.24, 0.76, 0.78, z + 0.1, z + 0.28, '#D5DADD');
  shell.box(x + 0.32, x + 0.38, 0.76, 0.78, z + 0.13, z + 0.24, '#D5DADD');
  shell.box(x - 1.05, x - 0.72, 0.76, 0.785, z - 0.05, z + 0.32, '#C5DDE6');
  shell.box(x + 0.8, x + 0.89, 0.76, 0.86, z - 0.1, z - 0.01, BRAND);
  floorShadow(x, z, 3, 1.15, 0.26);
  addCollider(x - 1.4, x + 1.4, z - 0.5, z + 0.5, { low: true });
}

function outlineGeometry(w, h, t) {
  const position = [];
  const index = [];
  const rect = (x0, x1, y0, y1) => {
    const base = position.length / 3;
    position.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0);
    index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const x = w / 2 + 0.09;
  const y = h / 2 + 0.09;
  rect(-x - t, x + t, y, y + t);
  rect(-x - t, x + t, -y - t, -y);
  rect(-x - t, -x, -y, y);
  rect(x, x + t, -y, y);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  return geometry;
}

// A soft patch of light or shadow on a wall, trimmed to the wall so it can't spill into a
// doorway, past the end of a partition, or under the floor
function wallDecal(texture, color, opacity, wall, x, y, z, width, height, layer) {
  const x0 = x - width / 2;
  const y0 = y - height / 2;
  const left = Math.max(x0, wall.left);
  const right = Math.min(x0 + width, wall.right);
  const bottom = Math.max(y0, wall.bottom);
  const top = Math.min(y0 + height, wall.top);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([left, bottom, 0, right, bottom, 0, right, top, 0, left, top, 0], 3));
  const u = (value) => (value - x0) / width;
  const v = (value) => (value - y0) / height;
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([u(left), v(bottom), u(right), v(bottom), u(right), v(top), u(left), v(top)], 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = decal(texture, color, opacity, layer);
  mesh.geometry = geometry;
  mesh.position.z = z;
  return mesh;
}

function placeExhibit(ex, room, position, normal, wall) {
  const onWall = Boolean(wall);
  const { theme } = room;
  ex.room = room;
  ex.center = position;
  ex.normal = normal;
  ex.right = new THREE.Vector3(normal.z, 0, -normal.x);
  ex.needsReveal = true;

  const group = new THREE.Group();
  group.position.copy(position);
  group.rotation.y = Math.atan2(normal.x, normal.z);
  world.add(group);
  ex.group = group;

  const isArt = ex.kind !== 'text';

  if (onWall) {
    group.add(wallDecal(softTextures.pool, 0xffffff, theme.pool * (isArt ? 1 : 0.7), wall, 0, ex.h * 0.08, 0.005, ex.w * 1.75 + 1, ex.h * 1.6 + 1.2));

    if (isArt) {
      if (theme === THEMES.dark && ex.kind !== 'image') {
        // A screen in a dark room lights the wall around it
        group.add(wallDecal(softTextures.pool, 0xc5dde6, 0.12, wall, 0, 0, 0.007, ex.w * 1.8, ex.h * 2.1));
      } else {
        group.add(wallDecal(softTextures.shadow, 0x000000, theme === THEMES.dark ? 0.5 : 0.28, wall, 0, -0.05, 0.008, ex.w * 1.55, ex.h * 1.55, LAYER.shadow));
      }
    }
  }

  if (isArt) {
    const depth = onWall ? 0.05 : 0.04;
    const back = new THREE.Mesh(new THREE.BoxGeometry(ex.w + 0.05, ex.h + 0.05, depth), new THREE.MeshBasicMaterial({ color: INK, toneMapped: false }));
    back.position.z = depth / 2 + (onWall ? 0.009 : -0.02);
    group.add(back);
    ex.material = lift(new THREE.MeshBasicMaterial({ color: theme === THEMES.dark ? 0x2c2c2c : 0xd5dadd, toneMapped: false }), LAYER.lettering);
    const face = new THREE.Mesh(planeGeometry, ex.material);
    face.scale.set(ex.w, ex.h, 1);
    face.position.z = back.position.z + depth / 2 + 0.002;
    group.add(face);
    ex.faceZ = face.position.z;

    if (ex.label) {
      ex.labelLayout = layoutPanel({ w: Math.min(ex.w, 3.4), lede: ex.label, scale: 0.72 }, theme);
      ex.labelMaterial = lettering(false);
      ex.labelMaterial.visible = false;
      const plate = new THREE.Mesh(planeGeometry, ex.labelMaterial);
      const w = ex.labelLayout.width / 100;
      const h = ex.labelLayout.height / 100;
      plate.scale.set(w, h, 1);
      plate.position.set(-ex.w / 2 + w / 2, -ex.h / 2 - 0.05 - h / 2, 0.012);
      plate.renderOrder = LAYER.lettering;
      group.add(plate);
    }
  } else {
    ex.material = lettering(ex.bg);
    ex.material.visible = false;
    const face = new THREE.Mesh(planeGeometry, ex.material);
    face.scale.set(ex.w, ex.h, 1);
    face.position.z = onWall ? 0.012 : 0.022;
    face.renderOrder = LAYER.lettering;
    group.add(face);
    if (ex.bg && !onWall) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(ex.w + 0.05, ex.h + 0.05, 0.04), new THREE.MeshBasicMaterial({ color: '#0B0B0B', toneMapped: false }));
      group.add(back);
    }
  }

  if (ex.action !== 'none') {
    ex.outline = new THREE.Mesh(outlineGeometry(ex.w, ex.h, 0.03), new THREE.MeshBasicMaterial({ color: BRAND, toneMapped: false }));
    ex.outline.position.z = isArt ? 0.08 : 0.03;
    ex.outline.visible = false;
    group.add(ex.outline);
  }

  if (onWall) trackLights.push([position.x + normal.x * 1.3, room.h - 0.1, position.z + normal.z * 1.3, position.x, position.y + ex.h / 2, position.z]);
}

// Sets a panel's lettering, shrinking it if an edit has made it too tall for its wall
function measurePanel(ex, room) {
  const theme = ex.bg ? THEMES.dark : room.theme;
  const run = room.runs[ex.hang];
  const tallest = (run ? run.height : room.h) - 0.75;
  ex.layout = layoutPanel(ex, theme);
  for (let tries = 0; !ex.fixedH && ex.layout.height / 100 > tallest && tries < 8; tries++) {
    ex.scale = (ex.scale || 1) * 0.92;
    ex.layout = layoutPanel(ex, theme);
  }
  ex.h = ex.layout.height / 100;
}

// New sections on a page go on whichever wall in the room has the most space
function hangExtras(room) {
  room.extras.forEach((ex) => {
    const free = (run) => run.length - room.exhibits.filter((other) => other.hang === run.id).reduce((sum, other) => sum + other.w + 0.4, 0.4);
    const best = Object.values(room.runs).sort((a, b) => free(b) - free(a))[0];
    if (free(best) < ex.w + 0.4) {
      // A full room keeps it in the reading panel of its last piece, so the words aren't lost
      const last = room.exhibits.filter((other) => !other.action).pop();
      last.more = [...(last.more || []), ex];
      console.info(`Gallery: no wall space in ${room.id} for "${ex.title}", so it's in the panel of ${last.id}`);
      return;
    }
    ex.hang = best.id;
    room.exhibits.push(ex);
  });
}

function buildExhibits() {
  ROOMS.forEach((room) => {
    hangExtras(room);
    room.exhibits.forEach((ex) => {
      if (ex.kind === 'text') {
        measurePanel(ex, room);
      } else {
        ex.h = ex.w / ex.aspect;
      }
    });

    (room.benches || []).forEach((bench) => addBench(bench, room.theme));

    // Share each run's length out evenly between the pieces hung on it
    Object.values(room.runs).forEach((run) => {
      const pieces = room.exhibits.filter((ex) => ex.hang === run.id);
      if (!pieces.length) return;
      const used = pieces.reduce((sum, ex) => sum + ex.w, 0);
      const spacing = (run.length - used) / (pieces.length + 1);
      if (spacing < 0.2) console.warn(`Tight hang on ${room.id} ${run.id}: ${spacing.toFixed(2)}m between pieces`);
      let s = spacing;
      pieces.forEach((ex) => {
        const mid = s + ex.w / 2;
        s += ex.w + spacing;
        const y = ex.fixedH ? ex.y : Math.min(Math.max(ex.y ?? 1.95, ex.h / 2 + 0.42), run.height - ex.h / 2 - 0.25);
        const position = new THREE.Vector3(run.origin[0] + run.right[0] * mid, y, run.origin[1] + run.right[1] * mid);
        // Light and shadow stop where the wall does
        const wall = { left: -mid, right: run.length - mid, bottom: -y, top: run.height - y };
        placeExhibit(ex, room, position, new THREE.Vector3(run.n[0], 0, run.n[1]), wall);
      });
    });

    room.exhibits.filter((ex) => ex.desk).forEach((ex) => {
      addDesk(ex);
      placeExhibit(ex, room, new THREE.Vector3(ex.desk.x, ex.y, ex.desk.z - 0.1), new THREE.Vector3(0, 0, 1), false);
    });
  });

  ROOMS.forEach((room) => room.exhibits.forEach((ex) => {
    if (!ex.room) throw new Error(`${room.id}/${ex.id} hangs on a wall that doesn't exist: ${ex.hang}`);
    exhibits.push(ex);
    if (ex.kind === 'notes') {
      ex.wall = createNoteWall(ex, {
        THREE, renderer, canvasOf, setFont, wrap, lift, revealTexture, planeGeometry, layer: LAYER.lettering, pixelsPerMetre: PIXELS_PER_METRE,
      });
      noteWalls.push(ex.wall);
    }
  }));
}

// The name of the next room above each door, on both sides
function buildSigns() {
  DOORS.forEach((door) => {
    [[door.a, door.b, 1], [door.b, door.a, -1]].forEach(([fromId, toId, direction]) => {
      const from = roomById[fromId];
      const to = roomById[toId];
      const layout = layoutPanel({ w: DOOR_W, lede: to.name, scale: 1.1 }, from.theme);
      const material = lettering(false);
      material.visible = false;
      const mesh = new THREE.Mesh(planeGeometry, material);
      mesh.scale.set(layout.width / 100, layout.height / 100, 1);
      const offset = (WALL / 2 + 0.012) * direction;
      if (door.axis === 'x') {
        mesh.position.set(door.at - offset, DOOR_H + 0.28, door.c);
        mesh.rotation.y = direction > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        mesh.position.set(door.c, DOOR_H + 0.28, door.at - offset);
        mesh.rotation.y = direction > 0 ? Math.PI : 0;
      }
      mesh.renderOrder = LAYER.lettering;
      world.add(mesh);
      signs.push({ layout, material });
    });
  });
}

function buildTrackLights() {
  const geometry = new THREE.CylinderGeometry(0.055, 0.075, 0.22, 12);
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ color: 0x343434, toneMapped: false }), trackLights.length);
  const dummy = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  trackLights.forEach(([x, y, z, tx, ty, tz], i) => {
    dummy.position.set(x, y, z);
    dummy.quaternion.setFromUnitVectors(up, new THREE.Vector3(x - tx, y - ty, z - tz).normalize());
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.frustumCulled = false;
  world.add(mesh);
}

function revealTexture(material, texture) {
  material.map = texture;
  material.color.set(0xffffff);
  material.visible = true;
  material.needsUpdate = true;
}

function queueRoom(room) {
  if (loaded.has(room)) return;
  loaded.add(room);
  room.exhibits.forEach((ex) => {
    if (ex.kind === 'text') {
      jobs.push(() => revealTexture(ex.material, panelTexture(ex.layout, ex.bg)));
      return;
    }
    if (ex.kind === 'notes') {
      jobs.push(() => {
        revealTexture(ex.material, ex.wall.draw());
        ex.wall.load();
      });
      return;
    }
    if (ex.labelLayout) jobs.push(() => revealTexture(ex.labelMaterial, panelTexture(ex.labelLayout)));
    jobs.push(() => loadPicture(ex.poster || ex.src).then((texture) => {
      ex.poster2d = texture;
      if (!ex.playing) revealTexture(ex.material, texture);
    }).catch(() => console.warn(`Couldn't load ${ex.poster || ex.src}`)));
  });
}

function queueAround(room) {
  queueRoom(room);
  room.neighbours.forEach(queueRoom);
}

/* ----------------------------------------------------------------------------------- The visitor */

const player = { x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, pitch: 0, stride: 0, bob: 0 };
const input = { keys: new Set(), stickX: 0, stickY: 0 };
let currentRoom = null;
let hovered = null;
let state = 'loading'; // loading, intro, walking, paused, reading, map
let locked = false;
let everLocked = false;
let dragMode = isTouch;
let glide = null;
let viewShift = 0;
let viewShiftTarget = 0;
let mouseNdc = null;

function collide(pos) {
  for (let pass = 0; pass < 2; pass++) {
    colliders.forEach((box) => {
      const nx = Math.max(box.x0, Math.min(pos.x, box.x1));
      const nz = Math.max(box.z0, Math.min(pos.z, box.z1));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= RADIUS * RADIUS) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + dx / d * RADIUS;
        pos.z = nz + dz / d * RADIUS;
      } else {
        // Dead centre of a box: leave by the nearest edge
        const exits = [[pos.x - box.x0, -RADIUS, 0, box.x0], [box.x1 - pos.x, RADIUS, 0, box.x1], [pos.z - box.z0, 0, -RADIUS, box.z0], [box.z1 - pos.z, 0, RADIUS, box.z1]];
        const [, ax, az] = exits.sort((a, b) => a[0] - b[0])[0];
        pos.x += ax + Math.sign(ax) * Math.min(pos.x - box.x0, box.x1 - pos.x);
        pos.z += az + Math.sign(az) * Math.min(pos.z - box.z0, box.z1 - pos.z);
      }
    });
  }
}

// Furniture is low enough to see over, so only walls limit how far back you can stand
function hitsWall(x, z) {
  return colliders.some((box) => {
    if (box.low) return false;
    const nx = Math.max(box.x0, Math.min(x, box.x1));
    const nz = Math.max(box.z0, Math.min(z, box.z1));
    return (x - nx) ** 2 + (z - nz) ** 2 < RADIUS * RADIUS;
  });
}

function roomAt(x, z) {
  return ROOMS.find((room) => x >= room.x0 && x < room.x1 && z >= room.z0 && z < room.z1) || currentRoom;
}

function placeInRoom(room) {
  const [x, z] = room.spawn.at;
  const [lx, lz] = room.spawn.look;
  player.x = x;
  player.z = z;
  player.vx = player.vz = player.vy = 0;
  player.y = 0;
  player.yaw = Math.atan2(-(lx - x), -(lz - z));
  player.pitch = 0;
  enterRoom(room);
}

function enterRoom(room) {
  if (room === currentRoom) return;
  currentRoom = room;
  queueAround(room);

  dom.room.innerHTML = `
    <p class="home-caption"><span class="home-name">${room.name}</span><span class="home-sep" aria-hidden="true"></span><span class="home-status">${room.status}</span></p>
    ${room.title ? `<p class="g-room-title">${room.title}</p>` : ''}`;
  dom.room.classList.remove('is-in');
  void dom.room.offsetWidth;
  dom.room.classList.add('is-in');

  dom.mapRooms.querySelectorAll('button').forEach((button) => {
    if (button.dataset.room === room.id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });

  // The start and pause screen takes on the mood of the room behind it
  dom.intro.classList.toggle('is-dark', room.theme === THEMES.dark);
  dom.introRooms.querySelectorAll('button').forEach((button) => {
    if (button.dataset.room === room.id) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  if (state === 'intro') {
    dom.enter.textContent = room.id === 'foyer' ? 'Enter the gallery' : `Walk into ${room.name}`;
  }

  syncAddress();
}

// Keep the address on the current room, so a copied link walks you straight back into it
function syncAddress() {
  if (state === 'walking') history.replaceState(null, '', currentRoom.id === 'foyer' ? location.pathname : `#${currentRoom.id}`);
}

function updateMovement(dt) {
  const { keys } = input;
  let forward = input.stickY;
  let strafe = input.stickX;
  if (keys.has('KeyW') || keys.has('ArrowUp')) forward += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) forward -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) strafe += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) strafe -= 1;
  const length = Math.hypot(forward, strafe);
  if (length > 1) {
    forward /= length;
    strafe /= length;
  }

  const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? RUN : WALK;
  const sin = Math.sin(player.yaw);
  const cos = Math.cos(player.yaw);
  const wishX = (-sin * forward + cos * strafe) * speed;
  const wishZ = (-cos * forward - sin * strafe) * speed;
  const blend = 1 - Math.exp(-dt * (length > 0 ? 10 : 12));
  player.vx += (wishX - player.vx) * blend;
  player.vz += (wishZ - player.vz) * blend;

  const pos = { x: player.x + player.vx * dt, z: player.z + player.vz * dt };
  collide(pos);
  player.x = pos.x;
  player.z = pos.z;

  player.vy -= 13 * dt;
  player.y += player.vy * dt;
  if (player.y <= 0) {
    player.y = 0;
    player.vy = 0;
    if (keys.has('Space')) player.vy = 4.4;
  }

  const moving = Math.hypot(player.vx, player.vz);
  if (moving > 0.1 && player.y === 0) player.stride += moving * dt * 1.9;
  const bobTarget = reduceMotion ? 0 : Math.sin(player.stride * 2) * 0.024 * Math.min(moving / WALK, 1.3);
  player.bob += (bobTarget - player.bob) * (1 - Math.exp(-dt * 14));

  const room = roomAt(player.x, player.z);
  if (room !== currentRoom) enterRoom(room);

  if (length > 0) dom.hint.classList.add('is-used');
}

function applyCamera() {
  camera.position.set(player.x, EYE + player.y + player.bob, player.z);
  camera.rotation.set(player.pitch, player.yaw, 0);
}

/* ------------------------------------------------------------------- Pointing at the exhibits */

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const toCenter = new THREE.Vector3();

function exhibitUnder(x, y) {
  ndc.set(x, y);
  ray.setFromCamera(ndc, camera);
  const { origin, direction } = ray.ray;
  let best = null;
  let bestT = REACH;
  currentRoom.exhibits.forEach((ex) => {
    const facing = direction.dot(ex.normal);
    if (facing >= 0) return;
    const t = toCenter.subVectors(ex.center, origin).dot(ex.normal) / facing;
    if (t <= 0 || t >= bestT) return;
    const px = origin.x + direction.x * t - ex.center.x;
    const py = origin.y + direction.y * t - ex.center.y;
    const pz = origin.z + direction.z * t - ex.center.z;
    if (Math.abs(px * ex.right.x + pz * ex.right.z) > ex.w / 2 + 0.1) return;
    if (Math.abs(py) > ex.h / 2 + 0.1) return;
    bestT = t;
    best = ex;
  });
  if (!best) return null;

  // A partition can stand between you and the wall behind it
  const blocked = colliders.some((box) => {
    if (!box.occludes) return false;
    let near = 0;
    let far = bestT;
    for (const [o, d, lo, hi] of [[origin.x, direction.x, box.x0, box.x1], [origin.z, direction.z, box.z0, box.z1]]) {
      if (Math.abs(d) < 1e-6) {
        if (o < lo || o > hi) return false;
      } else {
        const a = (lo - o) / d;
        const b = (hi - o) / d;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    return near < far && far < bestT - 0.1;
  });
  return blocked ? null : best;
}

function cursorLabel(ex) {
  if (ex.cursor) return ex.cursor;
  if (ex.action === 'map') return 'Open the map';
  if (ex.kind === 'film') return 'Watch the film';
  return 'Look closer';
}

function setHovered(ex) {
  if (ex === hovered) return;
  if (hovered) hovered.outline.visible = false;
  hovered = ex;
  if (ex) ex.outline.visible = true;
  const label = ex ? cursorLabel(ex) : '';
  dom.reticle.classList.toggle('has-label', Boolean(ex));
  if (ex) dom.reticle.querySelector('.tm-cursor-label').textContent = label;
  // Without pointer lock, the shared cursor from cursor.js carries the label instead
  if (ex && dragMode) dom.canvas.dataset.cursor = label;
  else delete dom.canvas.dataset.cursor;
}

function updateHover() {
  if (state !== 'walking') {
    setHovered(null);
    return;
  }
  if (dragMode && !isTouch && mouseNdc) setHovered(exhibitUnder(mouseNdc.x, mouseNdc.y));
  else setHovered(exhibitUnder(0, 0));
}

function interact(ex) {
  if (!ex || state !== 'walking') return;
  if (ex.action === 'exit') {
    location.href = '../';
    return;
  }
  if (ex.action === 'map') {
    openMap();
    return;
  }
  // The note wall opens in the reading panel too, as the place to make a note
  openReader(ex);
}

/* ------------------------------------------------------------------------------- The reading panel */

let reading = null;

function panelWidth() {
  return window.innerWidth >= 900 ? Math.min(window.innerWidth * 0.42, reading && reading.kind === 'film' ? 680 : 560) : 0;
}

function shortestAngle(from, to) {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta;
}

// Where to stand to see a piece whole in the part of the screen the panel leaves free
function viewingSpot(ex) {
  const width = window.innerWidth - panelWidth();
  const height = window.innerHeight;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitHeight = (ex.h / 2 * 1.3) / halfTan;
  const fitWidth = (ex.w / 2 * 1.14) / (halfTan * (width / height));
  let distance = Math.max(1.5, fitHeight, fitWidth);

  // Back up only as far as the room allows
  let clear = 0.6;
  while (clear < distance) {
    const next = clear + 0.25;
    if (hitsWall(ex.center.x + ex.normal.x * next, ex.center.z + ex.normal.z * next)) break;
    clear = next;
  }
  distance = clear;

  const x = ex.center.x + ex.normal.x * distance;
  const z = ex.center.z + ex.normal.z * distance;
  return {
    x,
    z,
    yaw: Math.atan2(ex.normal.x, ex.normal.z),
    pitch: Math.atan2(ex.center.y - EYE, distance),
  };
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function readerHtml(ex) {
  if (ex.wall) return ex.wall.html();
  const parts = [];
  if (ex.kind === 'film' && ex.vimeo) {
    parts.push(`<div class="g-reader-film"><iframe src="https://player.vimeo.com/video/${ex.vimeo}" title="${escapeHtml(ex.title)}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`);
  } else if (ex.kind === 'image') {
    parts.push(`<img class="g-reader-media" src="${ex.src}" alt="">`);
  } else if (ex.kind === 'video') {
    parts.push(`<video class="g-reader-media" src="${ex.src}" poster="${ex.poster}" muted loop playsinline controls></video>`);
  }
  if (ex.over) parts.push(`<p class="overline g-reader-over">${escapeHtml(ex.over)}</p>`);
  if (ex.title) parts.push(`<h2 class="headlinePrimary">${escapeHtml(ex.title)}</h2>`);
  if (ex.lede) parts.push(`<p class="body">${escapeHtml(ex.lede)}</p>`);
  if (ex.quote) {
    parts.push(`<figure class="insight">${ex.quoteLabel ? `<figcaption>${escapeHtml(ex.quoteLabel)}</figcaption>` : ''}<blockquote><p>${escapeHtml(ex.quote)}</p></blockquote></figure>`);
  }
  if (ex.grid) {
    parts.push(`<dl class="brief-grid">${ex.grid.map(([term, detail]) => `<div><dt>${escapeHtml(term)}</dt><dd>${escapeHtml(detail)}</dd></div>`).join('')}</dl>`);
  }
  if (ex.stats) {
    parts.push(`<dl class="results">${ex.stats.map(([value, label]) => `<div><dt>${escapeHtml(value)}</dt><dd>${escapeHtml(label)}</dd></div>`).join('')}</dl>`);
  }
  (ex.body || []).forEach((text) => parts.push(`<p class="body">${escapeHtml(text)}</p>`));
  if (ex.caption) parts.push(`<p class="caption-regular g-reader-caption">${escapeHtml(ex.caption)}</p>`);
  (ex.more || []).forEach((extra) => {
    parts.push(`<h2 class="headlinePrimary g-reader-more">${escapeHtml(extra.title)}</h2>`);
    [extra.lede, ...(extra.body || [])].filter(Boolean).forEach((copy) => parts.push(`<p class="body">${escapeHtml(copy)}</p>`));
  });
  if (ex.plan) parts.push('<p class="body">Press M at any time to see where you are.</p>');
  if (ex.link) {
    const external = ex.link.external ? ' target="_blank" rel="noopener"' : '';
    parts.push(`<p><a class="link" href="${ex.link.href}"${external}><span class="link-text">${escapeHtml(ex.link.text)}</span></a></p>`);
  }
  return parts.join('');
}

function readableTour() {
  return exhibits.filter((ex) => !ex.action);
}

function openReader(ex) {
  const wasReading = state === 'reading';
  state = 'reading';
  reading = ex;
  dom.body.classList.add('is-reading');
  if (locked) document.exitPointerLock();
  input.keys.clear();

  const room = ex.room;
  queueAround(room);
  const inRoom = readableTour().filter((item) => item.room === room);
  dom.readerRoom.innerHTML = `<span class="home-name">${room.name}</span><span class="home-sep" aria-hidden="true"></span><span class="home-status">${room.status}</span>`;
  dom.readerCount.textContent = `${inRoom.indexOf(ex) + 1} of ${inRoom.length}`;
  dom.readerBody.innerHTML = readerHtml(ex);
  dom.readerBody.scrollTop = 0;
  if (ex.wall) ex.wall.bind(dom.readerBody);
  // The note wall isn't part of the tour, so it has no previous and next
  dom.reader.querySelector('.g-reader-steps').hidden = !inRoom.includes(ex);
  if (room.href) {
    dom.readerCta.href = room.href;
    dom.readerCta.textContent = room.cta;
    dom.readerCta.hidden = false;
  } else {
    dom.readerCta.hidden = true;
  }
  dom.reader.classList.toggle('is-film', ex.kind === 'film');
  dom.reader.classList.add('is-open');
  dom.reader.removeAttribute('inert');
  if (!wasReading) dom.reader.querySelector('.g-reader-close').focus({ preventScroll: true });

  viewShiftTarget = panelWidth() / 2;
  const to = viewingSpot(ex);
  if (ex.room !== currentRoom || reduceMotion) {
    // Across rooms a glide would pass through walls, so cut instead
    dom.veil.classList.add('is-on');
    setTimeout(() => {
      player.x = to.x;
      player.z = to.z;
      player.yaw = to.yaw;
      player.pitch = to.pitch;
      enterRoom(ex.room);
      dom.veil.classList.remove('is-on');
    }, reduceMotion ? 0 : 180);
    glide = null;
    return;
  }
  const distance = Math.hypot(to.x - player.x, to.z - player.z);
  glide = {
    t: 0,
    duration: Math.min(1.5, 0.55 + distance * 0.09),
    from: { x: player.x, z: player.z, yaw: player.yaw, pitch: player.pitch },
    to: { ...to, yaw: shortestAngle(player.yaw, to.yaw) },
  };
}

function stepReader(direction) {
  const tour = readableTour();
  const next = tour[(tour.indexOf(reading) + direction + tour.length) % tour.length];
  openReader(next);
}

function closeReader() {
  dom.reader.classList.remove('is-open', 'is-film');
  dom.reader.setAttribute('inert', '');
  dom.body.classList.remove('is-reading');
  dom.readerBody.innerHTML = '';
  reading = null;
  viewShiftTarget = 0;
  glide = null;

  // Step back to somewhere walkable before carrying on
  const pos = { x: player.x, z: player.z };
  collide(pos);
  player.x = pos.x;
  player.z = pos.z;
  player.vx = player.vz = 0;
  resumeWalking();
}

function updateGlide(dt) {
  if (glide) {
    glide.t = Math.min(1, glide.t + dt / glide.duration);
    const e = 1 - (1 - glide.t) ** 3;
    player.x = glide.from.x + (glide.to.x - glide.from.x) * e;
    player.z = glide.from.z + (glide.to.z - glide.from.z) * e;
    player.yaw = glide.from.yaw + (glide.to.yaw - glide.from.yaw) * e;
    player.pitch = glide.from.pitch + (glide.to.pitch - glide.from.pitch) * e;
    if (glide.t === 1) glide = null;
  }
  // Slide the picture over so the piece sits in the space the panel leaves
  const next = viewShift + (viewShiftTarget - viewShift) * (1 - Math.exp(-dt * 7));
  if (Math.abs(next - viewShift) > 0.05) {
    viewShift = next;
    applyViewOffset();
  } else if (viewShift !== viewShiftTarget && Math.abs(viewShiftTarget - viewShift) < 0.5) {
    viewShift = viewShiftTarget;
    applyViewOffset();
  }
}

function applyViewOffset() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (viewShift !== 0) camera.setViewOffset(w, h, viewShift, 0, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
}

/* ----------------------------------------------------------------------------------------- Maps */

function planSvg(labelled = false) {
  const lines = ROOMS.flatMap((room) => Object.values(room.runs).map((run) => (
    `<line x1="${run.origin[0]}" y1="${run.origin[1]}" x2="${run.origin[0] + run.right[0] * run.length}" y2="${run.origin[1] + run.right[1] * run.length}"/>`
  ))).join('');
  const route = routePoints.filter((p, i) => i % 3 === 0).map((p) => `${p.x.toFixed(2)},${p.z.toFixed(2)}`).join(' ');
  return `
    <svg viewBox="-13 -15 60 30" aria-hidden="true">
      <g class="g-plan-walls">${lines}</g>
      <polyline class="g-plan-route" points="${route}"/>
      ${labelled ? ROOMS.map((room) => `<text class="g-plan-label" x="${(room.x0 + room.x1) / 2}" y="${(room.z0 + room.z1) / 2 + (room.id === 'foyer' ? 0 : room.z0 < 0 ? -4 : 5)}">${room.name}</text>`).join('') : ''}
      <g class="g-plan-you"><circle r="1.5"/><path d="M0 -2.9 L1.5 -0.6 L-1.5 -0.6 Z"/></g>
    </svg>`;
}

function buildMaps() {
  dom.introRooms.innerHTML = ROOMS.filter((room) => room.id !== 'foyer').map((room) => `
    <button type="button" data-room="${room.id}">
      <span class="g-intro-room-name">${room.name}</span>
      <span class="g-intro-room-status">${room.status}</span>
    </button>`).join('');
  dom.introRooms.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) jumpTour(roomById[button.dataset.room]);
  });

  dom.mini.innerHTML = planSvg();
  dom.mapPlan.innerHTML = planSvg(true);
  dom.mapRooms.innerHTML = ROOMS.map((room) => `
    <li><button type="button" data-room="${room.id}">
      <span class="home-caption"><span class="home-name">${room.name}</span><span class="home-sep" aria-hidden="true"></span><span class="home-status">${room.status}</span></span>
    </button></li>`).join('');
  dom.mapRooms.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    const room = roomById[button.dataset.room];
    closeMap();
    dom.veil.classList.add('is-on');
    setTimeout(() => {
      placeInRoom(room);
      dom.veil.classList.remove('is-on');
    }, reduceMotion ? 0 : 180);
  });
}

const youMarkers = [];
function updateMarkers() {
  if (!youMarkers.length) youMarkers.push(...document.querySelectorAll('.g-plan-you'));
  const transform = `translate(${player.x.toFixed(2)} ${player.z.toFixed(2)}) rotate(${(-player.yaw * 180 / Math.PI).toFixed(1)})`;
  youMarkers.forEach((marker) => marker.setAttribute('transform', transform));
}

function openMap() {
  state = 'map';
  input.keys.clear();
  if (locked) document.exitPointerLock();
  dom.map.classList.add('is-open');
  dom.map.removeAttribute('inert');
  dom.body.classList.add('is-reading');
  dom.map.querySelector('.g-map-close').focus({ preventScroll: true });
}

function closeMap() {
  dom.map.classList.remove('is-open');
  dom.map.setAttribute('inert', '');
  dom.body.classList.remove('is-reading');
  resumeWalking();
}

/* ------------------------------------------------------------------------------- The opening tour */

// Before you step in, the camera glides along the dashed line through the real rooms, and the
// pointer nudges the view a little. Entering hands over from wherever it has got to.
const TOUR_SPEED = 1.5;
const TOUR_LOOK_AHEAD = 6;
const tour = { at: 0, yaw: 0, lookX: 0, lookY: 0, pointerX: 0, pointerY: 0 };
const routeSpacing = routePoints.reduce((sum, p, i) => (i ? sum + p.distanceTo(routePoints[i - 1]) : 0), 0) / (routePoints.length - 1);

function routePointAt(index) {
  const count = routePoints.length - 1;
  const wrapped = ((index % count) + count) % count;
  const lower = Math.floor(wrapped);
  return routePoints[lower].clone().lerp(routePoints[lower + 1], wrapped - lower);
}

const yawTowards = (from, to) => Math.atan2(-(to.x - from.x), -(to.z - from.z));

function startTourFrom(room) {
  const [x, z] = room.spawn.at;
  let best = 0;
  routePoints.forEach((p, i) => {
    if (Math.hypot(p.x - x, p.z - z) < Math.hypot(routePoints[best].x - x, routePoints[best].z - z)) best = i;
  });
  tour.at = best;
  if (!reduceMotion) tour.yaw = yawTowards(routePointAt(best), routePointAt(best + TOUR_LOOK_AHEAD / routeSpacing));
}

function updateTour(dt) {
  tour.at += TOUR_SPEED * dt / routeSpacing;
  const here = routePointAt(tour.at);
  const ahead = routePointAt(tour.at + TOUR_LOOK_AHEAD / routeSpacing);
  const heading = shortestAngle(tour.yaw, yawTowards(here, ahead));
  tour.yaw += (heading - tour.yaw) * (1 - Math.exp(-dt * 1.4));
  const ease = 1 - Math.exp(-dt * 3);
  tour.lookX += (tour.pointerX - tour.lookX) * ease;
  tour.lookY += (tour.pointerY - tour.lookY) * ease;
  player.x = here.x;
  player.z = here.z;
  player.yaw = tour.yaw + tour.lookX;
  player.pitch = tour.lookY;
  const room = roomAt(player.x, player.z);
  if (room !== currentRoom) enterRoom(room);
}

// From the room strip: carry the tour on from that room, or wait there if paused
function jumpTour(room) {
  dom.veil.classList.add('is-on');
  setTimeout(() => {
    placeInRoom(room);
    if (state === 'intro') startTourFrom(room);
    dom.veil.classList.remove('is-on');
  }, reduceMotion ? 0 : 180);
}

/* ------------------------------------------------------------------------------ Starting and pausing */

function requestLock() {
  if (dragMode) return;
  try {
    const request = dom.canvas.requestPointerLock();
    if (request && request.catch) request.catch(lockFailed);
  } catch (error) {
    lockFailed();
  }
}

function lockFailed() {
  if (locked) return;
  if (everLocked) {
    // Browsers refuse to re-lock for a moment after Esc, so ask for one more click
    if (state === 'walking') pause();
    return;
  }
  // No pointer lock here at all, as in some embedded browsers: drag to look instead
  dragMode = true;
  dom.body.classList.add('is-drag');
}

// On the start and pause screens, frame the rooms in the open space beside the words
function introShift() {
  return window.innerWidth >= 900 ? -window.innerWidth * 0.2 : 0;
}

function resumeWalking() {
  state = 'walking';
  viewShiftTarget = 0;
  syncAddress();
  dom.intro.classList.remove('is-open');
  dom.intro.setAttribute('inert', '');
  dom.body.classList.add('is-walking');
  dom.canvas.focus({ preventScroll: true });
  requestLock();
}

function pause() {
  state = 'paused';
  viewShiftTarget = introShift();
  input.keys.clear();
  dom.enter.textContent = 'Keep walking';
  dom.introNote.textContent = 'Paused. Your place is saved.';
  dom.intro.classList.add('is-open');
  dom.intro.removeAttribute('inert');
  dom.body.classList.remove('is-walking');
  dom.enter.focus({ preventScroll: true });
}

function bindInput() {
  dom.enter.addEventListener('click', resumeWalking);
  dom.reader.querySelector('.g-reader-close').addEventListener('click', closeReader);
  dom.reader.querySelector('.g-reader-prev').addEventListener('click', () => stepReader(-1));
  dom.reader.querySelector('.g-reader-next').addEventListener('click', () => stepReader(1));
  dom.map.querySelector('.g-map-close').addEventListener('click', closeMap);
  dom.map.addEventListener('click', (event) => { if (event.target === dom.map) closeMap(); });
  $('#open-map').addEventListener('click', () => { if (state === 'walking') openMap(); });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === dom.canvas;
    dom.body.classList.toggle('is-locked', locked);
    if (locked) everLocked = true;
    else if (state === 'walking') pause();
  });
  document.addEventListener('pointerlockerror', lockFailed);

  dom.intro.addEventListener('mousemove', (event) => {
    tour.pointerX = (0.5 - event.clientX / window.innerWidth) * 0.3;
    tour.pointerY = (0.5 - event.clientY / window.innerHeight) * 0.14;
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked || state !== 'walking') return;
    // Some browsers occasionally report a huge jump when the pointer is captured
    if (Math.abs(event.movementX) > 300 || Math.abs(event.movementY) > 300) return;
    look(event.movementX, event.movementY, 0.0021);
  });

  dom.canvas.addEventListener('mousedown', (event) => {
    if (locked && event.button === 0) interact(hovered);
  });

  // Dragging to look, for touch screens and anywhere pointer lock isn't available
  const pointers = new Map();
  let stickId = null;
  let stickOrigin = null;

  dom.canvas.addEventListener('pointerdown', (event) => {
    if (locked || state !== 'walking') return;
    if (event.pointerType === 'touch' && event.clientX < window.innerWidth * 0.4 && stickId === null) {
      stickId = event.pointerId;
      stickOrigin = { x: event.clientX, y: event.clientY };
      dom.stick.style.transform = `translate(${event.clientX}px, ${event.clientY}px)`;
      dom.stick.classList.add('is-on');
    } else {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: 0 });
    }
    dom.canvas.setPointerCapture(event.pointerId);
  });

  dom.canvas.addEventListener('pointermove', (event) => {
    if (!isTouch) {
      mouseNdc = { x: event.clientX / window.innerWidth * 2 - 1, y: -(event.clientY / window.innerHeight * 2 - 1) };
    }
    if (event.pointerId === stickId) {
      const dx = event.clientX - stickOrigin.x;
      const dy = event.clientY - stickOrigin.y;
      const reach = 56;
      const d = Math.min(1, Math.hypot(dx, dy) / reach);
      const a = Math.atan2(dy, dx);
      input.stickX = Math.cos(a) * d;
      input.stickY = -Math.sin(a) * d;
      dom.stick.firstElementChild.style.transform = `translate(${input.stickX * reach}px, ${-input.stickY * reach}px)`;
      dom.hint.classList.add('is-used');
      return;
    }
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.moved += Math.abs(dx) + Math.abs(dy);
    look(dx, dy, event.pointerType === 'touch' ? 0.0042 : 0.0034);
  });

  const release = (event) => {
    if (event.pointerId === stickId) {
      stickId = null;
      input.stickX = input.stickY = 0;
      dom.stick.classList.remove('is-on');
      dom.stick.firstElementChild.style.transform = '';
      return;
    }
    const pointer = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (pointer && pointer.moved < 8 && event.type === 'pointerup' && state === 'walking') {
      interact(exhibitUnder(event.clientX / window.innerWidth * 2 - 1, -(event.clientY / window.innerHeight * 2 - 1)));
    }
  };
  dom.canvas.addEventListener('pointerup', release);
  dom.canvas.addEventListener('pointercancel', release);

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    if (state === 'reading') {
      if (event.code === 'Escape' || event.code === 'KeyE') closeReader();
      else if (event.code === 'ArrowRight' && !reading.wall) stepReader(1);
      else if (event.code === 'ArrowLeft' && !reading.wall) stepReader(-1);
      return;
    }
    if (state === 'map') {
      if (event.code === 'Escape' || event.code === 'KeyM') closeMap();
      return;
    }
    if (state !== 'walking') return;

    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'KeyE' || event.code === 'Enter') interact(hovered);
    else if (event.code === 'KeyM') openMap();
    else if (event.code === 'Escape' && !locked) pause();
    else input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('blur', () => input.keys.clear());
  window.addEventListener('resize', resize);
}

function look(dx, dy, sensitivity) {
  player.yaw -= dx * sensitivity;
  player.pitch = Math.max(-1.35, Math.min(1.35, player.pitch - dy * sensitivity));
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // A phone held upright needs a wider view to take in a room
  camera.fov = w < h ? 84 : 68;
  if (reading) {
    viewShift = viewShiftTarget = panelWidth() / 2;
  } else if (state === 'intro' || state === 'paused') {
    viewShift = viewShiftTarget = introShift();
  }
  applyViewOffset();
}

/* ------------------------------------------------------------------------------------- Video */

// Loops only run in the room you're standing in, and never for people who'd rather no motion
function updateVideos() {
  if (reduceMotion) return;
  ROOMS.forEach((room) => room.exhibits.forEach((ex) => {
    if (ex.kind !== 'video' && ex.kind !== 'film') return;
    const wanted = room === currentRoom && !document.hidden;
    if (wanted && !ex.video) {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.preload = 'auto';
      video.src = ex.src;
      video.addEventListener('playing', () => {
        if (ex.playing) return;
        ex.playing = true;
        const texture = new THREE.VideoTexture(video);
        texture.colorSpace = THREE.SRGBColorSpace;
        revealTexture(ex.material, texture);
      }, { once: true });
      ex.video = video;
    }
    if (!ex.video) return;
    if (wanted && ex.video.paused) ex.video.play().catch(() => {});
    else if (!wanted && !ex.video.paused) ex.video.pause();
  }));
}

/* ----------------------------------------------------------------------------------------- Loop */

let last = 0;
let mirror = null;
let routeTexture = null;
let tick = 0;
let frameTotal = 0;
let frameCount = 0;
let pixelRatio = 1;

// Drop resolution, then reflections, if a machine is struggling
function adapt(dt) {
  frameTotal += dt;
  frameCount++;
  if (frameCount < 90) return;
  const average = frameTotal / frameCount;
  frameTotal = 0;
  frameCount = 0;
  if (average < 0.026 || document.hidden) return;
  if (pixelRatio > 1) {
    pixelRatio = Math.max(1, pixelRatio - 0.25);
    renderer.setPixelRatio(pixelRatio);
    resize();
  } else if (mirror.visible) {
    mirror.visible = false;
    floorMaterial.uniforms.uRefl.value = 0;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  tick++;

  if (state === 'walking') updateMovement(dt);
  updateGlide(dt);

  if (state === 'intro' && !reduceMotion) updateTour(dt);

  applyCamera();
  if (tick % 3 === 0) updateHover();
  if (tick % 2 === 0) updateMarkers();
  if (tick % 20 === 0) updateVideos();

  if (routeTexture && !reduceMotion) routeTexture.offset.x = -now * 0.00042;
  noteWalls.forEach((wall) => wall.update(dt));

  const job = jobs.shift();
  if (job) job();
  // Fade the world in once the first rooms' lettering is on the walls
  if (!jobs.length) dom.body.classList.add('is-revealed');

  renderer.render(scene, camera);
  if (dt > 0 && state === 'walking') adapt(dt);
}

/* ------------------------------------------------------------------------------------- Start */

async function boot() {
  try {
    // Keeping the last frame lets the page dissolve capture the rooms as you leave
    renderer = new THREE.WebGLRenderer({ canvas: dom.canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  } catch (error) {
    dom.body.classList.add('no-webgl');
    return;
  }

  pixelRatio = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0xfafafa);
  renderer.toneMapping = THREE.NoToneMapping;

  // Lettering is measured as well as drawn, so the fonts have to be here first
  await Promise.race([
    Promise.all([
      document.fonts.load(`400 40px ${SERIF}`),
      document.fonts.load(`400 40px ${SANS}`),
      document.fonts.load(`500 40px ${SANS}`),
    ]),
    new Promise((resolve) => { setTimeout(resolve, 3000); }),
  ]);

  // Everything on the walls comes from the site's pages
  if (!await loadContent(ROOMS)) {
    dom.body.classList.add('no-webgl');
    $('#no-webgl-note').textContent = 'The gallery couldn’t load the work just now. All of it is on the main site.';
    return;
  }

  scene.add(world, overlay);
  buildExhibits();
  buildShell();
  buildSigns();
  buildTrackLights();
  routeTexture = buildRoute();

  const shellMesh = new THREE.Mesh(shell.geometry(), shellMaterial);
  world.add(shellMesh);

  // The reflection: the whole building again, upside down beneath the see-through floor
  mirror = world.clone();
  mirror.scale.y = -1;
  mirror.traverse((object) => {
    // Keeps the same order, but all of it beneath the see-through floor
    if (object.material && object.material.transparent) object.renderOrder += MIRROR_OFFSET;
  });
  scene.add(mirror);

  signs.forEach((sign) => jobs.push(() => revealTexture(sign.material, panelTexture(sign.layout))));

  buildMaps();
  bindInput();

  const hashRoom = roomById[location.hash.slice(1)];
  placeInRoom(hashRoom || roomById.foyer);
  startTourFrom(hashRoom || roomById.foyer);
  resize();
  applyCamera();

  state = 'intro';
  viewShift = viewShiftTarget = introShift();
  applyViewOffset();
  dom.enter.disabled = false;
  dom.enter.textContent = currentRoom.id === 'foyer' ? 'Enter the gallery' : `Walk into ${currentRoom.name}`;
  requestAnimationFrame(frame);
}

boot();
