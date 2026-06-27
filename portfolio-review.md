# Portfolio Review — tommoore.co.uk

Reviewed: templates/index.html, about.html, rapid-api.html, times-radio.html, garments.html, installation.html, family-portrait.html, resources/CSS/styles.css, build.py, and asset files. Compared against Simon Pan (simonpan.com), Andrew Couldwell (roomfive.net), Anton Sten (antonsten.com), Buzz Usborne (buzzusborne.com), Austin Knight (austinknight.com), Tom Parkes (tparkes.com), Ed Chao (thatedchao.com), Pratibha Joshi (pratibhajoshi.com), Billy Sweeney (billysweeney.com), and the Case Study Club / Bestfolios curated lists.

## 1. What's working well

**Case study structure is genuinely strong.** `rapid-api.html` and `times-radio.html` both follow a real problem → process → decision → outcome arc, not just a gallery of screens: challenge, role, research method (empathy maps), the hypothesis that came out of it, stakeholder negotiation, and a dedicated "Outcomes" section with `<mark>`-highlighted metrics (30% conversion increase, 100k users, 3.96m weekly listening hours). This matches the structure that case-study-club calls the "golden standard" (Simon Pan's Uber/Amazon work: clear problem statement → process → metrics). You're already doing the hard part.

**Meta panel is a nice pattern.** The Company / Outcome / Contribution / Press four-column block at the top of each case study (`rapid-api.html` lines 29-65) gives recruiters a 10-second scan of role and impact before they commit to reading. Few personal portfolios do this as cleanly.

**Design system thinking shows through in the CSS.** Typographic scale (title/headlinePrimary/subhead/overline/body/caption), a full dark-mode token override (`[data-theme="dark"]` and `prefers-color-scheme`), and a working theme toggle in the nav are a legitimate "this person thinks in systems" signal — exactly the kind of thing that makes a portfolio a design artifact in itself.

**Testimonials are specific, not filler.** The Jorge/Yenny/Annie quotes on `about.html` name real people, real companies, and real working relationships (mentor, understaffed team, communicator) rather than generic "great to work with" lines.

**Responsive type and layout are properly handled**, not just Bootstrap defaults left alone — font sizes, paddings, and the asymmetric "wide-img-left/right" bleed all have deliberate mobile overrides at 992px/768px breakpoints.

## 2. Prioritized, actionable improvements

### Priority 1 — Fix before anything else

1. **Broken card on the homepage.** `templates/index.html` lines 67-87 — the "My Account / The Times" card has no `<a href>` wrapper around it, unlike the Rapid and Times Radio cards above it. It currently reads as a dead, unclickable tile labeled "Coming soon." Either finish and link the case study, or remove the card until it's ready — a non-functional card on a product designer's homepage undercuts the rest of the page.

2. **Copy-pasted alt text in `times-radio.html`.** Lines 128 and 179 both use `alt="Rapid team members infront of a large billboard saying Rapid"` on Times Radio images (the concept slide and the Boris Johnson photo). Small, but it's a literal factual error sitting in your markup — fix both.

3. **21MB GIF.** `resources/Images/timesradio/promo.gif` is 21MB and loads on the Times Radio case study. Convert to an MP4/WebM in a `<video>` tag or a compressed lossy GIF — this alone is probably your single biggest page-weight problem.

4. **Unoptimized hero/PNG images with no responsive sizing.** Several images are 350KB–1.5MB (`timesradio/hero.png` 1.5MB, `Index/timesradio-index.png` 876KB, `About/about.jpg` 800KB, `Rapid/hero.png` 548KB) and none use `srcset`/`sizes` or explicit `width`/`height` attributes, so mobile visitors download desktop-sized files and pages risk layout shift while images load. Convert to WebP, generate 2-3 responsive sizes, and add width/height to the `<img>` tags in `templates/*.html`.

5. **426MB `deck/` folder, partly unsynced.** This is a Keynote "export to web" bundle (full pdf.js library, WebGL shaders, dozens of UUID folders) powering `installation-deck.html`'s "Dive Deeper" link. Several asset files inside are still iCloud placeholder stubs (`.xxx.mp4.icloud`, `.xxx.pdf.icloud`) rather than the real files — if those haven't synced before a deploy, that linked deck will serve broken media. This is both a deploy risk and 426MB of legacy tech (Keynote's web player hasn't been touched in years) sitting behind a single "dive deeper" link. Replace with a plain embedded PDF or a few static images with captions.

### Priority 2 — Content gaps that matter to hiring managers

6. **Your "about" doesn't say what kind of designer you are or what you want next.** `templates/about.html` line 21: "I'm a thoughtful and collaborative designer with over X years of industry experience, blending creative expertise with a solid foundation in computer science." This describes character traits, not a specialization or a goal. Compare Anton Sten's homepage: "I work with teams who need clarity in their product design... Right now I'm the fractional design lead at three companies" — specific, and tells you exactly what he does and his current availability. Your case studies show a real specialization (0-to-1 product launches inside large orgs — Rapid, Times Radio, The Times) and a leadership trajectory (your CV file is literally named `TomMoore_ProductDesignLead_CV.pdf` while your site title says "Product Designer" everywhere else). Pick the framing and use it consistently: are you presenting as an IC product designer or a design lead? Right now the site and the CV filename disagree.

7. **No stated availability or what you're looking for.** Every comparison portfolio that's actively job-hunting or open to work says so directly (Anton Sten: "Right now I'm the fractional design lead at three companies"; Billy Sweeney: title states current role at Figma). Your nav "Contact" just opens LinkedIn with no context. Add a line near the top of `about.html` or the homepage hero stating what you're looking for (e.g., "Currently looking for senior/lead product design roles in [X]").

8. **Personal/creative projects dilute the product-design signal.** `garments.html`, `installation.html`, and `family-portrait.html` (a short film, an art installation, a family-video piece) are bundled into `about.html` using the exact same card pattern as your professional case studies, with much thinner write-ups ("Objective / Introducing / Creative development / Outcome" in 4 short paragraphs vs. the dense, multi-section Rapid/Times Radio studies). For a product design portfolio, these read as a different discipline competing for attention right under your testimonials. Either move them to a clearly separate "Personal work" section lower down, or trim to 1 strong example — most of the benchmark portfolios (Simon Pan, Pratibha Joshi) keep personal/experimental work visually and narratively separate from client/employer case studies.

9. **Figma embeds ask too much of a skimming recruiter.** `rapid-api.html` and `times-radio.html` embed live, pannable Figma canvases at 90vh (`.figma iframe`). A recruiter spending 90 seconds on your site won't zoom/pan an embedded Figma file — they'll scroll past it. Replace with a static, annotated screenshot (callouts pointing at the specific empathy-map insight or flow decision you're describing in the adjacent paragraph) and link out to the live Figma file for anyone who wants to go deeper. This is the single change most likely to make your existing strong written process land visually.

10. **Dense, unbroken paragraphs reduce scannability.** Sections like "Understanding the existing product architecture" and "Agile iteration of the existing workflow" in `rapid-api.html` are two full paragraphs of continuous prose with no sub-bullets, pull quotes, or stat callouts breaking them up. The content itself is good (empathy maps → hypothesis → stakeholder buy-in is a legitimately strong narrative) but it reads as a memo, not a portfolio page. Pull 1-2 sentence findings into a highlighted stat/quote block (you already do this well in the "Outcomes" sections with `<mark>` tags — extend that treatment earlier in the case study).

### Priority 3 — Polish

11. **Typography has no distinct personality.** Every weight/size token in `resources/CSS/styles.css` is Inter — clean and systemic, but visually interchangeable with thousands of other Bootstrap-based sites. You don't need a redesign, but consider a second display typeface for `h1`/`title` only (the way Bethany Heck or Karina Sirqueira use type as a brand signal) so the site itself reads as more deliberately art-directed rather than template-driven.

12. **CV and title inconsistency.** As noted above, resolve "Product Designer" (site title, meta tags) vs. "Product Design Lead" (CV filename) — pick one level and use it everywhere, including LinkedIn's title if it differs.

13. **Footer CTA is generic.** "Let's connect! Connect on LinkedIn and let's discuss how I can help you." — fine, but combined with the missing availability statement (#7), this is the second missed opportunity to say what you're actually looking for right now.

## 3. Direct inspiration: 2-3 portfolios to study

**Simon Pan — simonpan.com.** Borrow: the problem-statement-first case study opening and the way every project closes on 2-3 hard metrics. Your Rapid/Times Radio structure is already close to this; what's missing is Pan's visual treatment of process — annotated diagrams and pull-quote stats instead of raw embedded tools, which directly addresses improvement #9 and #10 above.

**Anton Sten — antonsten.com.** Borrow: positioning clarity. The homepage states in one sentence what kind of design problems he solves, who he's currently working with, and implicitly his availability — solving your biggest content gap (#6, #7). He also threads testimonials into the *homepage*, not just a separate about page, which is worth considering since yours are strong enough to do double duty.

**Andrew Couldwell — roomfive.net.** Borrow: how to present a varied career (freelance + in-house leadership + side projects/writing) without it feeling scattered — he organizes "Freelancer / Founder / Author / Leader" as explicit facets rather than burying them in one CV link. Useful if you want your personal creative work (#8) to coexist with your product case studies without diluting either.
