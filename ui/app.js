import './enquiry-form.js';
import { icon } from './icons.js';
import {
  e,
  norm,
  pageUrl,
  searchCatalog,
  renderFocus,
  focusItems,
  filterRecords,
  eventsAt,
  citationText
} from './records.js';
import { renderPage, dossier, featureDetail, preserveLinks } from './page.js';
import { geoState, AtlasMap } from './map.js';
let c,
  atlas = null,
  focus = 0,
  sheet = 'summary',
  filters = false,
  modalType = '',
  returnFocus = null;
const $ = (s) => document.querySelector(s),
  url = () => new URL(location.href),
  params = () => url().searchParams;
const selected = () =>
  c?.profiles.find((p) => location.pathname.replace(/\/$/, '') === '/corridors/' + p.slug);
let defLayers = ['localities', 'infrastructure', 'sections'];
const layers = () => new Set(params().has('layers') ? params().get('layers').split(',').filter((k) => defLayers.includes(k)) : defLayers);
function defaultSheet(sp) {
  return ['compare', 'source', 'section', 'part'].some((key) => sp.has(key)) ? 'full' : 'summary';
}
let later;
function toast(txt) {
  const dialog = $('#dialog');
  if (dialog?.open) {
    let status = dialog.querySelector('.dialog-status');
    if (!status) {
      status = document.createElement('p');
      status.className = 'dialog-status small';
      status.setAttribute('role', 'status');
      $('#dialog-in').append(status);
    }
    status.textContent = txt;
    return;
  }
  let n = $('#toast');
  n.textContent = txt;
  n.classList.add('show');
  clearTimeout(later);
  later = setTimeout(() => n.classList.remove('show'), 2400);
}
function icons() {
  document.querySelectorAll('[data-i]').forEach((el) => (el.innerHTML = icon(el.dataset.i)));
}
function captureReader() {
  const input = $('#atlas-query');
  const results = $('#atlas-matches');
  return {
    sheet,
    focus,
    filters,
    top: window.scrollY,
    reading: $('#reader')?.scrollTop || 0,
    query: input?.value || '',
    suggestions: Boolean(results && !results.hidden)
  };
}
function setU(u, replace = false) {
  const next = u.pathname + u.search + u.hash;
  const current = location.pathname + location.search + location.hash;
  if (replace || next === current) {
    history.replaceState(history.state, '', next);
    return;
  }
  history.replaceState({ ...history.state, reader: captureReader() }, '', current);
  history.pushState(null, '', next);
}
function edit(k, v, replace = false, render = true) {
  let u = url();
  if (v) u.searchParams.set(k, v);
  else u.searchParams.delete(k);
  setU(u, replace);
  if (render) draw(false);
}
function navigate(path, opts = {}) {
  let u = new URL(path, location.origin),
    prev = params();
  if (opts.keep !== false) {
    for (let k of ['region', 'mode', 'status', 'order', 'date', 'q', 'layers'])
      if (prev.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, prev.get(k));
  }
  if (opts.pin) u.searchParams.set('pin', opts.pin);
  if (opts.compare) u.searchParams.set('compare', opts.compare);
  if (opts.clear) u.searchParams.delete(opts.clear);
  if (geoState.failed || location.pathname.startsWith('/places/') || u.pathname.startsWith('/places/')) {
    location.assign(u.href);
    return;
  }
  setU(u);
  sheet = defaultSheet(u.searchParams);
  closeMatches();
  dismiss();
  const input = $('#atlas-query');
  if (input) input.value = u.searchParams.get('q') || '';
  window.scrollTo({ top: 0, behavior: 'instant' });
  draw();
  const heading = document.querySelector('#reader h1, #reader .d-title, #mainbody h1');
  if (heading && !u.searchParams.has('source') && !u.searchParams.has('section')) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  }
}
function available(p, d) {
  return !d || eventsAt(p, d).length;
}
function draw(scrollDeep = true) {
  if (!c || location.pathname.startsWith('/places/')) return;
  if (geoState.failed) {
    location.reload();
    return;
  }
  document.body.classList.remove('expanded-map');
  const view = url(),
    sp = view.searchParams,
    p = selected(),
    q = c.profiles.find((x) => x.slug === sp.get('compare')),
    wasFocus = document.activeElement,
    focusKey = wasFocus?.dataset?.act,
    activeFilter = wasFocus?.dataset?.filter;
  let oldScroll = $('#reader')?.scrollTop || 0,
    previous = atlas
      ? {
          center: [...atlas.center],
          z: atlas.z,
          key: atlas.opts.slugs.join(',') + ':' + (atlas.opts.section || '')
        }
      : null;
  atlas?.destroy();
  atlas = null;
  $('#mainbody').innerHTML = preserveLinks(
    renderPage(c, view, { sheet, filters, focus, features: geoState.features, rels: geoState.relationships }),
    view
  );
  let nav = view.pathname.startsWith('/index')
    ? 'index'
    : view.pathname.startsWith('/about')
      ? 'about'
      : 'atlas';
  for (let a of document.querySelectorAll('.mast [data-nav]')) {
    a.classList.toggle('active', a.dataset.nav === nav);
    if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.title =
    (view.pathname.startsWith('/reference')
      ? 'Read the atlas API'
      : p?.name || { index: sp.get('sections') === '1' ? 'Mapped sections' : 'Corridor index', about: 'About the atlas', atlas: 'World atlas' }[nav]) +
    ' | The Corridor';
  icons();
  let map = $('#mapcanvas');
  if (map) {
    const live = filterRecords(c, sp);
    const corridorSlug = !p && view.pathname.replace(/\/$/, '') === '/atlas' ? sp.get('corridor') : '';
    const isolated = corridorSlug ? live.find(profile => profile.slug === corridorSlug) : null;
    const worldSelection = corridorSlug ? (isolated ? [isolated] : []) : live;
    atlas = new AtlasMap(map, {
      spotlight: isolated?.slug || spotlight(sp.get('date')),
      section: sp.get('section'),
      slugs: [p?.slug || isolated?.slug, p && q?.slug].filter(Boolean),
      unavailableCorridor: Boolean(corridorSlug && !isolated),
      filterSlugs: p ? null : new Set(worldSelection.map(profile => profile.slug)),
      date: sp.get('date'),
      layers: layers(),
      view: sp.get('view'),
      region: sp.get('mapregion') || p?.region || isolated?.region || '',
      pin: sp.get('pin'),
      onView: (v) => edit('view', v, true, false),
      select: (id) => openPlace(id),
      close: () => closePlace()
    });
    if (
      previous &&
      geoState.ready &&
      previous.key !== atlas.opts.slugs.join(',') + ':' + (atlas.opts.section || '') &&
      !sp.has('view')
    )
      atlas.transitionFrom(previous);
    if (sp.has('pin') && (!q || history.state?.inspectFeature) &&
        (!corridorSlug || atlas.validFeatures().some(feature => (feature.properties.id || feature.id) === sp.get('pin')))) {
      showPlace(sp.get('pin'));
    }
  }
  syncSheet();
  if (sp.has('source')) placeCitation(sp);
  if (!scrollDeep && $('#reader')) $('#reader').scrollTop = oldScroll;
  if (scrollDeep && (sp.has('section') || sp.has('source')))
    requestAnimationFrame(() =>
      jump(sp.has('source') ? 'source-' + sp.get('source') : 'section-' + sp.get('section'))
    );
  if (scrollDeep && q) requestAnimationFrame(() => $('#comparison')?.scrollIntoView({ block: 'nearest' }));
  if (!scrollDeep) {
    if (focusKey)
      document.querySelector('[data-act="' + CSS.escape(focusKey) + '"]')?.focus({ preventScroll: true });
    else if (activeFilter)
      document
        .querySelector('[data-filter="' + CSS.escape(activeFilter) + '"]')
        ?.focus({ preventScroll: true });
  }
}
function spotlight(date) {
  const items = focusItems(c, date);
  if (!items.length) return '';
  return items[((focus % items.length) + items.length) % items.length].slug;
}
function syncSheet() {
  const layout = $('.dossier-layout');
  if (!layout) return;
  layout.dataset.sheet = sheet;
  layout.querySelectorAll('button[data-sheet]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.sheet === sheet));
  });
}
function placeCitation(sp) {
  const sid = sp.get('source');
  const i = Number(sp.get('cite'));
  if (!sid || !Number.isInteger(i) || i < 1) return;
  const scope = sp.has('section') ? document.getElementById('section-' + sp.get('section')) : $('#reader');
  const claim = scope?.querySelectorAll('[data-sid="' + CSS.escape(sid) + '"]')[i - 1];
  const card = document.getElementById('source-' + sid);
  const account = claim?.closest('.account');
  if (account && card) {
    if (!account.contains(card)) account.append(card);
    return;
  }
  const block = claim?.closest('p, li');
  if (block && card && block.nextElementSibling !== card) block.after(card);
}
function jump(id, full = true) {
  if (full && matchMedia('(max-width:760px)').matches) {
    sheet = 'full';
    syncSheet();
  }
  let n = document.getElementById(id),
    reader = $('#reader');
  if (!n || !reader) return;
  const phone = matchMedia('(max-width:760px)').matches && sheet === 'full';
  const margin = id.startsWith('source-')
    ? Math.min(145, (phone ? window.innerHeight : reader.clientHeight) * 0.23)
    : 12;
  if (phone) window.scrollBy({ top: n.getBoundingClientRect().top - margin, behavior: 'instant' });
  else {
    reader.scrollTo({
      top: Math.max(
        0,
        reader.scrollTop + n.getBoundingClientRect().top - reader.getBoundingClientRect().top - margin
      ),
      behavior: 'instant'
    });
  }
}
function showPlace(id) {
  let f = geoState.features.find((f) => (f.properties.id || f.id) === id),
    node = $('#place-popup');
  if (!node) return;
  if (!f) {
    node.innerHTML = '';
    return;
  }
  let date = params().get('date');
  if (
    date &&
    (!f.properties.validFrom ||
      f.properties.validFrom > date ||
      (f.properties.validTo && f.properties.validTo < date))
  ) {
    node.innerHTML = '';
    return;
  }
  const connections = geoState.relationships.filter(
    (r) => !date || (r.validFrom && r.validFrom <= date && (!r.validTo || r.validTo >= date))
  );
  node.innerHTML = featureDetail(f, c, connections, params().get('date'));
}
function openPlace(id, center = false) {
  let u = url();
  u.searchParams.set('pin', id);
  if (center) u.searchParams.delete('view');
  setU(u);
  history.replaceState({ ...history.state, inspectFeature: true }, '');
  if (center) {
    draw(false);
    if (matchMedia('(max-width:760px)').matches) {
      sheet = 'summary';
      syncSheet();
      $('#mapcanvas').scrollIntoView({ block: 'center' });
    }
  } else {
    atlas.opts.pin = id;
    atlas.paint();
    showPlace(id);
  }
}
function closePlace() {
  const panel = $('#place-popup');
  if (!panel?.innerHTML) return;
  const restoreFocus = panel.contains(document.activeElement);
  edit('pin', '', true, false);
  $('#place-popup').innerHTML = '';
  if (atlas) {
    atlas.opts.pin = null;
    atlas.paint();
    if (restoreFocus) atlas.svg.focus({ preventScroll: true });
  }
}
function openDialog(type, html) {
  let d = $('#dialog');
  if (!d.open) {
    returnFocus = document.activeElement;
    d.showModal();
  }
  modalType = type;
  $('#dialog-in').innerHTML = html;
  let i = d.querySelector('[autofocus]') || d.querySelector('input') || d.querySelector('button');
  i?.focus();
}
function dismiss() {
  let d = $('#dialog');
  if (d.open) d.close();
}
$('#dialog').addEventListener('close', () => {
  modalType = '';
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  returnFocus = null;
});
$('#dialog').addEventListener('click', (ev) => {
  if (ev.target !== $('#dialog')) return;
  let r = ev.target.getBoundingClientRect();
  if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) dismiss();
});
function heading(title) {
  return (
    '<div class="modal-head"><h2 class="modal-title" id="atlas-dialog-title">' +
    e(title) +
    '</h2><button class="step" data-act="dismiss" aria-label="Close dialog">' +
    icon('close', 13) +
    '</button></div>'
  );
}
function search(type = 'search') {
  const input = $('#atlas-query');
  if (type === 'search' && input) {
    input.focus();
    input.select();
    if (c) mastResults();
    return;
  }
  const cmp = type === 'compare';
  openDialog(
    type,
    heading(cmp ? 'Compare with another corridor' : 'Search the atlas') +
      '<div class="modal-search">' +
      icon('search', 18) +
      '<input id="search-q" aria-label="Search by corridor, alias, place or infrastructure" placeholder="Corridor, place or infrastructure" type="search" autocomplete="off" autofocus></div>' +
      '<div class="search-results" id="results"></div>'
  );
  searchResults('');
}
function indexLink(term) {
  const next = new URL('/index/', location.origin);
  for (const key of ['date', 'layers']) if (params().has(key)) next.searchParams.set(key, params().get(key));
  if (term.trim()) next.searchParams.set('q', term.trim());
  return next.pathname + next.search;
}
function searchResults(query, target = $('#results'), compact = false) {
  if (!target || !c) return;
  const term = norm(query),
    when = params().get('date'),
    cmp = !compact && modalType === 'compare',
    p = selected();
  let rows = searchCatalog(c, query).filter((v) => available(v, when) && (!cmp || v.slug !== p?.slug));
  const hits =
    !cmp && term
      ? geoState.features
          .filter((f) => {
            const z = f.properties;
            return (
              norm(z.name).includes(term) &&
              (!when || (z.validFrom && z.validFrom <= when && (!z.validTo || when <= z.validTo)))
            );
          })
          .sort((a, b) => Number(norm(b.properties.name) === term) - Number(norm(a.properties.name) === term))
      : [];
  if (!term) {
    const featured = focusItems(c, when).filter((v) => rows.includes(v));
    rows = featured.concat(rows.filter((v) => !featured.includes(v)));
  }
  // The context and action must also survive opening a result in a new tab.
  function resultURL(path, extra = {}) {
    const dest = new URL(path, location.origin);
    for (const k of cmp ? ['date', 'region', 'mode', 'status', 'order', 'layers'] : ['date', 'layers'])
      if (params().has(k)) dest.searchParams.set(k, params().get(k));
    for (const [k, v] of Object.entries(extra)) if (v) dest.searchParams.set(k, v);
    return dest.pathname + dest.search;
  }
  const recordHTML = rows
    .slice(0, compact ? 5 : 16)
    .map((v) => {
      const path = cmp
        ? resultURL(pageUrl(p), { compare: v.slug, pin: params().get('pin') })
        : resultURL(pageUrl(v));
      return (
        '<a href="' +
        e(path) +
        '" ' +
        (cmp ? 'data-compare="' : 'data-slug="') +
        e(v.slug) +
        '" class="result"><span>' +
        e(v.name) +
        '<small>' +
        e(v.region) +
        ' · ' +
        e(when ? 'Dated evidence' : v.status) +
        '</small></span>' +
        icon(cmp ? 'compare' : 'book', 15) +
        '</a>'
      );
    })
    .join('');
  const placeHTML = hits
    .slice(0, compact ? 3 : 7)
    .map((f) => {
      const id = f.properties.id || f.id;
      return (
        '<a class="result" href="' +
        e(resultURL('/places/' + encodeURIComponent(id) + '/')) +
        '" data-search-place="' +
        e(id) +
        '"><span>' +
        e(f.properties.name) +
        '<small>' +
        e(f.properties.kind || 'Mapped location') +
        '</small></span>' +
        icon('pin', 14) +
        '</a>'
      );
    })
    .join('');
  const from = recordHTML
    ? '<div class="eyebrow">' +
      (term
        ? rows.length + (rows.length === 1 ? ' matching profile' : ' matching profiles')
        : 'From the index') +
      '</div>' +
      recordHTML
    : '';
  const places = placeHTML ? '<div class="eyebrow">Mapped places</div>' + placeHTML : '';
  const exactPlace = term && hits.length && norm(hits[0].properties.name) === term;
  let html = exactPlace ? places + from : from + places;
  if (!html) html = '<p class="empty">No records match this search. Try another name or abbreviation.</p>';
  if (!cmp && rows.length && (term || rows.length > 5))
    html +=
      '<a class="textlink more" data-act="all-results" href="' +
      e(indexLink(query)) +
      '">' +
      (term
        ? 'View ' +
          (rows.length === 1 ? 'this profile' : 'all ' + rows.length + ' profiles') +
          ' in the index'
        : 'Open the corridor index') +
      '</a>';
  target.innerHTML = html;
}
function closeMatches() {
  const panel = $('#atlas-matches');
  if (panel) panel.hidden = true;
}
function mastResults() {
  const panel = $('#atlas-matches'),
    input = $('#atlas-query');
  if (!c || !panel || !input) return;
  searchResults(input.value, panel, true);
  panel.hidden = false;
}
async function copyText(value, ok = 'Copied') {
  try {
    if (!navigator.clipboard) throw Error();
    await navigator.clipboard.writeText(value);
    toast(ok);
    return true;
  } catch {
    let ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.left = '-10000px';
    ($('#dialog').open ? $('#dialog') : document.body).appendChild(ta);
    ta.select();
    let success = false;
    try {
      success = document.execCommand('copy');
    } catch {}
    ta.remove();
    if (success) {
      toast(ok);
      return true;
    }
    openDialog(
      'copy',
      heading('Copy text') +
        '<div class="modbody"><p>Select and copy the text below.</p><label class="field"><span>Text to copy</span><textarea id="copy-fallback">' +
        e(value) +
        '</textarea></label></div>'
    );
    $('#copy-fallback').select();
    return false;
  }
}
function pop(type) {
  let n = $('#map-popover');
  if (!n) return;
  let same = n.dataset.type === type && n.innerHTML;
  n.dataset.type = same ? '' : type;
  n.innerHTML = '';
  document
    .querySelectorAll('[data-pop]')
    .forEach((b) => b.setAttribute('aria-expanded', !same && b.dataset.pop === type));
  if (same) return;
  if (type === 'region') {
    n.innerHTML =
      '<div class="map-layer-pop"><div class="eyebrow">Map extent</div>' +
      ['World view', 'Africa', 'Americas', 'Asia', 'Europe', 'Middle East', 'Oceania']
        .map((v) => '<button data-mapregion="' + v + '">' + v + '</button>')
        .join('') +
      '</div>';
  } else {
    let layerSet = layers(),
      d = params().get('date');
    n.innerHTML =
      '<div class="map-layer-pop"><div class="eyebrow">Map layers</div>' +
      [
        ['localities', 'Named localities'],
        ['infrastructure', 'Infrastructure'],
        ['sections', 'Mapped sections']
      ]
        .map(
          ([k, v]) =>
            '<label><input type="checkbox" data-layer="' +
            k +
            '" ' +
            (layerSet.has(k) ? 'checked' : '') +
            '>' +
            v +
            '</label>'
        )
        .join('') +
      '<div class="eyebrow" style="margin-top:7px">View at date</div><input type="date" aria-label="View at date" data-filter="date" max="' +
      c.edition +
      '" value="' +
      e(d || '') +
      '"><button data-remove="date" class="textlink">Current view</button></div>';
  }
}
document.addEventListener('input', (ev) => {
  if (ev.target.id === 'search-q') searchResults(ev.target.value);
  if (ev.target.id === 'atlas-query') mastResults();
});
document.addEventListener('focusin', (ev) => {
  if (ev.target.id === 'atlas-query') mastResults();
  if (!ev.target.closest('.atlas-search')) closeMatches();
});
document.addEventListener('pointerdown', (ev) => {
  if (!ev.target.closest('.atlas-search')) closeMatches();
});
document.addEventListener('submit', async (ev) => {
  if (ev.target.matches('.map-corridor-picker') && c && geoState.ready && !geoState.failed) {
    ev.preventDefault();
    const next = url();
    const slug = ev.target.elements.corridor.value;
    for (const key of ['view', 'pin', 'mapregion', 'compare', 'section', 'source', 'cite']) next.searchParams.delete(key);
    if (slug) next.searchParams.set('corridor', slug);
    else next.searchParams.delete('corridor');
    next.hash = 'world-atlas';
    setU(next);
    draw(false);
    document.getElementById('map-corridor-select')?.focus({preventScroll:true});
    return;
  }
  if (ev.target.contains($('#atlas-query')) && c) {
    ev.preventDefault();
    const input = $('#atlas-query');
    navigate(indexLink(input.value), { keep: false });
    return;
  }
});
document.addEventListener('change', (ev) => {
  let t = ev.target;
  if (t.dataset.layer) {
    let ls = layers();
    t.checked ? ls.add(t.dataset.layer) : ls.delete(t.dataset.layer);
    let u = url();
    u.searchParams.set('layers', [...ls].join(','));
    setU(u);
    if (atlas) {
      atlas.opts.layers = ls;
      atlas.paint();
    }
    return;
  }
  if (t.dataset.filter) {
    let u = url(),
      k = t.dataset.filter;
    if (t.value && !(k === 'order' && t.value === 'name')) u.searchParams.set(k, t.value);
    else u.searchParams.delete(k);
    u.searchParams.delete('view');
    u.searchParams.delete('pin');
    if (k === 'date') {
      if (t.value && t.value > c.edition) {
        t.value = c.edition;
        u.searchParams.set(k, c.edition);
      }
      u.searchParams.delete('status');
      u.searchParams.delete('source');
      u.searchParams.delete('section');
      u.searchParams.delete('cite');
      u.hash = '';
    }
    setU(u);
    draw(false);
    if (k === 'date' && t.closest('#map-popover')) {
      pop('layers');
      $('#map-popover input[type="date"]')?.focus({ preventScroll: true });
    }
  }
});
document.addEventListener('click', async (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
  let t = ev.target.closest('button,a');
  if (!c) return;
  if (!t) {
    if (!ev.target.closest('#map-popover') && $('#map-popover')?.innerHTML)
      pop($('#map-popover').dataset.type);
    return;
  }
  let d = t.dataset,
    p = selected(),
    a = d.act;
  if (t.closest('#map-popover') === null && !d.pop && $('#map-popover')?.innerHTML)
    pop($('#map-popover').dataset.type);
  if (geoState.failed && t.tagName === 'A') return;
  if (d.nav === 'pax' || d.nav === 'advisory' || (d.nav === 'atlas' && t.hash === '#world-atlas')) return;
  if (d.nav) {
    ev.preventDefault();
    navigate(d.nav === 'atlas' ? '/atlas/' : d.nav === 'index' ? '/index/' : '/about/', {
      keep: d.nav === 'index'
    });
    return;
  }
  if (d.readerPart && p && $('#reader')) {
    ev.preventDefault();
    const destination = new URL(t.href);
    setU(destination);
    const phone = matchMedia('(max-width:760px)').matches;
    if (phone) sheet = 'full';
    $('#reader').outerHTML = preserveLinks(
      dossier(c, p, destination.searchParams, geoState.features, geoState.relationships),
      destination
    );
    syncSheet();
    const reader = $('#reader');
    reader.scrollTop = 0;
    const active = reader.querySelector('[data-reader-part][aria-current="page"]');
    active?.focus({ preventScroll: true });
    if (phone) active?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (d.slug) {
    ev.preventDefault();
    navigate(t.getAttribute('href') || '/corridors/' + encodeURIComponent(d.slug) + '/', {
      pin: d.pin,
      keep: !t.closest('#atlas-matches, #results')
    });
    return;
  }
  if (d.sid) {
    ev.preventDefault();
    const u = url();
    const section = t.closest('[data-sec]');
    const scope = section || $('#reader');
    const similar = [...(scope?.querySelectorAll('[data-sid="' + CSS.escape(d.sid) + '"]') || [])];
    const occurrence = similar.indexOf(t) + 1;
    if (t.closest('.reader-overview')) u.searchParams.set('part', 'overview');
    else u.searchParams.delete('part');
    u.searchParams.set('source', d.sid);
    if (section) u.searchParams.set('section', section.dataset.sec);
    else u.searchParams.delete('section');
    if (occurrence) u.searchParams.set('cite', occurrence);
    u.hash = 'source-' + d.sid;
    setU(u);
    draw(false);
    jump('source-' + d.sid);
    const card = document.getElementById('source-' + d.sid);
    if (card) {
      card.tabIndex = -1;
      card.focus({ preventScroll: true });
    }
    return;
  }
  if (d.copycite) {
    let s = c.sources[d.copycite];
    if (s) await copyText(citationText(s), 'Citation copied');
    return;
  }
  if (d.sectionLink) {
    let u = url();
    u.searchParams.set('section', d.sectionLink);
    for (const key of ['source', 'cite', 'view', 'pin']) u.searchParams.delete(key);
    u.hash = 'section-' + d.sectionLink;
    await copyText(u.href, 'Section link copied');
    return;
  }
  if (d.place) {
    if (t.tagName === 'A' && !atlas) return;
    ev.preventDefault();
    openPlace(d.place, true);
    return;
  }
  if (d.searchPlace) return;
  if (d.compare || d.pair) {
    ev.preventDefault();
    let pair = d.pair?.split(',') || [p?.slug, d.compare];
    if (pair.every(Boolean)) {
      let pin = d.pin || params().get('pin');
      navigate('/corridors/' + pair[0] + '/', { compare: pair[1], pin });
    }
    return;
  }
  if (d.sheet) {
    sheet = d.sheet;
    syncSheet();
    return;
  }
  if (d.pop) {
    pop(d.pop);
    // The menu lives after the map controls in DOM order. Send keyboard
    // activation to its first option instead of through unrelated zoom tools.
    if (ev.detail === 0) $('#map-popover button, #map-popover input')?.focus({ preventScroll: true });
    return;
  }
  if (d.mapregion) {
    let u = url();
    if (p) u.pathname = '/atlas/';
    if (d.mapregion === 'World view') u.searchParams.delete('mapregion');
    else u.searchParams.set('mapregion', d.mapregion);
    ['corridor', 'compare', 'pin', 'section', 'source', 'view'].forEach((k) => u.searchParams.delete(k));
    setU(u);
    draw(false);
    document.querySelector('[data-pop="region"]')?.focus({ preventScroll: true });
    return;
  }
  if (d.remove) {
    const next = url();
    next.searchParams.delete(d.remove);
    if (d.remove === 'date') {
      for (const key of ['source', 'cite', 'section', 'pin', 'view']) next.searchParams.delete(key);
      next.hash = '';
    }
    setU(next);
    if (d.remove === 'q' && $('#atlas-query')) $('#atlas-query').value = '';
    const fromLayers = Boolean(t.closest('#map-popover'));
    draw(false);
    if (fromLayers) document.querySelector('[data-pop="layers"]')?.focus({ preventScroll: true });
    else document.querySelector('[data-act="filters"]')?.focus({ preventScroll: true });
    return;
  }
  if (a === 'search' || a === 'compare') {
    if (!c) {
      location.href = '/index/';
      return;
    }
    search(a);
    return;
  }
  if (a === 'dismiss') {
    dismiss();
    return;
  }
  if (a === 'close-source') {
    const u = url(),
      sid = u.searchParams.get('source');
    if (!sid || !p) return;
    const section = u.searchParams.get('section');
    const i = Math.max(0, Number(u.searchParams.get('cite') || 1) - 1);
    u.searchParams.delete('source');
    u.searchParams.delete('cite');
    u.hash = section ? 'section-' + section : '';
    setU(u, true);
    draw(false);
    const scope = (section && document.getElementById('section-' + section)) || $('#reader');
    const references = scope?.querySelectorAll('[data-sid="' + CSS.escape(sid) + '"]');
    const reference = references?.[i] || references?.[0];
    reference?.focus({ preventScroll: true });
    reference?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    return;
  }
  if (a === 'print') {
    window.print();
    return;
  }
  if (a === 'all-results') {
    ev.preventDefault();
    navigate(t.getAttribute('href'), { keep: false });
    return;
  }
  if (a === 'previous' || a === 'next' || d.focusIndex !== undefined) {
    ev.preventDefault();
    focus = d.focusIndex === undefined ? focus + (a === 'next' ? 1 : -1) : Number(d.focusIndex);
    let fs = document.querySelector('.focus-side');
    if (fs) {
      fs.outerHTML = preserveLinks(renderFocus(c, focus, params().get('date')), url());
      if (atlas) {
        atlas.opts.spotlight = spotlight(params().get('date'));
        atlas.paint();
      }
      const control =
        d.focusIndex === undefined
          ? document.querySelector('[data-act="' + a + '"]')
          : $('.focus-picker summary');
      control?.focus({ preventScroll: true });
    }
    return;
  }
  if (a === 'filters') {
    filters = !filters;
    draw(false);
    return;
  }
  if (a === 'reset') {
    let u = url();
    ['q', 'region', 'mode', 'status', 'date', 'mapregion', 'view', 'pin', 'corridor'].forEach((k) =>
      u.searchParams.delete(k)
    );
    setU(u);
    if ($('#atlas-query')) $('#atlas-query').value = '';
    draw(false);
    return;
  }
  if (a === 'expand-map') {
    let n = $('.mapwrap'),
      on = n.classList.toggle('expanded');
    document.body.classList.toggle('expanded-map', on);
    t.setAttribute('aria-label', on ? 'Close expanded map' : 'Expand map');
    t.setAttribute('aria-pressed', String(on));
    t.innerHTML = icon(on ? 'close' : 'upRight', 15);
    return;
  }
  if (a === 'zoom-in' || a === 'zoom-out') {
    atlas?.zoom(a === 'zoom-in' ? 1.5 : 1 / 1.5);
    return;
  }
  if (a === 'fit') {
    let u = url();
    u.searchParams.delete('view');
    u.searchParams.delete('pin');
    setU(u);
    draw(false);
    return;
  }
  if (a === 'share') {
    await copyText(location.href, 'Dossier link copied');
    return;
  }
  if (a === 'close-place') {
    closePlace();
    return;
  }
  if (a === 'end-compare') {
    let u = url();
    u.searchParams.delete('compare');
    u.searchParams.delete('view');
    setU(u);
    draw();
    return;
  }
  if (a === 'jump-sources') {
    jump('sources');
    return;
  }
  // Section anchors work as ordinary links when scripts are unavailable.
  if (t.tagName === 'A' && t.origin === location.origin) {
    const target = new URL(t.href);
    if (
      target.pathname.startsWith('/corridors/') &&
      (target.searchParams.has('section') || target.searchParams.has('source'))
    ) {
      ev.preventDefault();
      navigate(target.href);
    }
  }
});
window.addEventListener('pagehide', () => {
  if (c) history.replaceState({ ...history.state, reader: captureReader() }, '');
});
window.addEventListener('popstate', (ev) => {
  if (!c) return;
  if (location.pathname.startsWith('/places/')) {
    location.reload();
    return;
  }
  dismiss();
  closeMatches();
  restoreReader(ev.state?.reader);
});
function restoreReader(saved) {
  const input = $('#atlas-query');
  sheet = saved?.sheet || defaultSheet(params());
  focus = saved?.focus || 0;
  filters = Boolean(saved?.filters);
  if (input) input.value = saved?.query ?? params().get('q') ?? '';
  draw(!saved);
  if (!saved) return;
  requestAnimationFrame(() => {
    if ($('#reader')) $('#reader').scrollTop = saved.reading;
    window.scrollTo({ top: saved.top, behavior: 'instant' });
    if (saved.suggestions && input) {
      input.focus({ preventScroll: true });
      mastResults();
    }
  });
}
document.addEventListener('keydown', (ev) => {
  if (
    ev.key === '/' &&
    !ev.ctrlKey &&
    !ev.metaKey &&
    !ev.altKey &&
    !ev.target.matches('input,textarea,select') &&
    !$('#dialog').open
  ) {
    ev.preventDefault();
    if (c || $('#atlas-query')) search();
    return;
  }
  const inMast = Boolean(ev.target.closest('.atlas-search'));
  const inModalSearch = ev.target.id === 'search-q' || ev.target.closest('#results');
  if ((inMast || inModalSearch) && ['ArrowDown', 'ArrowUp'].includes(ev.key)) {
    if (inMast && $('#atlas-matches')?.hidden) mastResults();
    const results = (inMast ? $('#atlas-matches') : $('#results'))?.querySelectorAll('a[href], button');
    if (results?.length) {
      ev.preventDefault();
      const current = [...results].indexOf(ev.target);
      const index =
        current < 0
          ? ev.key === 'ArrowDown'
            ? 0
            : results.length - 1
          : current + (ev.key === 'ArrowDown' ? 1 : -1);
      const entry = results[index] || (inMast ? $('#atlas-query') : $('#search-q'));
      entry.focus();
    }
    return;
  }
  if (ev.key === 'Escape' && inMast && !$('#atlas-matches')?.hidden) {
    ev.preventDefault();
    $('#atlas-query')?.focus({ preventScroll: true });
    closeMatches();
    return;
  }
  if (ev.key === 'Escape' && !$('#dialog').open) {
    if ($('.mapwrap.expanded')) {
      $('[data-act="expand-map"]').click();
      return;
    }
    if ($('#map-popover')?.innerHTML) {
      const type = $('#map-popover').dataset.type;
      pop(type);
      document.querySelector('[data-pop="' + type + '"]')?.focus({ preventScroll: true });
    } else closePlace();
  }
  if (ev.key === 'Enter' && ev.target.id === 'search-q') {
    let first = $('#results .result');
    if (first) {
      ev.preventDefault();
      first.click();
    }
  }
});
async function json(path) {
  let r = await fetch(path);
  if (!r.ok) throw Error('Unavailable');
  return r.json();
}
async function start() {
  if (/^\/advisory\/?$/.test(location.pathname)) return;
  icons();
  const firstURL = location.href;
  // Keep the server's text and geography on screen while independent assets arrive.
  const catalogFile = json('/data/catalog.json');
  const mapFiles = Promise.allSettled([
    json('/data/features.json').catch(() => json('/api/v1/features')),
    json('/data/relationships.json').catch(() => json('/api/v1/relationships')),
    json('/data/boundaries.json')
  ]);
  try {
    c = await catalogFile;
    history.scrollRestoration = 'manual';
    const input = $('#atlas-query');
    if (input && !input.value) input.value = params().get('q') || '';
    sheet = defaultSheet(params());
    if (input && document.activeElement === input) mastResults();
    let [fs, rels, bd] = await mapFiles;
    if (fs.status === 'fulfilled') geoState.features = fs.value.features || [];
    geoState.failed = fs.status !== 'fulfilled' || rels.status !== 'fulfilled';
    if (rels.status === 'fulfilled')
      geoState.relationships = Array.isArray(rels.value) ? rels.value : rels.value.relationships || [];
    if (bd.status === 'fulfilled') geoState.boundaries = bd.value;
    geoState.ready = true;
    if (geoState.failed) {
      if (firstURL !== location.href) {
        location.reload();
        return;
      }
      const msg = $('#map-status');
      if (msg)
        msg.innerHTML =
          '<span class="map-message">The interactive map could not load. ' +
          '<a href="' +
          e(location.href) +
          '">Reload map</a> or <a href="/index/">browse the index</a>.</span>';
    } else if (history.state?.reader && firstURL === location.href) {
      restoreReader(history.state.reader);
    } else {
      draw(document.activeElement === document.body || document.activeElement === $('#main'));
    }
    if ($('#atlas-matches') && !$('#atlas-matches').hidden) mastResults();
  } catch {
    let n = document.createElement('p');
    n.className = 'historical-note';
    n.textContent =
      'The interactive atlas could not load. The edition and its source links are available below.';
    $('#mainbody').prepend(n);
  }
}
start();
