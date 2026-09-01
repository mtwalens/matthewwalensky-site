/* ── CURSOR ─────────────────────────────────────────────────── */
const dot = document.querySelector('.cursor-dot');
let cursorVisible = false;

document.addEventListener('mousemove', e => {
  dot.style.left = e.clientX + 'px';
  dot.style.top  = e.clientY + 'px';
  if (!cursorVisible) { dot.classList.add('visible'); cursorVisible = true; }
}, { passive: true });

function addHoverCursor(els) {
  els.forEach(el => {
    el.addEventListener('mouseenter', () => dot.classList.add('hovering'));
    el.addEventListener('mouseleave', () => dot.classList.remove('hovering'));
  });
}
addHoverCursor(document.querySelectorAll('a, button, .project-card'));

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── LOADER ─────────────────────────────────────────────────── */
/* Fade out the loader once the page has had a moment to paint + fonts load. */
function dismissLoader() {
  document.body.classList.remove('loading');
}
if (document.readyState === 'complete') {
  setTimeout(dismissLoader, 900);
} else {
  window.addEventListener('load', () => setTimeout(dismissLoader, 700));
}

/* ── ROUTING (Projects ↔ Home ↔ Stills + About overlay) ───── */
const VALID_PAGES = new Set(['home', 'projects', 'about', 'stills']);

function goToPage(page, { push = true } = {}) {
  if (!VALID_PAGES.has(page)) page = 'home';
  document.body.dataset.page = page;
  if (push) {
    const url = page === 'home' ? '#' : '#' + page;
    history.pushState({ page }, '', url);
  }
  /* When opening stills, ensure gallery has been built. */
  if (page === 'stills') ensureStillsBuilt();
}

/* Click any element with [data-go] to navigate. */
document.addEventListener('click', e => {
  const link = e.target.closest('[data-go]');
  if (!link) return;
  e.preventDefault();
  goToPage(link.dataset.go);
});

/* Browser back/forward */
window.addEventListener('popstate', e => {
  const page = (e.state && e.state.page) || (location.hash || '').replace('#', '') || 'home';
  goToPage(page, { push: false });
});

/* Honor an existing hash on load (e.g. someone bookmarked /#stills, or was
   sent a direct link to one photo: /#stills/wildlife/DSCF2774.jpg) */
(function initRoute() {
  const hash = location.hash || '';
  const initial = hash.replace('#', '').split('/')[0] || 'home';
  document.body.dataset.page = VALID_PAGES.has(initial) ? initial : 'home';
})();

/* ── CONTENT JSON (editable site copy) ─────────────────────── */
let siteContent = {};
fetch('content.json', { cache: 'no-cache' })
  .then(r => r.ok ? r.json() : {})
  .then(j => {
    siteContent = j;
    applySiteContent();
  })
  .catch(err => console.warn('[content] load failed:', err));

function applySiteContent() {
  /* Update hero name */
  if (siteContent.name) {
    const nameEl = document.querySelector('.home-name');
    if (nameEl) nameEl.textContent = siteContent.name;
  }
  /* Update projects data (used by the project detail renderer) */
  if (siteContent.projects && typeof projects === 'object') {
    Object.entries(siteContent.projects).forEach(([key, vals]) => {
      if (!projects[key]) return;
      if (vals.title)    projects[key].title    = vals.title;
      if (vals.category) projects[key].category = vals.category;
      if (vals.desc)     projects[key].desc     = vals.desc;
    });
    /* Refresh the proj-strip labels in place */
    document.querySelectorAll('.proj-strip').forEach(strip => {
      const k = strip.dataset.project;
      const c = siteContent.projects[k];
      if (!c) return;
      const name = strip.querySelector('.proj-strip-name');
      const cat  = strip.querySelector('.proj-strip-cat');
      if (name && c.title)    name.textContent = c.title;
      if (cat  && c.category) cat.textContent  = c.category;
    });
  }
}

/* ── ADMIN PANEL ────────────────────────────────────────────── */
const adminPanelEl = document.getElementById('adminPanel');
const adminFabEl   = document.getElementById('adminFab');

function openAdmin()  {
  adminPanelEl?.classList.add('open');
  buildAdminContent();
  buildAdminCaptionBrowser();
  buildAdminVideoBrowser();
}
function closeAdmin() { adminPanelEl?.classList.remove('open'); }

adminFabEl?.addEventListener('click', openAdmin);
document.getElementById('adminClose')?.addEventListener('click', closeAdmin);
document.getElementById('adminExit')?.addEventListener('click', () => {
  localStorage.removeItem(ADMIN_KEY);
  document.body.classList.remove('admin-mode');
  closeAdmin();
  /* Hard reload to clear any admin-only state */
  location.href = location.pathname + (location.hash || '');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && adminPanelEl?.classList.contains('open')) closeAdmin();
});

/* Tab switching */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    document.querySelector(`.admin-section[data-section="${tab.dataset.tab}"]`)?.classList.add('active');
  });
});

/* Build the Photo Captions editor. Per category, list every photo with thumb
   + caption input. Edits autosave on blur. */
function buildAdminCaptionBrowser() {
  const host = document.getElementById('adminCaptionBrowser');
  if (!host) return;
  host.innerHTML = '';
  Object.keys(galleryData).forEach(cat => {
    const paths = galleryData[cat] || [];
    if (!paths.length) return;
    const group = document.createElement('div');
    group.className = 'admin-group';
    const head = document.createElement('div');
    head.className = 'admin-group-title';
    head.textContent = `${cat} — ${paths.length} photos`;
    group.appendChild(head);
    paths.forEach(path => {
      const row = document.createElement('div');
      row.className = 'admin-photo-row';
      row.innerHTML = `
        <img src="${BASE}${path}" alt="" loading="lazy"/>
        <input type="text" class="admin-photo-cap" placeholder="Add caption…" value="${(galleryCaptions[path] || '').replace(/"/g,'&quot;')}"/>
      `;
      const input = row.querySelector('.admin-photo-cap');
      input.addEventListener('input', () => { galleryCaptions[path] = input.value; });
      input.addEventListener('blur',  () => autoSaveCaptions());
      group.appendChild(row);
    });
    host.appendChild(group);
  });
}

/* Build the Video Title editor. Per project + tab, list every video with thumb
   + title input. Edits autosave on blur. */
function buildAdminVideoBrowser() {
  const host = document.getElementById('adminVideoBrowser');
  if (!host) return;
  host.innerHTML = '';
  Object.entries(videoData || {}).forEach(([projKey, projVal]) => {
    if (projKey.startsWith('_')) return;
    const group = document.createElement('div');
    group.className = 'admin-group';
    const head = document.createElement('div');
    head.className = 'admin-group-title';
    head.textContent = projKey;
    group.appendChild(head);
    const renderList = (list, tabLabel) => {
      if (!list.length) return;
      if (tabLabel) {
        const sub = document.createElement('div');
        sub.className = 'admin-subgroup-title';
        sub.textContent = tabLabel;
        group.appendChild(sub);
      }
      list.forEach((v, i) => {
        const row = document.createElement('div');
        row.className = 'admin-video-row';
        const poster = v.poster || '';
        row.innerHTML = `
          ${poster ? `<img src="${poster}" alt="" loading="lazy"/>` : '<div class="admin-video-row-noimg">no poster</div>'}
          <input type="text" class="admin-video-title" placeholder="Title…" value="${(v.title || '').replace(/"/g,'&quot;')}"/>
        `;
        const input = row.querySelector('.admin-video-title');
        input.addEventListener('input', () => { v.title = input.value; });
        input.addEventListener('blur',  () => autoSaveVideos(projKey, tabLabel || null, list));
        group.appendChild(row);
      });
    };
    if (Array.isArray(projVal)) {
      renderList(projVal, null);
    } else if (typeof projVal === 'object') {
      Object.entries(projVal).forEach(([tabSlug, list]) => {
        renderList(list, tabSlug);
      });
    }
    host.appendChild(group);
  });
}

/* Build the Site Copy form from current siteContent */
function buildAdminContent() {
  const form = document.getElementById('adminContentForm');
  if (!form) return;
  form.innerHTML = '';

  /* Name field */
  form.appendChild(adminField({ label: 'Site Name (top of home page)', key: 'name', val: siteContent.name || '', type: 'input' }));

  /* Project fields */
  if (siteContent.projects) {
    Object.entries(siteContent.projects).forEach(([key, vals]) => {
      const group = document.createElement('div');
      group.className = 'admin-group';
      const title = document.createElement('div');
      title.className = 'admin-group-title';
      title.textContent = vals.title || key;
      group.appendChild(title);
      group.appendChild(adminField({ label: 'Title',    key: `projects.${key}.title`,    val: vals.title    || '', type: 'input' }));
      group.appendChild(adminField({ label: 'Category', key: `projects.${key}.category`, val: vals.category || '', type: 'input' }));
      group.appendChild(adminField({ label: 'Description', key: `projects.${key}.desc`,  val: vals.desc     || '', type: 'textarea' }));
      form.appendChild(group);
    });
  }
}

function adminField({ label, key, val, type }) {
  const wrap = document.createElement('div');
  wrap.className = 'admin-field';
  const lbl = document.createElement('label');
  lbl.textContent = label;
  wrap.appendChild(lbl);
  const input = document.createElement(type === 'textarea' ? 'textarea' : 'input');
  input.dataset.key = key;
  input.value = val;
  wrap.appendChild(input);
  return wrap;
}

/* Save site copy */
document.getElementById('adminSaveContent')?.addEventListener('click', async () => {
  const btn = document.getElementById('adminSaveContent');
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';

  const updated = JSON.parse(JSON.stringify(siteContent || {}));
  document.querySelectorAll('#adminContentForm [data-key]').forEach(inp => {
    const path = inp.dataset.key.split('.');
    let target = updated;
    for (let i = 0; i < path.length - 1; i++) {
      target[path[i]] = target[path[i]] || {};
      target = target[path[i]];
    }
    target[path[path.length - 1]] = inp.value;
  });

  try {
    const res = await fetch('/api/save-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (!res.ok) throw new Error('save ' + res.status);
    siteContent = updated;
    applySiteContent();
    btn.textContent = '✓ Saved → content.json';
  } catch (err) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(updated, null, 2));
      siteContent = updated;
      applySiteContent();
      btn.textContent = '✓ Copied — paste into content.json';
    } catch {
      btn.textContent = '✗ Save failed';
      console.error('[admin] content save failed:', err);
    }
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2400);
});

