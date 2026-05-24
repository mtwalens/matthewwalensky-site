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

/* Honor an existing hash on load (e.g. someone bookmarked /#stills) */
(function initRoute() {
  const initial = (location.hash || '').replace('#', '') || 'home';
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
   Categories map: environmental→nature, sports, product, street, portrait. */
let galleryData = { nature: [], sports: [], product: [], street: [], portrait: [] };
let galleryReady = false;

/* Per-image captions, keyed by image path (e.g. "environmental/DSCF2774.jpg"). */
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
      renderStills(currentStillsCat || 'all');
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
      renderStills(currentStillsCat || 'all');
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
function setGallerySpan(item) {
  if (document.body.classList.contains('admin-mode')) {
    item.classList.remove('tall'); return;
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

function buildPanel(category, explicitPanel) {
  /* Use the explicit panel element when provided (avoids ID-lookup ambiguity
     when the same gallery category appears in multiple places — e.g.
     VIZION inside the project overlay AND the Stills page). */
  const panel = explicitPanel || document.getElementById('modal-panel-' + category);
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = 'true';

  let paths;
  if (category === 'all') {
    /* Interleave all categories for visual variety — but exclude `product`
       since it now lives under the VIZION project. */
    const arrays = Object.entries(galleryData)
      .filter(([k]) => k !== 'product')
      .map(([, v]) => v);
    const maxLen = Math.max(...arrays.map(a => a.length));
    paths = [];
    for (let i = 0; i < maxLen; i++) {
      arrays.forEach(arr => { if (arr[i]) paths.push(arr[i]); });
    }
  } else if (IS_ADMIN) {
    /* Admins see their in-progress order from localStorage. */
    const saved = localStorage.getItem('gallery_order_' + category);
    paths = saved ? JSON.parse(saved) : galleryData[category];
  } else {
    /* Public always sees the canonical order from manifest.json. */
    paths = galleryData[category];
  }

  const grid = document.createElement('div');
  grid.className = 'gallery-grid';

  paths.forEach(path => {
    const item = document.createElement('div');
    item.className = 'gallery-item';
    item.dataset.path = path;
    item.dataset.full = BASE + path;
    if (IS_ADMIN) item.draggable = true;

    const img = document.createElement('img');
    img.src = BASE + path;
    img.alt = '';
    img.loading = 'lazy';
    /* Tag portrait orientation for mosaic packing */
    setGallerySpan(item);

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
    grid.appendChild(item);

    item.addEventListener('click', () => openLightbox(item.dataset.full));
  });

  /* drag-to-reorder — admin only */
  if (IS_ADMIN) {
    grid.addEventListener('dragstart', e => {
      dragSrc = e.target.closest('.gallery-item');
      if (!dragSrc) return;
      dragSrc.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.gallery-item');
      if (!target || target === dragSrc) return;
      const rect = target.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      grid.insertBefore(dragSrc, after ? target.nextSibling : target);
    });

    grid.addEventListener('dragend', () => {
      if (!dragSrc) return;
      dragSrc.classList.remove('dragging');
      saveOrder(category, grid);
      /* Auto-save the new order silently — no inline Save button anymore. */
      autoSaveAdminOrder(category, grid);
      dragSrc = null;
    });
  }

  panel.appendChild(grid);
  addHoverCursor(panel.querySelectorAll('.gallery-item'));
}

/* ── STILLS PAGE (inline gallery) ───────────────────────────── */
const stillsContent = document.getElementById('stillsContent');
let currentStillsCat = 'all';

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
}

function ensureStillsBuilt() {
  if (!stillsContent) return;
  if (!stillsContent.children.length) renderStills(currentStillsCat);
}

/* Wire filter buttons */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => renderStills(btn.dataset.cat));
});

/* If user visits #stills directly, build it on initial load too. */
if (document.body.dataset.page === 'stills') ensureStillsBuilt();

/* Vertical mouse-wheel scrolls the Stills horizontal filmstrip left/right.
   Trackpad horizontal swipes pass through naturally; we only intercept when
   the vertical delta dominates (i.e. mouse wheel or vertical trackpad). */
stillsContent?.addEventListener('wheel', e => {
  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault();
    stillsContent.scrollLeft += e.deltaY;
  }
}, { passive: false });

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
    img: 'images/projects/the-morning-brew-bts.jpeg',
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
        cover: 'images/projects/VZN-11.jpg',
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
        <a href="https://linkedin.com/in/matthewwalensky" target="_blank" rel="noopener" aria-label="LinkedIn">
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
  projDetailEl.appendChild(buildProjectFooter());
}

function openProjectDetail(key) {
  document.querySelectorAll('.proj-strip').forEach(s => {
    s.classList.toggle('active', s.dataset.project === key);
  });
  buildProjectDetail(key);
  /* Class on body so corner buttons can hide reliably (no :has() dependency) */
  document.body.classList.add('proj-detail-open');
  requestAnimationFrame(() => projDetailEl.classList.add('open'));
}
function closeProjectDetail() {
  document.querySelectorAll('.proj-strip').forEach(s => s.classList.remove('active'));
  projDetailEl.classList.remove('open');
  document.body.classList.remove('proj-detail-open');
  setTimeout(() => { if (!projDetailEl.classList.contains('open')) projDetailEl.innerHTML = ''; }, 700);
}

document.querySelectorAll('.proj-strip').forEach(strip => {
  strip.addEventListener('click', () => openProjectDetail(strip.dataset.project));
});

/* Esc closes the project detail overlay (parity with other modals) */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && projDetailEl?.classList.contains('open')) closeProjectDetail();
});

/* (former nav dropdown handler removed — no nav in new layout) */

/* ── LIGHTBOX ───────────────────────────────────────────────── */
const lightbox      = document.getElementById('lightbox');
const lightboxClose = document.getElementById('lightboxClose');
const lightboxImg   = document.getElementById('lightboxImg');

function openLightbox(src) {
  lightboxImg.src = src;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeLightbox(); closeCF(); }
});

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
