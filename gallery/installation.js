// Transience, rebuilt in its room: a projection on the wall and, in front of it, the white plinth
// with the conductive-ink controller on top, as it stood at the show.
//
// Step up to the plinth and click the pads to turn them on and off. The six along the top each
// bring in one channel of a techno track, and the three round ones along the bottom each put one
// raver's film up on the wall, one film at a time. With no film on, the wall goes back to projector
// grey. All six channels run in time with each other from the moment you step up, so any mix of
// pads makes music. (At the show the pads worked only while touched, and restarted a channel each
// time; here they stay on, so there's no need to hold anything.)
//
// Placeholders until the real media is in: a film without a `src` is drawn live, a channel without
// a `src` is synthesised, and the photos without `srcs` are blank prints. Give any of them a file in
// content.js and it's used instead.

const INK = '#141414';
const PAPER = '#F3F3F0';
const SANS = 'Inter, "Helvetica Neue", sans-serif';

const BPM = 126;
const BEAT = 60 / BPM;
const STEP = BEAT / 4;

// The board, measured in metres, and how far it's tipped back towards whoever is playing it
const BOARD = { w: 0.86, h: 0.58, tilt: (25 * Math.PI) / 180 };

// The ink artwork, redrawn from the footage. Positions are fractions of the board, from its top
// left corner as you stand at it. Each pad is also where it's touched.
const PADS = [
  ...[0.12, 0.272, 0.424, 0.576, 0.728, 0.88].map((u, i) => ({
    kind: 'sound', index: i, u, v0: 0.22, v1: 0.56, shape: i % 2 ? 'bar' : 'coil', key: `${i + 1}`,
  })),
  ...[0.3, 0.5, 0.7].map((u, i) => ({ kind: 'film', index: i, u, v: 0.78, key: ['←', '↑', '→'][i] })),
];

export const KEYS = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5,
  ArrowLeft: 6, ArrowUp: 7, ArrowRight: 8,
};

/* ----------------------------------------------------------------------------------- Sound */

const ROOTS = [55, 55, 43.65, 49]; // A, A, F, G: one a bar
const semis = (f, n) => f * 2 ** (n / 12);

// Each voice plays one sixteenth-note step of its part into `out`
const VOICES = {
  kick(ctx, out, t, pos) {
    if (pos % 4) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.13);
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
  },
  hats(ctx, out, t, pos, bar, kit) {
    const open = pos % 4 === 2;
    if (!open && pos % 2 === 0) return;
    const src = ctx.createBufferSource();
    src.buffer = kit.noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(open ? 0.32 : 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.08 : 0.03));
    src.connect(hp).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.1);
  },
  bass(ctx, out, t, pos, bar) {
    if (pos % 4 === 0) return;
    const f = ROOTS[bar];
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(950, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + STEP * 0.9);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.42, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t + STEP * 0.95);
    [0, 7].forEach((detune) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = detune;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + STEP);
    });
    lp.connect(g).connect(out);
  },
  clap(ctx, out, t, pos, bar, kit) {
    if (pos !== 4 && pos !== 12) return;
    const src = ctx.createBufferSource();
    src.buffer = kit.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    // Three quick slaps and a tail, the way a clap is built
    g.gain.setValueAtTime(0.7, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.01);
    g.gain.setValueAtTime(0.6, t + 0.012);
    g.gain.linearRampToValueAtTime(0.08, t + 0.022);
    g.gain.setValueAtTime(0.55, t + 0.024);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.25);
  },
  stab(ctx, out, t, pos, bar) {
    if (pos !== 3 && pos !== 10 && !(bar === 3 && pos === 14)) return;
    const root = ROOTS[bar] * 4;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    [0, 3, 7].forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = semis(root, n);
      osc.detune.value = (i - 1) * 6;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + 0.28);
    });
    lp.connect(g).connect(out);
  },
  pad(ctx, out, t, pos, bar) {
    if (pos !== 0) return;
    const root = ROOTS[bar] * 4;
    const length = STEP * 16;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1300, t + length * 0.6);
    lp.frequency.linearRampToValueAtTime(700, t + length);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.055, t + 0.5);
    g.gain.setValueAtTime(0.055, t + length - 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t + length + 0.05);
    [0, 3, 7, 10].forEach((n, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = semis(root, n);
      osc.detune.value = i % 2 ? 9 : -9;
      osc.connect(lp);
      osc.start(t);
      osc.stop(t + length + 0.1);
    });
    lp.connect(g).connect(out);
  },
};