/* ── TOP-LEFT CONTACT TRIGGER (opens contact form modal) ────── */
document.querySelectorAll('[data-action="contact"]').forEach(btn => {
  btn.addEventListener('click', e => {
    e.preventDefault();
    if (typeof openCF === 'function') openCF();
  });
});

/* ── HERO WORD HOVER REVEAL ─────────────────────────────────── */
/* Hovering a lower-third word fades that section's preview image in
   over the default hero background. Leaving any word clears it. */
const heroHomeEl = document.querySelector('.page--home');
if (heroHomeEl) {
  heroHomeEl.querySelectorAll('.hero-word').forEach(word => {
    const key = word.dataset.for;
    word.addEventListener('mouseenter', () => {
      heroHomeEl.classList.add('preview-active', 'preview-' + key);
    });
    word.addEventListener('mouseleave', () => {
      heroHomeEl.classList.remove('preview-active', 'preview-' + key);
    });
  });
}

/* ── GALLERY DATA ───────────────────────────────────────────── */
const BASE = 'images/gallery/';

/* galleryData is populated at runtime from images/gallery/manifest.json.
   To refresh: drop photos into images/gallery/<category>/ and run:
     python3 generate-manifest.py
   Folder name == category key: landscape, wildlife, sports, street,
   portrait, product.

   Each entry is { p: "landscape/DSCF1234.jpg", w, h, feat? } where `p` is
   the original's path — the stable id used by captions and ordering. The
   images actually served are the web-sized derivatives under _web/. */
let galleryData = { landscape: [], wildlife: [], sports: [], street: [], portrait: [], product: [] };

/* Originals are 10-35 MB each, so the site never loads them directly:
   the grid gets ~900px thumbs and the lightbox gets ~2400px versions. */
function derivedSrc(path, size) {
  const slash = path.indexOf('/');
  const folder = path.slice(0, slash);
  const stem = path.slice(slash + 1).replace(/\.[^.]+$/, '');
  return `${BASE}_web/${folder}/${size}/${stem}.jpg`;
}
const thumbSrc = path => derivedSrc(path, 'thumb');
const fullSrc  = path => derivedSrc(path, 'full');

/* Accepts both the current object entries and the older plain-string
   manifest, so a stale manifest.json still renders. */
const entryPath = e => (typeof e === 'string' ? e : e.p);
let galleryReady = false;

/* Per-image captions, keyed by image path (e.g. "wildlife/DSCF2774.jpg"). */
let galleryCaptions = {};
fetch(BASE + 'captions.json', { cache: 'no-cache' })
  .then(r => r.ok ? r.json() : {})
  .then(j => { galleryCaptions = j; })
  .catch(() => {});

async function loadGalleryManifest() {
  try {
    const res = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest fetch ' + res.status);
    galleryData = await res.json();
    galleryReady = true;
    /* If the stills page is currently visible, re-render with fresh data. */
    if (document.body.dataset.page === 'stills' && typeof renderStills === 'function') {
      /* A direct photo link takes priority — open that exact frame. */
      if (!(location.hash.startsWith('#stills/') && openPhotoFromHash(location.hash))) {
        renderStills(currentStillsCat || 'featured');
      }
    }
    /* If a gallery-backed project (e.g. VIZION) is open, rebuild it now. */
    if (document.body.classList.contains('proj-detail-open')) {
      const active = document.querySelector('.proj-strip.active');
      const key = active?.dataset.project;
      if (key && projects[key] && projects[key].gallery && typeof buildProjectDetail === 'function') {
        buildProjectDetail(key);
      }
    }
  } catch (err) {
    console.warn('[gallery] manifest load failed:', err);
  }
}
loadGalleryManifest();

/* ── GALLERY BUILD + DRAG (admin-only reorder) ──────────────── */
/* Drag-to-reorder is gated behind ?admin=1 so public visitors can't change
   the order. The admin flag is persisted to localStorage so you only need to
   visit ?admin=1 once on your machine. Add ?admin=0 to disable. */
const ADMIN_KEY = 'mw_admin';
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('admin')) {
  if (urlParams.get('admin') === '0') localStorage.removeItem(ADMIN_KEY);
  else                                 localStorage.setItem(ADMIN_KEY, '1');
}
const IS_ADMIN = localStorage.getItem(ADMIN_KEY) === '1';
if (IS_ADMIN) document.body.classList.add('admin-mode');

let dragSrc = null;

function saveOrder(category, grid) {
  const paths = [...grid.querySelectorAll('.gallery-item')].map(el => el.dataset.path);
  localStorage.setItem('gallery_order_' + category, JSON.stringify(paths));
}

/* Admin helper: save the current visible order. Tries the local dev-server's
   /api/save-order endpoint first (writes straight to manifest.json). If that
   isn't available (e.g. on the live site or with plain http.server), falls
   back to copying the order to the clipboard so you can paste it into the
   manifest manually. */
async function saveAdminOrder(category, grid, btn) {
  const paths = [...grid.querySelectorAll('.gallery-item')].map(el => el.dataset.path);
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, paths }),
    });
    if (res.ok) {
      btn.textContent = `✓ Saved ${paths.length} → manifest.json`;
      console.log(`[admin] saved "${category}" (${paths.length} paths) to manifest.json`);
      setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2200);
      return;
    }
    throw new Error('dev-server returned ' + res.status);
  } catch (err) {
    /* Fallback: clipboard. */
    try {
      await navigator.clipboard.writeText(JSON.stringify(paths, null, 2));
      btn.textContent = `✓ Copied ${paths.length} — paste into manifest.json`;
      console.log(`[admin] no dev-server — copied "${category}" order to clipboard`);
    } catch (e) {
      btn.textContent = '✗ Save failed (see console)';
      console.error('[admin] save + clipboard both failed:', err, e);
    }
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2800);
  }
}

/* Admin: flag/unflag a photo for the Featured tab. Writes to manifest.json
   through the dev-server, and keeps the in-memory copy in sync so switching
   to Featured reflects the change without a reload. */
async function saveFeatured(path, featured) {
  try {
    const res = await fetch('/api/save-featured', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, featured }),
    });
    if (!res.ok) throw new Error('server returned ' + res.status);
    const { total } = await res.json();

    for (const entries of Object.values(galleryData)) {
      const hit = entries.find(e => entryPath(e) === path);
      if (hit) { if (featured) hit.feat = true; else delete hit.feat; }
    }
    /* Featured is derived, so force it to rebuild next time it's opened. */
    const panel = document.getElementById('stills-panel-featured');
    if (panel) { panel.remove(); }

    flashAdminToast(`${featured ? '★ Added to' : '☆ Removed from'} Featured (${total} total)`);
  } catch (e) {
    console.warn('[admin] featured save failed:', e);
    flashAdminToast('✗ Featured save failed — is dev-server.py running?');
  }
}

/* Silent autosave for photo order: fires on drag-end, no UI. */
async function autoSaveAdminOrder(category, grid) {
  const paths = [...grid.querySelectorAll('.gallery-item')].map(el => el.dataset.path);
  try {
    await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, paths }),
    });
    flashAdminToast(`Saved ${category} (${paths.length})`);
  } catch (e) {
    console.warn('[admin] autosave failed:', e);
  }
}

/* Silent autosave for video order/titles: fires on drag-end or input blur. */
async function autoSaveVideos(project, tabLabel, list) {
  const tabSlug = tabLabel ? slugify(tabLabel) : null;
  try {
    await fetch('/api/save-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, tab: tabSlug, videos: list }),
    });
    flashAdminToast(`Saved ${project}/${tabSlug || ''} (${list.length})`);
  } catch (e) {
    console.warn('[admin] video autosave failed:', e);
  }
}

/* Silent autosave for captions. */
async function autoSaveCaptions() {
  const out = {};
  Object.entries(galleryCaptions).forEach(([k, v]) => { if (v && v.trim()) out[k] = v.trim(); });
  try {
    await fetch('/api/save-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
    });
    flashAdminToast(`Captions saved (${Object.keys(out).length})`);
    /* If the stills page is currently open, rebuild it so the new caption
       text is wired into the items. (Doesn't auto-show — still hover-only.) */
    if (document.body.dataset.page === 'stills' && typeof renderStills === 'function') {
      renderStills(currentStillsCat || 'featured');
    }
  } catch (e) {
    console.warn('[admin] captions autosave failed:', e);
  }
}

/* Small admin-only toast that briefly confirms a silent save. */
function flashAdminToast(msg) {
  if (!IS_ADMIN) return;
  let toast = document.getElementById('adminToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'adminToast';
    toast.className = 'admin-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = '✓ ' + msg;
  toast.classList.add('show');
  clearTimeout(flashAdminToast._t);
  flashAdminToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

/* Save the in-memory galleryCaptions map to disk via dev-server (or fall back
   to clipboard if no dev-server). Used by the admin-panel Captions editor. */
async function saveCaptions(btn) {
  const original = btn.textContent;
  btn.disabled = true; btn.textContent = 'Saving…';
  /* Prune empty entries so the file stays small */
  const out = {};
  Object.entries(galleryCaptions).forEach(([k, v]) => { if (v && v.trim()) out[k] = v.trim(); });
  try {
    const res = await fetch('/api/save-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out),
    });
    if (!res.ok) throw new Error('save-captions ' + res.status);
    btn.textContent = `✓ Saved ${Object.keys(out).length} captions`;
  } catch (err) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(out, null, 2));
      btn.textContent = `✓ Copied — paste into captions.json`;
    } catch {
      btn.textContent = '✗ Save failed';
      console.error('[admin] caption save failed:', err);
    }
  }
  setTimeout(() => { btn.disabled = false; btn.textContent = original; }, 2400);
}

/* Tag portrait gallery items with .tall so CSS spans them across 2 rows —
   gives the stills page a tight mosaic feel (no dead space). */
