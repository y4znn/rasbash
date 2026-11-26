import { wordmark } from './wordmark.js';
import { advisoryPage } from './advisory.js';
import {
  e,
  dateLabel,
  norm,
  focusItems,
  renderFocus,
  inquirySection,
  filterRecords,
  sortName,
  listRows,
  pageUrl,
  readSections,
  sourceTitle,
  sourceBody,
  srcRefs,
  about,
  guide,
  eventsAt
} from './records.js';
import { mapShell } from './map.js';
import { icon } from './icons.js';
const gname = (f) => f?.properties?.name || '';
const fid = (f) => f?.properties?.id || f?.id;
export function rrSlugs(r) {
  return r.profiles || r.corridorSlugs || r.corridors || [r.from, r.to].filter(Boolean);
}
function eligibleAt(item, day) {
  return !day || (item.validFrom && item.validFrom <= day && (!item.validTo || item.validTo >= day));
}
function placeUrl(feature, day) {
  return (
    '/places/' + encodeURIComponent(fid(feature)) + '/' + (day ? '?date=' + encodeURIComponent(day) : '')
  );
}
function connectionSources(relation) {
  const records = (relation.evidence || []).map(item => ({url: item.source, locator: item.locator}));
  for (const url of [relation.sourceUrl || relation.source, ...(relation.sources || [])]) {
    if (url && !records.some(record => record.url === url)) {
      records.push({url, locator: url === (relation.sourceUrl || relation.source) ? relation.locator : ''});
    }
  }
  return records.map(({url, locator}, index) =>
    '<details class="connection-citation"><summary>Connection source ' + (index + 1) +
    '</summary><p>' + e(locator || 'See the issuing document.') + '</p><a class="textlink" href="' +
    e(url) + '" target="_blank" rel="noopener">Original document ↗</a></details>'
  ).join('');
}
function placeArticle(feature, c, relations, day) {
  const z = feature.properties;
  const profileFor = (slug) => c.profiles.find((p) => p.slug === slug);
  function profileLink(slug) {
    const p = profileFor(slug);
    return p
      ? '<a href="' +
          pageUrl(p) +
          '?pin=' +
          encodeURIComponent(fid(feature)) +
          (day ? '&amp;date=' + e(day) : '') +
          '">' +
          e(p.name) +
          '</a>'
      : '';
  }
  const rows = z.profiles
    .map((slug) => {
      const member = z.memberships?.find((m) => m.profile === slug);
      return (
        '<li>' +
        profileLink(slug) +
        (member
          ? '<p>' +
            e(member.label || 'Documented association') +
            '</p><details><summary>Membership source</summary><p>' +
            e(member.locator || '') +
            '</p>' +
            '<a href="' +
            e(member.source) +
            '">Original document</a></details>'
          : '') +
        '</li>'
      );
    })
    .join('');
  const pairs = relations
    .filter((r) => r.asset === fid(feature) && eligibleAt(r, day))
    .map((r) => {
      const [a, b] = r.profiles.map(profileFor);
      if (!a || !b) return '';
      const query = new URLSearchParams({ compare: b.slug, pin: fid(feature) });
      if (day) query.set('date', day);
      return (
        '<section class="place-pair"><h3>' +
        e(a.shortName || a.name) +
        ' and ' +
        e(b.shortName || b.name) +
        '</h3><p>' +
        e(r.detail) +
        '</p><a href="' +
        pageUrl(a) +
        '?' +
        e(query.toString()) +
        '">Compare at this place</a>' +
        connectionSources(r) +
        '</section>'
      );
    })
    .join('');
  return (
    '<article class="article place-article"><a class="textlink" href="/index/">Corridor index</a>' +
    '<h1>' +
    e(z.name) +
    '</h1><p class="place-precision">' +
    e(z.precision) +
    '</p><h2>Corridor records</h2>' +
    '<ul class="place-members">' +
    rows +
    '</ul>' +
    (pairs ? '<h2>Documented connections</h2>' + pairs : '') +
    '<h2>Geographic evidence</h2><p>' +
    e(z.locator) +
    '</p><p><a href="' +
    e(z.source || z.sourceUrl) +
    '">Coordinate source</a> · ' +
    e(z.version) +
    ' · ' +
    e(z.licence) +
    '</p>' +
    (z.observedAt ? '<p>Observed on ' + e(dateLabel(z.observedAt)) + '.</p>' : '') +
    (z.validFrom
      ? '<p>Valid from ' +
        e(dateLabel(z.validFrom)) +
        (z.validTo ? ' to ' + e(dateLabel(z.validTo)) : '') +
        '.</p>'
      : '') +
    (z.attribution ? '<p>' + e(z.attribution) + ' <a href="' + e(z.licenceUrl) + '">Licence</a></p>' : '') +
    '</article>'
  );
}
function indexPlaces(features, c, params) {
  const q = norm(params.get('q') || '');
  if (!q) return '';
  const day = params.get('date');
  const scope = new URLSearchParams(params);
  scope.delete('q');
  const profiles = new Set(filterRecords(c, scope).map((p) => p.slug));
  const matches = features
    .filter(
      (f) =>
        eligibleAt(f.properties, day) &&
        f.properties.profiles.some((slug) => profiles.has(slug)) &&
        q.split(' ').every((term) => norm(gname(f)).includes(term))
    )
    .sort((a, b) => gname(a).localeCompare(gname(b)));
  if (!matches.length) return '';
  return (
    '<section class="index-places"><h2>Mapped places and sections</h2><ul>' +
    matches
      .map(
        (f) =>
          '<li><a href="' +
          placeUrl(f, day) +
          '">' +
          e(gname(f)) +
          '</a><span>' +
          e(f.properties.precision) +
          '</span></li>'
      )
      .join('') +
    '</ul></section>'
  );
}
export function geoDetails(p, geos, relations, date) {
  let fs = geos.filter(
    (f) =>
      f.properties.profiles?.includes(p.slug) &&
      (!date ||
        (f.properties.validFrom &&
          f.properties.validFrom <= date &&
          (!f.properties.validTo || f.properties.validTo >= date)))
  );
  let rs = relations.filter(
    (r) =>
      rrSlugs(r).includes(p.slug) &&
      (!date || (r.validFrom && r.validFrom <= date && (!r.validTo || r.validTo >= date)))
  );
  const pointFeatures = fs.filter(f => f.geometry.type === 'Point');
  const linearFeatures = fs.filter(f => f.geometry.type !== 'Point');
  const mappedGroups = [['Places', pointFeatures], ['Route sections', linearFeatures]]
    .filter(([, items]) => items.length).map(([label, items]) =>
      '<div class="reader-places"><h4>' + label + '</h4>' + items.map(f =>
        '<a class="geo-feature" href="' + placeUrl(f, date) + '" data-place="' + e(fid(f)) + '">' +
        e(gname(f)) + '</a>').join('') + '</div>'
    ).join('');
  return (
    '<section class="d-section" id="geography"><h3>Geography</h3>' +
    (mappedGroups || '<p>' + (date ? 'No locations or route sections in the record by ' + e(dateLabel(date)) :
      'Geographic scope: ' + e(p.places?.join(', ') || p.region)) + '.</p>') +
    '</section>' +
    (rs.length
      ? '<section class="d-section"><h3>Connections</h3>' +
        rs
          .map(
            (r) =>
              '<p><strong>' +
              e(r.label || r.name || r.kind) +
              '</strong></p><p>' +
              e(r.detail || r.description || r.statement || r.note || r.locator || '') +
              '</p>' +
              connectionSources(r) +
              rrSlugs(r)
                .filter((s) => s !== p.slug)
                .map(
                  (s) =>
                    '<button class="textlink" data-compare="' +
                    e(s) +
                    '" data-pin="' +
                    e(r.featureId || r.feature || r.asset || '') +
                    '">Compare at this place ' +
                    icon('compare', 12) +
                    '</button>'
                )
                .join('')
          )
          .join('') +
        '</section>'
      : '')
  );
}
export function featureDetail(f, c, rs, day = '') {
  const z = f.properties,
    pr = z.profiles || [],
    members = z.memberships || [];
  const links = pr
    .map((s) => {
      let item = c.profiles.find((x) => x.slug === s);
      return item
        ? '<a class="textlink" href="' +
            pageUrl(item) +
            '?pin=' +
            encodeURIComponent(fid(f)) +
            (day ? '&amp;date=' + encodeURIComponent(day) : '') +
            '" data-slug="' +
            e(s) +
            '" data-pin="' +
            e(fid(f)) +
            '">' +
            e(item.shortName || item.name) +
            ' ' +
            icon('arrow', 12) +
            '</a>'
        : '';
    })
    .join('');
  const atAsset = rs.filter((r) => r.asset === fid(f) && rrSlugs(r).length > 1 && eligibleAt(r, day));
  const compare = atAsset
    .map((r) => {
      const pair = rrSlugs(r).slice(0, 2);
      const names = pair.map((slug) => c.profiles.find((item) => item.slug === slug)?.shortName || slug);
      return (
        '<button class="btn place-compare" data-pair="' +
        e(pair.join(',')) +
        '" data-pin="' +
        e(fid(f)) +
        '">' +
        icon('compare', 15) +
        'Compare ' +
        e(names.join(' and ')) +
        '</button>'
      );
    })
    .join('');
  const geometryOnly = ['Unspecified', 'Road mapped', 'Waterway'].includes(z.serviceStatus);
  const service =
    f.geometry.type.includes('LineString') && z.serviceStatus
      ? '<p class="small">' + e(geometryOnly ? 'Service status unconfirmed' : z.serviceStatus) + '</p>'
      : '';
  const source = z.sourceUrl || z.source,
    notes = members
      .map(
        (m) =>
          '<p><strong>' + e(m.label || 'Documented association') + '</strong><br><a class="textlink" href="' +
          e(m.source) +
          '" target="_blank" rel="noopener">Corridor evidence ↗</a>' +
          e(m.locator || '') +
          '</p>'
      )
      .join('');
  return (
    '<div class="map-pop"><button class="pop-close" data-act="close-place" aria-label="Close location">' +
    icon('close', 14) +
    '</button><span class="eyebrow">' +
    e(z.kind) +
    '</span><h3>' +
    e(gname(f)) +
    '</h3><p class="small low">' +
    e(z.precision || '') +
    '</p>' +
    service +
    '<a class="textlink place-record-link" href="' +
    placeUrl(f, day) +
    '">' + (f.geometry.type.includes('LineString') ? 'Read section record' : 'Read place record') + '</a>' +
    links +
    (atAsset.length > 1
      ? '<details class="pair-picker"><summary>Compare corridors here</summary>' + compare + '</details>'
      : compare) +
    '<details class="geonotes"><summary>Geographic sources</summary><p>' +
    e(z.locator || '') +
    (z.validFrom ? '</p><p>Valid from ' + e(dateLabel(z.validFrom)) : '') +
    (z.observedAt ? '</p><p>Observed ' + e(dateLabel(z.observedAt)) : '') +
    '</p><p>' +
    e(z.version || '') +
    ' · ' +
    e(z.licence || '') +
    '</p>' +
    (z.attribution
      ? '<p>' +
        e(z.attribution) +
        ' <a class="textlink" href="' +
        e(z.licenceUrl) +
        '" target="_blank" rel="noopener">Licence ↗</a></p>'
      : '') +
    (source
      ? '<a class="textlink" href="' + e(source) + '" target="_blank" rel="noopener">Coordinate source ↗</a>'
      : '') +
    notes +
    '</details></div>'
  );
}
function indexHeading(c, params) {
  const region = params.get('region');
  const query = params.get('q');
  const title = query ? 'Search results' : region || 'Corridor index';
  const datedIndex = '/index/' + (params.get('date') ? '?date=' + encodeURIComponent(params.get('date')) : '');
  const scope = query ? 'Results for “' + query + '”' : region ? '' : 'Routes, infrastructure programmes and historical designations.';
  return `<header class="lead index-heading"><div>
    ${region || query ? `<a class="index-return" href="${e(datedIndex)}">Corridor index</a>` : ''}
    <h1>${e(title)}</h1>${scope ? `<p class="lead-sub">${e(scope)}</p>` : ''}
    </div><div class="edition"><span class="eyebrow">Atlas edition</span><div class="edition-date">${e(dateLabel(c.edition))}</div></div></header>`;
}
function filterOpts(c, k) {
  return [...new Set(c.profiles.flatMap((p) => (k === 'mode' ? p.modes : p[k] ? [p[k]] : [])))].sort();
}
export function directory(c, params, opt = {}) {
  let rows = filterRecords(c, params),
    order = params.get('order') || 'name',
    date = params.get('date'),
    filterOn = ['region', 'mode', 'status', 'date', 'q'].filter((k) => params.get(k)),
    limit = opt.full ? rows.length : 8;
  if (order === 'region') rows.sort((a, b) => a.region.localeCompare(b.region) || sortName(a, b));
  let list = rows.slice(0, limit);
  let fields = [
    ['region', 'Region'],
    ['mode', 'Transport mode'],
    ['status', 'Standing']
  ].filter(([k]) => !(k === 'status' && date));
  let filterHTML =
    '<div class="filterbox">' +
    fields
      .map(
        ([k, label]) =>
          '<label>' +
          label +
          '<select data-filter="' +
          k +
          '"><option value="">All ' +
          (k === 'status' ? 'standings' : k === 'mode' ? 'modes' : 'regions') +
          '</option>' +
          filterOpts(c, k)
            .map(
              (v) =>
                '<option ' +
                (v === params.get(k) ? 'selected ' : '') +
                'value="' +
                e(v) +
                '">' +
                e(v) +
                '</option>'
            )
            .join('') +
          '</select></label>'
      )
      .join('') +
    '<label>View at date<input type="date" data-filter="date" max="' +
    c.edition +
    '" value="' +
    e(date || '') +
    '"></label><button class="textlink" data-act="reset">Reset filters</button></div>';
  return (
    '<section class="index-section" aria-label="Corridor index" id="directory"><div class="index-top"><div class="section-title"><h2>' +
    (opt.page ? 'Profiles' : 'Corridor index') +
    '</h2><span class="number">' +
    rows.length +
    '</span></div><div class="filters"><button class="btn" data-act="filters" aria-expanded="' +
    Boolean(opt.filters) +
    '">' +
    icon('sliders', 14) +
    'Filters' +
    (filterOn.length ? ' (' + filterOn.length + ')' : '') +
    '</button><label class="order"><span class="sr-only">Order profiles</span><select data-filter="order"><option value="name">Alphabetical</option><option value="region"' +
    (order === 'region' ? ' selected' : '') +
    '>By region</option></select></label></div></div>' +
    (filterOn.length
      ? '<div class="active-filters">' +
        filterOn
          .map(
            (k) =>
              '<button class="btn" data-remove="' +
              k +
              '">' +
              '<span class="sr-only">Remove ' +
              e(k) +
              ' filter </span>' +
              e(params.get(k)) +
              ' ' +
              icon('close', 11) +
              '</button>'
          )
          .join('') +
        (!opt.filters ? '<button class="textlink" data-act="reset">Reset filters</button>' : '') + '</div>'
      : '') +
    (opt.filters ? filterHTML : '') +
    '<div class="list-head colhead"><span>Corridor or programme</span><span>Region</span><span>Standing</span><span></span></div>' +
    (rows.length
      ? listRows(list, order, date)
      : c.profiles.length
        ? '<div class="empty">No profiles match this view. <a class="textlink" href="/index/" data-act="reset">Reset filters</a></div>'
        : '<div class="empty">The publisher has yet to release profiles for this edition.</div>') +
    (list.length < rows.length
      ? '<a class="btn more" href="/index/?' +
        e(params.toString()) +
        '" data-nav="index">View all ' +
        rows.length +
        ' profiles ' +
        icon('arrow', 14) +
        '</a>'
      : '') +
    '</section>'
  );
}
export function compareCard(c, p, q, features, rels, params) {
  let when = params.get('date');
  let valid = (f) =>
      !when ||
      (f.properties.validFrom &&
        f.properties.validFrom <= when &&
        (!f.properties.validTo || f.properties.validTo >= when)),
    rvalid = (r) => !when || (r.validFrom && r.validFrom <= when && (!r.validTo || r.validTo >= when));
  let shared = features.filter(
      (f) => valid(f) && [p, q].every((x) => f.properties.profiles?.includes(x.slug))
    ),
    connections = rels.filter((r) => rvalid(r) && [p, q].every((x) => rrSlugs(r).includes(x.slug)));
  const pinned = shared.find((f) => fid(f) === params.get('pin')) || shared[0];
  function col(v, i) {
    const obs = when ? eventsAt(v, when).at(-1) : null;
    const evidence = when ? obs?.sourceIds : v.summarySourceIds;
    const membership = pinned?.properties.memberships?.find((m) => m.profile === v.slug);
    const sourceLinks = (evidence || [])
      .map((id) => {
        const source = c.sources[id];
        if (!source) return '';
        const query = new URLSearchParams({ source: id });
        if (when) query.set('date', when);
        return (
          '<a href="' +
          pageUrl(v) +
          '?' +
          e(query.toString()) +
          '#source-' +
          e(id) +
          '">' +
          e(source.issuer || source.title) +
          '</a>'
        );
      })
      .join(' · ');
    return (
      '<article class="compare-col"><div class="cmp-name"><span class="compare-label">' +
      (i ? 'B' : 'A') +
      '</span><h2>' +
      e(v.name) +
      '</h2></div><div class="cmp-field"><h3>Operating conditions</h3>' +
      '<p>' +
      e(when ? obs?.text || 'No observation is available by this date.' : v.summary) +
      '</p>' +
      (!when && v.qualification ? '<p>' + e(v.qualification) + '</p>' : '') +
      '</div><div class="cmp-field"><h3>Evidence date</h3><p>' +
      e(dateLabel(when ? obs?.availableFrom : v.evidenceDate) || 'See original sources') +
      '</p>' +
      sourceLinks +
      (!when && v.qualificationSourceIds?.length
        ? '<p>' +
          v.qualificationSourceIds
            .map(
              (id) =>
                '<a href="' +
                pageUrl(v) +
                '?source=' +
                e(id) +
                '#source-' +
                e(id) +
                '">' +
                e(c.sources[id]?.issuer || 'Source for qualification') +
                '</a>'
            )
            .join(' · ') +
          '</p>'
        : '') +
      '</div>' +
      (pinned
        ? '<div class="cmp-field"><h3>At ' +
          e(gname(pinned)) +
          '</h3><p>' +
          e(membership?.label || 'Recorded location') +
          '</p>' +
          (membership?.source
            ? '<a href="' + e(membership.source) + '" target="_blank" rel="noopener">Membership source</a>'
            : '') +
          '</div>'
        : '') +
      '<a class="cmp-dossier" href="' +
      pageUrl(v) +
      (when ? '?date=' + e(when) : '') +
      '">Read dossier</a></article>'
    );
  }
  return (
    '<section class="comparison" id="comparison"><div class="between"><h1 class="subheading">Compare corridors</h1><button class="btn" data-act="end-compare">Close ' +
    icon('close', 12) +
    '</button></div>' +
    (pinned ? '<p class="cmp-location">' + icon('pin', 15) + e(gname(pinned)) + '</p>' : '') +
    '<div class="compare-grid">' +
    col(p, 0) +
    col(q, 1) +
    '</div><div class="historical-note">' +
    (connections.length
      ? connections
          .map(
            (r) =>
              '<strong>' +
              e(r.label || r.name || r.kind) +
              '</strong> · ' +
              e(r.detail || r.description || r.statement || r.note || r.locator || '') +
              connectionSources(r)
          )
          .join('<br>')
      : shared.length
        ? 'Shared mapped place: ' +
          e(shared.map(gname).join(', ')) +
          '. The record does not establish a freight transfer.'
        : 'These profiles have no documented interchange in this edition.') +
    '</div></section>'
  );
}
export function dossier(c, p, params, features = [], rels = []) {
  const day = params.get('date');
  const sid = params.get('source');
  const summaryIds = p.summarySourceIds || [];
  const scopeIds = p.qualificationSourceIds || [];
  const overviewSource = !day && !params.has('section') && sid &&
    (summaryIds.includes(sid) || scopeIds.includes(sid));
  const nav = day
    ? [['analysis', 'Chronology'], ['geography', 'Geography'], ['sources', 'Sources']]
    : [['overview', 'Overview'], ['analysis', 'Analysis'], ['geography', 'Geography'], ['sources', 'Sources']];
  const requested = params.get('part');
  const active = overviewSource ? 'overview' : params.has('section') || sid ? 'analysis' :
    nav.some(([key]) => key === requested) ? requested : nav[0][0];
  function partLink(key) {
    const query = new URLSearchParams(params);
    for (const name of ['section', 'source', 'cite']) query.delete(name);
    query.set('part', key);
    return pageUrl(p) + '?' + query.toString() + '#reader';
  }
  function panel(key, content) {
    return `<div class="reader-panel reader-${key}" data-current="${active === key}" aria-label="${e(nav.find(item => item[0] === key)?.[1] || key)}">${content}</div>`;
  }
  const navLinks = nav.map(([key, label]) =>
    `<a href="${e(partLink(key))}" data-reader-part="${key}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
  const analysisParams = new URLSearchParams(params);
  if (overviewSource) analysisParams.delete('source');
  const srcIds = day ? [...new Set(eventsAt(p, day).flatMap(event => event.sourceIds))] : p.sourceIds;
  const references = srcIds.map(id => {
    const s = c.sources[id];
    if (!s) return '';
    const title = e(sourceTitle(s));
    const linked = /^https?:\/\//i.test(s.url || '') ? `<a href="${e(s.url)}">${title}</a>` : title;
    return `<li><span class="reader-source-byline">${e([s.issuer, s.date && dateLabel(s.date)].filter(Boolean).join(' · '))}</span>
      ${linked}${s.locator ? `<p>${e(s.locator)}</p>` : ''}
      <button class="textlink" data-copycite="${e(id)}">Copy citation</button><span class="print-citation">${e(s.citation || '')} ${e(s.url || '')}</span></li>`;
  }).join('');
  const sectionLinks = !day && p.sections.filter(s => s.paragraphs?.length).map(s => {
    const title = s.title === 'Documentary record' ? 'Corridor analysis' : s.title;
    return `<a href="?section=${encodeURIComponent(s.id)}#section-${e(s.id)}">${e(title)}</a>`;
  }).join('');
  const overview = day ? '' : panel('overview', `<p class="reader-lead">${e(p.summary)}${srcRefs(summaryIds, p)}</p>
    ${overviewSource && summaryIds.includes(sid) ? sourceBody(c.sources[sid]) : ''}
    <dl class="reader-facts">${[['Places', p.places?.join(', ')], ['Transport', p.modes?.join(', ')], ['Evidence date', p.evidenceDate && dateLabel(p.evidenceDate)]]
      .filter(([, value]) => value).map(([k,v]) => `<div><dt>${k}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>
    ${p.qualification ? '<p class="reader-scope">' + e(p.qualification) + srcRefs(scopeIds, p) + '</p>' : ''}
    ${overviewSource && !summaryIds.includes(sid) ? sourceBody(c.sources[sid]) : ''}`);
  return `<aside class="side dossier-side corridor-reader" aria-label="Dossier" id="reader">
    <div class="side-top"><span class="reader-region">${e(p.region)}</span><a href="/atlas/#world-atlas" data-nav="atlas" class="reader-back">World atlas</a></div>
    <h1 class="d-title">${e(p.name)}</h1><p class="reader-standing">${e(day ? 'As of ' + dateLabel(day) : [p.status, p.kind].filter(Boolean).join(' · '))}</p>
    <nav class="reader-nav" aria-label="Corridor profile">${navLinks}</nav>${overview}
    ${panel('analysis', (sectionLinks && p.sections.length > 1 ? '<nav class="section-jumps" aria-label="Analysis sections">' + sectionLinks + '</nav>' : '') + readSections(c, p, analysisParams))}
    ${panel('geography', geoDetails(p, features, rels, day))}
    ${panel('sources', `<section class="d-section" id="sources"><h3>Sources</h3>
      ${c.manifest.audience === 'owner-private' && p.page ? '<p class="meta">RASBASH Research Initiative · Reference manuscript, p. ' + e(p.page) + '</p>' : ''}
      <ol class="reader-bibliography">${references}</ol></section>`)}
    <div class="reader-tools d-actions"><button class="textlink" data-act="compare">Compare corridors</button><button class="textlink" data-act="share">Copy link</button><button class="textlink" data-act="print">Print</button></div>
    ${active !== 'analysis' || day || !inquirySection(p) ? '<a class="inquiry-link" href="/advisory/?corridor=' + encodeURIComponent(p.slug) + '#enquiry">Discuss this corridor</a>' : ''}
  </aside>`;
}
function gatewayRegister(catalog, features, relations, day) {
  const places = new Map(features.filter(f => eligibleAt(f.properties, day)).map(f => [fid(f), f]));
  const profiles = new Map(catalog.profiles.map(p => [p.slug, p]));
  const groups = new Map();
  for (const relation of relations) {
    if (!['Shared port', 'Shared railway section', 'Shared terminal'].includes(relation.kind) || !eligibleAt(relation, day)) continue;
    const feature = places.get(relation.asset);
    if (!feature || !relation.profiles.every(slug => profiles.has(slug))) continue;
    if (!groups.has(relation.asset)) groups.set(relation.asset, {feature, members: new Set(), pairs: []});
    const group = groups.get(relation.asset);
    relation.profiles.forEach(slug => group.members.add(slug));
    group.pairs.push(relation);
  }
  if (!groups.size) return '';
  const rows = [...groups.values()].sort((a,b) => b.members.size - a.members.size || gname(a.feature).localeCompare(gname(b.feature))).map(group => {
    const {feature, members, pairs} = group;
    const [first, second] = pairs[0].profiles;
    const query = new URLSearchParams({compare: second, pin: fid(feature)});
    if (day) query.set('date', day);
    const names = [...members].map(slug => profiles.get(slug).shortName || profiles.get(slug).name);
    const place = placeUrl(feature, day);
    const caption = [...members].map(slug => {
      const p = profiles.get(slug);
      return '<a href="' + pageUrl(p) + (day ? '?date=' + encodeURIComponent(day) : '') + '">' + e(p.shortName || p.name) + '</a>';
    }).join('<span aria-hidden="true"> / </span>');
    const location = feature.geometry.coordinates;
    const coord = (v, pos, neg) => Math.abs(v).toFixed(1) + '° ' + (v < 0 ? neg : pos);
    const isPoint = feature.geometry.type === 'Point';
    const recordLabel = pairs[0].kind === 'Shared terminal' ? 'Terminal record' : isPoint ? 'Port record' : 'Section record';
    const coords = isPoint ? coord(location[1], 'N', 'S') + '  ' + coord(location[0], 'E', 'W') : 'Railway section';
    const end = pairs.every(relation => relation.validTo) ? pairs.map(relation => relation.validTo).sort().at(-1) : '';
    const period = end ? ' · Recorded through ' + dateLabel(end) : '';
    return '<li><div class="gateway-id"><span class="gateway-coord">' + e(coords + period) + '</span><a class="gateway-name" href="' + place + '">' +
      e(gname(feature)) + '</a></div><div class="gateway-members">' + caption +
      '</div><div class="gateway-actions"><a href="' + pageUrl(profiles.get(first)) + '?' + e(query.toString()) +
      '" aria-label="Compare ' + e(names.slice(0,2).join(' and ')) + ' at ' + e(gname(feature)) +
      '">Compare records</a><a href="' + place + '">' + recordLabel + '</a></div></li>';
  }).join('');
  return '<section class="gateway-register" id="connections" aria-labelledby="gateway-heading"><div class="gateway-intro"><h2 id="gateway-heading">Shared infrastructure</h2><p>Infrastructure named in more than one corridor record.</p></div><ol>' + rows + '</ol></section>';
}
function sectionIndex(catalog, features, day) {
  const groups = new Map();
  const profiles = new Map(catalog.profiles.map(profile => [profile.slug, profile]));
  for (const feature of features) {
    if (!feature.geometry.type.includes('LineString') || !eligibleAt(feature.properties, day)) continue;
    for (const slug of feature.properties.profiles) {
      const profile = profiles.get(slug);
      if (!profile) continue;
      if (!groups.has(profile.region)) groups.set(profile.region, []);
      const query = new URLSearchParams({pin: fid(feature)});
      if (day) query.set('date', day);
      groups.get(profile.region).push({
        name: gname(feature), profile: profile.shortName || profile.name,
        href: pageUrl(profile) + '?' + query.toString()
      });
    }
  }
  const regions = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([region, entries]) => {
    const links = entries.sort((a, b) => a.name.localeCompare(b.name)).map(item =>
      '<li><a href="' + e(item.href) + '"><span>' + e(item.name) + '</span><small>' +
      e(item.profile) + '</small></a></li>'
    ).join('');
    return '<section><h2>' + e(region) + '</h2><ul>' + links + '</ul></section>';
  }).join('');
  return '<article class="mapped-index"><a class="textlink" href="/index/">Corridor index</a>' +
    '<h1>Mapped sections</h1><p>Choose a section to inspect its alignment and source in the corridor dossier.</p>' +
    (regions || '<p>This edition has no mapped sections for the selected period.</p>') + '</article>';
}
function featuredConnection(catalog, features, relations) {
  const profiles = new Map(catalog.profiles.map(profile => [profile.slug, profile]));
  const places = new Map(features.map(feature => [fid(feature), feature]));
  const joint = relations.find(relation => ['Shared port', 'Shared railway section', 'Shared terminal'].includes(relation.kind) &&
    places.has(relation.asset) && relation.profiles.length >= 2 && relation.profiles.every(slug => profiles.has(slug)));
  let reading = '';
  if (joint) {
    const place = places.get(joint.asset);
    const pair = joint.profiles.slice(0, 2).map(slug => profiles.get(slug));
    const comparison = pageUrl(pair[0]) + '?' + new URLSearchParams({compare: pair[1].slug, pin: fid(place)});
    const note = pair.some(profile => profile.slug === 'trans-kalahari-corridor') &&
      pair.some(profile => profile.slug === 'trans-cunene-corridor') && fid(place) === 'ne-port-1730088215'
      ? 'One route turns inland through Botswana toward South Africa. The other runs north toward southern Angola. Both reach the Atlantic here.'
      : joint.detail;
    reading = `<aside class="atlas-lead-note" aria-labelledby="lead-place">
      <p class="atlas-lead-label"><span>${e(joint.kind)}</span><span>${e(pair[0].region)}</span></p>
      <h2 id="lead-place"><a href="${e(placeUrl(place))}">${e(gname(place))}</a></h2>
      <p class="atlas-lead-note-copy">${e(note)}</p>
      <div class="atlas-pair">${pair.map(profile => `<a href="${e(pageUrl(profile))}">${e(profile.shortName || profile.name)}</a>`).join('')}</div>
      <a class="atlas-lead-compare" href="${e(comparison)}">Compare these corridors</a>
    </aside>`;
  }
  return reading;
}
function advisoryIntroduction() {
  return `<section class="advisory-intro" aria-labelledby="advisory-intro-title">
    <div><p class="advisory-byline">${wordmark('atlas-cover-mark')} Communications</p><h2 id="advisory-intro-title">Corridor advisory</h2></div>
    <div class="advisory-note"><p>We brief decision makers on who controls access to a corridor and advise on how to explain a project to its partners, the press and the public.</p><a href="/advisory/">Our advisory work</a></div>
  </section>`;
}
export function renderPage(c, u, opt = {}) {
  let p = c.profiles.find((p) => u.pathname.replace(/\/$/, '') === '/corridors/' + p.slug),
    params = u.searchParams,
    q = c.profiles.find((p) => p.slug === params.get('compare')),
    fs = opt.features || [],
    rs = opt.rels || [],
    date = params.get('date');
  if (u.pathname.startsWith('/places/')) {
    const feature = fs.find(
      (f) => u.pathname.replace(/\/$/, '') === '/places/' + fid(f) && eligibleAt(f.properties, date)
    );
    return feature
      ? placeArticle(feature, c, rs, date)
      : '<article class="article"><h1>Place record unavailable</h1><a href="/index/">Browse the index</a></article>';
  }
  if (/^\/advisory\/?$/.test(u.pathname)) return advisoryPage(c, params);
  if (u.pathname.startsWith('/reference')) return guide(c);
  if (u.pathname.startsWith('/about')) {
    const all = new Set(fs.flatMap((f) => f.properties.profiles)),
      lines = new Set(
        fs.filter((f) => f.geometry.type.includes('LineString')).flatMap((f) => f.properties.profiles)
      ),
      credits = [
        ...new Map(
          fs.filter((f) => f.properties.attribution).map((f) => [f.properties.attribution, f.properties])
        ).values()
      ];
    const profileGaps = c.profiles.length - all.size;
    const pointOnly = all.size - lines.size;
    const coverage =
      '<h2>Edition coverage</h2><p>Of the ' + c.profiles.length + ' profiles in this edition, ' +
      lines.size + ' have mapped sections and ' + pointOnly + ' have locations only.' +
      (profileGaps ? ' The other ' + profileGaps + ' can be read in the index while geographic work continues.' : '') +
      '</p><p>Recorded connections between corridors: ' + rs.length + '.</p>' +
      (lines.size ? '<p><a class="textlink" href="/index/?sections=1">Browse the mapped sections</a></p>' : '');
    const inventory = c.profiles.slice().sort((a,b) => a.name.localeCompare(b.name)).map(profile => {
      const mapped = fs.filter(feature => feature.properties.profiles.includes(profile.slug));
      const sections = mapped.filter(feature => feature.geometry.type.includes('LineString')).length;
      return '<tr><th scope="row"><a href="/atlas/?corridor=' + encodeURIComponent(profile.slug) +
        '#world-atlas">' + e(profile.name) + '</a></th><td>' + (mapped.length - sections) +
        '</td><td>' + sections + '</td></tr>';
    }).join('');
    const coverageTable = '<details id="coverage-by-corridor" class="coverage-inventory"' + (params.get('coverage') === '1' ? ' open' : '') + '><summary>Coverage by corridor</summary>' +
      '<table><caption>Mapped features in this edition</caption><thead><tr><th scope="col">Corridor</th>' +
      '<th scope="col">Locations</th><th scope="col">Sections</th></tr></thead><tbody>' + inventory +
      '</tbody></table></details>';
    const attribution =
      '<h2>Map credits</h2><p>The atlas uses Natural Earth country outlines. Each mapped transport section carries its own geographic source. <a class="textlink" href="https://www.naturalearthdata.com/">Natural Earth ↗</a></p>' +
      credits
        .map(
          (z) =>
            '<p>' +
            e(z.attribution) +
            ' · <a class="textlink" href="' +
            e(z.licenceUrl) +
            '">' +
            e(z.licence) +
            ' ↗</a></p>'
        )
        .join('');
    return about(c).replace(
      '</article>',
      coverage + coverageTable +
        attribution +
        '<p><a class="textlink" href="/reference/">Read API and edition coverage ↗</a></p></article>'
    );
  }
  if (u.pathname.startsWith('/index') && params.get('sections') === '1') return sectionIndex(c, fs, date);
  if (u.pathname.startsWith('/index'))
    return (
      indexHeading(c, params) +
      indexPlaces(fs, c, params) +
      directory(c, params, { full: true, page: true, filters: opt.filters })
    );
  if (!p && !/^\/atlas\/?$/.test(u.pathname))
    return '<article class="article"><h1>Profile unavailable</h1><a class="btn" href="/index/">Browse the corridor index</a></article>';
  if (p)
    return (
      '<nav class="atlas-breadcrumb" aria-label="Breadcrumb"><a href="/atlas/#world-atlas" data-nav="atlas">World atlas</a><span>/</span><a href="/index/?region=' +
      encodeURIComponent(p.region) +
      '">' +
      e(p.region) +
      '</a><span>/</span><span>' +
      e(p.shortName || p.name) +
      '</span></nav>' +
      '<div class="atlas-layout dossier-layout' +
      (q && q !== p ? ' comparing' : '') +
      '" data-sheet="' +
      e(opt.sheet || 'summary') +
      '">' +
      mapShell() +
      '<div class="mobile-tabs"><button data-sheet="summary">Map</button><button data-sheet="half">Split view</button><button data-sheet="full">Read</button></div>' +
      (q && q !== p
        ? '<aside class="side dossier-side compare-side" aria-label="Dossier comparison" id="reader">' +
          compareCard(c, p, q, fs, rs, params) +
          '</aside>'
        : dossier(c, p, params, fs, rs)) +
      '</div>' +
      directory(c, params, { filters: opt.filters })
    );
  const eligible = date ? c.profiles.filter((profile) => eventsAt(profile, date).length) : c.profiles;
  const regions = [...new Set(eligible.map(profile => profile.region))].sort();
  const indexQuery = date ? '?date=' + encodeURIComponent(date) : '';
  const regionLinks = regions.map(region => {
    const query = new URLSearchParams({ region });
    if (date) query.set('date', date);
    return `<a href="/index/?${e(query.toString())}">${e(region)}</a>`;
  }).join('');
  const profiles = filterRecords(c, params);
  const corridor = params.get('corridor') || '';
  const selected = corridor ? profiles.find(profile => profile.slug === corridor) : null;
  const visibleSlugs = new Set(corridor ? (selected ? [selected.slug] : []) : profiles.map(profile => profile.slug));
  const visibleFeatures = fs.filter(feature => feature.properties.profiles.some(slug => visibleSlugs.has(slug)));
  const preview = opt.firstPaint && !params.has('view') && !params.has('mapregion') && !params.has('pin') ?
    {features: visibleFeatures, date: date || '',
     layers: params.has('layers') ? new Set(params.get('layers').split(',')) : null,
     spotlight: selected?.slug || focusItems(c, date)[0]?.slug} : undefined;
  const map = mapShell(preview, {profiles, corridor, params});
  const recorded = visibleFeatures.filter(feature => eligibleAt(feature.properties, date));
  const recordedSections = recorded.filter(feature => feature.geometry.type.includes('LineString'));
  const recordedPlaces = recorded.filter(feature => feature.geometry.type === 'Point');
  const featureGroups = selected ? [['Route sections', recordedSections], ['Locations', recordedPlaces]]
    .filter(([, items]) => items.length).map(([label, items]) =>
      '<section><h3>' + label + '</h3><ul>' + [...items].sort((a,b) => gname(a).localeCompare(gname(b)))
        .map(feature => '<li><a href="' + placeUrl(feature, date) + '">' + e(gname(feature)) + '</a></li>')
        .join('') + '</ul></section>').join('') : '';
  const geographyRegister = featureGroups
    ? '<details class="selected-geography"><summary>Recorded geography · ' +
      recordedSections.length + (recordedSections.length === 1 ? ' section' : ' sections') + ', ' +
      recordedPlaces.length + (recordedPlaces.length === 1 ? ' location' : ' locations') +
      '</summary><div>' + featureGroups + '</div></details>' : '';
  const connections = gatewayRegister(c, fs, corridor ? rs.filter(relation => rrSlugs(relation).includes(corridor)) : rs, date);
  const reviewed = [...fs.map(f => f.properties.observedAt), ...rs.map(r => r.observedAt)].filter(Boolean).sort().at(-1);
  const filtered = ['view', 'mapregion', 'pin', 'date', 'region', 'q', 'mode', 'status', 'layers', 'corridor'].some(key => params.has(key));
  const connection = filtered ? '' : featuredConnection(c, fs, rs);
  const focusPanel = corridor && !selected
    ? '<aside class="focus-side dossier-spread"><h2>Corridor unavailable</h2><p class="blurb">Select another corridor or adjust the filters.</p><a class="textlink" href="/atlas/#world-atlas">Return to the world atlas</a></aside>'
    : renderFocus(selected ? {...c, profiles:[selected]} : c, selected ? 0 : opt.focus || 0, date);
  return `<section class="atlas-opening" id="world-atlas" tabindex="-1" aria-labelledby="atlas-heading">
    <header class="atlas-titlebar"><div><h1 id="atlas-heading">World atlas</h1><p>Economic corridors and their infrastructure</p></div>
      <div class="atlas-edition"><span>Atlas edition</span><time datetime="${e(c.edition)}">${e(dateLabel(c.edition))}</time>${reviewed && reviewed !== c.edition ? '<span class="map-reviewed">Geography updated · ' + e(dateLabel(reviewed)) + '</span>' : ''}</div></header>
    <div class="atlas-workspace"><div class="sheet-map">${map}</div></div>${geographyRegister}
    <nav class="region-strip" aria-label="Browse profiles by region">
      <a class="region-index" href="/index/${e(indexQuery)}">Index <span>${eligible.length}</span></a>
      ${regionLinks}
      ${fs.some(f => f.geometry.type.includes('LineString') && eligibleAt(f.properties, date)) ?
        '<a class="section-index-link" href="/index/?sections=1' + (date ? '&amp;date=' + e(date) : '') + '">Mapped sections ' + icon('arrow', 13) + '</a>' : ''}
      <a href="/about/?coverage=1#coverage-by-corridor">Map coverage</a>
    </nav>
  </section><div class="atlas-reading${connection ? ' has-connection' : ''}"><div class="atlas-feature">${focusPanel}</div>${connection}</div>` +
    connections + (!filtered ? advisoryIntroduction() : '') + directory(c, params, { filters: opt.filters });

}

export function preserveLinks(html, u) {
  return html.replace(/href="([^"]*\?(?:source|section)=[^"]*)"/g, (attr, raw) => {
    const link = new URL(raw.replace(/&amp;/g, '&'), u);
    const retain =
      link.pathname === u.pathname && !u.searchParams.has('compare')
        ? ['date', 'layers', 'pin', 'view', 'section']
        : ['date', 'layers'];
    for (const k of retain)
      if (!link.searchParams.has(k) && u.searchParams.has(k)) link.searchParams.set(k, u.searchParams.get(k));
    return 'href="' + e(link.pathname + link.search + link.hash) + '"';
  });
}