const PANS = { hats: 0.25, stab: -0.2, pad: 0.1 };

class Sound {
  constructor(stems) {
    this.stems = stems;
    this.ctx = null;
    this.muted = false;
    this.timer = null;
    this.sleep = null;
  }

  setup() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    const ctx = new AudioContext();
    this.ctx = ctx;

    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -14;
    glue.ratio.value = 3;
    glue.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(glue);

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.kit = { noise };

    this.gates = this.stems.map((stem) => {
      const gate = ctx.createGain();
      gate.gain.value = 0;
      let to = this.master;
      if (ctx.createStereoPanner && PANS[stem.voice]) {
        const pan = ctx.createStereoPanner();
        pan.pan.value = PANS[stem.voice];
        pan.connect(this.master);
        to = pan;
      }
      gate.connect(to);
      return gate;
    });

    this.t0 = ctx.currentTime + 0.06;
    this.step = 0;
    this.next = this.t0;

    // Real recordings, where given, loop in step with everything else
    this.buffers = [];
    this.stems.forEach((stem, i) => {
      if (!stem.src) return;
      fetch(stem.src)
        .then((response) => response.arrayBuffer())
        .then((bytes) => ctx.decodeAudioData(bytes))
        .then((buffer) => {
          this.buffers[i] = buffer;
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.loop = true;
          source.connect(this.gates[i]);
          const at = ctx.currentTime + 0.05;
          source.start(at, (at - this.t0) % buffer.duration);
        })
        .catch(() => console.warn(`Gallery: couldn't load ${stem.src}, so ${stem.name} is synthesised`));
    });
    return true;
  }

  async start() {
    if (!this.ctx && !this.setup()) return;
    clearTimeout(this.sleep);
    this.sleep = null;
    try { await this.ctx.resume(); } catch { /* the next press will try again */ }
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    this.schedule();
  }

  schedule() {
    const { ctx } = this;
    // After a stall, rejoin on the next step rather than playing everything that was missed
    if (this.next < ctx.currentTime - 0.05) {
      const behind = Math.ceil((ctx.currentTime - this.next) / STEP);
      this.step += behind;
      this.next += behind * STEP;
    }
    while (this.next < ctx.currentTime + 0.12) {
      const pos = this.step % 16;
      const bar = Math.floor(this.step / 16) % 4;
      this.stems.forEach((stem, i) => {
        if (this.buffers[i] || !VOICES[stem.voice]) return;
        VOICES[stem.voice](ctx, this.gates[i], this.next, pos, bar, this.kit);
      });
      this.step++;
      this.next += STEP;
    }
  }

  gate(i, on) {
    if (!this.ctx) return;
    const { gain } = this.gates[i];
    const now = this.ctx.currentTime;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(on ? 1 : 0, now, on ? 0.008 : 0.04);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.8, this.ctx.currentTime, 0.03);
  }

  // Where the track is, in beats, so the films can pulse along with it
  beat() {
    if (!this.ctx || this.ctx.state !== 'running') return performance.now() / 1000 / BEAT;
    return (this.ctx.currentTime - this.t0) / BEAT;
  }

  stop() {
    if (!this.ctx) return;
    this.gates.forEach((gate, i) => this.gate(i, false));
    clearTimeout(this.sleep);
    this.sleep = setTimeout(() => {
      clearInterval(this.timer);
      this.timer = null;
      this.ctx.suspend().catch(() => {});
    }, 600);
  }
}