function setGallerySpan(item, entry) {
  if (document.body.classList.contains('admin-mode')) {
    item.classList.remove('tall'); return;
  }
  /* Dimensions come from the manifest, so orientation is known before the
     image loads — no reflow once it arrives. */
  if (entry && entry.w && entry.h) {
    item.classList.toggle('tall', entry.h > entry.w * 1.05);
    return;
  }
  const img = item.querySelector('img');
  if (!img) return;
  const tag = () => {
    if (img.naturalWidth && img.naturalHeight) {
      const portrait = img.naturalHeight > img.naturalWidth * 1.05;
      item.classList.toggle('tall', portrait);
    }
  };
  if (img.complete) tag(); else img.addEventListener('load', tag, { once: true });
}

/* Real photo categories — skips `product` (it lives under VIZION) and any
   bookkeeping key like _featuredOrder. */
function photoCategories() {
  return Object.entries(galleryData)
    .filter(([k]) => !k.startsWith('_') && k !== 'product');
}

/* Photos flagged "feat": true. If a custom Featured order has been saved
   (via Arrange), that wins; otherwise they're interleaved so consecutive
   frames come from different categories. Until anything is flagged, shows
   an even spread of the library so the tab is never empty. */
function collectFeatured() {
  const cats = photoCategories();
  const starred = cats.flatMap(([, v]) => v.filter(e => e && e.feat));

  if (starred.length) {
    const saved = galleryData._featuredOrder;
    if (Array.isArray(saved) && saved.length) {
      const byPath = new Map(starred.map(e => [entryPath(e), e]));
      const ordered = saved.map(p => byPath.get(p)).filter(Boolean);
      /* Anything starred since the order was saved goes on the end. */
      const seen = new Set(ordered.map(entryPath));
      return [...ordered, ...starred.filter(e => !seen.has(entryPath(e)))];
    }
    return interleave(cats.map(([, v]) => v.filter(e => e && e.feat)));
  }

  /* Nothing curated yet — take an even spread from each category. */
  const PER_CATEGORY = 6;
  return interleave(cats.map(([, v]) => {
    const step = Math.max(1, Math.floor(v.length / PER_CATEGORY));
    return v.filter((_, i) => i % step === 0).slice(0, PER_CATEGORY);
  }));
}

function interleave(arrays) {
  const out = [];
  const maxLen = Math.max(...arrays.map(a => a.length), 0);
  for (let i = 0; i < maxLen; i++) {
    arrays.forEach(a => { if (a[i]) out.push(a[i]); });
  }
  return out;
}

function buildPanel(category, explicitPanel) {
  /* Use the explicit panel element when provided (avoids ID-lookup ambiguity
     when the same gallery category appears in multiple places — e.g.
     VIZION inside the project overlay AND the Stills page). */
  const panel = explicitPanel || document.getElementById('modal-panel-' + category);
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = 'true';

  let entries;
  if (category === 'featured') {
    /* The hand-picked set — photos flagged "feat": true in manifest.json.
       Interleaved across categories so the opening view stays varied.
       Falls back to a sample of everything if nothing's flagged yet. */
    entries = collectFeatured();
  } else if (category === 'all') {
    /* Interleave all categories — but exclude `product`, which now lives
       under the VIZION project rather than in Stills. */
    const arrays = photoCategories().map(([, v]) => v);
    const maxLen = Math.max(...arrays.map(a => a.length), 0);
    entries = [];
    for (let i = 0; i < maxLen; i++) {
      arrays.forEach(arr => { if (arr[i]) entries.push(arr[i]); });
    }
  } else if (IS_ADMIN) {
    /* Admins see their in-progress order from localStorage. */
    const saved = localStorage.getItem('gallery_order_' + category);
    const byPath = new Map((galleryData[category] || []).map(e => [entryPath(e), e]));
    entries = saved
      ? JSON.parse(saved).map(p => byPath.get(p) || { p }).filter(Boolean)
      : (galleryData[category] || []);
  } else {
    /* Public always sees the canonical order from manifest.json. */
    entries = galleryData[category] || [];
  }

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  entries.forEach(entry => {
    const path = entryPath(entry);
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.path = path;
    item.dataset.full = fullSrc(path);
    /* Not draggable: reordering lives in the Arrange overlay. */

    const img = document.createElement('img');
    img.src = thumbSrc(path);
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    /* Intrinsic size lets the browser reserve space before the image loads. */
    if (entry.w && entry.h) { img.width = entry.w; img.height = entry.h; }
    /* Drives the tile's width in the filmstrip (see .gallery-item in CSS)
       and reserves correct space in the mobile masonry. */
    item.style.aspectRatio = entry.w && entry.h ? `${entry.w} / ${entry.h}` : '3 / 2';
    /* Tag portrait orientation for mosaic packing */
    setGallerySpan(item, entry);

    const overlay = document.createElement('div');
    overlay.className = 'gallery-overlay';

    /* Caption: read-only on hover for everyone. Editing is in the admin panel. */
    const captionWrap = document.createElement('div');
    captionWrap.className = 'gallery-caption';
    const captionText = galleryCaptions[path];
    if (captionText) {
      const span = document.createElement('span');
      span.className = 'gallery-caption-text';
      span.textContent = captionText;
      captionWrap.appendChild(span);
    } else {
      captionWrap.classList.add('gallery-caption--empty');
    }

    item.append(img, overlay, captionWrap);

    /* Admin: a star in the corner toggles this photo into the Featured tab.
       Writes straight to manifest.json via the dev-server. */
    if (IS_ADMIN) {
      const star = document.createElement('button');
      star.className = 'gallery-star' + (entry.feat ? ' is-featured' : '');
      star.title = entry.feat ? 'Remove from Featured' : 'Add to Featured';
      star.textContent = entry.feat ? '★' : '☆';
      star.addEventListener('click', async ev => {
        ev.stopPropagation();          /* don't open the lightbox */
        const next = !star.classList.contains('is-featured');
        star.classList.toggle('is-featured', next);
        star.textContent = next ? '★' : '☆';
        star.title = next ? 'Remove from Featured' : 'Add to Featured';
        entry.feat = next || undefined;
        await saveFeatured(path, next);
      });
      item.appendChild(star);
    }

    grid.appendChild(item);

    item.addEventListener('click', () => openLightbox(item.dataset.full, item));
  });

  /* Reordering happens in the Arrange overlay, not here.
     Dragging inside this grid used to be possible but was broken two ways:
     splitStillsIntoRows() moves items into .gallery-row wrappers, so
     grid.insertBefore() threw on every dragover; and saving read DOM order,
     which after the split is "all even-indexed, then all odd" — so a drop
     silently scrambled the whole category. Arrange works on a flat list
     and writes an order that matches what you see. */

  panel.appendChild(grid);
  addHoverCursor(panel.querySelectorAll('.gallery-item'));
}

/* ── STILLS PAGE (inline gallery) ───────────────────────────── */
const stillsContent = document.getElementById('stillsContent');
let currentStillsCat = 'featured';

function renderStills(category) {
  if (!stillsContent) return;
  currentStillsCat = category;
  stillsContent.innerHTML = `<div class="gallery-panel gallery-panel--stills" id="stills-panel-${category}"></div>`;
  const panel = stillsContent.querySelector('.gallery-panel');
  buildPanel(category, panel);
  /* Split flat list of items into 2 alternating rows for clean 2-row filmstrip */
  splitStillsIntoRows();
  stillsContent.scrollLeft = 0;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === category);
  });
}

function splitStillsIntoRows() {
  const grid = stillsContent.querySelector('.gallery-grid');
  if (!grid) return;
  const items = [...grid.querySelectorAll(':scope > .gallery-item')];
  if (!items.length) return;
  const row1 = document.createElement('div'); row1.className = 'gallery-row';
  const row2 = document.createElement('div'); row2.className = 'gallery-row';
  items.forEach((item, i) => {
    /* Strip masonry-leftover class; this layout doesn't use it. */
    item.classList.remove('tall');
    (i % 2 === 0 ? row1 : row2).appendChild(item);
  });
  grid.innerHTML = '';
  grid.append(row1, row2);
  sizeStillsGrid();
}

/* Give the filmstrip an explicit width.

   Leaving it to `width: max-content` is circular here: the grid is a column
   of rows whose item widths come from aspect-ratio × row height, but the row
   height depends on the grid. Browsers resolve that inconsistently — it came
   out far too wide for landscape-heavy sets (a long empty scroll runway) and
   too narrow for portrait-heavy ones (photos clipped off the end).

   Each row's width is just the sum of its items plus the gaps, so measure it
   and set it. */
function sizeStillsGrid() {
  const grid = stillsContent?.querySelector('.gallery-grid');
  if (!grid) return;
  const rows = [...grid.querySelectorAll('.gallery-row')];
  if (!rows.length) return;

  grid.style.width = 'auto';          /* release any previous value first */

  const widest = Math.max(...rows.map(row => {
    const kids = [...row.children];
    if (!kids.length) return 0;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    const total = kids.reduce((sum, k) => sum + k.getBoundingClientRect().width, 0);
    return total + gap * (kids.length - 1);
  }));

  if (widest > 0) grid.style.width = Math.ceil(widest) + 'px';
}

/* Row height changes with the viewport, and item widths follow it. */
let stillsResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(stillsResizeTimer);
  stillsResizeTimer = setTimeout(sizeStillsGrid, 150);
});

function ensureStillsBuilt() {
  if (!stillsContent) return;
  if (!stillsContent.children.length) renderStills(currentStillsCat);
}

/* The desktop filmstrip scrolls sideways, but a mouse wheel and a trackpad
   two-finger swipe are usually vertical — translate that into horizontal
   movement so the gallery responds to the gesture people actually make.
   Left untouched on the mobile layout, which genuinely scrolls vertically. */
if (stillsContent) {
  stillsContent.addEventListener('wheel', e => {
    /* Mobile stills is a normal vertical column — leave it alone. */
    if (window.matchMedia('(max-width: 780px)').matches) return;
    /* Respect a deliberate horizontal gesture; only convert vertical ones. */
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

    const max = stillsContent.scrollWidth - stillsContent.clientWidth;
    if (max <= 0) return;

    /* Let the page do its thing once we've hit either end. */
    const atStart = stillsContent.scrollLeft <= 0 && e.deltaY < 0;
    const atEnd   = stillsContent.scrollLeft >= max - 1 && e.deltaY > 0;
    if (atStart || atEnd) return;

    e.preventDefault();
    stillsContent.scrollLeft += e.deltaY;
  }, { passive: false });
}

