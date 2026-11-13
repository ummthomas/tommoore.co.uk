// Closing Time: the gallery's secret.
//
// Low on a wall in the Garments room there's a red button that says not to press it. Pressing it
// sounds the alarm, the lights go red, and the visitors who stayed too long climb up out of the
// polished floor, in waves. Survive as long as you can.
//
// Everything is built the way the rest of the gallery is: unlit boxes with their faces shaded by
// hand, and sound synthesised on the spot, so it adds nothing to download. gallery.js owns the
// visitor (walking, looking, colliding with the walls) and hands control here while the game runs.

const FOG = 0x160505;

// Hitscan weapons. Each is named for a room you'll have walked through, and the later ones are
// handed out between waves.
const WEAPONS = [
  { id: 'pistol', name: 'Pistol', damage: 34, rate: 0.16, auto: false, mag: 12, reserve: Infinity, reload: 1.05, spread: 0.006, pellets: 1, unlock: 1, kick: 1 },
  { id: 'rapid', name: 'The Rapid', damage: 21, rate: 0.085, auto: true, mag: 32, reserve: 160, reload: 1.5, spread: 0.022, pellets: 1, unlock: 3, kick: 0.6 },
  { id: 'patchwork', name: 'The Patchwork', damage: 15, rate: 0.72, auto: false, mag: 6, reserve: 30, reload: 1.9, spread: 0.085, pellets: 9, unlock: 5, kick: 2.2 },
];

// The undead, by type. Speeds are metres a second; they get a little quicker and tougher each wave.
const TYPES = {
  walker: { scale: 1, hp: 62, speed: [1.15, 1.6], damage: 10, score: 100, skin: '#8C9C77' },
  runner: { scale: 0.92, hp: 40, speed: [3.3, 3.9], damage: 8, score: 150, skin: '#A2A57A' },
  brute: { scale: 1.38, hp: 340, speed: [0.95, 1.1], damage: 28, score: 500, skin: '#7A8A68' },
};

// What the visitors were wearing when they got locked in
const OUTFITS = [
  ['#1E1E1E', '#2E2E2E'], // the black polo neck
  ['#1BA9DF', '#2A3440'],
  ['#C5DDE6', '#1E1E1E'],
  ['#6B4E3D', '#3A3A3A'],
  ['#E8E2D4', '#59605F'],
  ['#8A2E2E', '#262626'],
];

const PLAYER_HP = 100;
const ZOMBIE_RADIUS = 0.3;

