// The gallery's floor plan and how the work is hung in it.
//
// This file decides where things go, not what they say. The words, pictures and numbers come
// from the site's own pages each time the gallery loads (see pages.js), so edit those as normal.
// Each exhibit's `from` picks the part of a page it shows. The little text left here is the
// gallery's own signage.
//
// Plan units are metres, seen from above: x runs east, z runs south.
//
//              x -12      0        13                33        46
//   z -14        +--------+--------+-----------------+---------+
//                |        |Patchwork|     Rapid      |  Times  |
//                | Foyer  +--------+-----------------+----  ---+
//                |        | Family |   Transience    | Garments|
//   z  14        +--------+--------+-----------------+---------+
//
// Each exhibit hangs on a "run", a stretch of wall. Runs are named by side (N, E, S, W) and,
// where doors split a side, numbered in reading order: clockwise, which is left to right for
// someone facing that wall. Exhibits share out the run's length evenly. P.N and P.S are the
// two faces of the partition in the Rapid room.

export const DOORS = [
  { axis: 'x', at: 0, c: -7, a: 'foyer', b: 'patchwork' },
  { axis: 'x', at: 13, c: -7, a: 'patchwork', b: 'rapid' },
  { axis: 'x', at: 33, c: -7, a: 'rapid', b: 'times' },
  { axis: 'z', at: 0, c: 39.5, a: 'times', b: 'garments' },
  { axis: 'x', at: 33, c: 7, a: 'transience', b: 'garments' },
  { axis: 'x', at: 13, c: 7, a: 'family', b: 'transience' },
  { axis: 'x', at: 0, c: 7, a: 'foyer', b: 'family' },
];

// The dashed line on the floor, in the order you walk it
export const ROUTE = [
  [-6, 0], [-2.8, -4.4], [0, -7],
  [4, -4.6], [9.4, -4.6], [13, -7],
  [15.6, -3.2], [23, -2.6], [30.4, -3.2], [33, -7],
  [36.2, -5.2], [39.5, -3], [39.5, 0],
  [39.5, 3], [37, 5.6], [33, 7],
  [28, 4.6], [18, 4.6], [13, 7],
  [9.4, 4.6], [4, 4.6], [0, 7],
  [-2.8, 4.4],
];

// A picture or video whose caption is its text
const captioned = (media) => (media ? { ...media, title: media.label, lede: media.caption, caption: undefined } : {});

// A section's words and its first picture
const told = (page, id, n = 0) => ({
  ...page.media(id, n),
  title: page.heading(id),
  ...page.story(id),
});

// The big picture at the top of a case study
const hero = ({ page }) => ({ ...page.hero(), title: page.title(), lede: page.intro(), label: undefined });

const titlePanel = ({ page }) => ({
  over: page.over(),
  title: page.title(),
  lede: page.intro(),
  grid: page.meta('Company') ? [['Company', page.meta('Company')]] : [],
});

const briefPanel = (storyId) => ({ page }) => ({
  over: page.heading('brief'),
  grid: page.grid('brief'),
  body: storyId ? page.paras(storyId) : [],
});