/* Wire filter buttons */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => renderStills(btn.dataset.cat));
});

/* If user visits #stills directly, build it on initial load too. */
if (document.body.dataset.page === 'stills') ensureStillsBuilt();

/* (The wheel → horizontal-scroll handler lives with the Stills code above.) */

/* ── PROJECT DATA ───────────────────────────────────────────── */
/*
 * Each project can have:
 *   img   — thumbnail (used on work card and as fallback in modal)
 *   video — single video URL: YouTube embed URL, Vimeo embed URL, or local path like '/videos/film.mp4'
 *   tabs  — array of sub-categories shown as tabs inside the modal
 *           Each tab: { label, img, video, desc }
 *           video can be a YouTube/Vimeo embed URL or a local .mp4 path
 */
const projects = {
  film: {
    title: 'Days Until College',
    category: 'Short Film',
    roles: ['Lead Producer', 'Assistant Director', 'Temp. Score Composer'],
    desc: 'Two best friends, Sam and Teddy, find their lifelong friendship on the line as they navigate a tumultuous summer of questionable decisions and questionable relationships, all while preparing for the wild adventure that is college life.',
    award: 'LA Shorts — Gold Laurel',
    awardImg: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/8013b8bf-d136-4a08-bdc2-1f14a4a9c107/LAShorts%2BLaurel%2B-%2BGOLD.png',
    img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/3185d8c5-0532-451d-9165-e431b5791dac/IMG_3583.jpeg?format=1500w',
    video: 'https://www.youtube.com/embed/H2UyrPUpN9c',
  },
  redsox: {
    title: 'Boston Red Sox',
    category: 'Sports Media · Videographer / Editor',
    logoImg: 'https://a.espncdn.com/i/teamlogos/mlb/500/bos.png',
    roles: ['Videographer', 'Editor'],
    desc: 'Internship with the Boston Red Sox media team — producing, shooting, and editing video content across music videos, game highlights, community outreach, and social media.',
    img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/2c334bff-a5c2-48dc-bbe9-0ab0e4d65e6a/tempImagec4GdF8.jpg',
    tabs: [
      {
        label: 'Music Videos',
        img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/1735249180505-W960E4NRFIFTO1SE8886/Screenshot+2024-12-26+at+13.29.23.png',
        video: null,
        desc: 'Produced and edited music video content for the Boston Red Sox, blending cinematic visuals with the energy and culture of the team.',
      },
      {
        label: 'Highlights',
        img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/1735251312314-4PV6YRM1CTHX718FN20R/s3___bgmp-arc_arc-feeds_generic-photos_to-arc_DavisSoxAstros22-642df9c7ee9cb.jpg',
        video: null,
        desc: 'Shot and edited game highlight packages capturing key moments, athlete performances, and the atmosphere of Fenway Park.',
      },
      {
        label: 'Community',
        img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/1735253732136-P39LOL4YRJMFJEENVMBN/Screenshot+2024-12-26+at+14.55.04.png',
        video: null,
        desc: 'Documented the Red Sox community initiatives, telling the stories of outreach programs and the team\'s impact beyond the diamond.',
      },
      {
        label: 'Social Media',
        img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/1735261887772-WHJ9LL3H23UWMSUWM9QY/2a80bbf53f3c1d65a36c42c2bf063508.jpg',
        video: null,
        desc: 'Created short-form vertical content optimized for Instagram and other platforms, driving engagement for one of MLB\'s most storied franchises.',
      },
    ],
  },
  usc: {
    title: 'USC Athletics',
    category: 'Sports Content · Multi-Role',
    logoImg: 'https://a.espncdn.com/i/teamlogos/ncaa/500/30.png',
    roles: [
      'Technical Director — NCAA Women\'s Soccer Playoffs',
      'Technical Director — Trojan\'s Live with Lincoln Riley',
      'Videographer — Basketball',
      'Broadcast Camera Operator — Baseball',
    ],
    desc: 'Multi-role contributor to USC Athletics — editing and producing Water Polo content, technical directing live broadcasts, and operating cameras for basketball and baseball coverage.',
    img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/b4ac4653-7390-4666-9f8d-4efaba9f8489/thumbnail',
    tabs: [
      {
        label: 'Water Polo',
        img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/b4ac4653-7390-4666-9f8d-4efaba9f8489/thumbnail',
        video: null,
        desc: 'Editor — Edited and produced social media highlight packages and Mic\'d Up features for USC Water Polo, including game highlights, goal saves, and behind-the-scenes content with the head coach and team captains.',
      },
    ],
  },
  brew: {
    title: 'The Morning Brew',
    category: 'Trojan Vision · Host / Senior Producer',
    logoImg: 'images/projects/Morning-Brew-Primary-Logo-Pink.png',
    logoOnly: true,    /* render logo INSTEAD of title text */
    roles: ['Host', 'Senior Producer'],
    desc: 'A live USC student-produced morning show on Trojan Vision. As Senior Producer, oversaw the full production of the show. As Host of the Delish segment, led on-camera food and taste-test features across four episodes.',
    segmentLabel: 'Delish Segment',
    img: 'images/projects/_web/the-morning-brew-bts.jpg',
    tabs: [
      {
        label: 'Cheap vs. Expensive',
        img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/0fcc0b3a-54dd-4b3f-84fd-9cd78368402c/thumbnail',
        video: null,
        desc: 'Delish — Hosted a blind taste-test showdown comparing cheap vs. expensive versions of the same food.',
      },
      {
        label: 'Tap Water',
        img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/2efbc126-fb67-4e6e-ba85-9c84a4d976ac/thumbnail',
        video: null,
        desc: 'Delish — Hosted a segment putting different tap waters to the test in a blind taste comparison.',
      },
      {
        label: 'Smoothies',
        img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/17a82d27-f860-4fe1-b530-f2781c313300/thumbnail',
        video: null,
        desc: 'Delish — Hosted a smoothie taste-off featuring a range of blends, from health-store staples to homemade creations.',
      },
      {
        label: 'Doughnuts',
        img: 'https://video.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/2de7f35a-21bf-4da1-910e-28ad268d5fe0/thumbnail',
        video: null,
        desc: 'Delish — Hosted a doughnut taste-test ranking local and chain favorites head-to-head.',
      },
    ],
  },
  freelance: {
    title: 'Freelance',
    category: 'Independent Work · Multi-role',
    desc: 'A collection of freelance photo and video work spanning commercial, documentary, event, and narrative formats — always with a distinct visual perspective.',
    img: 'https://images.squarespace-cdn.com/content/v1/676dbe11e77f9863643f12c3/691125a0-2f3f-4923-b415-d58ea3c017a1/IMG_3725.jpeg?format=1500w',
    /* Renders a slideshow. Each slide is a freelance project; clicking opens its gallery.
       Add new entries here as new freelance work comes in. */
    slideshow: true,
    slides: [
      {
        title: 'Shangri La Museum',
        subtitle: 'Cinematic Walkthrough · Oahu, Hawaii',
        cover: 'videos/freelance/Shangri_la Sizzle.jpg',
        video: 'https://vimeo.com/1194799388',
        desc: 'A cinematic walkthrough of the Shangri La Museum estate in Oahu, Hawaii — highlighting key art pieces and the architecture of Doris Duke\'s former home.',
      },
      {
        title: 'VIZION',
        subtitle: 'Startup Photo Campaign',
        cover: 'images/projects/_web/VZN-11.jpg',
        gallery: 'product',
        desc: 'Brand photo campaign for VIZION — a startup eyewear company. Editorial product shots and identity-driven imagery shot across multiple sessions.',
      },
    ],
  },
};

/* ── VIDEO MANIFEST (videos/links.json) ─────────────────────── */
let videoData = {};
fetch('videos/links.json', { cache: 'no-cache' })
  .then(r => r.ok ? r.json() : {})
  .then(j => { videoData = j; })
  .catch(err => console.warn('[videos] links.json load failed:', err));