export function createZombieMode(env) {
  const {
    THREE, scene, camera, renderer, player, colliders, ROOMS, DOORS, roomById, collide,
    shellMaterial, floorMaterial, canvasOf, wallDecal, softTextures, reduceMotion, isTouch,
  } = env;

  /* -------------------------------------------------------------------------------- The button */

  const button = { ex: null, cap: null, glow: null, led: null, pressed: 0 };

  function hazardTexture(w, h) {
    const scale = 600;
    const [canvas, c] = canvasOf(Math.round(w * scale), Math.round(h * scale));
    const W = canvas.width;
    const H = canvas.height;
    c.fillStyle = '#E8B91C';
    c.fillRect(0, 0, W, H);
    c.save();
    c.beginPath();
    c.rect(0, 0, W, H);
    c.clip();
    c.fillStyle = '#141414';
    for (let x = -H; x < W + H; x += 44) {
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 22, 0);
      c.lineTo(x + 22 - H, H);
      c.lineTo(x - H, H);
      c.fill();
    }
    c.restore();
    const inset = 18;
    c.fillStyle = '#1B1B1B';
    c.fillRect(inset, inset, W - inset * 2, H - inset * 2);
    c.fillStyle = '#E8B91C';
    c.textAlign = 'center';
    c.font = `600 ${Math.round(W * 0.085)}px Inter, "Helvetica Neue", sans-serif`;
    if ('letterSpacing' in c) c.letterSpacing = '3px';
    c.fillText('DO NOT', W / 2, H - inset - W * 0.2);
    c.fillText('PRESS', W / 2, H - inset - W * 0.08);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  }

  // Hung like any other piece (see content.js), so it's pointed at and clicked the same way
  function buildButton(ex, group, theme, wall) {
    button.ex = ex;
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(ex.w, ex.h), new THREE.MeshBasicMaterial({ map: hazardTexture(ex.w, ex.h), toneMapped: false }));
    plate.position.z = 0.012;
    group.add(plate);

    const top = ex.h / 2 - 0.13;
    const housing = new THREE.Mesh(shadedBox(0.17, 0.17, 0.07), new THREE.MeshBasicMaterial({ color: '#4A4A4A', vertexColors: true, toneMapped: false }));
    housing.position.set(0, top - 0.02, 0.05);
    group.add(housing);

    const cap = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.05, 24), new THREE.MeshBasicMaterial({ color: '#A3150F', toneMapped: false }));
    stem.rotation.x = Math.PI / 2;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.056, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#E3291E', toneMapped: false }));
    dome.rotation.x = Math.PI / 2;
    dome.scale.y = 0.5;
    dome.position.z = 0.025;
    const shine = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), new THREE.MeshBasicMaterial({ color: '#FF9A8A', toneMapped: false }));
    shine.position.set(-0.018, 0.02, 0.047);
    cap.add(stem, dome, shine);
    cap.position.set(0, top - 0.02, 0.11);
    group.add(cap);
    button.cap = cap;

    const led = new THREE.Mesh(new THREE.CircleGeometry(0.008, 10), new THREE.MeshBasicMaterial({ color: '#FF3B2F', toneMapped: false }));
    led.position.set(0.06, top + 0.05, 0.086);
    group.add(led);
    button.led = led;

    // A faint red glow on the wall: easy to miss, hard to unsee
    button.glow = wallDecal(softTextures.pool, 0xff2a1a, 0.16, wall, 0, 0.02, 0.006, 1.2, 1.2);
    group.add(button.glow);
  }

  /* ------------------------------------------------------------------------------------ Boxes */

  // The same hand-shaded faces as the benches and desks
  const boxCache = new Map();
  function shadedBox(w, h, d) {
    const key = `${w}|${h}|${d}`;
    if (boxCache.has(key)) return boxCache.get(key);
    const geometry = new THREE.BoxGeometry(w, h, d);
    const shades = [0.78, 0.72, 1, 0.55, 0.9, 0.8]; // +x -x +y -y +z -z
    const colors = [];
    for (let face = 0; face < 6; face++) for (let v = 0; v < 4; v++) colors.push(shades[face], shades[face], shades[face]);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    boxCache.set(key, geometry);
    return geometry;
  }

  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({ color, vertexColors: true, toneMapped: false, ...extra });

  function part(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    return mesh;
  }

  /* ---------------------------------------------------------------------------------- Sound */

  let audio = null;
  let master = null;
  let noise = null;
  let muted = false;

  function startAudio() {
    if (audio) {
      if (audio.state === 'suspended') audio.resume();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audio = new Context();
    master = audio.createGain();
    master.gain.value = muted ? 0 : 0.7;
    const squash = audio.createDynamicsCompressor();
    master.connect(squash).connect(audio.destination);
    noise = audio.createBuffer(1, audio.sampleRate, audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function setMuted(next) {
    muted = next;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, audio.currentTime, 0.02);
    hud.mute.textContent = muted ? 'Sound off' : '';
  }

  function burst(t, { length, from, to = from, type = 'lowpass', q = 0.8, gain, out = master }) {
    const src = audio.createBufferSource();
    src.buffer = noise;
    const filter = audio.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = audio.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + length);
    src.connect(filter).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.02);
  }

  function tone(t, { type = 'sine', from, to = from, length, gain, attack = 0.005, out = master }) {
    const osc = audio.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, t + length);
    const g = audio.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + length);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  const sfx = {
    shot(weapon) {
      if (!audio) return;
      const t = audio.currentTime;
      if (weapon.id === 'patchwork') {
        burst(t, { length: 0.42, from: 2600, to: 180, gain: 1.1 });
        tone(t, { from: 120, to: 38, length: 0.3, gain: 0.9 });
      } else if (weapon.id === 'rapid') {
        burst(t, { length: 0.11, from: 5200, to: 700, gain: 0.55 });
        tone(t, { from: 170, to: 60, length: 0.09, gain: 0.45 });
      } else {
        burst(t, { length: 0.2, from: 4200, to: 400, gain: 0.8 });
        tone(t, { from: 150, to: 50, length: 0.16, gain: 0.6 });
      }
    },
    click() {
      if (!audio) return;
      burst(audio.currentTime, { length: 0.03, from: 3500, type: 'highpass', gain: 0.25 });
    },
    reload(duration) {
      if (!audio) return;
      const t = audio.currentTime;
      burst(t + 0.12, { length: 0.04, from: 2400, type: 'bandpass', q: 3, gain: 0.35 });
      burst(t + duration * 0.55, { length: 0.05, from: 1600, type: 'bandpass', q: 3, gain: 0.4 });
      burst(t + duration * 0.85, { length: 0.04, from: 3000, type: 'bandpass', q: 3, gain: 0.45 });
    },
    hit(head) {
      if (!audio) return;
      const t = audio.currentTime;
      burst(t, { length: 0.09, from: 900, to: 200, gain: 0.5 });
      if (head) tone(t, { type: 'triangle', from: 1400, to: 900, length: 0.07, gain: 0.12 });
    },
    groan(z) {
      if (!audio) return;
      const dx = z.x - player.x;
      const dz = z.z - player.z;
      const d = Math.hypot(dx, dz);
      if (d > 20) return;
      const t = audio.currentTime;
      const pan = audio.createStereoPanner ? audio.createStereoPanner() : null;
      const out = audio.createGain();
      out.gain.value = Math.max(0, 1 - d / 20) * 0.5;
      if (pan) {
        // Right, as the visitor faces
        const right = dx * Math.cos(player.yaw) - dz * Math.sin(player.yaw);
        pan.pan.value = Math.max(-1, Math.min(1, right / Math.max(d, 1)));
        out.connect(pan).connect(master);
      } else {
        out.connect(master);
      }
      const base = (z.type === 'brute' ? 52 : z.type === 'runner' ? 120 : 82) * (0.9 + Math.random() * 0.2);
      const length = 0.9 + Math.random() * 0.8;
      const osc = audio.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.linearRampToValueAtTime(base * 0.78, t + length);
      const wobble = audio.createOscillator();
      wobble.frequency.value = 5 + Math.random() * 4;
      const depth = audio.createGain();
      depth.gain.value = base * 0.06;
      wobble.connect(depth).connect(osc.frequency);
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 4;
      const g = audio.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0008, t + length);
      osc.connect(lp).connect(g).connect(out);
      osc.start(t);
      wobble.start(t);
      osc.stop(t + length);
      wobble.stop(t + length);
    },
    hurt() {
      if (!audio) return;
      const t = audio.currentTime;
      tone(t, { from: 210, to: 70, length: 0.28, gain: 0.5, type: 'triangle' });
      burst(t, { length: 0.16, from: 1200, to: 300, gain: 0.4 });
    },
    siren() {
      if (!audio) return;
      const t = audio.currentTime;
      const lp = audio.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      lp.connect(master);
      for (let i = 0; i < 4; i++) {
        tone(t + i * 0.62, { type: 'square', from: 660, length: 0.3, gain: 0.12, attack: 0.02, out: lp });
        tone(t + i * 0.62 + 0.31, { type: 'square', from: 494, length: 0.3, gain: 0.12, attack: 0.02, out: lp });
      }
      tone(t, { from: 55, to: 40, length: 2.6, gain: 0.35, attack: 0.3 });
    },
    sting() {
      if (!audio) return;
      const t = audio.currentTime;
      [55, 65.4, 82.4].forEach((f) => tone(t, { type: 'sawtooth', from: f, length: 1.6, gain: 0.12, attack: 0.04 }));
      burst(t, { length: 1.2, from: 300, to: 60, gain: 0.5 });
    },
    clear() {
      if (!audio) return;
      const t = audio.currentTime;
      [440, 554, 659, 880].forEach((f, i) => tone(t + i * 0.09, { type: 'triangle', from: f, length: 0.5, gain: 0.12 }));
    },
    pickup() {
      if (!audio) return;
      const t = audio.currentTime;
      tone(t, { type: 'triangle', from: 660, length: 0.12, gain: 0.18 });
      tone(t + 0.08, { type: 'triangle', from: 990, length: 0.18, gain: 0.18 });
    },
    death() {
      if (!audio) return;
      const t = audio.currentTime;
      tone(t, { type: 'sawtooth', from: 110, to: 30, length: 2.4, gain: 0.3, attack: 0.05 });
      burst(t, { length: 1.8, from: 600, to: 50, gain: 0.5 });
    },
  };

  /* -------------------------------------------------------------------------------------- HUD */

  const root = document.createElement('div');
  root.className = 'z-hud';
  root.hidden = true;
  root.innerHTML = `
    <div class="z-top">
      <p class="z-wave">Wave <b>1</b></p>
      <p class="z-left"><b>0</b> left</p>
      <p class="z-score"><b>0</b></p>
    </div>
    <div class="z-cross" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
    <div class="z-hitmark" aria-hidden="true"></div>
    <div class="z-banner" aria-live="polite">
      <p class="z-banner-over"></p>
      <h2 class="z-banner-title"></h2>
      <p class="z-banner-sub"></p>
    </div>
    <div class="z-health">
      <span class="z-label">Health</span>
      <div class="z-bar"><span></span></div>
      <b>100</b>
    </div>
    <div class="z-weapon">
      <span class="z-label z-weapon-name">Pistol</span>
      <p class="z-ammo"><b>12</b><span>/ ∞</span></p>
      <p class="z-slots"></p>
      <p class="z-mute"></p>
    </div>
    <div class="z-touch">
      <button class="z-touch-btn z-touch-swap" type="button">Swap</button>
      <button class="z-touch-btn z-touch-reload" type="button">Reload</button>
      <button class="z-touch-btn z-touch-fire" type="button">Fire</button>
    </div>`;

  const screen = document.createElement('div');
  screen.className = 'z-screen';
  screen.hidden = true;
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.innerHTML = `
    <div class="z-card">
      <p class="overline z-screen-over"></p>
      <h2 class="title z-screen-title"></h2>
      <p class="body z-screen-body"></p>
      <dl class="z-stats"></dl>
      <div class="z-actions">
        <button class="btn btn--primary z-primary" type="button"></button>
        <button class="btn btn--secondary z-secondary" type="button"></button>
      </div>
    </div>`;

  const hurtLayer = document.createElement('div');
  hurtLayer.className = 'z-hurt';
  hurtLayer.setAttribute('aria-hidden', 'true');

  document.body.append(hurtLayer, root, screen);

  const $ = (selector, from = root) => from.querySelector(selector);
  const hud = {
    wave: $('.z-wave b'),
    left: $('.z-left b'),
    score: $('.z-score b'),
    cross: $('.z-cross'),
    hitmark: $('.z-hitmark'),
    banner: $('.z-banner'),
    bannerOver: $('.z-banner-over'),
    bannerTitle: $('.z-banner-title'),
    bannerSub: $('.z-banner-sub'),
    health: $('.z-health'),
    healthBar: $('.z-bar span'),
    healthText: $('.z-health b'),
    weaponName: $('.z-weapon-name'),
    ammo: $('.z-ammo b'),
    reserve: $('.z-ammo span'),
    slots: $('.z-slots'),
    mute: $('.z-mute'),
  };

  let bannerTimer = 0;
  function banner(over, title, sub = '', seconds = 2.6) {
    hud.bannerOver.textContent = over;
    hud.bannerTitle.textContent = title;
    hud.bannerSub.textContent = sub;
    hud.banner.classList.remove('is-on');
    void hud.banner.offsetWidth;
    hud.banner.classList.add('is-on');
    bannerTimer = seconds;
  }

  function showScreen({ over, title, body, stats = [], primary, secondary }) {
    $('.z-screen-over', screen).textContent = over;
    $('.z-screen-title', screen).textContent = title;
    $('.z-screen-body', screen).textContent = body;
    $('.z-stats', screen).innerHTML = stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    $('.z-primary', screen).textContent = primary;
    $('.z-secondary', screen).textContent = secondary;
    screen.hidden = false;
    document.body.classList.add('is-zombies-menu');
    $('.z-primary', screen).focus({ preventScroll: true });
  }

  function hideScreen() {
    screen.hidden = true;
    document.body.classList.remove('is-zombies-menu');
  }

  $('.z-primary', screen).addEventListener('click', () => {
    if (game.phase === 'over') restart();
    else resume();
    env.requestLock();
  });
  $('.z-secondary', screen).addEventListener('click', () => quit());

  // Touch controls: the left thumb still walks and the right still looks (gallery.js handles those)
  const fireButton = $('.z-touch-fire');
  fireButton.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    trigger(true);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => fireButton.addEventListener(type, () => trigger(false)));
  $('.z-touch-reload').addEventListener('click', () => reload());
  $('.z-touch-swap').addEventListener('click', () => cycleWeapon(1));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && live()) pause();
  });

  /* ---------------------------------------------------------------------------------- The gun */

  const gunScene = new THREE.Scene();
  const gunCamera = new THREE.PerspectiveCamera(58, 1, 0.01, 10);
  const gunRig = new THREE.Group();
  gunScene.add(gunRig);
  const REST = new THREE.Vector3(0.15, -0.15, -0.5);
  gunRig.scale.setScalar(0.72);

  function buildGuns() {
    const dark = basic('#1E1E1E');
    const metal = basic('#3B3F42');
    const brand = basic('#1BA9DF');
    const wood = basic('#6B4A33');
    const patches = [basic('#C5DDE6'), basic('#E3B23C'), basic('#B5523B')];

    const pistol = new THREE.Group();
    pistol.add(part(shadedBox(0.05, 0.055, 0.24), metal, 0, 0, -0.04));
    pistol.add(part(shadedBox(0.044, 0.035, 0.2), dark, 0, -0.04, -0.02));
    const grip = part(shadedBox(0.042, 0.12, 0.06), dark, 0, -0.1, 0.05);
    grip.rotation.x = -0.25;
    pistol.add(grip);
    pistol.add(part(shadedBox(0.01, 0.012, 0.01), brand, 0, 0.034, -0.15));

    const rapid = new THREE.Group();
    rapid.add(part(shadedBox(0.06, 0.08, 0.42), dark, 0, 0, -0.08));
    rapid.add(part(shadedBox(0.03, 0.03, 0.16), metal, 0, 0.01, -0.36));
    rapid.add(part(shadedBox(0.062, 0.012, 0.3), brand, 0, 0.046, -0.08));
    const mag = part(shadedBox(0.04, 0.14, 0.06), metal, 0, -0.1, -0.12);
    mag.rotation.x = 0.18;
    rapid.add(mag);
    const rgrip = part(shadedBox(0.042, 0.11, 0.05), dark, 0, -0.09, 0.05);
    rgrip.rotation.x = -0.3;
    rapid.add(rgrip);

    const patchwork = new THREE.Group();
    patchwork.add(part(shadedBox(0.034, 0.034, 0.5), metal, -0.019, 0.01, -0.16));
    patchwork.add(part(shadedBox(0.034, 0.034, 0.5), metal, 0.019, 0.01, -0.16));
    patchwork.add(part(shadedBox(0.07, 0.06, 0.2), wood, 0, -0.03, 0.04));
    patchwork.add(part(shadedBox(0.072, 0.03, 0.06), patches[0], 0, -0.012, 0.0));
    patchwork.add(part(shadedBox(0.072, 0.025, 0.05), patches[1], 0, -0.045, 0.09));
    patchwork.add(part(shadedBox(0.074, 0.06, 0.05), patches[2], 0, -0.03, -0.1));

    const models = { pistol, rapid, patchwork };
    Object.values(models).forEach((model) => {
      model.visible = false;
      model.traverse((object) => {
        if (object.material) {
          object.material.depthTest = true;
          object.renderOrder = 10;
        }
      });
      gunRig.add(model);
    });

    const flashCanvas = canvasOf(64, 64);
    const fc = flashCanvas[1];
    const g = fc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.35, 'rgba(255,200,90,.85)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    fc.fillStyle = g;
    fc.fillRect(0, 0, 64, 64);
    const flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(flashCanvas[0]), blending: THREE.AdditiveBlending, depthTest: false, transparent: true }));
    flash.scale.set(0.16, 0.16, 1);
    flash.visible = false;
    flash.renderOrder = 20;
    gunRig.add(flash);
    return { models, flash, muzzles: { pistol: -0.19, rapid: -0.46, patchwork: -0.43 } };
  }

  const guns = buildGuns();

  /* ---------------------------------------------------------------------------- Effects pool */

  const puffTexture = (() => {
    const [canvas, c] = canvasOf(64, 64);
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  })();

  const holeTexture = (() => {
    const [canvas, c] = canvasOf(32, 32);
    const g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(0,0,0,.95)');
    g.addColorStop(0.45, 'rgba(0,0,0,.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
  })();

  const effects = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < 48; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture, transparent: true, depthWrite: false }));
    sprite.visible = false;
    effects.add(sprite);
    puffs.push({ sprite, t: 0, life: 0, vx: 0, vy: 0, vz: 0, size: 0 });
  }
  let nextPuff = 0;

  function puff(point, color, { size = 0.18, life = 0.3, spread = 1, count = 3, opacity = 0.9 } = {}) {
    for (let i = 0; i < count; i++) {
      const p = puffs[nextPuff];
      nextPuff = (nextPuff + 1) % puffs.length;
      p.sprite.position.copy(point);
      p.sprite.material.color.set(color);
      p.sprite.material.opacity = opacity;
      p.sprite.visible = true;
      p.t = 0;
      p.life = life * (0.7 + Math.random() * 0.6);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.vx = (Math.random() - 0.5) * spread;
      p.vy = Math.random() * spread * 0.8;
      p.vz = (Math.random() - 0.5) * spread;
      p.opacity = opacity;
    }
  }

  const holes = [];
  const holeGeometry = new THREE.PlaneGeometry(0.07, 0.07);
  let nextHole = 0;
  function bulletHole(point, normal) {
    let hole = holes[nextHole];
    if (!hole) {
      hole = new THREE.Mesh(holeGeometry, new THREE.MeshBasicMaterial({
        map: holeTexture, transparent: true, depthWrite: false, toneMapped: false,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -8,
      }));
      holes.push(hole);
      effects.add(hole);
    }
    nextHole = (nextHole + 1) % 90;
    hole.visible = true;
    hole.position.copy(point).addScaledVector(normal, 0.006);
    hole.lookAt(hole.position.x + normal.x, hole.position.y + normal.y, hole.position.z + normal.z);
    hole.rotation.z = Math.random() * Math.PI;
  }

  function updateEffects(dt) {
    puffs.forEach((p) => {
      if (!p.sprite.visible) return;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        p.sprite.visible = false;
        return;
      }
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      p.vy -= 2.5 * dt;
      const s = p.size * (0.6 + k * 1.2);
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = p.opacity * (1 - k);
    });
  }

  /* --------------------------------------------------------------------------- Finding the way */

  function roomOf(x, z) {
    return ROOMS.find((room) => x >= room.x0 && x < room.x1 && z >= room.z0 && z < room.z1) || null;
  }

  // For every pair of rooms, the door to walk through first to get from one to the other
  const nextDoor = {};
  const hops = {};
  ROOMS.forEach((goal) => {
    hops[goal.id] = { [goal.id]: 0 };
    const queue = [goal];
    while (queue.length) {
      const room = queue.shift();
      DOORS.forEach((door) => {
        const other = door.a === room.id ? door.b : door.b === room.id ? door.a : null;
        if (!other || other in hops[goal.id]) return;
        hops[goal.id][other] = hops[goal.id][room.id] + 1;
        (nextDoor[other] ||= {})[goal.id] = door;
        queue.push(roomById[other]);
      });
    }
  });

  function collideCircle(pos, r) {
    colliders.forEach((box) => {
      const nx = Math.max(box.x0, Math.min(pos.x, box.x1));
      const nz = Math.max(box.z0, Math.min(pos.z, box.z1));
      const dx = pos.x - nx;
      const dz = pos.z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) return;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + dx / d * r;
        pos.z = nz + dz / d * r;
      } else {
        const exits = [[pos.x - box.x0, box.x0 - r, null], [box.x1 - pos.x, box.x1 + r, null], [pos.z - box.z0, null, box.z0 - r], [box.z1 - pos.z, null, box.z1 + r]];
        const [, ex, ez] = exits.sort((a, b) => a[0] - b[0])[0];
        if (ex !== null) pos.x = ex;
        if (ez !== null) pos.z = ez;
      }
    });
  }

  // The first box in the way of a straight walk from a to b, if any
  function blocker(ax, az, bx, bz, margin) {
    let best = null;
    let bestT = 1;
    colliders.forEach((box) => {
      const x0 = box.x0 - margin;
      const x1 = box.x1 + margin;
      const z0 = box.z0 - margin;
      const z1 = box.z1 + margin;
      if (ax > x0 && ax < x1 && az > z0 && az < z1) return;
      let near = 0;
      let far = 1;
      const dx = bx - ax;
      const dz = bz - az;
      for (const [o, d, lo, hi] of [[ax, dx, x0, x1], [az, dz, z0, z1]]) {
        if (Math.abs(d) < 1e-9) {
          if (o < lo || o > hi) return;
        } else {
          const t0 = (lo - o) / d;
          const t1 = (hi - o) / d;
          near = Math.max(near, Math.min(t0, t1));
          far = Math.min(far, Math.max(t0, t1));
        }
      }
      if (near < far && near < bestT) {
        bestT = near;
        best = box;
      }
    });
    return best;
  }

  function doorCentre(door) {
    return door.axis === 'x' ? [door.at, door.c] : [door.c, door.at];
  }

  function targetFor(z) {
    const here = roomOf(z.x, z.z);
    const there = roomOf(player.x, player.z);
    if (!here || !there) return [player.x, player.z];

    if (here !== there) {
      const door = nextDoor[here.id] && nextDoor[here.id][there.id];
      if (!door) return [player.x, player.z];
      const next = roomById[door.a === here.id ? door.b : door.a];
      const [cx, cz] = doorCentre(door);
      const ax = door.axis === 'x' ? 1 : 0;
      const az = 1 - ax;
      const sign = (door.axis === 'x' ? next.x0 >= door.at : next.z0 >= door.at) ? 1 : -1;
      const along = ((z.x - cx) * ax + (z.z - cz) * az) * sign;
      const lateral = (z.x - cx) * az + (z.z - cz) * ax;
      // Line up with the doorway first, then walk through it
      if (along < -0.25 && Math.abs(lateral) > 0.9) {
        const lined = [cx - ax * sign * 1.1, cz - az * sign * 1.1];
        const box = blocker(z.x, z.z, lined[0], lined[1], 0.15);
        return box ? around(box, z, lined, here) : lined;
      }
      return [cx + ax * sign * 1.8, cz + az * sign * 1.8];
    }

    const goal = [player.x, player.z];
    const box = blocker(z.x, z.z, goal[0], goal[1], 0.15);
    return box ? around(box, z, goal, here) : goal;
  }

  // Head for whichever corner of the thing in the way makes the shorter walk
  function around(box, z, goal, room) {
    const m = z.r + 0.55;
    const corners = [[box.x0 - m, box.z0 - m], [box.x1 + m, box.z0 - m], [box.x1 + m, box.z1 + m], [box.x0 - m, box.z1 + m]]
      .filter(([x, zz]) => x > room.x0 + 0.3 && x < room.x1 - 0.3 && zz > room.z0 + 0.3 && zz < room.z1 - 0.3);
    if (!corners.length) return goal;
    let best = corners[0];
    let bestD = Infinity;
    corners.forEach((c) => {
      const d = Math.hypot(c[0] - z.x, c[1] - z.z) + Math.hypot(goal[0] - c[0], goal[1] - c[1]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    });
    return best;
  }

  // Where they climb out of the floor: a few spots in every room, away from the furniture
  // (Worked out when the game first starts: the walls aren't up yet when this module is made)
  const spawnPoints = [];
  const findSpawnPoints = () => ROOMS.forEach((room) => {
    const spots = [room.spawn.at];
    [0.25, 0.75].forEach((fx) => [0.25, 0.75].forEach((fz) => spots.push([room.x0 + (room.x1 - room.x0) * fx, room.z0 + (room.z1 - room.z0) * fz])));
    spots.push([(room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2]);
    spots.forEach(([x, z]) => {
      const clear = !colliders.some((box) => x > box.x0 - 0.8 && x < box.x1 + 0.8 && z > box.z0 - 0.8 && z < box.z1 + 0.8);
      if (clear) spawnPoints.push({ x, z, room });
    });
  });

  function pickSpawn() {
    const here = roomOf(player.x, player.z) || ROOMS[0];
    const far = spawnPoints.filter((p) => Math.hypot(p.x - player.x, p.z - player.z) > 9);
    // Nearby rooms first, so nobody has to wait for a long walk
    const ranked = far.map((p) => ({ p, hop: hops[here.id][p.room.id] ?? 9 })).sort((a, b) => a.hop - b.hop || Math.random() - 0.5);
    const pool = ranked.filter((r) => r.hop <= Math.max(1, ranked[0] ? ranked[0].hop + 1 : 1));
    const choice = (pool.length ? pool : ranked)[Math.floor(Math.random() * Math.min(6, (pool.length ? pool : ranked).length))];
    return choice ? choice.p : spawnPoints[0];
  }

  /* ---------------------------------------------------------------------------------- Zombies */

  const horde = new THREE.Group();
  const zombies = [];

  function makeZombie(type, wave) {
    const kind = TYPES[type];
    const s = kind.scale;
    const [shirt, trousers] = OUTFITS[Math.floor(Math.random() * OUTFITS.length)];
    const mats = {
      skin: basic(kind.skin),
      shirt: basic(type === 'brute' ? '#3A3A3A' : shirt),
      legs: basic(trousers),
    };
    const base = { skin: kind.skin, shirt: mats.shirt.color.getHex(), legs: trousers };
    const eye = new THREE.MeshBasicMaterial({ color: '#FF3B1F', toneMapped: false, fog: false });

    const group = new THREE.Group();
    const body = new THREE.Group();
    group.add(body);
    group.scale.setScalar(s);

    const hips = 0.86;
    const legL = new THREE.Group();
    const legR = new THREE.Group();
    legL.position.set(-0.13, hips, 0);
    legR.position.set(0.13, hips, 0);
    legL.add(part(shadedBox(0.17, hips, 0.19), mats.legs, 0, -hips / 2, 0));
    legR.add(part(shadedBox(0.17, hips, 0.19), mats.legs, 0, -hips / 2, 0));
    legL.add(part(shadedBox(0.18, 0.08, 0.27), mats.legs, 0, -hips + 0.04, -0.04));
    legR.add(part(shadedBox(0.18, 0.08, 0.27), mats.legs, 0, -hips + 0.04, -0.04));

    const torso = new THREE.Group();
    torso.position.set(0, hips, 0);
    torso.add(part(shadedBox(0.5, 0.64, 0.28), mats.shirt, 0, 0.32, 0));
    // The visitor's lanyard, still on
    torso.add(part(shadedBox(0.025, 0.3, 0.01), basic('#1BA9DF'), -0.07, 0.42, -0.145));
    torso.add(part(shadedBox(0.025, 0.3, 0.01), basic('#1BA9DF'), 0.07, 0.42, -0.145));
    torso.add(part(shadedBox(0.14, 0.1, 0.012), basic('#F4F4F4'), 0, 0.24, -0.15));

    const armL = new THREE.Group();
    const armR = new THREE.Group();
    armL.position.set(-0.32, 0.58, 0);
    armR.position.set(0.32, 0.58, 0);
    [armL, armR].forEach((arm) => {
      arm.add(part(shadedBox(0.14, 0.5, 0.15), mats.shirt, 0, -0.25, 0));
      arm.add(part(shadedBox(0.12, 0.14, 0.13), mats.skin, 0, -0.57, 0));
      torso.add(arm);
    });

    const head = new THREE.Group();
    head.position.set(0, 0.64, 0);
    head.add(part(shadedBox(0.3, 0.32, 0.3), mats.skin, 0, 0.18, 0));
    head.add(part(shadedBox(0.06, 0.04, 0.01), eye, -0.07, 0.22, -0.152));
    head.add(part(shadedBox(0.06, 0.04, 0.01), eye, 0.07, 0.22, -0.152));
    head.add(part(shadedBox(0.14, 0.035, 0.01), basic('#2A1010'), 0, 0.09, -0.152));
    if (Math.random() < 0.5) head.add(part(shadedBox(0.32, 0.08, 0.32), basic(['#2B2420', '#5A4632', '#C9C2B4', '#1E1E1E'][Math.floor(Math.random() * 4)]), 0, 0.36, 0.01));
    torso.add(head);

    body.add(legL, legR, torso);
    horde.add(group);

    const toughness = 1 + (wave - 1) * 0.09;
    const quicken = 1 + Math.min(0.45, (wave - 1) * 0.04);
    const z = {
      type, group, body, legL, legR, torso, armL, armR, head, mats, base, s,
      r: ZOMBIE_RADIUS * s,
      hp: kind.hp * toughness,
      speed: (kind.speed[0] + Math.random() * (kind.speed[1] - kind.speed[0])) * quicken,
      damage: kind.damage,
      score: kind.score,
      x: 0, z: 0, y: 0, vx: 0, vz: 0, yaw: 0,
      phase: 'rise', t: 0, cycle: Math.random() * 10, attack: 0, swing: 0, flash: 0,
      target: null, retarget: 0, groan: 1 + Math.random() * 4,
      stuck: 0, lastX: 0, lastZ: 0, shove: null,
      tilt: (Math.random() - 0.5) * 0.3,
    };
    return z;
  }

  function spawn(type) {
    const spot = pickSpawn();
    const z = makeZombie(type, game.wave);
    z.x = spot.x + (Math.random() - 0.5) * 1.2;
    z.z = spot.z + (Math.random() - 0.5) * 1.2;
    z.lastX = z.x;
    z.lastZ = z.z;
    z.yaw = Math.atan2(player.x - z.x, player.z - z.z) + Math.PI;
    z.group.position.set(z.x, -1.9 * z.s, z.z);
    zombies.push(z);
    puff(new THREE.Vector3(z.x, 0.05, z.z), '#3A1A14', { size: 0.9, life: 1.2, spread: 0.6, count: 4, opacity: 0.6 });
  }

  function removeZombie(z) {
    horde.remove(z.group);
    Object.values(z.mats).forEach((m) => m.dispose());
    zombies.splice(zombies.indexOf(z), 1);
  }

  function setFlash(z, on) {
    Object.entries(z.mats).forEach(([key, m]) => m.color.set(on ? '#FFFFFF' : z.base[key]));
  }

  function updateZombie(z, dt) {
    z.t += dt;

    if (z.phase === 'rise') {
      // Up out of the floor, clawing
      const k = Math.min(1, z.t / 1.4);
      const e = 1 - (1 - k) ** 2;
      z.group.position.set(z.x, -1.9 * z.s * (1 - e), z.z);
      z.armL.rotation.x = 2.6 + Math.sin(z.t * 9) * 0.4;
      z.armR.rotation.x = 2.6 + Math.cos(z.t * 9) * 0.4;
      z.group.rotation.y = z.yaw;
      if (k >= 1) {
        z.phase = 'walk';
        z.t = 0;
      }
      return;
    }

    if (z.phase === 'dying') {
      const k = Math.min(1, z.t / 0.55);
      z.body.rotation.x = k * k * 1.45 * z.fall;
      z.body.position.y = -k * 0.1;
      if (z.t > 1.6) z.group.position.y = -(z.t - 1.6) * 1.2 * z.s;
      if (z.t > 3.4) removeZombie(z);
      return;
    }

    if (z.flash > 0) {
      z.flash -= dt;
      if (z.flash <= 0) setFlash(z, false);
    }

    z.retarget -= dt;
    if (z.retarget <= 0) {
      z.target = targetFor(z);
      z.retarget = 0.2 + Math.random() * 0.15;
    }

    const toX = player.x - z.x;
    const toZ = player.z - z.z;
    const toPlayer = Math.hypot(toX, toZ);
    const reach = z.r + 0.55;
    let [tx, tz] = z.target || [player.x, player.z];
    if (z.shove) {
      z.shove.t -= dt;
      [tx, tz] = [z.x + z.shove.x, z.z + z.shove.z];
      if (z.shove.t <= 0) z.shove = null;
    }
    let dx = tx - z.x;
    let dz = tz - z.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;

    let speed = z.speed;
    // Close enough to touch, with nothing in between (a doorway counts as nothing)
    const sameRoom = toPlayer < 4 && !blocker(z.x, z.z, player.x, player.z, 0);
    if (toPlayer < reach && sameRoom) speed = 0;

    // Don't crowd: a gentle push away from the others
    let sx = 0;
    let sz = 0;
    zombies.forEach((o) => {
      if (o === z || o.phase === 'dying') return;
      const ox = z.x - o.x;
      const oz = z.z - o.z;
      const od = Math.hypot(ox, oz);
      const min = z.r + o.r + 0.12;
      if (od > 0 && od < min) {
        sx += ox / od * (min - od);
        sz += oz / od * (min - od);
      }
    });

    const blend = Math.min(1, dt * 6);
    z.vx += (dx * speed - z.vx) * blend;
    z.vz += (dz * speed - z.vz) * blend;
    const pos = { x: z.x + z.vx * dt + sx * 0.5, z: z.z + z.vz * dt + sz * 0.5 };
    collideCircle(pos, z.r);
    z.x = pos.x;
    z.z = pos.z;

    // Stuck on something? Shuffle off sideways for a moment
    z.stuck += dt;
    if (z.stuck > 1.5) {
      const moved = Math.hypot(z.x - z.lastX, z.z - z.lastZ);
      if (moved < 0.3 && toPlayer > reach + 0.5) {
        const a = Math.random() * Math.PI * 2;
        z.shove = { x: Math.cos(a), z: Math.sin(a), t: 0.6 };
      }
      z.stuck = 0;
      z.lastX = z.x;
      z.lastZ = z.z;
    }

    // Face where they're going, or you when they're close
    const faceX = toPlayer < 4 && sameRoom ? toX : z.vx;
    const faceZ = toPlayer < 4 && sameRoom ? toZ : z.vz;
    if (Math.hypot(faceX, faceZ) > 0.05) {
      // Models are built facing -z, so turn them half way round
      const want = Math.atan2(faceX, faceZ) + Math.PI;
      let diff = want - z.yaw;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      z.yaw += diff * Math.min(1, dt * 8);
    }

    // Shamble
    const moving = Math.hypot(z.vx, z.vz);
    z.cycle += dt * (2.2 + moving * 2.4);
    const stride = Math.min(1, moving / 1.2) * (z.type === 'runner' ? 0.9 : 0.5);
    z.legL.rotation.x = Math.sin(z.cycle) * stride;
    z.legR.rotation.x = -Math.sin(z.cycle) * stride;
    z.torso.rotation.z = Math.sin(z.cycle) * 0.07 + z.tilt * 0.3;
    z.torso.rotation.x = z.type === 'runner' ? -0.35 : -0.12;
    z.head.rotation.z = z.tilt + Math.sin(z.cycle * 0.5) * 0.12;
    const reachOut = z.type === 'runner' ? 0.9 : 1.45;
    z.swing = Math.max(0, z.swing - dt * 3.5);
    const claw = Math.sin(z.swing * Math.PI) * 1.2;
    z.armL.rotation.x = reachOut + Math.sin(z.cycle * 0.9) * 0.15 + claw;
    z.armR.rotation.x = reachOut - Math.sin(z.cycle * 0.9) * 0.15 + claw;
    z.body.position.y = Math.abs(Math.sin(z.cycle)) * 0.03;

    z.group.position.set(z.x, 0, z.z);
    z.group.rotation.y = z.yaw;

    // Bite
    z.attack -= dt;
    if (toPlayer < reach + 0.15 && sameRoom && z.attack <= 0 && game.phase !== 'over') {
      z.attack = z.type === 'runner' ? 0.85 : 1.3;
      z.swing = 1;
      hurt(z.damage, z);
    }

    // Keep out of the visitor's space
    const gap = z.r + 0.38;
    if (toPlayer < gap && toPlayer > 1e-4) {
      const push = { x: player.x + (toX / toPlayer) * (gap - toPlayer), z: player.z + (toZ / toPlayer) * (gap - toPlayer) };
      collide(push);
      player.x = push.x;
      player.z = push.z;
    }

    z.groan -= dt;
    if (z.groan <= 0) {
      z.groan = 3 + Math.random() * 5;
      if (Math.random() < 0.7) sfx.groan(z);
    }
  }

  /* ------------------------------------------------------------------------------- Pickups */

  const pickups = [];

  function crossTexture() {
    const [canvas, c] = canvasOf(64, 64);
    c.fillStyle = '#F4F4F4';
    c.fillRect(0, 0, 64, 64);
    c.fillStyle = '#D21E1E';
    c.fillRect(24, 10, 16, 44);
    c.fillRect(10, 24, 44, 16);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
  const medTexture = crossTexture();

  function dropPickup(x, z) {
    const lowHealth = game.hp < 45;
    const hasAmmoGuns = game.owned.some((w) => w.reserve !== Infinity);
    const roll = Math.random();
    let kind = null;
    if (roll < (lowHealth ? 0.2 : 0.09)) kind = 'health';
    else if (hasAmmoGuns && roll < (lowHealth ? 0.32 : 0.23)) kind = 'ammo';
    if (!kind) return;
    const group = new THREE.Group();
    if (kind === 'health') {
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.34), new THREE.MeshBasicMaterial({ map: medTexture, toneMapped: false })));
    } else {
      group.add(part(shadedBox(0.4, 0.2, 0.26), basic('#4A5236'), 0, 0, 0));
      group.add(part(shadedBox(0.41, 0.04, 0.27), basic('#1BA9DF'), 0, 0.03, 0));
    }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture, color: kind === 'health' ? '#FF5A4A' : '#1BA9DF', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(1.1, 1.1, 1);
    group.add(glow);
    group.position.set(x, 0.4, z);
    effects.add(group);
    pickups.push({ kind, group, t: 0 });
  }

  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.t += dt;
      p.group.rotation.y += dt * 1.6;
      p.group.position.y = 0.4 + Math.sin(p.t * 3) * 0.06;
      p.group.visible = p.t < 22 || Math.floor(p.t * 8) % 2 === 0;
      const close = Math.hypot(p.group.position.x - player.x, p.group.position.z - player.z) < 0.9;
      if (close && p.kind === 'health' && game.hp >= PLAYER_HP) continue;
      if (close || p.t > 26) {
        if (close) {
          if (p.kind === 'health') {
            game.hp = Math.min(PLAYER_HP, game.hp + 35);
            flashBanner('+35 health');
          } else {
            game.owned.forEach((w) => {
              if (w.reserve !== Infinity) w.reserve += w.def.mag * 2;
            });
            flashBanner('Ammo');
          }
          sfx.pickup();
          updateHud();
        }
        effects.remove(p.group);
        pickups.splice(i, 1);
      }
    }
  }

  let toastTimer = null;
  function flashBanner(text) {
    hud.health.dataset.toast = text;
    hud.health.classList.add('has-toast');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => hud.health.classList.remove('has-toast'), 1100);
  }

  /* --------------------------------------------------------------------------- Shooting */

  const ray = new THREE.Raycaster();
  const forward = new THREE.Vector3();
  const rightV = new THREE.Vector3();
  const upV = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();

  function wallHit(o, d, maxT) {
    let best = { t: maxT, normal: null };
    colliders.forEach((box) => {
      if (box.low) return;
      let near = 0;
      let far = best.t;
      let axis = null;
      for (const [key, oo, dd, lo, hi] of [['x', o.x, d.x, box.x0, box.x1], ['z', o.z, d.z, box.z0, box.z1]]) {
        if (Math.abs(dd) < 1e-9) {
          if (oo < lo || oo > hi) return;
        } else {
          const t0 = (lo - oo) / dd;
          const t1 = (hi - oo) / dd;
          const tn = Math.min(t0, t1);
          if (tn > near) {
            near = tn;
            axis = key;
          }
          far = Math.min(far, Math.max(t0, t1));
        }
      }
      if (axis && near < far && near < best.t) {
        const normal = axis === 'x' ? new THREE.Vector3(d.x > 0 ? -1 : 1, 0, 0) : new THREE.Vector3(0, 0, d.z > 0 ? -1 : 1);
        best = { t: near, normal };
      }
    });
    const room = roomOf(o.x, o.z);
    const ceiling = room ? room.h : 4.4;
    if (d.y < -1e-6) {
      const t = -o.y / d.y;
      if (t < best.t) best = { t, normal: new THREE.Vector3(0, 1, 0) };
    } else if (d.y > 1e-6) {
      const t = (ceiling - o.y) / d.y;
      if (t < best.t) best = { t, normal: new THREE.Vector3(0, -1, 0) };
    }
    return best;
  }

  function zombieHit(o, d, maxT) {
    let best = null;
    let bestT = maxT;
    zombies.forEach((z) => {
      if (z.phase === 'dying') return;
      const s = z.s;
      const baseY = z.group.position.y;
      // Head: a ball
      const head = new THREE.Vector3(0, 0.82, 0);
      z.head.getWorldPosition(head);
      head.y += 0.18 * s;
      const hr = 0.2 * s;
      const lx = o.x - head.x;
      const ly = o.y - head.y;
      const lz = o.z - head.z;
      const b = lx * d.x + ly * d.y + lz * d.z;
      const c = lx * lx + ly * ly + lz * lz - hr * hr;
      const disc = b * b - c;
      if (disc >= 0) {
        const t = -b - Math.sqrt(disc);
        if (t > 0 && t < bestT) {
          bestT = t;
          best = { z, head: true, t };
        }
      }
      // Body: an upright tube
      const r = 0.3 * s;
      const ox = o.x - z.x;
      const oz = o.z - z.z;
      const a2 = d.x * d.x + d.z * d.z;
      if (a2 < 1e-9) return;
      const b2 = ox * d.x + oz * d.z;
      const c2 = ox * ox + oz * oz - r * r;
      const disc2 = b2 * b2 - a2 * c2;
      if (disc2 < 0) return;
      const t = (-b2 - Math.sqrt(disc2)) / a2;
      if (t <= 0 || t >= bestT) return;
      const y = o.y + d.y * t;
      if (y < baseY || y > baseY + 1.5 * s) return;
      bestT = t;
      best = { z, head: false, t };
    });
    return best;
  }

  function fire() {
    const w = game.weapon;
    if (game.switching > 0 || w.reloading > 0 || game.cooldown > 0) return;
    if (w.ammo <= 0) {
      sfx.click();
      game.cooldown = 0.25;
      reload();
      return;
    }
    w.ammo--;
    game.cooldown = w.def.rate;
    game.recoil = Math.min(1.6, game.recoil + w.def.kick);
    game.flash = 0.05;
    sfx.shot(w.def);

    camera.getWorldDirection(forward);
    rightV.set(1, 0, 0).applyQuaternion(camera.quaternion);
    upV.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const origin = camera.position.clone();
    let hitAny = false;
    let headAny = false;
    let killed = false;
    for (let i = 0; i < w.def.pellets; i++) {
      const spread = w.def.spread * (1 + (Math.hypot(player.vx, player.vz) > 4 ? 0.8 : 0));
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      dir.copy(forward).addScaledVector(rightV, Math.cos(a) * r).addScaledVector(upV, Math.sin(a) * r).normalize();
      const wall = wallHit(origin, dir, 60);
      const hit = zombieHit(origin, dir, wall.t);
      if (hit) {
        hitPoint.copy(origin).addScaledVector(dir, hit.t);
        const damage = w.def.damage * (hit.head ? 2.2 : 1);
        hit.z.hp -= damage;
        hit.z.flash = 0.07;
        setFlash(hit.z, true);
        // A shove back, more for the shotgun
        hit.z.vx += dir.x * (w.def.pellets > 1 ? 0.9 : 1.8);
        hit.z.vz += dir.z * (w.def.pellets > 1 ? 0.9 : 1.8);
        puff(hitPoint, '#5B1A12', { size: 0.16, life: 0.4, spread: 1.4, count: 3 });
        hitAny = true;
        headAny = headAny || hit.head;
        if (hit.z.hp <= 0) {
          kill(hit.z, hit.head, dir);
          killed = true;
        }
      } else if (wall.normal) {
        hitPoint.copy(origin).addScaledVector(dir, wall.t);
        bulletHole(hitPoint, wall.normal);
        puff(hitPoint.addScaledVector(wall.normal, 0.03), '#CFC6BE', { size: 0.12, life: 0.35, spread: 0.6, count: 2, opacity: 0.6 });
      }
    }
    if (hitAny) {
      sfx.hit(headAny);
      hud.hitmark.classList.remove('is-on', 'is-kill');
      void hud.hitmark.offsetWidth;
      hud.hitmark.classList.add('is-on');
      if (killed || headAny) hud.hitmark.classList.add('is-kill');
    }
    if (w.ammo === 0) setTimeout(() => { if (game.weapon === w && live()) reload(); }, 220);
    updateHud();
  }

  function kill(z, head, direction) {
    z.phase = 'dying';
    z.t = 0;
    setFlash(z, false);
    // Fall away from the shot (this points out of their back)
    const facing = new THREE.Vector3(Math.sin(z.yaw), 0, Math.cos(z.yaw));
    z.fall = facing.dot(direction) > 0 ? 1 : -1;
    game.score += z.score + (head ? 50 : 0);
    game.kills++;
    game.remaining--;
    dropPickup(z.x, z.z);
    updateHud();
  }

  function reload() {
    const w = game.weapon;
    if (w.reloading > 0 || w.ammo >= w.def.mag || w.reserve <= 0) return;
    w.reloading = w.def.reload;
    sfx.reload(w.def.reload);
  }

  function finishReload(w) {
    const need = w.def.mag - w.ammo;
    const take = Math.min(need, w.reserve);
    w.ammo += take;
    if (w.reserve !== Infinity) w.reserve -= take;
    updateHud();
  }

  function selectWeapon(index) {
    const w = game.owned[index];
    if (!w || w === game.weapon) return;
    if (game.weapon) game.weapon.reloading = 0;
    game.weapon = w;
    game.switching = 0.3;
    Object.entries(guns.models).forEach(([id, model]) => { model.visible = id === w.def.id; });
    updateHud();
  }

  function cycleWeapon(step) {
    if (game.owned.length < 2) return;
    const i = game.owned.indexOf(game.weapon);
    selectWeapon((i + step + game.owned.length) % game.owned.length);
  }

  let triggerHeld = false;
  function trigger(down) {
    if (down && !triggerHeld && live()) fire();
    triggerHeld = down;
  }

  function hurt(amount, from) {
    if (game.phase === 'over') return;
    game.hp = Math.max(0, game.hp - amount);
    game.hurt = 1;
    game.shake = 0.35;
    sfx.hurt();
    if (from) {
      // Knocked back a little
      const dx = player.x - from.x;
      const dz = player.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      player.vx += dx / d * 3;
      player.vz += dz / d * 3;
    }
    updateHud();
    if (game.hp <= 0) gameOver();
  }

  /* ----------------------------------------------------------------------------- The game */

  const game = {
    active: false,
    phase: 'off', // off, alarm, break, wave, paused, over
    resumeTo: null,
    wave: 0,
    score: 0,
    kills: 0,
    hp: PLAYER_HP,
    queue: [],
    remaining: 0,
    spawnTimer: 0,
    timer: 0,
    owned: [],
    weapon: null,
    cooldown: 0,
    recoil: 0,
    flash: 0,
    switching: 0,
    hurt: 0,
    shake: 0,
    flicker: 1,
    dread: 0,
  };

  function live() {
    return game.active && game.phase !== 'paused' && game.phase !== 'over';
  }

  function arm(def) {
    return { def, ammo: def.mag, reserve: def.reserve, reloading: 0 };
  }

  function updateHud() {
    if (!game.weapon) return;
    hud.wave.textContent = Math.max(1, game.wave);
    hud.left.textContent = Math.max(0, game.remaining);
    hud.left.parentElement.lastChild.textContent = ' left';
    if (game.phase === 'break' || game.phase === 'alarm') {
      hud.left.textContent = Math.ceil(Math.max(0, game.timer) + (game.phase === 'alarm' ? 3.2 : 0));
      hud.left.parentElement.lastChild.textContent = 's until the next wave';
    }
    hud.score.textContent = game.score.toLocaleString('en-GB');
    hud.healthText.textContent = Math.ceil(game.hp);
    hud.healthBar.style.transform = `scaleX(${game.hp / PLAYER_HP})`;
    hud.health.classList.toggle('is-low', game.hp <= 30);
    const w = game.weapon;
    hud.weaponName.textContent = w.reloading > 0 ? 'Reloading…' : w.def.name;
    hud.ammo.textContent = w.ammo;
    hud.reserve.textContent = `/ ${w.reserve === Infinity ? '∞' : w.reserve}`;
    hud.ammo.parentElement.classList.toggle('is-empty', w.ammo === 0);
    hud.slots.innerHTML = game.owned.map((o, i) => `<span class="${o === w ? 'is-on' : ''}"><kbd>${i + 1}</kbd>${o.def.name}</span>`).join('');
  }

  function waveQueue(wave) {
    const total = 5 + wave * 3;
    const brutes = wave >= 5 ? Math.floor((wave - 3) / 2) : 0;
    const runners = wave >= 3 ? Math.floor(total * Math.min(0.45, 0.12 * (wave - 2))) : 0;
    const list = [
      ...Array(brutes).fill('brute'),
      ...Array(runners).fill('runner'),
      ...Array(Math.max(0, total - brutes - runners)).fill('walker'),
    ];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // A breather at the start of each wave: walkers first
    list.sort((a, b) => (a === 'walker' ? 0 : 1) - (b === 'walker' ? 0 : 1) || 0);
    const head = list.splice(0, Math.min(3, list.length));
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return [...head, ...list];
  }

  function startBreak() {
    game.phase = 'break';
    const next = game.wave + 1;
    game.timer = game.wave === 0 ? 3.2 : 7;
    const unlocked = WEAPONS.find((def) => def.unlock === next && !game.owned.some((w) => w.def === def));
    if (unlocked) {
      game.owned.push(arm(unlocked));
      selectWeapon(game.owned.length - 1);
      banner('New weapon', unlocked.name, `Press ${game.owned.length} to switch, or Q`, 4);
    } else if (game.wave > 0) {
      banner(`Wave ${game.wave} cleared`, 'Catch your breath', 'Health topped up a little', 3.2);
    }
    if (game.wave > 0) {
      game.hp = Math.min(PLAYER_HP, game.hp + 20);
      sfx.clear();
    }
    updateHud();
  }

  function startWave() {
    game.wave++;
    game.phase = 'wave';
    game.queue = waveQueue(game.wave);
    game.remaining = game.queue.length;
    game.spawnTimer = 0.3;
    banner('Closing time', `Wave ${game.wave}`, game.wave === 1 ? (isTouch ? 'Fire with the button. Reload when it runs dry.' : 'Click to shoot. R to reload. Shift to run.') : '', 2.6);
    sfx.sting();
    updateHud();
  }

  function maxAlive() {
    return Math.min(5 + game.wave * 2, 22);
  }

  function setDread(on) {
    scene.fog = on ? new THREE.Fog(FOG, 2.5, 26) : null;
    renderer.setClearColor(on ? 0x0e0303 : 0xfafafa);
    // Premultiplied lettering can't take fog: it would glow as pale rectangles on the walls
    scene.traverse((object) => {
      const m = object.material;
      if (!m || m === shellMaterial || m === floorMaterial || Array.isArray(m)) return;
      if (on) {
        if (m.blending === THREE.CustomBlending && m.userData.fogWas === undefined) {
          m.userData.fogWas = m.fog;
          m.fog = false;
          m.needsUpdate = true;
        }
      } else if (m.userData.fogWas !== undefined) {
        m.fog = m.userData.fogWas;
        delete m.userData.fogWas;
        m.needsUpdate = true;
      }
    });
    document.body.classList.toggle('is-zombies', on);
  }

  function clearBoard() {
    [...zombies].forEach(removeZombie);
    pickups.forEach((p) => effects.remove(p.group));
    pickups.length = 0;
    holes.forEach((h) => { h.visible = false; });
    puffs.forEach((p) => { p.sprite.visible = false; });
  }

  function reset() {
    clearBoard();
    Object.assign(game, {
      phase: 'alarm', wave: 0, score: 0, kills: 0, hp: PLAYER_HP, queue: [], remaining: 0, timer: 2.4,
      cooldown: 0, recoil: 0, flash: 0, switching: 0, hurt: 0, shake: 0,
    });
    game.owned = [arm(WEAPONS[0])];
    game.weapon = null;
    selectWeapon(0);
    updateHud();
  }

  function start() {
    if (!spawnPoints.length) findSpawnPoints();
    startAudio();
    game.active = true;
    scene.add(horde, effects);
    button.pressed = 1;
    reset();
    setDread(true);
    root.hidden = false;
    document.body.classList.toggle('is-touch-game', isTouch);
    sfx.siren();
    banner('You pressed it', 'The gallery is closed', 'Something is coming up through the floor', 2.4);
  }

  function pause() {
    if (!live()) return;
    game.resumeTo = game.phase;
    game.phase = 'paused';
    triggerHeld = false;
    if (audio) audio.suspend();
    showScreen({
      over: 'Paused',
      title: 'Closing time',
      body: 'They’ll wait. They’re very patient.',
      stats: [['Wave', Math.max(1, game.wave)], ['Score', game.score.toLocaleString('en-GB')], ['Health', Math.ceil(game.hp)]],
      primary: 'Keep fighting',
      secondary: 'Turn the lights back on',
    });
  }

  function resume() {
    if (game.phase !== 'paused') return;
    hideScreen();
    game.phase = game.resumeTo || 'wave';
    if (audio) audio.resume();
  }

  function bestScore(score) {
    try {
      const best = Number(localStorage.getItem('gallery-closing-time-best')) || 0;
      if (score > best) localStorage.setItem('gallery-closing-time-best', String(score));
      return Math.max(best, score);
    } catch (error) {
      return score;
    }
  }

  function gameOver() {
    game.phase = 'over';
    game.slump = 0;
    triggerHeld = false;
    sfx.death();
    const best = bestScore(game.score);
    env.exitLock();
    setTimeout(() => {
      if (game.phase !== 'over') return;
      showScreen({
        over: 'You’ve joined the permanent collection',
        title: `You made it to wave ${game.wave}`,
        body: game.score >= best && game.score > 0 ? 'A new best. The curators would be proud, if they were still alive.' : 'The visitors stayed for the whole exhibition.',
        stats: [['Score', game.score.toLocaleString('en-GB')], ['Best', best.toLocaleString('en-GB')], ['Zombies', game.kills]],
        primary: 'Try again',
        secondary: 'Turn the lights back on',
      });
    }, 900);
  }

  function restart() {
    hideScreen();
    if (audio) audio.resume();
    reset();
    game.timer = 1.2;
    sfx.siren();
  }

  function quit() {
    hideScreen();
    game.active = false;
    game.phase = 'off';
    triggerHeld = false;
    clearBoard();
    scene.remove(horde, effects);
    setDread(false);
    shellMaterial.uniforms.uDread.value = 0;
    floorMaterial.uniforms.uDread.value = 0;
    root.hidden = true;
    hurtLayer.style.opacity = 0;
    if (audio) audio.resume();
    env.onQuit();
  }

  function onUnlock() {
    if (live()) pause();
  }

  // Keys while playing. Returns true when the key was used here.
  function key(code) {
    if (code === 'KeyR') reload();
    else if (code === 'KeyQ') cycleWeapon(1);
    else if (code === 'KeyM') setMuted(!muted);
    else if (/^Digit[1-3]$/.test(code)) selectWeapon(Number(code.slice(5)) - 1);
    else return false;
    return true;
  }

  /* ---------------------------------------------------------------------------- Every frame */

  const sway = { x: 0, y: 0, yaw: 0, pitch: 0 };

  function updateGun(dt) {
    const w = game.weapon;
    if (!w) return;
    game.cooldown = Math.max(0, game.cooldown - dt);
    if (w.reloading > 0) {
      w.reloading -= dt;
      if (w.reloading <= 0) {
        w.reloading = 0;
        finishReload(w);
      }
    }
    if (game.switching > 0) game.switching = Math.max(0, game.switching - dt);
    if (triggerHeld && w.def.auto && live()) fire();

    // Sway against the turn, bob with the walk
    const dyaw = player.yaw - sway.yaw;
    const dpitch = player.pitch - sway.pitch;
    sway.yaw = player.yaw;
    sway.pitch = player.pitch;
    const k = 1 - Math.exp(-dt * 10);
    sway.x += (Math.max(-0.05, Math.min(0.05, dyaw * 0.6)) - sway.x) * k;
    sway.y += (Math.max(-0.05, Math.min(0.05, -dpitch * 0.6)) - sway.y) * k;
    const speed = Math.hypot(player.vx, player.vz);
    const bob = reduceMotion ? 0 : Math.min(1, speed / 4);
    const t = performance.now() / 1000;

    game.recoil = Math.max(0, game.recoil - dt * 7);
    const reloadDip = w.reloading > 0 ? Math.sin((1 - w.reloading / w.def.reload) * Math.PI) : 0;
    const switchDip = game.switching / 0.3;

    gunRig.position.set(
      REST.x + sway.x + Math.sin(t * 7) * 0.012 * bob,
      REST.y + sway.y - Math.abs(Math.cos(t * 7)) * 0.012 * bob - reloadDip * 0.12 - switchDip * 0.25,
      REST.z + game.recoil * 0.04,
    );
    gunRig.rotation.set(game.recoil * 0.12 + reloadDip * 0.6, -0.04, reloadDip * 0.4);

    game.flash = Math.max(0, game.flash - dt);
    guns.flash.visible = game.flash > 0;
    guns.flash.position.set(0, 0.01, guns.muzzles[w.def.id]);
    guns.flash.material.rotation = Math.random() * Math.PI;
  }

  function updateLights(dt) {
    game.dread += ((game.active ? 1 : 0) - game.dread) * (1 - Math.exp(-dt * 2.5));
    // The emergency lights stutter, worst while the alarm sounds
    const stutter = game.phase === 'alarm' ? 0.18 : 0.012;
    if (Math.random() < stutter && !reduceMotion) game.flicker = 0.25 + Math.random() * 0.4;
    else game.flicker += (1 - game.flicker) * (1 - Math.exp(-dt * 10));
    const muzzle = game.flash > 0 ? 1.3 : 1;
    shellMaterial.uniforms.uDread.value = game.dread;
    shellMaterial.uniforms.uFlicker.value = game.flicker * muzzle;
    floorMaterial.uniforms.uDread.value = game.dread;
    floorMaterial.uniforms.uFlicker.value = game.flicker * muzzle;
  }

  function updateButton(dt) {
    if (!button.cap) return;
    const t = performance.now() / 1000;
    button.pressed = Math.max(0, button.pressed - dt * 0.8);
    button.cap.position.z = 0.11 - Math.min(1, button.pressed * 3) * 0.035;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    button.glow.material.opacity = game.active ? 0.5 : 0.1 + pulse * 0.1;
    button.led.visible = game.active ? Math.floor(t * 6) % 2 === 0 : Math.floor(t * 1.2) % 2 === 0;
  }

  function update(dt) {
    updateButton(dt);
    if (!game.active && game.dread < 0.001) return;
    updateLights(dt);
    if (!game.active) return;

    bannerTimer -= dt;
    if (bannerTimer <= 0) hud.banner.classList.remove('is-on');

    game.hurt = Math.max(0, game.hurt - dt * 1.8);
    const low = game.hp <= 30 && game.phase !== 'over' ? 0.35 + Math.sin(performance.now() / 260) * 0.12 : 0;
    hurtLayer.style.opacity = Math.max(game.hurt, low);

    if (game.phase === 'paused') return;

    if (game.phase === 'over') {
      // Slump to the floor
      game.slump = Math.min(1, game.slump + dt * 1.4);
      const e = 1 - (1 - game.slump) ** 3;
      camera.position.y -= e * 1.25;
      camera.rotation.z += e * 0.55;
      zombies.forEach((z) => {
        if (z.phase === 'dying') updateZombie(z, dt);
      });
      updateEffects(dt);
      return;
    }

    if (game.phase === 'alarm') {
      game.timer -= dt;
      if (game.timer <= 0) startBreak();
    } else if (game.phase === 'break') {
      game.timer -= dt;
      if (game.timer <= 0) startWave();
    } else if (game.phase === 'wave') {
      game.spawnTimer -= dt;
      const alive = zombies.filter((z) => z.phase !== 'dying').length;
      if (game.queue.length && game.spawnTimer <= 0 && alive < maxAlive()) {
        spawn(game.queue.shift());
        game.spawnTimer = Math.max(0.35, 1.3 - game.wave * 0.07);
      }
      if (!game.queue.length && alive === 0) startBreak();
    }

    [...zombies].forEach((z) => updateZombie(z, dt));
    updatePickups(dt);
    updateEffects(dt);
    updateGun(dt);
    if (Math.random() < dt * 4 || game.phase === 'break') updateHud();

    // Shake when hit
    if (game.shake > 0 && !reduceMotion) {
      game.shake = Math.max(0, game.shake - dt);
      camera.rotation.z += (Math.random() - 0.5) * game.shake * 0.12;
      camera.position.y += (Math.random() - 0.5) * game.shake * 0.06;
    }
    camera.rotation.x += game.recoil * 0.012;
  }

  // The gun is drawn last, on its own, so it never pokes into a wall
  function renderOverlay() {
    if (!game.active || game.phase === 'over' || !game.weapon) return;
    gunCamera.aspect = camera.aspect;
    gunCamera.fov = camera.fov < 70 ? 58 : 72;
    gunCamera.updateProjectionMatrix();
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(gunScene, gunCamera);
    renderer.autoClear = true;
  }

  return {
    buildButton,
    start,
    update,
    renderOverlay,
    trigger,
    key,
    pause,
    onUnlock,
    cycleWeapon,
    live,
    get active() { return game.active; },
  };
}