/* ----------------------------------------------------------------------------------- Films */

const FILM_W = 640;
const FILM_H = 360;

// A stand-in for a raver's film: a figure swaying under fairy lights, in the film's own colour,
// flashing on the beat, and clearly labelled as a placeholder
function drawPlaceholderFilm(c, film, t, beat) {
  const { hue } = film;
  const W = FILM_W;
  const H = FILM_H;
  const sway = Math.sin(t * 0.9 + hue) * W * 0.035;

  const bg = c.createRadialGradient(W * 0.6, H * 0.42, 10, W * 0.55, H * 0.5, W * 0.7);
  bg.addColorStop(0, `hsl(${hue}, 80%, 34%)`);
  bg.addColorStop(0.55, `hsl(${hue}, 70%, 13%)`);
  bg.addColorStop(1, `hsl(${hue}, 60%, 4%)`);
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  // A string of fairy lights sagging across the top
  for (let i = 0; i <= 26; i++) {
    const u = i / 26;
    const x = u * W;
    const y = H * 0.14 + Math.sin(u * Math.PI) * H * 0.13 + Math.sin(t * 0.5) * 3;
    const twinkle = 0.55 + 0.45 * Math.sin(t * 3 + i * 1.7);
    const glow = c.createRadialGradient(x, y, 0, x, y, 14);
    glow.addColorStop(0, `hsla(42, 100%, 80%, ${twinkle})`);
    glow.addColorStop(1, 'hsla(42, 100%, 60%, 0)');
    c.fillStyle = glow;
    c.fillRect(x - 14, y - 14, 28, 28);
  }

  // The raver, swaying, nodding on every beat
  const phase = beat % 1;
  const nod = Math.abs(Math.sin(phase * Math.PI)) * 7;
  const cx = W * 0.42 + sway;
  const headY = H * 0.43 + nod;
  c.fillStyle = 'rgba(0, 0, 0, .82)';
  c.beginPath();
  c.ellipse(cx, H * 1.02, W * 0.19, H * 0.36, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.ellipse(cx, headY, H * 0.1, H * 0.125, sway * 0.002, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = `hsla(${hue}, 95%, 62%, .7)`;
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(cx, headY, H * 0.1, H * 0.125, sway * 0.002, -1.1, 0.6);
  c.stroke();

  // A flash of light on the beat
  const flash = (1 - phase) ** 5;
  c.fillStyle = `hsla(${hue}, 100%, 70%, ${0.22 * flash})`;
  c.fillRect(0, 0, W, H);

  c.fillStyle = 'rgba(0, 0, 0, .45)';
  c.fillRect(18, H - 62, 248, 44);
  c.fillStyle = 'rgba(255, 255, 255, .6)';
  c.font = `500 12px ${SANS}`;
  c.fillText('PLACEHOLDER FILM', 30, H - 44);
  c.fillStyle = '#FFFFFF';
  c.font = `500 17px ${SANS}`;
  c.fillText(film.name, 30, H - 25);
}

/* ----------------------------------------------------------------------------------- Board */

function drawBoard(c, W, H, on, hover) {
  const px = (u) => u * W;
  const py = (v) => v * H;
  const lit = (pad) => on.has(pad);

  c.fillStyle = PAPER;
  c.fillRect(0, 0, W, H);
  // A hairline edge, the cut of the board
  c.strokeStyle = '#D6D6D2';
  c.lineWidth = 4;
  c.strokeRect(2, 2, W - 4, H - 4);

  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = INK;
  c.fillStyle = INK;

  // The top line, and the second one down the left edge and along the bottom
  c.lineWidth = 16;
  c.beginPath();
  c.moveTo(px(0.05), py(0.13));
  c.lineTo(px(0.95), py(0.13));
  c.moveTo(px(0.05), py(0.13));
  c.lineTo(px(0.05), py(0.92));
  c.lineTo(px(0.7), py(0.92));
  c.stroke();

  // The touch board, in its little box at the top
  c.fillStyle = '#FFFFFF';
  c.fillRect(px(0.45), py(0.03), px(0.1), py(0.14));
  c.strokeStyle = '#BDBDB8';
  c.lineWidth = 3;
  c.strokeRect(px(0.45), py(0.03), px(0.1), py(0.14));
  c.fillStyle = '#9A9A95';
  c.font = `500 ${Math.round(H * 0.022)}px ${SANS}`;
  c.textAlign = 'center';
  c.fillText('TOUCH', px(0.5), py(0.105));

  PADS.forEach((pad) => {
    const on = lit(pad);
    const colour = on ? '#1BA9DF' : INK;
    c.save();
    if (on) {
      c.shadowColor = 'rgba(27, 169, 223, .9)';
      c.shadowBlur = 28;
    }
    c.strokeStyle = colour;
    c.fillStyle = colour;
    if (pad.kind === 'sound') {
      const x = px(pad.u);
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(x, py(0.13));
      c.lineTo(x, py(pad.v0));
      c.stroke();
      if (pad.shape === 'coil') {
        c.lineWidth = 13;
        c.beginPath();
        c.moveTo(x, py(pad.v0));
        const zigs = 7;
        for (let i = 1; i <= zigs; i++) {
          const v = pad.v0 + (pad.v1 - pad.v0) * (i / zigs);
          c.lineTo(x + (i % 2 ? 1 : -1) * px(0.026), py(v));
        }
        c.stroke();
      } else {
        c.beginPath();
        c.roundRect(x - px(0.017), py(pad.v0), px(0.034), py(pad.v1 - pad.v0), 6);
        c.fill();
      }
    } else {
      const x = px(pad.u);
      const y = py(pad.v);
      const r = H * 0.075;
      c.lineWidth = 12;
      c.beginPath();
      c.moveTo(x, py(0.92));
      c.lineTo(x, y + r);
      c.stroke();
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = PAPER;
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x, y, r * 0.55, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();

    if (pad === hover && !on) {
      c.strokeStyle = 'rgba(27, 169, 223, .7)';
      c.lineWidth = 4;
      c.setLineDash([12, 8]);
      c.beginPath();
      if (pad.kind === 'sound') c.roundRect(px(pad.u - 0.055), py(pad.v0 - 0.035), px(0.11), py(pad.v1 - pad.v0 + 0.07), 14);
      else c.arc(px(pad.u), py(pad.v), H * 0.11, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
    }

    // Which key plays it, small and grey, for anyone at a keyboard
    c.fillStyle = on ? '#1BA9DF' : '#8E8E89';
    c.font = `500 ${Math.round(H * 0.04)}px ${SANS}`;
    c.textAlign = 'center';
    if (pad.kind === 'sound') c.fillText(pad.key, px(pad.u), py(0.65));
    else c.fillText(pad.key, px(pad.u + 0.085), py(pad.v + 0.015));
  });
}

function padAt(u, v) {
  return PADS.find((pad) => {
    if (pad.kind === 'sound') return Math.abs(u - pad.u) < 0.065 && v > pad.v0 - 0.05 && v < pad.v1 + 0.06;
    const dx = (u - pad.u) * BOARD.w;
    const dy = (v - pad.v) * BOARD.h;
    return Math.hypot(dx, dy) < BOARD.h * 0.12;
  }) || null;
}

/* ----------------------------------------------------------------------------------- Photos */

function drawPhotos(c, W, H, { cols, rows }, cell, gap, pictures) {
  c.clearRect(0, 0, W, H);
  for (let i = 0; i < cols * rows; i++) {
    const x = (i % cols) * (cell.w + gap);
    const y = Math.floor(i / cols) * (cell.h + gap);
    const picture = pictures[i];
    if (picture) {
      // Black and white, cropped to fill
      const scale = Math.max(cell.w / picture.width, cell.h / picture.height);
      const w = picture.width * scale;
      const h = picture.height * scale;
      c.save();
      c.beginPath();
      c.rect(x, y, cell.w, cell.h);
      c.clip();
      c.filter = 'grayscale(1)';
      c.drawImage(picture, x + (cell.w - w) / 2, y + (cell.h - h) / 2, w, h);
      c.restore();
    } else {
      const shade = 34 + ((i * 37) % 22);
      const g = c.createLinearGradient(x, y, x + cell.w, y + cell.h);
      g.addColorStop(0, `rgb(${shade + 20}, ${shade + 20}, ${shade + 20})`);
      g.addColorStop(1, `rgb(${shade}, ${shade}, ${shade})`);
      c.fillStyle = g;
      c.fillRect(x, y, cell.w, cell.h);
      c.fillStyle = 'rgba(255, 255, 255, .35)';
      c.font = `500 ${Math.round(cell.h * 0.11)}px ${SANS}`;
      c.textAlign = 'left';
      c.fillText(`Photo ${i + 1}`, x + cell.h * 0.08, y + cell.h - cell.h * 0.1);
    }
  }
}

/* ----------------------------------------------------------------------------------- Building it */

export function createInstallation(ex, kit) {
  const {
    THREE, shell, addCollider, floorShadow, wallDecal, decal, softTextures, outlineGeometry, lift,
    planeGeometry, canvasOf, overlay, LAYER, BRAND, reduceMotion,
  } = kit;
  const { room, normal: n, right: r, center } = ex;
  const wall = ex.wallBounds;

  const install = {
    room,
    on: new Set(), // the pads switched on
    hover: null,
    fade: 0,
    shown: -1,
    playing: false,
    t: 0,
  };

  /* The projection */
  const blank = new THREE.Mesh(planeGeometry, lift(new THREE.MeshBasicMaterial({ color: 0x2a2d30, toneMapped: false }), LAYER.lettering));
  blank.scale.set(ex.w, ex.h, 1);
  blank.position.z = 0.011;
  blank.renderOrder = LAYER.lettering;
  ex.group.add(blank);

  const films = ex.films.map((film) => {
    const entry = { ...film, tint: new THREE.Color().setHSL((film.hue ?? 30) / 360, 0.85, 0.55) };
    if (film.src) {
      const video = document.createElement('video');
      Object.assign(video, { muted: true, loop: true, playsInline: true, preload: 'none', src: film.src });
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      if (film.poster) video.poster = film.poster;
      entry.video = video;
      entry.texture = new THREE.VideoTexture(video);
    } else {
      const [canvas, c] = canvasOf(FILM_W, FILM_H);
      entry.c = c;
      entry.texture = new THREE.CanvasTexture(canvas);
    }
    entry.texture.colorSpace = THREE.SRGBColorSpace;
    return entry;
  });

  const filmMaterial = lift(new THREE.MeshBasicMaterial({
    map: films[0].texture, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  }), LAYER.lettering + 1);
  const screen = new THREE.Mesh(planeGeometry, filmMaterial);
  screen.scale.set(ex.w, ex.h, 1);
  screen.position.z = 0.013;
  screen.renderOrder = LAYER.lettering + 1;
  ex.group.add(screen);

  // The film lights the wall around it, and the floor in front
  const glow = wallDecal(softTextures.pool, 0xffffff, 0.04, wall, 0, 0, 0.007, ex.w * 2.1, ex.h * 2.3);
  ex.group.add(glow);
  const spill = decal(softTextures.pool, 0xffffff, 0, LAYER.edges);
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(center.x + n.x * 2.2, 0.005, center.z + n.z * 2.2);
  spill.rotation.z = Math.atan2(n.x, n.z);
  spill.scale.set(ex.w * 1.5, 5, 1);
  overlay.add(spill);

  /* The projector, hung from the ceiling behind the plinth, and its beam */
  const lens = new THREE.Vector3(center.x + n.x * (ex.plinth + 1.8), room.h - 0.42, center.z + n.z * (ex.plinth + 1.8));
  const axisBox = (along, across, y0, y1, depth, hex) => {
    // A box centred on `along` metres out from the wall, `across` metres to the right
    const cx = center.x + n.x * along + r.x * across;
    const cz = center.z + n.z * along + r.z * across;
    const hx = Math.abs(n.x) * depth.n + Math.abs(r.x) * depth.r;
    const hz = Math.abs(n.z) * depth.n + Math.abs(r.z) * depth.r;
    shell.box(cx - hx, cx + hx, y0, y1, cz - hz, cz + hz, hex);
  };
  axisBox(ex.plinth + 1.95, 0, room.h - 0.5, room.h - 0.34, { n: 0.2, r: 0.18 }, '#2E2E2E');
  axisBox(ex.plinth + 1.95, 0, room.h - 0.34, room.h, { n: 0.02, r: 0.02 }, '#1A1A1A');
  axisBox(ex.plinth + 1.74, 0, room.h - 0.47, room.h - 0.37, { n: 0.02, r: 0.045 }, '#0C0C0C');

  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => new THREE.Vector3(
    center.x + r.x * sx * ex.w / 2 + n.x * 0.02,
    center.y + sy * ex.h / 2,
    center.z + r.z * sx * ex.w / 2 + n.z * 0.02,
  ));
  const beamPositions = [];
  const beamColours = [];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    [lens, a, b].forEach((p, k) => {
      beamPositions.push(p.x, p.y, p.z);
      const strength = k === 0 ? 1 : 0.15;
      beamColours.push(strength, strength, strength);
    });
  });
  const beamGeometry = new THREE.BufferGeometry();
  beamGeometry.setAttribute('position', new THREE.Float32BufferAttribute(beamPositions, 3));
  beamGeometry.setAttribute('color', new THREE.Float32BufferAttribute(beamColours, 3));
  const beamMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.02, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const beam = new THREE.Mesh(beamGeometry, beamMaterial);
  beam.renderOrder = LAYER.lettering + 2;
  overlay.add(beam);

  /* The plinth */
  const P = { x: center.x + n.x * ex.plinth, z: center.z + n.z * ex.plinth };
  const plinthTop = 0.84;
  axisBox(ex.plinth, 0, 0, plinthTop, { n: 0.22, r: 0.4 }, '#F2F2F0');
  axisBox(ex.plinth, 0, 0, 0.06, { n: 0.225, r: 0.405 }, '#CFCFCC');
  floorShadow(P.x, P.z, 1, 0.6, 0.5);
  {
    const hx = Math.abs(n.x) * 0.3 + Math.abs(r.x) * 0.48;
    const hz = Math.abs(n.z) * 0.3 + Math.abs(r.z) * 0.48;
    addCollider(P.x - hx, P.x + hx, P.z - hz, P.z + hz, { low: true });
  }

  /* The board on top, tipped towards you */
  const boardGroup = new THREE.Group();
  // Its near edge rests on the plinth, its far edge is propped up
  const rise = Math.sin(BOARD.tilt) * BOARD.h;
  boardGroup.position.set(P.x, plinthTop + 0.02 + rise / 2, P.z);
  boardGroup.rotation.y = Math.atan2(n.x, n.z);
  ex.group.parent.add(boardGroup);
  const tipped = new THREE.Group();
  tipped.rotation.x = -(Math.PI / 2 - BOARD.tilt);
  boardGroup.add(tipped);

  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD.w + 0.03, BOARD.h + 0.03, 0.025),
    new THREE.MeshBasicMaterial({ color: 0xd9d9d5, toneMapped: false }),
  );
  slab.position.z = -0.013;
  tipped.add(slab);

  const boardW = 1032;
  const boardH = Math.round(boardW * BOARD.h / BOARD.w);
  const [boardCanvas, bc] = canvasOf(boardW, boardH);
  const boardTexture = new THREE.CanvasTexture(boardCanvas);
  boardTexture.colorSpace = THREE.SRGBColorSpace;
  boardTexture.anisotropy = 8;
  const face = new THREE.Mesh(planeGeometry, new THREE.MeshBasicMaterial({ map: boardTexture, toneMapped: false }));
  face.scale.set(BOARD.w, BOARD.h, 1);
  face.position.z = 0.001;
  tipped.add(face);

  // The prop under its far edge
  // From the plinth up to just under the board, so it never shows through
  const propZ = -(Math.cos(BOARD.tilt) * BOARD.h) / 2 + 0.05;
  const propTop = -(propZ + 0.025) * Math.tan(BOARD.tilt) - 0.012;
  const propBottom = -(0.02 + rise / 2);
  const prop = new THREE.Mesh(
    new THREE.BoxGeometry(BOARD.w - 0.1, propTop - propBottom, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xe2e2df, toneMapped: false }),
  );
  prop.position.set(0, (propTop + propBottom) / 2, propZ);
  boardGroup.add(prop);

  const redrawBoard = () => {
    drawBoard(bc, boardW, boardH, install.on, install.hover);
    boardTexture.needsUpdate = true;
  };
  redrawBoard();

  /* The photos, beside the projection */
  const photos = ex.photos || { cols: 4, rows: 2, srcs: [] };
  const cell = { w: 0.3, h: 0.22 };
  const gap = 0.05;
  const gridW = photos.cols * cell.w + (photos.cols - 1) * gap;
  const gridH = photos.rows * cell.h + (photos.rows - 1) * gap;
  const ppm = 600;
  const [photoCanvas, pc] = canvasOf(Math.round(gridW * ppm), Math.round(gridH * ppm));
  const photoTexture = new THREE.CanvasTexture(photoCanvas);
  photoTexture.colorSpace = THREE.SRGBColorSpace;
  const pictures = [];
  const redrawPhotos = () => {
    drawPhotos(pc, photoCanvas.width, photoCanvas.height, photos, { w: cell.w * ppm, h: cell.h * ppm }, gap * ppm, pictures);
    photoTexture.needsUpdate = true;
  };
  redrawPhotos();
  (photos.srcs || []).forEach((src, i) => {
    const image = new Image();
    image.onload = () => { pictures[i] = image; redrawPhotos(); };
    image.src = src;
  });
  const photoMesh = new THREE.Mesh(planeGeometry, lift(new THREE.MeshBasicMaterial({
    map: photoTexture, transparent: true, toneMapped: false,
  }), LAYER.lettering));
  photoMesh.scale.set(gridW, gridH, 1);
  const photoX = ex.w / 2 + 1.1 + gridW / 2;
  photoMesh.position.set(Math.min(photoX, wall.right - gridW / 2 - 0.3), 0.35, 0.012);
  photoMesh.renderOrder = LAYER.lettering;
  ex.group.add(photoMesh);

  /* Pointing at it: the board stands in for an exhibit, so walking up and clicking works as usual */
  boardGroup.updateMatrixWorld(true);
  const boardNormal = new THREE.Vector3(0, 0, 1).transformDirection(face.matrixWorld);
  const boardUp = new THREE.Vector3(0, 1, 0).transformDirection(face.matrixWorld);
  const controller = {
    id: `${ex.id}-controller`,
    kind: 'controller',
    room,
    action: 'play',
    cursor: ex.cursor,
    install,
    center: face.getWorldPosition(new THREE.Vector3()),
    normal: boardNormal,
    right: new THREE.Vector3(boardNormal.z, 0, -boardNormal.x).normalize(),
    up: boardUp,
    w: BOARD.w,
    h: BOARD.h,
  };
  controller.outline = new THREE.Mesh(outlineGeometry(BOARD.w - 0.15, BOARD.h - 0.15, 0.012), new THREE.MeshBasicMaterial({ color: BRAND, toneMapped: false }));
  controller.outline.position.z = 0.004;
  controller.outline.visible = false;
  tipped.add(controller.outline);
  ex.install = install;
  install.controller = controller;
  install.projection = ex;

  /* Playing it */
  const sound = new Sound(ex.stems);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  install.standSpot = () => {
    // Far enough back to take in the board and the projection together
    const distance = ex.plinth + 1.3;
    return {
      x: center.x + n.x * distance,
      z: center.z + n.z * distance,
      yaw: Math.atan2(n.x, n.z),
      pitch: -0.2,
    };
  };

  install.padUnder = (clientX, clientY, camera) => {
    ndc.set(clientX / window.innerWidth * 2 - 1, -(clientY / window.innerHeight * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const [hit] = raycaster.intersectObject(face, false);
    if (!hit || !hit.uv) return null;
    return padAt(hit.uv.x, 1 - hit.uv.y);
  };

  install.padByKey = (code) => (code in KEYS ? PADS[KEYS[code]] : null);

  const sync = () => {
    PADS.filter((pad) => pad.kind === 'sound').forEach((pad) => sound.gate(pad.index, install.on.has(pad)));
    const film = PADS.find((pad) => pad.kind === 'film' && install.on.has(pad));
    install.wanted = film ? film.index : -1;
    redrawBoard();
  };

  install.isOn = (pad) => install.on.has(pad);

  // Each click flips a pad. Only one film shows at a time, so turning one on turns the others off.
  install.toggle = (pad) => {
    if (!pad) return;
    if (install.on.has(pad)) {
      install.on.delete(pad);
    } else {
      if (pad.kind === 'film') PADS.forEach((other) => { if (other.kind === 'film') install.on.delete(other); });
      install.on.add(pad);
    }
    sync();
  };

  install.clear = () => {
    if (!install.on.size) return;
    install.on.clear();
    sync();
  };

  install.setHover = (pad) => {
    if (pad === install.hover) return;
    install.hover = pad;
    redrawBoard();
  };

  install.begin = () => {
    install.playing = true;
    sound.start();
  };

  install.end = () => {
    install.playing = false;
    install.hover = null;
    install.clear();
    redrawBoard();
    sound.stop();
  };

  install.setMuted = (muted) => sound.setMuted(muted);

  install.wanted = -1;
  const shine = new THREE.Color();
  install.update = (dt, active) => {
    install.t += dt;
    if (!active && install.fade === 0) return;

    // Fade up quickly when a film is pressed, and away a little slower when let go
    const target = active && install.wanted >= 0 ? 1 : 0;
    if (install.wanted >= 0 && install.wanted !== install.shown) {
      const previous = films[install.shown];
      if (previous && previous.video) previous.video.pause();
      install.shown = install.wanted;
      const film = films[install.shown];
      filmMaterial.map = film.texture;
      if (film.video) film.video.play().catch(() => {});
    }
    install.fade += (target - install.fade) * (1 - Math.exp(-dt * (target ? 18 : 7)));
    if (Math.abs(install.fade - target) < 0.003) install.fade = target;

    const film = films[install.shown];
    if (film && install.fade > 0) {
      if (film.c) {
        drawPlaceholderFilm(film.c, film, reduceMotion ? 0 : install.t, reduceMotion ? 0.5 : sound.beat());
        film.texture.needsUpdate = true;
      }
      shine.copy(film.tint);
    } else {
      shine.setRGB(0.77, 0.87, 0.9);
    }
    if (install.fade === 0 && film && film.video && !film.video.paused) film.video.pause();

    filmMaterial.opacity = install.fade;
    glow.material.color.copy(shine);
    glow.material.opacity = 0.04 + 0.3 * install.fade;
    spill.material.color.copy(shine);
    spill.material.opacity = 0.16 * install.fade;
    beamMaterial.color.copy(shine);
    beamMaterial.opacity = 0.02 + 0.07 * install.fade;
  };

  return install;
}