function slugify(s) {
  return String(s || '').toLowerCase().trim()
    .replace(/['']/g, '').replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function youtubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:embed\/|watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function vimeoId(url) {
  const m = String(url).match(/vimeo\.com\/(?:video\/|channels\/[^/]+\/)?(\d+)/);
  return m ? m[1] : null;
}
function videoEmbedUrl(item) {
  const url = item.url;
  if (!url) return null;
  if (/\.(mp4|webm|mov)$/i.test(url)) return url; /* local file */
  const yt = youtubeId(url);
  if (yt) return `https://www.youtube.com/embed/${yt}?rel=0&modestbranding=1`;
  const vm = vimeoId(url);
  if (vm) return `https://player.vimeo.com/video/${vm}`;
  return url; /* assume already-embeddable */
}
function videoPoster(item) {
  if (item.poster) return item.poster;
  const yt = youtubeId(item.url);
  if (yt) return `https://img.youtube.com/vi/${yt}/maxresdefault.jpg`;
  return null; /* caller handles missing poster */
}
function videosFor(projectKey, tabLabel) {
  const proj = videoData[projectKey];
  if (!proj) return [];
  if (Array.isArray(proj)) return proj; /* single-list project like freelance */
  const list = proj[slugify(tabLabel)];
  return Array.isArray(list) ? list : [];
}

/* ── WORK ACCORDION ─────────────────────────────────────────── */
/* Renders into the media slot:
   - If the project/tab has 2+ videos in videos/links.json → thumbnail grid,
     click a thumbnail to play inline.
   - If exactly 1 video → embed it directly.
   - Otherwise falls back to the static img.                                */
function setAccordMedia(el, { img, video }, projectKey, tabLabel) {
  const videos = videosFor(projectKey, tabLabel);
  const list = videos.length ? videos : (video ? [{ url: video }] : []);

  const ctx = { project: projectKey, tabLabel: tabLabel };

  if (list.length > 1) {
    renderVideoGrid(el, list, ctx);
    return;
  }

  if (list.length === 1) {
    playVideoIn(el, list[0], list, /*withBack=*/false, ctx);
    return;
  }

  if (img) {
    el.innerHTML = `<div class="accord-img-wrap"><img src="${img}" alt=""/></div>`;
  }
}

/* Aspect-ratio string for inline style, derived from manifest w/h. */
function aspectFor(v) {
  if (v.w && v.h) return `${v.w} / ${v.h}`;
  /* YouTube embeds default to 16:9; same for unknown */
  return '16 / 9';
}

/* Drag-and-drop state for the video grid (admin only). */
let videoDragSrc = null;

function buildThumbCard(v, el, list, ctx) {
  const card = document.createElement('div');
  card.className = 'video-thumb';
  card.style.aspectRatio = aspectFor(v);
  /* Stash a reference to the video object so we can re-collect on save. */
  card._video = v;

  const poster = videoPoster(v);
  const posterHtml = poster
    ? `<img src="${poster}" alt="" loading="lazy"/>`
    : `<div class="video-thumb-fallback">${(v.title || 'Play').slice(0, 40)}</div>`;

  /* Video title is read-only everywhere. Editing happens in the admin panel. */
  const titleHtml = v.title ? `<div class="video-thumb-title">${v.title}</div>` : '';

  card.innerHTML = `
    ${posterHtml}
    <div class="video-thumb-overlay"></div>
    <svg class="video-thumb-play" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="30" fill="rgba(13,11,9,0.6)" stroke="rgba(240,230,208,0.9)" stroke-width="1"/>
      <path d="M26 20 L46 32 L26 44 Z" fill="rgba(240,230,208,0.95)"/>
    </svg>
    ${titleHtml}
  `;

  card.addEventListener('click', () => playVideoIn(el, card._video, list, true, ctx));

  /* Drag-to-reorder still available in admin mode — autosaves on drop. */
  if (IS_ADMIN) card.draggable = true;
  return card;
}

/* Update the in-memory videoData cache after a save so that switching tabs
   and coming back doesn't show the old titles/order from the initial fetch. */
function updateVideoCache(project, tabSlug, videos) {
  if (tabSlug) {
    if (!videoData[project] || Array.isArray(videoData[project])) videoData[project] = {};
    videoData[project][tabSlug] = videos;
  } else {
    videoData[project] = videos;
  }
}

async function saveVideoOrder(project, tabLabel, grid, btn) {
  /* Flush any pending input edits — if a field still has focus, its 'input'
     event has fired but we re-read .value to be sure. */
  grid.querySelectorAll('.video-thumb-title--edit').forEach(inp => {
    const card = inp.closest('.video-thumb');
    if (card) card._video = { ...card._video, title: inp.value };
  });
  const videos = [...grid.querySelectorAll('.video-thumb')].map(c => c._video);
  const tabSlug = tabLabel ? slugify(tabLabel) : null;
  console.log('[admin] saving', { project, tab: tabSlug, videos });

  /* Optimistically update the in-memory cache so tab-switches show edits
     even if the server save fails — at least within this session. */
  updateVideoCache(project, tabSlug, videos);

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const res = await fetch('/api/save-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, tab: tabSlug, videos }),
    });
    if (res.ok) {
      btn.textContent = `✓ Saved ${videos.length} → links.json`;
      console.log(`[admin] saved videos for ${project}/${tabSlug || ''}`);
    } else {
      throw new Error('save-videos ' + res.status);
    }
  } catch (err) {
    /* Fallback: clipboard */
    try {
      await navigator.clipboard.writeText(JSON.stringify(videos, null, 2));
      btn.textContent = `✓ Copied — paste into videos/links.json`;
      console.log('[admin] no dev-server — copied videos to clipboard');
    } catch (e) {
      btn.textContent = '✗ Save failed (see console)';
      console.error('[admin] video save failed:', err, e);
    }
  }
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2400);
}

function renderVideoGrid(el, list, ctx) {
  el.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'video-grid';
  list.forEach(v => grid.appendChild(buildThumbCard(v, el, list, ctx)));

  if (IS_ADMIN) {
    grid.addEventListener('dragstart', e => {
      videoDragSrc = e.target.closest('.video-thumb');
      if (!videoDragSrc) return;
      videoDragSrc.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    grid.addEventListener('dragover', e => {
      e.preventDefault();
      const target = e.target.closest('.video-thumb');
      if (!target || target === videoDragSrc) return;
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      grid.insertBefore(videoDragSrc, after ? target.nextSibling : target);
    });
    grid.addEventListener('dragend', () => {
      if (videoDragSrc) videoDragSrc.classList.remove('dragging');
      videoDragSrc = null;
      /* Autosave the new order. */
      const reorderedList = [...grid.querySelectorAll('.video-thumb')].map(c => c._video);
      updateVideoCache(ctx.project, ctx.tabLabel ? slugify(ctx.tabLabel) : null, reorderedList);
      autoSaveVideos(ctx.project, ctx.tabLabel, reorderedList);
    });
  }

  el.appendChild(grid);
  addHoverCursor([...grid.querySelectorAll('.video-thumb')]);
}

function playVideoIn(el, v, list, withBack = true, ctx) {
  const url = videoEmbedUrl(v);
  if (!url) return;
  const isLocal = /\.(mp4|webm|mov)$/i.test(url);
  const player = isLocal
    ? `<video src="${url}" controls playsinline></video>`
    : `<iframe src="${url}" allow="fullscreen; picture-in-picture" allowfullscreen></iframe>`;
  const back = (withBack && (list.length > 1 || IS_ADMIN))
    ? `<button class="video-back" title="Back to videos">← All videos</button>`
    : '';
  el.innerHTML = `<div class="accord-video" style="aspect-ratio:${aspectFor(v)}">${player}${back}</div>`;
  const backBtn = el.querySelector('.video-back');
  if (backBtn) {
    addHoverCursor([backBtn]);
    backBtn.addEventListener('click', () => renderVideoGrid(el, list, ctx || {}));
  }
}

function buildAccordPanel(key, inner) {
  const p = projects[key];
  if (!p || inner.dataset.built) return;
  inner.dataset.built = 'true';

  const left  = document.createElement('div');  left.className  = 'accord-left';
  const right = document.createElement('div');  right.className = 'accord-right';
  const mediaEl = document.createElement('div');
  const descEl  = document.createElement('p');  descEl.className = 'accord-desc';

  if (p.tabs && p.tabs.length > 1) {
    const tabsEl = document.createElement('div');
    tabsEl.className = 'accord-tabs';
    p.tabs.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.className = 'accord-tab' + (i === 0 ? ' active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.accord-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        setAccordMedia(mediaEl, tab, key, tab.label);
        descEl.textContent = tab.desc || p.desc;
      });
      tabsEl.appendChild(btn);
    });
    addHoverCursor([...tabsEl.querySelectorAll('.accord-tab')]);
    setAccordMedia(mediaEl, p.tabs[0], key, p.tabs[0].label);
    descEl.textContent = p.tabs[0].desc || p.desc;
    const rightChildren = [];
    if (p.roles && p.roles.length) {
      const rolesEl = document.createElement('div');
      rolesEl.className = 'accord-roles';
      p.roles.forEach(r => {
        const s = document.createElement('span'); s.textContent = r; rolesEl.appendChild(s);
      });
      addHoverCursor([...rolesEl.querySelectorAll('span')]);
      rightChildren.push(rolesEl);
    }
    if (p.segmentLabel) {
      const segEl = document.createElement('p');
      segEl.className = 'accord-segment-label';
      segEl.textContent = p.segmentLabel;
      rightChildren.push(segEl);
    }
    rightChildren.push(tabsEl, descEl);
    right.append(...rightChildren);
  } else {
    setAccordMedia(mediaEl, p, key, null);
    descEl.textContent = p.desc;
    if (p.roles && p.roles.length) {
      const rolesEl = document.createElement('div');
      rolesEl.className = 'accord-roles';
      p.roles.forEach(r => {
        const s = document.createElement('span');
        s.textContent = r;
        rolesEl.appendChild(s);
      });
      right.appendChild(rolesEl);
    }

    right.appendChild(descEl);

    if (p.awardImg) {
      const awardEl = document.createElement('div');
      awardEl.className = 'accord-award accord-award--float';
      const img = document.createElement('img');
      img.src = p.awardImg;
      img.alt = p.award || '';
      img.className = 'accord-award-img';
      awardEl.appendChild(img);
      right.appendChild(awardEl);
    }

    if (p.award && !p.awardImg) {
      const awardEl = document.createElement('p');
      awardEl.className = 'accord-award';
      awardEl.textContent = '★ ' + p.award;
      right.appendChild(awardEl);
    }
  }

  left.appendChild(mediaEl);
  inner.append(left, right);
}

/* Stamp the current year into the bio-page footer. */
(() => {
  const yr = document.getElementById('aboutFooterYear');
  if (yr) yr.textContent = new Date().getFullYear();
})();

/* ── PROJECTS ACCORDION: click a strip → overlay slides up ──── */
const projDetailEl = document.getElementById('projDetail');

/* Opens a slide as a temporary project detail. Handles both gallery slides
   (e.g. VIZION → product photo grid) and video slides (e.g. Mercury,
   Shangri La → big video player). Back button returns to the slideshow. */
function openSlideGallery(slide) {
  if (!slide) return;
  const virt = {
    title: slide.title,
    category: slide.subtitle || '',
    desc: slide.desc || '',
  };
  if (slide.gallery) virt.gallery = slide.gallery;
  if (slide.video)   virt.video   = slide.video;
  projects['freelance__slideback'] = virt;
  buildProjectDetail('freelance__slideback');
  const backBtn = document.createElement('button');
  backBtn.className = 'slide-back';
  backBtn.textContent = '← Back to Freelance';
  backBtn.addEventListener('click', () => buildProjectDetail('freelance'));
  projDetailEl.insertBefore(backBtn, projDetailEl.firstChild.nextSibling);
  addHoverCursor([backBtn]);
}

/* Renders a footer at the bottom of any project detail panel. Only used on
   project detail overlays — NOT on the main projects strip page or stills. */
/* Which Stills category each project leads into. Keeps someone who just
   watched the Red Sox reel moving into the sports photography instead of
   dead-ending at the bottom of the page. */
