import { icon } from './icons.js';
export const clean = (s) => String(s ?? '').replace(/[\u2013\u2014]/g, '-');
export const e = (s) =>
  clean(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
export const norm = (s) =>
  clean(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
export const dateLabel = (v) => {
  if (!v) return '';
  if (/^\d{4}-\d\d$/.test(v))
    return new Date(v + '-15T12:00:00Z').toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC'
    });
  if (!/^\d{4}-\d\d-\d\d$/.test(v)) return clean(v);
  return new Date(v + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
};
export const pageUrl = (p) => '/corridors/' + encodeURIComponent(p.slug) + '/';
export function focusItems(c, day = '') {
  if (day) return c.profiles.filter((p) => eventsAt(p, day).length);
  const featured = c.profiles.filter((p) => p.focus).sort((a, b) => a.focus.rank - b.focus.rank);
  if (c.manifest?.audience === 'public') {
    return [...featured, ...c.profiles.filter(p => !p.focus).sort(sortName)];
  }
  return featured.length ? featured : c.profiles.slice(0, 1);
}

function focusPicker(profiles, current, date) {
  if (profiles.length < 2) return '';
  const choices = profiles.map((p, i) => {
    if (i === current) return '';
    const href = pageUrl(p) + (date ? '?date=' + encodeURIComponent(date) : '');
    return `<a href="${href}" data-focus-index="${i}"><span>${e(p.shortName || p.name)}</span><small>${e(p.region)}</small></a>`;
  }).join('');
  return `<details class="focus-picker"><summary>Choose a corridor</summary><nav aria-label="Dossier selection">${choices}</nav></details>`;
}

export function renderFocus(c, fidx = 0, day = '') {
  const items = focusItems(c, day);
  if (!items.length) {
    return day
      ? `<aside class="focus-side dossier-spread"><span class="eyebrow">Historical view</span><h2>No dated entries</h2>
        <p class="blurb">The earliest available observations in this edition fall after ${e(dateLabel(day))}, or have no verified date.</p>
        <button class="btn" data-remove="date">Return to current view</button></aside>`
      : '<aside class="focus-side dossier-spread"><h2>Corridor index</h2><p class="blurb">There are no corridors in this edition.</p><a class="textlink" href="/about/">Read about the atlas</a></aside>';
  }
  const idx = ((fidx % items.length) + items.length) % items.length;
  const p = items[idx];
  const event = day ? eventsAt(p, day).at(-1) : null;
  const section = !day && p.sections.find((s) => s.id === p.focus?.section);
  const dossierUrl = pageUrl(p) + (day ? '?date=' + encodeURIComponent(day) : '');
  const refs = event ? event.sourceIds : p.summarySourceIds;
  const source = (refs || []).map((sid) => {
    const evidenceUrl = pageUrl(p) + '?' + new URLSearchParams({ ...(day ? { date: day } : {}), source: sid }) +
      '#source-' + encodeURIComponent(sid);
    const n = p.sourceIds.indexOf(sid) + 1;
    return `<a class="focus-ref" href="${e(evidenceUrl)}" aria-label="Read source ${n} for the featured passage"><sup>${n}</sup></a>`;
  }).join('');
  const related = section
    ? `<a class="focus-related" href="${pageUrl(p)}?section=${encodeURIComponent(section.id)}#section-${encodeURIComponent(section.id)}">${e(section.title)}</a>`
    : '';
  const pager = items.length > 1 ? `<div class="pager"><button class="step" data-act="previous" aria-label="Previous featured dossier">${icon('left', 14)}</button><button class="step" data-act="next" aria-label="Next featured dossier">${icon('right', 14)}</button></div>` : '';
  return `<aside class="focus-side dossier-spread${day ? ' historical-side' : ''}" aria-label="Selected dossier">
    <div class="spread-copy"><header class="spread-header"><span class="eyebrow">${day ? 'Historical record' : 'In focus'}</span>
    ${items.length > 1 ? `<div class="spread-paging"><span aria-label="Dossier ${idx + 1} of ${items.length}">${String(idx + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}</span>${pager}</div>` : ''}</header>
    <div class="focus-details"><div class="region meta">${e(p.region)} <span aria-hidden="true">/</span> ${e(day ? dateLabel(event.date) : p.status)}</div>
    <h2><a href="${e(dossierUrl)}" data-slug="${e(p.slug)}">${e(p.shortName || p.name)}</a></h2><p class="blurb">${e(event ? event.text : p.focus?.excerpt || p.summary)}${source}</p></div>
    <div class="cardend"><a class="darkbtn" href="${e(dossierUrl)}" data-slug="${e(p.slug)}">${day ? 'Open historical record' : 'Explore corridor'}</a>${related}</div>
    ${focusPicker(items, idx, day)}</div></aside>`;
}
export function searchCatalog(c, q) {
  let s = norm(q),
    tokens = s.split(' ').filter(Boolean);
  if (!tokens.length) return [...c.profiles].sort(sortName);
  return c.profiles
    .map((p) => {
      let name = norm(p.name),
        aliases = p.aliases.map(norm),
        hay = [name, ...aliases, ...p.places.map(norm), norm(p.region), ...p.modes.map(norm)].join(' ');
      return {
        p,
        score: !tokens.every((t) => hay.includes(t))
          ? 0
          : aliases.includes(s) || name === s
            ? 5
            : name.startsWith(s)
              ? 4
              : name.includes(s)
                ? 3
                : aliases.some((a) => a.includes(s))
                  ? 2
                  : 1
      };
    })
    .filter((r) => r.score)
    .sort((a, b) => b.score - a.score || sortName(a.p, b.p))
    .map((x) => x.p);
}
export const sortName = (a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' });
export const eventsAt = (p, when) =>
  (p.events || []).filter(
    (ev) => ev.availableFrom && ev.availableFrom <= when && (!ev.date || ev.date <= when)
  ).sort((a, b) => a.availableFrom.localeCompare(b.availableFrom) || (a.date || '').localeCompare(b.date || ''));
export function filterRecords(c, params) {
  let q = params.get('q') || '',
    d = params.get('date');
  return searchCatalog(c, q).filter(
    (p) =>
      (!d || eventsAt(p, d).length) &&
      (!params.get('region') || p.region === params.get('region')) &&
      (!params.get('mode') || p.modes.includes(params.get('mode'))) &&
      (!params.get('status') || (!d && p.status === params.get('status')))
  );
}
export function row(p, date) {
  let status = date ? 'Dated evidence' : p.status;
  return (
    '<a class="directory-row" href="' +
    pageUrl(p) +
    (date ? '?date=' + date : '') +
    '" data-slug="' +
    e(p.slug) +
    '"><span class="entry-title">' +
    e(p.name) +
    '</span><span class="reg">' +
    e(p.region) +
    '</span><span class="status-cell"><span class="status ' +
    e(norm(status)) +
    '"><i></i>' +
    e(status) +
    '</span></span><span class="go">' +
    icon('upRight', 14) +
    '</span></a>'
  );
}
export function listRows(rows, sort, date) {
  let g = '';
  return rows
    .map((p) => {
      let title = '';
      if (sort === 'region' && g !== p.region) {
        g = p.region;
        title = '<h3 class="regionbreak">' + e(g) + '</h3>';
      }
      return title + row(p, date);
    })
    .join('');
}
export function sourceTitle(s) {
  return s?.title || s?.citation || 'Source note';
}

export function citationText(s) {
  if (!s) return '';
  if (!s.title || !s.issuer) return [s.citation, s.url].filter(Boolean).join(' ');
  let text = (s.citation || '').trim().replace(/[.,\s]+$/, '');
  if (!text) text = s.issuer + ', “' + s.title.replace(/[.,]+$/, '') + ',” ' + (s.locator || '');
  // Original notes retain the publisher's report or article citation style. Some repeated
  // references omit a date supplied by the complete note to the same publication.
  if (s.date) {
    const gb = dateLabel(s.date);
    let us = gb;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s.date)) {
      us = new Date(s.date + 'T12:00:00Z').toLocaleDateString('en-US', {year:'numeric',month:'long',day:'numeric',timeZone:'UTC'});
    }
    if (![gb, us, s.date].some((date) => text.includes(date))) {
      const locator = (s.locator || '').replace(/[.,\s]+$/, '');
      const place = locator && text.lastIndexOf(locator);
      if (place && place > 0) text = text.slice(0, place) + gb + ', ' + text.slice(place);
      else text += ', ' + gb;
    }
  }
  return text + '.' + (s.url ? ' ' + s.url : '');
}

function locatorLabel(locator) {
  if (/^\d+$/.test(locator)) return 'Page ' + locator;
  if (/^\d+(?:,\s*\d+)+$/.test(locator)) return 'Pages ' + locator;
  return locator || '';
}

export function sourceBody(s, anchorId = '') {
  if (!s) return '';
  const url = /^https?:\/\//i.test(s.url || '') ? s.url : '';
  const linkedPinpoint = s.locator ? '<p class="source-locator">' + e(locatorLabel(s.locator)) + '</p>' : '';
  return `<aside class="source-card" aria-label="Source note" id="${e(anchorId || 'source-' + s.id)}">
    <span class="eyebrow">${e(s.issuer || 'Source note')}</span><p class="source-name"><strong>${e(sourceTitle(s))}</strong></p>
    ${linkedPinpoint}${s.date ? '<p class="source-date">Published ' + e(dateLabel(s.date)) + '</p>' : '<p class="source-date">Publication date unrecorded</p>'}
    ${s.accessed ? '<p class="source-date">Accessed ' + e(dateLabel(s.accessed)) + '</p>' : ''}
    ${url ? '<a class="textlink" href="' + e(url) + '" target="_blank" rel="noopener noreferrer">Original source ' + icon('upRight', 12) + '</a>' : ''}
    <button class="textlink" data-copycite="${e(s.id)}">Copy citation ${icon('copy', 12)}</button>
    <button class="textlink source-return" data-act="close-source">Return to passage</button></aside>`;
}

export function srcRefs(ids, p, section = '', counts) {
  return (ids || []).map((sid) => {
    const number = p.sourceIds.indexOf(sid) + 1;
    if (!number) return '';
    const query = new URLSearchParams({ source: sid });
    if (section) {
      query.set('section', section);
      if (counts) {
        const count = (counts.get(sid) || 0) + 1;
        counts.set(sid, count);
        query.set('cite', String(count));
      }
    }
    const href = pageUrl(p) + '?' + query.toString() + '#source-' + encodeURIComponent(sid);
    return `<a class="source-ref" href="${e(href)}" data-sid="${e(sid)}" aria-label="Open source note ${number}">${number}</a>`;
  }).join('');
}

function contextualSource(c, ids, context) {
  const { active, section, requestedSection, occurrence, counts, seen } = context;
  if (!active || seen.has(active) || !ids.includes(active)) return '';
  if (requestedSection && (requestedSection !== section || (counts.get(active) || 1) !== occurrence)) return '';
  seen.add(active);
  return sourceBody(c.sources[active]);
}

function dossierParagraph(para, p, c, context) {
  const ids = para.sourceIds || [];
  return '<p>' + e(para.text) + srcRefs(ids, p, context.section, context.counts) + '</p>' +
    contextualSource(c, ids, context);
}

function financingComparison(p, c, context) {
  const accounts = (p.events || []).filter((ev) => ev.account?.section === context.section);
  if (accounts.length < 2) return '';
  const currency = new Intl.DisplayNames('en', { type: 'currency' });
  const columns = accounts.map((ev) => {
    const src = c.sources[ev.sourceIds[0]];
    if (!src) return '';
    const { amount, currency: code } = ev.account;
    const quantity = new Intl.NumberFormat('en-GB', { notation: 'compact', compactDisplay: 'long', maximumFractionDigits: 6 }).format(amount);
    const display = code === 'USD' ? 'US$' + quantity : quantity + ' ' + code;
    const amountTitle = new Intl.NumberFormat('en-GB').format(amount) + ' ' + currency.of(code);
    return `<div class="account"><span class="eyebrow">${e(src.issuer)}</span><strong title="${e(amountTitle)}">${e(display)}</strong>
      <span class="account-date">Reported ${e(dateLabel(src.date || ev.availableFrom))}</span>
      <div class="account-links">${srcRefs(ev.sourceIds, p, context.section, context.counts)}
      ${/^https?:\/\//i.test(src.url || '') ? '<a class="textlink account-original" target="_blank" rel="noopener noreferrer" href="' + e(src.url) + '" aria-label="Read the statement from ' + e(src.issuer) + '">Read statement ' + icon('upRight', 12) + '</a>' : ''}</div>
      ${contextualSource(c, ev.sourceIds, context)}</div>`;
  }).join('');
  const scope = accounts.every((ev) => ev.account.scope === accounts[0].account.scope) ? accounts[0].account.scope : '';
  return (scope ? '<p class="account-scope">' + e(scope) + '</p>' : '') + '<div class="fin-pair">' + columns + '</div>';
}

export function inquirySection(p) {
  const preferred = (p.events || []).find((ev) => ev.account)?.account.section;
  return (p.sections || []).find((s) => s.id === preferred)?.id ||
    (p.sections || []).find((s) => /\b(access|investment|financing|concession|authority|agreement|customs|tariff|implementation)\b/i.test(s.title))?.id || null;
}

export function readSections(c, p, params) {
  const day = params.get('date');
  const active = params.get('source');
  const requestedSection = day ? '' : params.get('section') || '';
  const seen = new Set(!day && !requestedSection && p.summarySourceIds?.includes(active) ? [active] : []);
  let context = {
    active, requestedSection, occurrence: Math.max(1, Number(params.get('cite')) || 1),
    seen, section: '', counts: new Map()
  };
  if (day) {
    const ev = eventsAt(p, day);
    const dated = ev.map((x) => {
      const separateDate = x.availableFrom && x.availableFrom !== x.date;
      return '<div class="meta">Observed ' + e(dateLabel(x.date)) + '</div>' +
        dossierParagraph(x, p, c, context) + (separateDate
          ? '<p class="observation-date">On record by ' + e(dateLabel(x.availableFrom)) + '</p>' : '');
    }).join('');
    return '<div class="d-section"><h3>Evidence by ' + e(dateLabel(day)) + '</h3>' +
      (dated || '<p>The edition has no dated observation for this profile by the selected day.</p>') + '</div>';
  }
  const inquiry = inquirySection(p);
  const sections = (p.sections || []).filter((s) => s.paragraphs?.length).map((s) => {
    context.section = s.id;
    context.counts = new Map();
    const comparison = financingComparison(p, c, context);
    const paragraphs = s.paragraphs.map((x) => dossierParagraph(x, p, c, context)).join('');
    const invite = s.id === inquiry
      ? `<a class="inquiry-link" href="/advisory/?corridor=${encodeURIComponent(p.slug)}&amp;section=${encodeURIComponent(s.id)}#enquiry">Discuss this corridor</a>`
      : '';
    return `<section class="d-section" id="section-${e(s.id)}" data-sec="${e(s.id)}">
      <h3>${e(s.title === 'Documentary record' ? 'Corridor analysis' : s.title)}</h3>${comparison}${paragraphs}<div class="section-actions">
      <button class="textlink" data-section-link="${e(s.id)}">Link to section ${icon('share', 12)}</button>
      ${invite}</div></section>`;
  }).join('');
  return sections + (active && !seen.has(active) && p.sourceIds.includes(active) ? sourceBody(c.sources[active]) : '');
}
export function indexSSR(c, params = new URLSearchParams()) {
  let rows = filterRecords(c, params);
  return (
    '<div class="lead"><div><h1>Corridor index</h1><p class="lead-sub">' +
    rows.length +
    ' corridor and programme profiles.</p></div></div><section class="index-section"><div class="list-head colhead"><span>Corridor or programme</span><span>Region</span><span>Standing</span><span></span></div>' +
    listRows(rows, '', params.get('date')) +
    '</section>'
  );
}
export function about(c) {
  const edition = e(dateLabel(c.edition));
  const profile = c.profiles.find(item => item.events?.some(event => {
    const account = event.account;
    return account && item.events.some(other => other.account?.section === account.section &&
      other.account.scope === account.scope && other.account.currency === account.currency &&
      other.account.amount !== account.amount);
  }));
  const section = profile?.sections.find(item => item.id === inquirySection(profile));
  const example = section
    ? `<p>Before quoting a financing total, a spokesperson needs to know who reported it and what it covers. This dossier compares two accounts of the same transaction. <a class="textlink" href="${pageUrl(profile)}?section=${encodeURIComponent(section.id)}#section-${encodeURIComponent(section.id)}">${e(profile.shortName || profile.name)} · ${e(section.title)}</a></p>`
    : '';
  const provenance = c.manifest.audience === 'owner-private'
    ? 'The dossiers draw on <em>Economic Corridors Around the World</em>, prepared by the RASBASH Research Initiative.'
    : 'Each public dossier cites the institutions and documents on which its account rests.';
  return `<article class="article"><span class="eyebrow">RASBASH Communications</span><h1>About The Corridor</h1>
    <p>The Corridor is the economic corridor atlas of RASBASH Communications. We advise individuals and organisations on the interests behind infrastructure projects and on how to speak about them in public.</p>
    <h2>Corridor advisory</h2><p>Before a meeting, we can brief a client on who controls access to a route and whose agreement the next step requires. Ahead of an announcement, we help the client explain what has been agreed and prepare for the questions it will draw.</p>
    ${example}
    <h2>The research edition</h2><p>RASBASH Communications edits the atlas. ${provenance} The index contains ${c.profiles.length} profiles in the ${edition} research edition.</p>
    <h2 id="geography">Reading the map</h2><p>Circles mark named places. Facility symbols mark infrastructure. A line follows the section for which we can identify a geographic source. Select a port or railway section to see which corridor records name it and under what terms.</p>
    <h2>Reading a historical view</h2><p>Select a date to see the evidence available at the time. A later account of an earlier event first appears on the date of that account.</p>
    <h2 id="economic-evidence">Reading the economic evidence</h2>
    <p>A completed road tells us where vehicles can travel. Assessing its economic effect requires evidence on who gained access and what changed for them. The World Bank distinguishes the works themselves, changes in accessibility and trade, and outcomes such as wages or employment. <a class="textlink" href="https://thedocs.worldbank.org/en/doc/148001588854905473-0050022020/original/SpringboardieConnectCorridorSession.pdf#page=10">World Bank, <em>Economic Corridors</em>, pp. 9 to 10</a></p>
    <p>A border can shape a route as much as its track or road. In Central Asia, the OECD examines customs procedures, digital transport documents and cooperation between authorities. Each dossier identifies the institution responsible where the sources permit. <a class="textlink" href="https://www.oecd.org/en/topics/policy-issues/regional-economic-corridors.html">OECD, “Regional Economic Corridors”, section on trade facilitation in Central Asia</a></p>
    <p>PortWatch uses maritime observations to estimate trade activity. Assigning a share of traffic to an inland corridor requires a separate freight or operator record. <a class="textlink" href="https://portwatch.imf.org/pages/economy-monitor">IMF PortWatch, Economy Monitor</a></p>
    <h2>Sources and corrections</h2><p>A numbered note opens beside the passage it supports and identifies the issuing organisation and the original document. To raise a question about a passage, choose “Discuss this corridor” in the dossier. Its link accompanies your inquiry.</p>
    <a class="btn" href="/index/" data-nav="index">Browse the index</a></article>`;
}
export function guide(c) {
  const p = focusItems(c)[0];
  const alias = p?.aliases?.[0] || p?.name;
  const examples = [
    ['Release and geographic coverage', '/api/v1/release'],
    ['Searchable directory', '/api/v1/corridors']
  ];
  if (p) {
    examples.push(['Search by name or alias', '/api/v1/corridors?q=' + encodeURIComponent(alias)]);
    examples.push(['Read a dossier', '/api/v1/corridors/' + encodeURIComponent(p.slug)]);
    const dated = p.events?.find((ev) => ev.availableFrom);
    if (dated) examples.push(['Read dated evidence', '/api/v1/corridors/' + encodeURIComponent(p.slug) + '?date=' + dated.availableFrom]);
    examples.push(['Find connections for one record', '/api/v1/relationships?entity=' + encodeURIComponent(p.slug)]);
    if (p.sourceIds[0]) examples.push(['Read a source card', '/api/v1/sources/' + encodeURIComponent(p.sourceIds[0])]);
  }
  examples.push(['Find features in a bounding box', '/api/v1/features?bbox=-180,-90,180,90']);
  examples.push(['Read the edition history', '/api/v1/changes']);
  return (
    '<article class="article"><span class="eyebrow">Developer reference</span><h1>Read the atlas API</h1><p>The interface and the read API share one edition. Responses identify the edition in the <code>X-Atlas-Edition</code> header. Dates use ISO calendar notation. Geographic coordinates use longitude, latitude in WGS84.</p><h2>Queries</h2><div class="api-examples">' +
    examples
      .map(
        ([label, url]) =>
          '<p><a class="textlink" href="' +
          e(url) +
          '">' +
          e(label) +
          ' ↗</a><br><code>' +
          e(url) +
          '</code></p>'
      )
      .join('') +
    '</div><h2>Filter fields</h2><p>The corridor collection accepts <code>q</code>, <code>region</code>, <code>mode</code>, <code>status</code> and <code>date</code>. Dated results contain only observations available by the requested day. The features endpoint accepts <code>entity</code>, <code>bbox</code> and <code>date</code>. A bounding box takes west, south, east and north. West greater than east crosses the antimeridian.</p><h2>Geographic precision</h2><p>Each feature provides an identifier, a geometry revision, a geographic source and its link to a named corridor. A point can identify a locality or the representative location of a port. Inspect its precision before interpreting a coordinate as a terminal.</p><h2>Edition updates</h2><p>Editors stage files, inspect changes and promote an edition. An inquiry or a read request cannot change a record. The change feed identifies additions, revisions and removals. The prior edition can be restored from its saved version.</p><a class="btn" href="/about/" data-nav="about">About the atlas ' +
    icon('arrow', 14) +
    '</a></article>'
  );
}
