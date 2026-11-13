// Reads the gallery's content from the site's own pages each time it loads, so there's only one
// copy of the words and pictures. Edit a case study or the home page and the gallery follows.
//
// Exhibits in content.js say which part of a page they show, using the helpers below. Sections
// are found by the id on their heading, and everything up to the next heading belongs to them.
//
// patchwork.html is never read: its case study is encrypted, and the gallery only shows what the
// home page already says about it.

const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

// Paths in the pages are relative to the site root, and the gallery is one folder down
const fromRoot = (path) => (!path || /^(https?:|\/|#|mailto:)/.test(path) ? path : `../${path}`);

const pairs = (root) => (root ? [...root.querySelectorAll('dt')].map((dt) => [text(dt), text(dt.nextElementSibling)]) : []);

// The first clause of a caption makes a good short label for the wall
const firstClause = (caption) => caption.split(/[:,]\s|\.(?:\s|$)/)[0];

function readMedia(el) {
  if (!el || el.matches('.img-slot')) return null;
  const width = Number(el.getAttribute('width'));
  const height = Number(el.getAttribute('height'));
  const block = el.closest('.large-img, .figma') || el.parentElement;
  const caption = text(block.querySelector('.caption-regular'));
  return {
    kind: el.matches('video') ? 'video' : 'image',
    src: fromRoot(el.getAttribute('src')),
    ...(el.getAttribute('poster') ? { poster: fromRoot(el.getAttribute('poster')) } : {}),
    ...(width && height ? { aspect: width / height } : {}),
    ...(caption ? { caption, label: firstClause(caption) } : {}),
  };
}

export class Page {
  constructor(doc) {
    this.doc = doc;
    this.read = new Set();
  }

  // The blocks of a section: its heading's block, and those after it until the next heading
  blocks(id) {
    const heading = this.doc && this.doc.getElementById(id);
    if (!heading) return [];
    this.read.add(id);
    let block = heading;
    while (block.parentElement !== this.doc.body) block = block.parentElement;
    const blocks = [block];
    for (let next = block.nextElementSibling; next; next = next.nextElementSibling) {
      const ends = next.matches('footer, script, .recirc-next') || next.querySelector('h2[id], h3[id]');
      if (ends) break;
      blocks.push(next);
    }
    return blocks;
  }

  all(id, selector) {
    return this.blocks(id).flatMap((block) => [...(block.matches(selector) ? [block] : []), ...block.querySelectorAll(selector)]);
  }

  heading(id) {
    return text(this.doc && this.doc.getElementById(id));
  }

  paras(id) {
    return this.all(id, 'p.body').map(text);
  }

  // A section's opening paragraph, and whatever follows it
  story(id) {
    const [lede, ...body] = this.paras(id);
    return { lede, body };
  }

  grid(id, selector = '.brief-grid') {
    return pairs(this.all(id, selector)[0]);
  }

  results(id) {
    return pairs(this.all(id, '.results')[0]);
  }

  stats(id) {
    return this.all(id, '.stat').map((stat) => [
      text(stat.querySelector('.stat-value')),
      [text(stat.querySelector('.stat-persona')), text(stat.querySelector('.stat-label'))].filter(Boolean).join(' · '),
    ]);
  }

  learnings(id) {
    return this.all(id, '.learning').map((item) => [text(item.querySelector('h3')), text(item.querySelector('p'))]);
  }

  quote(id) {
    const figure = this.all(id, '.insight')[0];
    if (!figure) return {};
    return { quote: text(figure.querySelector('blockquote')), quoteLabel: text(figure.querySelector('figcaption')) };
  }

  // The nth piece of media in a section. Placeholder slots count, so that filling one in later
  // doesn't shift the pieces after it.
  media(id, n = 0) {
    const pieces = this.all(id, 'img, video, .img-slot').filter((el) => !el.closest('.asset'));
    return readMedia(pieces[n]);
  }

  caption(id) {
    return text(this.all(id, '.caption-regular')[0]);
  }

  vimeo(id) {
    const frame = this.all(id, 'iframe[src*="vimeo"]')[0];
    const match = frame && frame.getAttribute('src').match(/video\/(\d+)/);
    return match ? match[1] : null;
  }

  // A linked deck, shown as a thumbnail with a title
  asset(id) {
    const asset = this.all(id, '.asset')[0];
    if (!asset) return {};
    return {
      kind: 'image',
      src: fromRoot(asset.querySelector('img').getAttribute('src')),
      link: { href: fromRoot(asset.getAttribute('href')), text: text(asset.querySelector('.asset-cta')), external: true },
      label: text(asset.querySelector('.home-status')),
      assetTitle: text(asset.querySelector('.asset-title')),
    };
  }

  // The top of a case study, above the brief
  over() {
    return text(this.doc && this.doc.querySelector('.text-block .overline'));
  }

  title() {
    return text(this.doc && this.doc.querySelector('.text-block .title'));
  }

  intro() {
    return text(this.doc && this.doc.querySelector('.text-block .body'));
  }

  hero() {
    return readMedia(this.doc && this.doc.querySelector('.large-img img'));
  }

  meta(label) {
    const heading = this.doc && [...this.doc.querySelectorAll('.meta h6')].find((h6) => text(h6) === label);
    return heading ? [...heading.parentElement.querySelectorAll('li')].map(text).join(', ') : '';
  }

  // Headed sections that no exhibit has read
  unread() {
    if (!this.doc) return [];
    return [...this.doc.querySelectorAll('h2[id], h3[id]')]
      .filter((heading) => !heading.closest('.recirc-next') && !this.read.has(heading.id));
  }
}

// The home page, which holds each project's name, role and headline
export class Home extends Page {
  one(selector) {
    return text(this.doc && this.doc.querySelector(selector));
  }

  attr(selector, name) {
    const el = this.doc && this.doc.querySelector(selector);
    return el ? el.getAttribute(name) : '';
  }

  pairs(selector) {
    return pairs(this.doc && this.doc.querySelector(selector));
  }

  // "Patchwork, Rapid API and Times Radio", from whatever cards are on the page
  names(selector) {
    const names = this.doc ? [...this.doc.querySelectorAll(`${selector} .home-name`)].map(text) : [];
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names.join('');
  }

  card(page) {
    const card = this.doc && this.doc.querySelector(`a.home-card[href="${page}"], a.home-side-item[href="${page}"]`);
    if (!card) return null;
    const image = card.querySelector('.home-card-media img');
    return {
      name: text(card.querySelector('.home-name')),
      status: text(card.querySelector('.home-status')),
      headline: text(card.querySelector('h3')) || text(card.querySelector('.home-desc')),
      summary: text(card.querySelector('.home-desc')),
      metrics: pairs(card.querySelector('.home-metrics')),
      image: image ? { src: fromRoot(image.getAttribute('src')), alt: image.getAttribute('alt') } : null,
    };
  }
}

async function fetchPage(path) {
  try {
    // Always check for a newer copy, so an edit shows up on the next visit
    const response = await fetch(`../${path}`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(response.status);
    return new DOMParser().parseFromString(await response.text(), 'text/html');
  } catch (error) {
    console.warn(`Gallery couldn't read ${path}: ${error.message}`);
    return null;
  }
}

function hasContent(ex) {
  return Boolean(ex.src || ex.title || ex.lede || ex.quote || ex.plan || (ex.grid && ex.grid.length) || (ex.stats && ex.stats.length));
}

// Fills in every room from the pages. Returns false if the site couldn't be read at all.
export async function loadContent(rooms) {
  const homeDoc = await fetchPage('index.html');
  if (!homeDoc) return false;
  const home = new Home(homeDoc);

  const pages = rooms.filter((room) => room.page).map((room) => room.page);
  const docs = await Promise.all(pages.map(fetchPage));
  const byPath = new Map(pages.map((path, i) => [path, new Page(docs[i])]));

  rooms.forEach((room) => {
    const page = room.page ? byPath.get(room.page) : null;
    const card = home.card(room.page || room.cardFor);
    if (card) {
      room.name = card.name;
      room.status = card.status;
      room.title = card.headline;
    }

    room.exhibits = room.exhibits.filter((ex) => {
      // The note wall fills itself from the server, not from a page
      if (ex.kind === 'notes') return true;
      // So does the Transience installation, from installation.js
      if (ex.kind === 'installation') return true;
      // And the red button has nothing to say for itself
      if (ex.kind === 'button') return true;
      if (ex.from) Object.assign(ex, ex.from({ page, home, card }));
      // A piece whose content has gone from the page comes off the wall
      if (hasContent(ex)) {
        // If its picture has gone but its words haven't, it carries on as a text panel
        if (!ex.src && ex.kind !== 'text') ex.kind = 'text';
        return true;
      }
      console.warn(`Gallery: nothing to show for ${room.id}/${ex.id}, so it's been taken down`);
      return false;
    });

    // Sections added to a page since the gallery was hung still get a place on the wall
    room.extras = page ? page.unread().map((heading) => {
      const { lede, body } = page.story(heading.id);
      return { id: heading.id, kind: 'text', w: 3.8, size: 'h3', title: text(heading), lede, body, stats: page.results(heading.id) };
    }).filter(hasContent) : [];
  });
  return true;
}