const PROJECT_RELATED = {
  redsox:    { cat: 'sports',    label: 'Sports Photography' },
  usc:       { cat: 'sports',    label: 'Sports Photography' },
  film:      { cat: 'portrait',  label: 'Portrait Work' },
  brew:      { cat: 'portrait',  label: 'Portrait Work' },
  freelance: { cat: 'street',    label: 'Street Photography' },
};

/* A "keep looking" band above the footer: a few real frames from the
   related category, clickable straight into that gallery. */
function buildRelatedWork(key) {
  const rel = PROJECT_RELATED[key];
  if (!rel) return null;
  const pool = galleryData[rel.cat] || [];
  if (pool.length < 3) return null;

  /* Prefer featured frames, else spread across the category. */
  const feat = pool.filter(e => e.feat);
  const source = feat.length >= 4 ? feat : pool;
  const step = Math.max(1, Math.floor(source.length / 4));
  const picks = source.filter((_, i) => i % step === 0).slice(0, 4);

  const section = document.createElement('section');
  section.className = 'proj-related';
  section.innerHTML = `
    <div class="proj-related-head">
      <span class="proj-related-eyebrow">Related</span>
      <button class="proj-related-link" data-stills-cat="${rel.cat}">
        ${rel.label}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="9,5 16,12 9,19"/></svg>
      </button>
    </div>
    <div class="proj-related-grid"></div>
  `;

  const grid = section.querySelector('.proj-related-grid');
  picks.forEach(entry => {
    const path = entryPath(entry);
    const fig = document.createElement('button');
    fig.className = 'proj-related-item';
    fig.dataset.stillsCat = rel.cat;
    fig.dataset.stillsPath = path;
    const img = document.createElement('img');
    img.src = thumbSrc(path);
    img.alt = galleryCaptions[path] || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    if (entry.w && entry.h) { img.width = entry.w; img.height = entry.h; }
    fig.appendChild(img);
    grid.appendChild(fig);
  });

  return section;
}

/* Jump from a project into Stills — optionally straight to one photo. */
document.addEventListener('click', e => {
  const target = e.target.closest('[data-stills-cat]');
  if (!target) return;
  e.preventDefault();
  closeProjectDetail();
  goToPage('stills');
  const { stillsCat, stillsPath } = target.dataset;
  /* Let the page transition start before swapping the grid under it. */
  setTimeout(() => {
    renderStills(stillsCat);
    if (stillsPath) {
      requestAnimationFrame(() => {
        const item = document.querySelector(
          `.stills-content .gallery-item[data-path="${CSS.escape(stillsPath)}"]`
        );
        if (item) item.click();
      });
    }
  }, 420);
});

function buildProjectFooter() {
  const footer = document.createElement('footer');
  footer.className = 'proj-detail-footer';
  footer.innerHTML = `
    <div class="proj-detail-footer-inner">
      <div class="proj-detail-footer-left">© ${new Date().getFullYear()} Matthew Walensky</div>
      <div class="proj-detail-footer-socials">
        <a href="https://www.instagram.com/mwal.jpeg/" target="_blank" rel="noopener" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
        </a>
        <a href="https://www.linkedin.com/in/matthew-walensky/" target="_blank" rel="noopener" aria-label="LinkedIn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
        </a>
        <a href="mailto:mtwalensky@gmail.com" aria-label="Email">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,7 12,14 22,7"/></svg>
        </a>
      </div>
      <div class="proj-detail-footer-right">
        <button class="proj-detail-footer-contact" data-action="contact">Contact</button>
      </div>
    </div>
  `;
  return footer;
}

function buildProjectDetail(key) {
  const p = projects[key];
  if (!p || !projDetailEl) return;

  projDetailEl.innerHTML = '';

  /* Close button */
  const close = document.createElement('button');
  close.className = 'proj-detail-close';
  close.textContent = '× Close';
  close.addEventListener('click', closeProjectDetail);
  projDetailEl.appendChild(close);
  addHoverCursor([close]);

  const inner = document.createElement('div');
  inner.className = 'proj-detail-inner';
  /* Wide stacked layout for projects with tabs, photo galleries, or slideshows.
     Days Until College (single video, no tabs) keeps the side-by-side layout. */
  const wide = (p.tabs && p.tabs.length >= 1) || p.gallery || p.slideshow;
  if (wide) inner.classList.add('proj-detail-inner--wide');

  /* ── LEFT: text column ────────────────────────────────────── */
  const text = document.createElement('div');
  text.className = 'proj-detail-text';

  /* Order: badge → category → title → description → roles. All left-aligned. */
  if (p.awardImg) {
    const award = document.createElement('div');
    award.className = 'proj-detail-award';
    award.innerHTML = `<img src="${p.awardImg}" alt="${p.award || 'Award'}"/>`;
    /* Caption text intentionally omitted — the laurel speaks for itself. */
    text.appendChild(award);
  }

  const cat = document.createElement('span');
  cat.className = 'proj-detail-cat';
  cat.textContent = p.category || '';
  text.appendChild(cat);

  const title = document.createElement('h2');
  title.className = 'proj-detail-title';
  if (p.logoImg && p.logoOnly) {
    title.classList.add('proj-detail-title--logo-only');
    title.innerHTML = `<img class="proj-detail-logo proj-detail-logo--large" src="${p.logoImg}" alt="${p.title}"/>`;
  } else if (p.logoImg) {
    title.innerHTML = `<img class="proj-detail-logo" src="${p.logoImg}" alt=""/><span>${p.title}</span>`;
  } else {
    title.textContent = p.title;
  }
  text.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'proj-detail-desc';
  desc.textContent = p.tabs && p.tabs[0] ? (p.tabs[0].desc || p.desc) : p.desc;
  text.appendChild(desc);

  if (p.roles && p.roles.length) {
    const rolesEl = document.createElement('div');
    rolesEl.className = 'proj-detail-roles';
    p.roles.forEach(r => {
      const s = document.createElement('span'); s.textContent = r; rolesEl.appendChild(s);
    });
    text.appendChild(rolesEl);
  }

  /* ── RIGHT: media column with TABS ABOVE ─────────────────── */
  const right = document.createElement('div');
  right.className = 'proj-detail-right';

  const media = document.createElement('div');
  media.className = 'proj-detail-media';

  if (p.gallery) {
    /* Photo-only project (e.g. VIZION) */
    media.classList.add('proj-detail-media--gallery');
    const panelEl = document.createElement('div');
    panelEl.className = 'gallery-panel gallery-panel--project';
    panelEl.id = 'project-panel-' + p.gallery;
    media.appendChild(panelEl);
    right.appendChild(media);
    inner.append(text, right);
    projDetailEl.appendChild(inner);
    projDetailEl.appendChild(buildProjectFooter());
    /* Pass the explicit panel element so buildPanel doesn't have to
       guess via getElementById (which collided with the Stills panel). */
    if (typeof buildPanel === 'function') buildPanel(p.gallery, panelEl);
    return;
  }

  if (p.slideshow) {
    /* Freelance — real slideshow. Each slide = a sub-project with its own gallery.
       Click a slide → opens that gallery (replaces media area, shows back button).
       Arrows step between slides. */
    media.classList.add('proj-detail-media--slideshow');
    const slides = p.slides || [];
    let cursor = 0;

    const renderSlideshow = () => {
      if (!slides.length) {
        media.innerHTML = `
          <div class="slide-empty-wrap">
            <div class="slide-empty">Slideshow coming soon — drop projects here.</div>
          </div>
        `;
        return;
      }
      const slide = slides[cursor];
      media.innerHTML = `
        <button class="slide-arrow slide-arrow--prev" aria-label="Previous slide">&#x2190;</button>
        <div class="slide-frame" role="button" tabindex="0" aria-label="Open ${slide.title} gallery">
          <div class="slide-cover" style="background-image:url('${slide.cover}')"></div>
          <div class="slide-veil"></div>
          <div class="slide-meta">
            <span class="slide-subtitle">${slide.subtitle || ''}</span>
            <span class="slide-title">${slide.title}</span>
            <span class="slide-cta">Open Gallery →</span>
          </div>
          <div class="slide-count">${cursor + 1} / ${slides.length}</div>
        </div>
        <button class="slide-arrow slide-arrow--next" aria-label="Next slide">&#x2192;</button>
      `;
      addHoverCursor([...media.querySelectorAll('.slide-arrow, .slide-frame')]);
      const frame = media.querySelector('.slide-frame');
      frame.addEventListener('click', () => openSlideGallery(slide));
      frame.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') openSlideGallery(slide);
      });
      media.querySelector('.slide-arrow--prev').addEventListener('click', e => {
        e.stopPropagation();
        cursor = (cursor - 1 + slides.length) % slides.length;
        renderSlideshow();
      });
      media.querySelector('.slide-arrow--next').addEventListener('click', e => {
        e.stopPropagation();
        cursor = (cursor + 1) % slides.length;
        renderSlideshow();
      });
    };
    renderSlideshow();

    right.appendChild(media);
    inner.append(text, right);
    projDetailEl.appendChild(inner);
    const relatedSlideshow = buildRelatedWork(key);
    if (relatedSlideshow) projDetailEl.appendChild(relatedSlideshow);
    projDetailEl.appendChild(buildProjectFooter());
    return;
  }

  if (p.tabs && p.tabs.length > 1) {
    const tabsEl = document.createElement('div');
    tabsEl.className = 'proj-detail-tabs';
    p.tabs.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.className = 'proj-detail-tab' + (i === 0 ? ' active' : '');
      btn.textContent = tab.label;
      btn.addEventListener('click', () => {
        tabsEl.querySelectorAll('.proj-detail-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        setAccordMedia(media, tab, key, tab.label);
        desc.textContent = tab.desc || p.desc;
      });
      tabsEl.appendChild(btn);
    });
    right.append(tabsEl, media);
    setAccordMedia(media, p.tabs[0], key, p.tabs[0].label);
    addHoverCursor([...tabsEl.querySelectorAll('.proj-detail-tab')]);
  } else if (p.tabs && p.tabs.length === 1) {
    setAccordMedia(media, p.tabs[0], key, p.tabs[0].label);
    right.appendChild(media);
  } else {
    setAccordMedia(media, p, key, null);
    right.appendChild(media);
  }

  inner.append(text, right);
  projDetailEl.appendChild(inner);
  const related = buildRelatedWork(key);
  if (related) projDetailEl.appendChild(related);
  projDetailEl.appendChild(buildProjectFooter());
}