export const ROOMS = [
  {
    id: 'foyer',
    name: 'Foyer',
    status: 'Start here',
    theme: 'foyer',
    bounds: [-12, 0, -14, 14],
    h: 6,
    spawn: { at: [-8, 0], look: [0, 0] },
    benches: [{ x: -6, z: -9.5, along: 'x' }, { x: -6, z: 9.5, along: 'x' }],
    exhibits: [
      {
        id: 'hello', hang: 'E.1', kind: 'text', w: 9, y: 2.75, size: 'display', gridScale: 1.8,
        from: ({ home }) => ({ title: home.one('.home-title'), grid: home.pairs('.home-facts') }),
        link: { href: '../about.html', text: 'More about me' },
      },
      {
        id: 'selected', hang: 'E.0', kind: 'text', w: 4, y: 2.2, size: 'h2',
        over: 'Through this door',
        from: ({ home }) => ({ title: home.one('#home-work-title'), lede: `${home.names('.home-cards')}. Follow the dashed line.` }),
        action: 'map',
      },
      {
        id: 'outside', hang: 'E.2', kind: 'text', w: 4, y: 2.2, size: 'h2',
        over: 'Through this door',
        from: ({ home }) => ({ title: home.one('#home-side-title'), lede: `${home.names('.home-side-grid')}, in three screening rooms.` }),
        action: 'map',
      },
      {
        id: 'portrait', hang: 'N', kind: 'image', w: 2.3, aspect: 1024 / 1545, y: 2.5,
        from: ({ home }) => ({
          src: `../${home.attr('.home-tile-tall img', 'src')}`,
          title: home.one('.site-name'),
          label: home.one('.site-name'),
          lede: home.attr('.home-tile-tall img', 'alt'),
        }),
        link: { href: '../about.html', text: 'More about me' },
      },
      {
        id: 'about', hang: 'N', kind: 'text', w: 5.2, y: 2.5, size: 'h3',
        over: 'Introduction',
        from: ({ home }) => {
          // The first sentence goes large, as a headline
          const [first, ...rest] = home.one('.home-intro-text .type-on-scroll').split(/(?<=\.)\s+/);
          return { title: first, lede: rest.join(' ') };
        },
        wallMax: 400,
        link: { href: '../about.html', text: 'More about me' },
      },
      {
        id: 'plan', hang: 'S', kind: 'text', w: 8.4, y: 2.5, size: 'h3',
        over: 'Floor plan', title: 'Six rooms, one loop', plan: true,
        action: 'map',
      },
      {
        id: 'how', hang: 'W', kind: 'text', w: 4.6, y: 2.2, size: 'h3',
        over: 'How to visit', title: 'Walk up to anything and look closer',
        grid: [
          ['Walk', 'WASD or the arrow keys, with Shift to run'],
          ['Look closer', 'Point at a piece and press E or click'],
          ['Find your way', 'Follow the dashed line, or press M for the map'],
        ],
      },
      {
        id: 'exit', hang: 'W', kind: 'text', w: 2.5, fixedH: 3.1, y: 1.55, bg: '#1E1E1E', size: 'h3', centred: true,
        title: 'Back to the site',
        action: 'exit', cursor: 'Leave the gallery',
      },
      {
        // Visitors' sticky notes, kept on the server: see notes.js
        id: 'notes', hang: 'W', kind: 'notes', w: 6, aspect: 2, y: 1.95,
        action: 'notes', cursor: 'Leave a note',
      },
      {
        id: 'contact', hang: 'W', kind: 'text', w: 4.6, y: 2.2, size: 'h3',
        from: ({ home }) => ({
          over: home.one('.footer-kicker'),
          title: home.one('.footer-cta-text'),
          link: { href: home.attr('.footer-link', 'href'), text: home.one('.footer-link'), external: true },
        }),
      },
    ],
  },

  {
    id: 'patchwork',
    cardFor: 'patchwork.html',
    href: '../patchwork.html',
    cta: 'Unlock the case study',
    theme: 'light',
    bounds: [0, 13, -14, 0],
    h: 4.4,
    spawn: { at: [2.2, -7], look: [13, -7] },
    exhibits: [
      {
        id: 'title', hang: 'N', kind: 'text', w: 4.3, size: 'h2',
        over: 'Case study',
        from: ({ card }) => ({ title: card && card.headline, lede: card && card.summary }),
      },
      {
        id: 'hero', hang: 'N', kind: 'image', w: 6.4, aspect: 2400 / 1350,
        from: ({ card }) => (card && card.image ? { src: card.image.src, title: card.headline, lede: card.image.alt } : {}),
      },
      {
        id: 'results', hang: 'S', kind: 'text', w: 5.4, size: 'h3',
        over: 'Outcomes',
        from: ({ card }) => ({ stats: card ? card.metrics : [] }),
      },
      {
        id: 'locked', desk: { x: 6.5, z: -9.6, look: [6.5, -3] }, kind: 'text', w: 1.15, fixedH: 0.65, y: 1.2,
        bg: '#1E1E1E', scale: 0.3, centred: true, size: 'h2',
        over: 'Patchwork', title: 'Password protected',
        lede: 'This case study is password protected. Enter the password to read it, or ask me for access.',
        link: { href: '../patchwork.html', text: 'Unlock the case study' },
      },
    ],
  },

  {
    id: 'rapid',
    page: 'rapid-api.html',
    href: '../rapid-api.html',
    cta: 'Read the full case study',
    theme: 'light',
    bounds: [13, 33, -14, 0],
    h: 4.4,
    spawn: { at: [15, -7], look: [24, -12] },
    partition: { x0: 17, x1: 29, z: -7, h: 3.8 },
    exhibits: [
      { id: 'title', hang: 'N', kind: 'text', w: 4.4, size: 'h1', from: titlePanel },
      { id: 'hero', hang: 'N', kind: 'image', w: 6, aspect: 16 / 9, y: 2.15, from: hero },
      { id: 'brief', hang: 'N', kind: 'text', w: 4.8, size: 'h3', from: briefPanel() },
      {
        id: 'role', hang: 'P.N', kind: 'text', w: 3.3, size: 'h2',
        from: ({ page }) => ({ title: page.heading('my-role'), ...page.story('my-role') }),
      },
      {
        id: 'users', hang: 'P.N', kind: 'text', w: 3.4, size: 'h2',
        from: ({ page }) => ({ title: page.heading('users'), stats: page.stats('users'), body: page.paras('users') }),
      },
      {
        id: 'empathy', hang: 'P.N', kind: 'video', w: 4.3, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => told(page, 'research'),
      },
      {
        id: 'hypothesis', hang: 'W.1', kind: 'text', w: 3.9,
        from: ({ page }) => page.quote('research'),
      },
      {
        id: 'principles', hang: 'W.0', kind: 'text', w: 4.2, size: 'h3', columns: 2,
        from: ({ page }) => ({
          title: page.heading('principles'),
          lede: page.paras('principles')[0],
          grid: page.grid('principles', '.principles'),
          body: ['guided', 'clarity', 'adaptive'].flatMap((id) => page.paras(id)),
        }),
      },
      {
        id: 'ide', hang: 'P.S', kind: 'image', w: 5.1, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => told(page, 'accessible'),
      },
      {
        id: 'vscode', hang: 'P.S', kind: 'video', w: 5.1, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => captioned(page.media('accessible', 2)),
      },
      {
        id: 'iterating', hang: 'S', kind: 'text', w: 3.5, size: 'h2',
        from: ({ page }) => ({ title: page.heading('iteration'), ...page.story('iteration') }),
      },
      {
        id: 'logs', hang: 'S', kind: 'video', w: 4.6, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => captioned(page.media('iteration', 0)),
      },
      {
        id: 'testing', hang: 'S', kind: 'video', w: 4.6, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => captioned(page.media('iteration', 1)),
      },
      {
        id: 'team', hang: 'S', kind: 'image', w: 4.2, aspect: 2048 / 1365, y: 1.95,
        from: ({ page }) => told(page, 'squads'),
      },
      {
        id: 'outcomes', hang: 'E.1', kind: 'text', w: 4.3, size: 'h3',
        from: ({ page }) => ({ over: page.heading('outcomes'), stats: page.results('outcomes'), body: page.paras('outcomes') }),
      },
      {
        id: 'learnings', hang: 'E.0', kind: 'text', w: 4.2, size: 'h2', wallRows: 2,
        from: ({ page }) => ({ title: page.heading('learnings'), grid: page.learnings('learnings') }),
      },
    ],
  },

  {
    id: 'times',
    page: 'times-radio.html',
    href: '../times-radio.html',
    cta: 'Read the full case study',
    theme: 'light',
    bounds: [33, 46, -14, 0],
    h: 4.4,
    spawn: { at: [35.2, -7], look: [46, -9] },
    exhibits: [
      { id: 'title', hang: 'N', kind: 'text', w: 4.3, size: 'h1', from: titlePanel },
      { id: 'hero', hang: 'N', kind: 'image', w: 6.2, aspect: 16 / 9, y: 2.15, from: hero },
      { id: 'brief', hang: 'E', kind: 'text', w: 4, size: 'h3', from: briefPanel('solution') },
      {
        id: 'promo', desk: { x: 39.5, z: -9.6, look: [39.5, -3] }, kind: 'video', w: 1.15, aspect: 16 / 9, y: 1.2,
        from: ({ page }) => captioned(page.media('solution', 0)),
      },
      {
        id: 'architecture', hang: 'E', kind: 'text', w: 3.6, size: 'h2',
        from: ({ page }) => ({ title: page.heading('architecture'), ...page.story('architecture'), caption: page.caption('architecture') }),
      },
      {
        id: 'boris', hang: 'E', kind: 'image', w: 4.4, aspect: 1921 / 1080, y: 1.95,
        from: ({ page }) => captioned(page.media('outcomes', 0)),
      },
      {
        id: 'outcomes', hang: 'S.0', kind: 'text', w: 4.1, size: 'h3',
        from: ({ page }) => ({ over: page.heading('outcomes'), stats: page.results('outcomes'), body: page.paras('outcomes') }),
      },
      {
        id: 'concept', hang: 'S.1', kind: 'image', w: 4.2, aspect: 16 / 9, y: 1.95,
        from: ({ page }) => captioned(page.media('research', 0)),
      },
      {
        id: 'research', hang: 'W.0', kind: 'text', w: 4.2,
        from: ({ page }) => ({ ...page.quote('research'), body: page.paras('research') }),
      },
      {
        id: 'role', hang: 'W.1', kind: 'text', w: 3.8, size: 'h2', wallRows: 0,
        // There's only room for the learnings in the reading panel
        from: ({ page }) => ({ title: page.heading('my-role'), ...page.story('my-role'), grid: page.learnings('learnings') }),
      },
    ],
  },

  {
    id: 'garments',
    page: 'garments.html',
    href: '../garments.html',
    cta: 'Read the full project',
    theme: 'dark',
    bounds: [33, 46, 0, 14],
    h: 4.4,
    spawn: { at: [39.5, 2.2], look: [39.5, 14] },
    benches: [{ x: 39.5, z: 9, along: 'x' }],
    exhibits: [
      {
        id: 'title', hang: 'E', kind: 'text', w: 4.4, size: 'h1',
        from: ({ page }) => ({ over: page.over(), title: page.title(), lede: page.intro() }),
      },
      { id: 'brief', hang: 'E', kind: 'text', w: 4.8, size: 'h3', from: briefPanel('introduction') },
      {
        id: 'film', hang: 'S', kind: 'film', w: 6.8, aspect: 16 / 9, y: 2.2,
        src: '../resources/video/garments-wide.mp4', poster: '../resources/video/garments-wide.jpg',
        from: ({ page }) => ({ title: page.title(), lede: page.caption('introduction'), vimeo: page.vimeo('introduction') }),
      },
      { id: 'idea', hang: 'W.0', kind: 'text', w: 4, from: ({ page }) => page.quote('introduction') },
      {
        id: 'deck', hang: 'W.1', kind: 'image', w: 3.6, aspect: 2412 / 1354, y: 1.95,
        from: ({ page }) => ({ ...page.asset('development'), title: page.heading('development'), ...page.story('development') }),
      },
      {
        id: 'outcome', hang: 'N.0', kind: 'text', w: 4, size: 'h3',
        from: ({ page }) => ({ over: page.heading('outcome'), stats: page.results('outcome'), body: page.paras('outcome') }),
      },
    ],
  },

  {
    id: 'transience',
    page: 'installation.html',
    href: '../installation.html',
    cta: 'Read the full project',
    theme: 'dark',
    bounds: [13, 33, 0, 14],
    h: 4.4,
    spawn: { at: [30.8, 7], look: [13, 9] },
    exhibits: [
      {
        // The installation itself, rebuilt: a projection on the south wall and the conductive-ink
        // controller on a plinth in front of it (see installation.js). Each film, sound channel and
        // photo is a placeholder until it's given a `src`: the films are drawn live, the six sound
        // channels are synthesised in time with each other, and the photos are blank prints.
        id: 'installation', hang: 'S', kind: 'installation', w: 5.6, aspect: 16 / 9, y: 2,
        action: 'play', cursor: 'Step up to play',
        plinth: 4.4, // metres out from the projection
        films: [
          { name: 'Persona one', hue: 28 },
          { name: 'Persona two', hue: 350 },
          { name: 'Persona three', hue: 290 },
        ],
        stems: [
          { name: 'Kick', voice: 'kick' },
          { name: 'Hats', voice: 'hats' },
          { name: 'Bass', voice: 'bass' },
          { name: 'Clap', voice: 'clap' },
          { name: 'Stab', voice: 'stab' },
          { name: 'Pad', voice: 'pad' },
        ],
        photos: { cols: 4, rows: 2, srcs: [] },
      },
      {
        id: 'title', hang: 'N', kind: 'text', w: 4.8, size: 'h2',
        from: ({ page }) => ({ over: page.over(), title: page.title(), lede: page.intro() }),
      },
      {
        id: 'film', hang: 'N', kind: 'film', w: 6.8, aspect: 16 / 9, y: 2.2,
        src: '../resources/video/transience-wide.mp4', poster: '../resources/video/transience-wide.jpg',
        from: ({ page }) => ({ title: page.title(), lede: page.caption('introduction'), vimeo: page.vimeo('introduction') }),
      },
      { id: 'brief', hang: 'N', kind: 'text', w: 4.8, size: 'h3', from: briefPanel('introduction') },
      { id: 'idea', hang: 'W.1', kind: 'text', w: 4.2, from: ({ page }) => page.quote('introduction') },
      {
        id: 'outcome', hang: 'W.0', kind: 'text', w: 4.3, size: 'h3',
        from: ({ page }) => ({ over: page.heading('outcome'), stats: page.results('outcome'), body: page.paras('outcome') }),
      },
      {
        id: 'hero', hang: 'E.0', kind: 'image', w: 4.6, aspect: 16 / 9, y: 2.05,
        from: ({ page }) => ({ ...page.hero(), title: page.heading('development'), ...page.story('development') }),
      },
      {
        id: 'deck', hang: 'E.1', kind: 'image', w: 3.4, aspect: 3456 / 1940, y: 1.95,
        from: ({ page }) => {
          const asset = page.asset('development');
          return { ...asset, title: asset.label, lede: asset.assetTitle };
        },
      },
    ],
  },

  {
    id: 'family',
    page: 'family-portrait.html',
    href: '../family-portrait.html',
    cta: 'Read the full project',
    theme: 'dark',
    bounds: [0, 13, 0, 14],
    h: 4.4,
    spawn: { at: [10.8, 7], look: [0, 9] },
    benches: [{ x: 6.5, z: 9.2, along: 'x' }],
    exhibits: [
      {
        id: 'film', hang: 'S', kind: 'film', w: 6.8, aspect: 16 / 9, y: 2.2,
        src: '../resources/video/family-wide.mp4', poster: '../resources/video/family-wide.jpg',
        from: ({ page }) => ({ title: page.title(), lede: page.caption('introduction'), vimeo: page.vimeo('introduction') }),
      },
      { id: 'brief', hang: 'W.0', kind: 'text', w: 4.3, size: 'h3', from: briefPanel('introduction') },
      {
        id: 'title', hang: 'N', kind: 'text', w: 4.2, size: 'h1',
        from: ({ page }) => ({ over: page.over(), title: page.title(), lede: page.intro() }),
      },
      { id: 'hero', hang: 'N', kind: 'image', w: 6, aspect: 16 / 9, y: 2.1, from: hero },
      {
        id: 'idea', hang: 'E.1', kind: 'text', w: 3.9,
        from: ({ page }) => ({ ...page.quote('introduction'), body: page.paras('outcome') }),
      },
    ],
  },
];