/* IRIS reveal from the clicked tile.
   The overlay's clip-path is driven inline (no CSS vars) so the value is
   guaranteed to be a clean inset() that browsers can interpolate.
   We do NOT add .active to the strip — that would change its flex value
   mid-animation and the iris would chase a moving rect. */
let _lastOpenStrip = null;
const IRIS_MS = 520;
const IRIS_EASE = 'cubic-bezier(.22, .68, .26, 1)';

function clipFromStripRect(strip) {
  const page = projDetailEl.parentElement;
  const pr = page.getBoundingClientRect();
  const sr = strip.getBoundingClientRect();
  const t = Math.max(0, sr.top    - pr.top);
  const l = Math.max(0, sr.left   - pr.left);
  const r = Math.max(0, pr.right  - sr.right);
  const b = Math.max(0, pr.bottom - sr.bottom);
  return `inset(${t}px ${r}px ${b}px ${l}px)`;
}

function openProjectDetail(key, originStrip) {
  const strip = originStrip || document.querySelector(`.proj-strip[data-project="${key}"]`);
  _lastOpenStrip = strip;

  buildProjectDetail(key);

  /* 1. Seed the closed clip-path INLINE (no transition yet) so we start at
        the strip's rect. 2. Force a sync layout. 3. Next frame, enable the
        transition and set the open clip-path → smooth iris reveal. */
  projDetailEl.style.transition = 'none';
  projDetailEl.style.clipPath = clipFromStripRect(strip);
  projDetailEl.style.opacity = '1';
  projDetailEl.classList.add('armed');
  document.body.classList.add('proj-detail-open');
  // eslint-disable-next-line no-unused-expressions
  projDetailEl.offsetHeight;

  requestAnimationFrame(() => {
    projDetailEl.style.transition = `clip-path ${IRIS_MS}ms ${IRIS_EASE}, opacity ${IRIS_MS}ms ease`;
    projDetailEl.style.clipPath   = 'inset(0px 0px 0px 0px)';
    projDetailEl.classList.add('open');
  });
}

function closeProjectDetail() {
  if (!_lastOpenStrip) return;
  /* Two-phase close: opacity stays 1 while the iris shrinks back to the
     tile, then only the last ~120ms fades out — so you never see other
     tiles through a transparent open window. */
  const fadeMs   = 140;
  const fadeWait = IRIS_MS - fadeMs;   /* delay opacity until the iris is at the tile */
  projDetailEl.style.transition =
    `clip-path ${IRIS_MS}ms ${IRIS_EASE}, opacity ${fadeMs}ms ease ${fadeWait}ms`;
  projDetailEl.style.clipPath   = clipFromStripRect(_lastOpenStrip);
  projDetailEl.style.opacity    = '0';
  document.body.classList.remove('proj-detail-open');
  setTimeout(() => {
    projDetailEl.classList.remove('open');
    projDetailEl.classList.remove('armed');
    projDetailEl.innerHTML = '';
    projDetailEl.style.removeProperty('clip-path');
    projDetailEl.style.removeProperty('transition');
    projDetailEl.style.removeProperty('opacity');
  }, IRIS_MS + 40);
}

document.querySelectorAll('.proj-strip').forEach(strip => {
  strip.addEventListener('click', () => openProjectDetail(strip.dataset.project, strip));
});

/* Esc closes the project detail overlay (parity with other modals) */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && projDetailEl?.classList.contains('open')) closeProjectDetail();
});

/* (former nav dropdown handler removed — no nav in new layout) */

/* ── ARRANGE MODE (admin: reorder a category) ───────────────────
   Dragging photos around a two-row horizontal filmstrip is fiddly, so
   reordering happens here instead: a plain grid where you see everything
   at once and move a photo by clicking it, then clicking its destination.
   Dragging still works for anyone who prefers it. */
const arrangeEl     = document.getElementById('arrangeOverlay');
const arrangeGrid   = document.getElementById('arrangeGrid');
const arrangeCatSel = document.getElementById('arrangeCat');
const arrangeStatus = document.getElementById('arrangeStatus');

const ARRANGE_CATEGORIES = ['featured', 'landscape', 'wildlife', 'sports', 'street', 'portrait', 'product'];

let arrangeCat = null;
let arrangeList = [];        /* working copy of the category's entries */
let arrangePicked = null;    /* path of the photo currently "in hand" */
let arrangeUndo = null;      /* snapshot for the Undo button */

function openArrange(category) {
  if (!IS_ADMIN || !arrangeEl) return;
  arrangeCat = ARRANGE_CATEGORIES.includes(category) ? category : 'landscape';

  arrangeCatSel.innerHTML = ARRANGE_CATEGORIES
    .map(c => `<option value="${c}"${c === arrangeCat ? ' selected' : ''}>${c[0].toUpperCase() + c.slice(1)}</option>`)
    .join('');

  loadArrangeCategory(arrangeCat);
  arrangeEl.classList.add('open');
  arrangeEl.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeArrange() {
  arrangeEl.classList.remove('open');
  arrangeEl.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  arrangePicked = null;
  /* Re-render the Stills grid so it reflects the new order. */
  renderStills(currentStillsCat);
}

function loadArrangeCategory(category) {
  arrangeCat = category;
  /* Featured isn't a folder — it's whatever is starred, in its saved order. */
  arrangeList = category === 'featured'
    ? collectFeaturedStarredOnly()
    : [...(galleryData[category] || [])];
  arrangePicked = null;
  arrangeUndo = null;
  renderArrange();
}

/* The starred set in its current Featured order. Unlike collectFeatured()
   this never falls back to an auto-spread — you can only arrange photos you
   actually picked. */
function collectFeaturedStarredOnly() {
  const starred = photoCategories().flatMap(([, v]) => v.filter(e => e && e.feat));
  const saved = galleryData._featuredOrder;
  if (Array.isArray(saved) && saved.length) {
    const byPath = new Map(starred.map(e => [entryPath(e), e]));
    const ordered = saved.map(p => byPath.get(p)).filter(Boolean);
    const seen = new Set(ordered.map(entryPath));
    return [...ordered, ...starred.filter(e => !seen.has(entryPath(e)))];
  }
  return interleave(photoCategories().map(([, v]) => v.filter(e => e && e.feat)));
}

/* Full rebuild — only on open and category change. Picking a photo up or
   moving one reuses the existing tiles instead, so the thumbnails never
   reload and the grid doesn't flash. */
function renderArrange() {
  arrangeGrid.innerHTML = '';
  arrangeList.forEach((entry, i) => {
    const path = entryPath(entry);
    const cell = document.createElement('div');
    cell.className = 'arrange-item';
    if (path === arrangePicked) cell.classList.add('is-picked');
    cell.dataset.path = path;
    cell.dataset.index = i;
    cell.draggable = true;
    cell.innerHTML = `
      <img src="${thumbSrc(path)}" alt="" loading="lazy" decoding="async">
      <span class="arrange-num">${i + 1}</span>
      ${entry.feat ? '<span class="arrange-star">★</span>' : ''}
    `;
    arrangeGrid.appendChild(cell);
  });
  refreshArrangeChrome();
}

/* Re-label positions and sync each tile's index after a move. */
function renumberArrange() {
  [...arrangeGrid.children].forEach((cell, i) => {
    cell.dataset.index = i;
    const num = cell.querySelector('.arrange-num');
    if (num) num.textContent = i + 1;
    cell.classList.toggle('is-picked', cell.dataset.path === arrangePicked);
  });
  refreshArrangeChrome();
}

function refreshArrangeChrome() {
  updateArrangeStatus();
  document.getElementById('arrangeUndo').disabled = !arrangeUndo;
  document.getElementById('arrangeFront').disabled = !arrangePicked;
  document.getElementById('arrangeEnd').disabled = !arrangePicked;
}

function updateArrangeStatus() {
  if (!arrangePicked) {
    arrangeStatus.textContent =
      `${arrangeList.length} photos — click one to pick it up`;
    arrangeStatus.classList.remove('is-active');
    return;
  }
  const pos = arrangeList.findIndex(e => entryPath(e) === arrangePicked) + 1;
  arrangeStatus.textContent = `Holding #${pos} — click where it should go (Esc to cancel)`;
  arrangeStatus.classList.add('is-active');
}

/* Move the held photo to `toIndex`, remembering the previous order so a
   mis-click can be undone. */
function arrangeMoveTo(toIndex, { keepHold = false } = {}) {
  const from = arrangeList.findIndex(e => entryPath(e) === arrangePicked);
  if (from === -1 || from === toIndex) { arrangePicked = null; renumberArrange(); return; }

  arrangeUndo = [...arrangeList];
  const [moved] = arrangeList.splice(from, 1);
  arrangeList.splice(toIndex, 0, moved);

  /* Move the existing tile rather than rebuilding the grid — keeps every
     already-loaded thumbnail in place. The reference node is taken from the
     list *after* the splice, so this is correct in both directions (using
     the old index would be a no-op when moving forward by one). */
  const cell = arrangeGrid.children[from];
  if (cell) {
    const nextEntry = arrangeList[toIndex + 1];
    const ref = nextEntry
      ? arrangeGrid.querySelector(`.arrange-item[data-path="${CSS.escape(entryPath(nextEntry))}"]`)
      : null;
    arrangeGrid.insertBefore(cell, ref);
  }

  if (!keepHold) arrangePicked = null;
  renumberArrange();
  saveArrange();
}

async function saveArrange() {
  /* Featured stores just an order of paths; the photos themselves stay in
     their own categories. */
  if (arrangeCat === 'featured') galleryData._featuredOrder = arrangeList.map(entryPath);
  else galleryData[arrangeCat] = [...arrangeList];
  try {
    const res = await fetch('/api/save-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: arrangeCat, paths: arrangeList.map(entryPath) }),
    });
    if (!res.ok) throw new Error('server returned ' + res.status);
    flashAdminToast(`Saved ${arrangeCat} order`);
  } catch (e) {
    console.warn('[arrange] save failed:', e);
    flashAdminToast('✗ Save failed — is dev-server.py running?');
  }
}

if (arrangeEl) {
  /* Click to pick up, click again to place. */
  arrangeGrid.addEventListener('click', e => {
    const cell = e.target.closest('.arrange-item');
    if (!cell) return;
    const path = cell.dataset.path;

    if (!arrangePicked) {
      arrangePicked = path;
      renumberArrange();
    } else if (path === arrangePicked) {
      arrangePicked = null;          /* clicking it again puts it back down */
      renumberArrange();
    } else {
      arrangeMoveTo(Number(cell.dataset.index));
    }
  });

  /* Dragging, for anyone who prefers it. */
  let dragPath = null;
  arrangeGrid.addEventListener('dragstart', e => {
    const cell = e.target.closest('.arrange-item');
    if (!cell) return;
    dragPath = cell.dataset.path;
    cell.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  arrangeGrid.addEventListener('dragover', e => {
    if (!dragPath) return;
    e.preventDefault();
    const cell = e.target.closest('.arrange-item');
    arrangeGrid.querySelectorAll('.is-drop-target')
      .forEach(c => c.classList.remove('is-drop-target'));
    if (cell && cell.dataset.path !== dragPath) cell.classList.add('is-drop-target');
  });
  arrangeGrid.addEventListener('drop', e => {
    e.preventDefault();
    const cell = e.target.closest('.arrange-item');
    if (cell && dragPath && cell.dataset.path !== dragPath) {
      arrangePicked = dragPath;
      arrangeMoveTo(Number(cell.dataset.index));
    }
    dragPath = null;
  });
  arrangeGrid.addEventListener('dragend', () => {
    arrangeGrid.querySelectorAll('.is-dragging, .is-drop-target')
      .forEach(c => c.classList.remove('is-dragging', 'is-drop-target'));
    dragPath = null;
  });

  arrangeCatSel.addEventListener('change', () => loadArrangeCategory(arrangeCatSel.value));
  document.getElementById('arrangeDone').addEventListener('click', closeArrange);

  document.getElementById('arrangeFront').addEventListener('click', () => {
    if (arrangePicked) arrangeMoveTo(0);
  });
  document.getElementById('arrangeEnd').addEventListener('click', () => {
    if (arrangePicked) arrangeMoveTo(arrangeList.length - 1);
  });
  document.getElementById('arrangeUndo').addEventListener('click', () => {
    if (!arrangeUndo) return;
    arrangeList = arrangeUndo;
    arrangeUndo = null;
    arrangePicked = null;
    renderArrange();
    saveArrange();
  });

  document.addEventListener('keydown', e => {
    if (!arrangeEl.classList.contains('open')) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (arrangePicked) { arrangePicked = null; renumberArrange(); }
      else closeArrange();
      return;
    }
    /* Nudge the held photo one slot at a time; it stays in hand so you can
       keep tapping to walk it across the grid. */
    if (!arrangePicked) return;
    const at = arrangeList.findIndex(en => entryPath(en) === arrangePicked);
    if (e.key === 'ArrowRight' && at < arrangeList.length - 1) {
      e.preventDefault(); arrangeMoveTo(at + 1, { keepHold: true });
    }
    if (e.key === 'ArrowLeft' && at > 0) {
      e.preventDefault(); arrangeMoveTo(at - 1, { keepHold: true });
    }
  });
}

const stillsArrangeBtn = document.getElementById('stillsArrangeBtn');
if (stillsArrangeBtn) {
  stillsArrangeBtn.addEventListener('click', () => openArrange(currentStillsCat));
}

/* ── LIGHTBOX ───────────────────────────────────────────────── */
const lightbox        = document.getElementById('lightbox');
const lightboxClose   = document.getElementById('lightboxClose');
const lightboxImg     = document.getElementById('lightboxImg');
const lightboxPrev    = document.getElementById('lightboxPrev');
const lightboxNext    = document.getElementById('lightboxNext');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxCount   = document.getElementById('lightboxCount');

/* The set of photos the lightbox can page through, captured when it opens
   from whichever grid was clicked — so it always matches the visible
   category (and any admin re-ordering) without extra bookkeeping. */
let lbItems = [];
let lbIndex = 0;

function showLightboxAt(i, { push = true } = {}) {
  if (!lbItems.length) return;
  /* Wrap around at both ends. */
  lbIndex = (i + lbItems.length) % lbItems.length;
  const item = lbItems[lbIndex];
  lightboxImg.src = item.dataset.full;
  lightboxImg.alt = galleryCaptions[item.dataset.path] || '';

  /* Put the photo in the URL so a single frame can be linked directly. */
  if (push) {
    const url = `#stills/${item.dataset.path}`;
    if (location.hash !== url) history.replaceState({ page: 'stills' }, '', url);
  }

  if (lightboxCaption) {
    const text = galleryCaptions[item.dataset.path] || '';
    lightboxCaption.textContent = text;
    lightboxCaption.classList.toggle('is-empty', !text);
  }
  if (lightboxCount) {
    lightboxCount.textContent = `${lbIndex + 1} / ${lbItems.length}`;
  }
  /* Only show arrows when there's somewhere to go. */
  const multiple = lbItems.length > 1;
  if (lightboxPrev) lightboxPrev.hidden = !multiple;
  if (lightboxNext) lightboxNext.hidden = !multiple;

  preloadNeighbours();
}

/* Warm the adjacent frames so arrowing through feels instant. */
function preloadNeighbours() {
  [lbIndex - 1, lbIndex + 1].forEach(i => {
    const item = lbItems[(i + lbItems.length) % lbItems.length];
    if (item) new Image().src = item.dataset.full;
  });
}

function lightboxNav(step) { showLightboxAt(lbIndex + step); }

function openLightbox(src, originItem) {
  /* Build the sibling list from the grid that was actually clicked. */
  const grid = originItem && originItem.closest('.gallery-grid');
  lbItems = grid ? [...grid.querySelectorAll('.gallery-item')] : [];
  const start = originItem ? lbItems.indexOf(originItem) : -1;

  if (start === -1) {
    /* Fallback: a lone image with no grid context. */
    lbItems = [];
    lightboxImg.src = src;
    if (lightboxCaption) lightboxCaption.textContent = '';
    if (lightboxCount)   lightboxCount.textContent = '';
    if (lightboxPrev) lightboxPrev.hidden = true;
    if (lightboxNext) lightboxNext.hidden = true;
  } else {
    showLightboxAt(start);
  }

  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const wasOpen = lightbox.classList.contains('open');
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  lbItems = [];
  /* Drop the per-photo part of the URL, keeping the page itself. */
  if (wasOpen && location.hash.startsWith('#stills/')) {
    history.replaceState({ page: 'stills' }, '', '#stills');
  }
}

/* Open a photo straight from a URL like #stills/wildlife/DSCF2774.jpg —
   switches to the photo's own category so the arrow keys page through
   its neighbours, exactly as if it had been clicked. */
function openPhotoFromHash(hash) {
  const path = hash.replace(/^#stills\//, '');
  if (!path.includes('/')) return false;

  const category = path.slice(0, path.indexOf('/'));
  if (!galleryData[category]) return false;
  if (!galleryData[category].some(e => entryPath(e) === path)) return false;

  renderStills(category);
  /* Wait for the grid to exist, then click through to the right frame. */
  requestAnimationFrame(() => {
    const item = document.querySelector(
      `.stills-content .gallery-item[data-path="${CSS.escape(path)}"]`
    );
    if (item) item.click();
  });
  return true;
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

if (lightboxPrev) lightboxPrev.addEventListener('click', e => { e.stopPropagation(); lightboxNav(-1); });
if (lightboxNext) lightboxNext.addEventListener('click', e => { e.stopPropagation(); lightboxNav(1);  });

document.addEventListener('keydown', e => {
  /* closeModal() belonged to a modal system that no longer exists; calling it
     threw on every Escape, so neither the lightbox nor the contact form ever
     closed via the keyboard. */
  if (e.key === 'Escape') { closeLightbox(); closeCF(); return; }
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); lightboxNav(1);  }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); lightboxNav(-1); }
});

/* Swipe left/right on touch devices. */
(() => {
  let x0 = null, y0 = null;
  lightbox.addEventListener('touchstart', e => {
    x0 = e.changedTouches[0].clientX;
    y0 = e.changedTouches[0].clientY;
  }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    /* Horizontal intent only, and far enough to be deliberate. */
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) lightboxNav(dx < 0 ? 1 : -1);
    x0 = y0 = null;
  }, { passive: true });
})();

/* ── CONTACT FORM ───────────────────────────────────────────── */
const cfModal    = document.getElementById('cfModal');
const cfBackdrop = document.getElementById('cfBackdrop');
const cfClose    = document.getElementById('cfClose');
const cfForm     = document.getElementById('cfForm');
const cfSuccess  = document.getElementById('cfSuccess');
const contactBtn = document.getElementById('contactBtn');

function openCF() {
  cfModal.classList.add('open');
  cfBackdrop.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeCF() {
  cfModal.classList.remove('open');
  cfBackdrop.classList.remove('open');
  document.body.style.overflow = '';
}

contactBtn.addEventListener('click', openCF);
cfClose.addEventListener('click', closeCF);
cfBackdrop.addEventListener('click', closeCF);

cfForm.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = cfForm.querySelector('.cf-submit');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  try {
    const data = new FormData(cfForm);
    const res = await fetch(cfForm.action || '/', {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' },
    });

    if (res.ok || res.status === 200) {
      cfForm.style.display = 'none';
      cfSuccess.style.display = 'flex';
      setTimeout(closeCF, 3200);
      setTimeout(() => {
        cfForm.reset();
        cfForm.style.display = '';
        cfSuccess.style.display = 'none';
        btn.textContent = 'Send Message';
        btn.disabled = false;
      }, 3600);
    } else {
      throw new Error('Non-OK response');
    }
  } catch {
    /* fallback: open mail client */
    const name    = cfForm.querySelector('[name=name]').value;
    const email   = cfForm.querySelector('[name=email]').value;
    const subject = cfForm.querySelector('[name=subject]').value || 'Portfolio Inquiry';
    const message = cfForm.querySelector('[name=message]').value;
    window.location.href =
      `mailto:mtwalensky@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`From: ${name} <${email}>\n\n${message}`)}`;
    btn.textContent = 'Send Message';
    btn.disabled = false;
  }
});
