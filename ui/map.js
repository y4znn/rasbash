import { icon } from './icons.js';
import { norm } from './records.js';
const X = [
    1, 0.9986, 0.9954, 0.99, 0.9822, 0.973, 0.96, 0.9427, 0.9216, 0.8962, 0.8679, 0.835, 0.7986, 0.7597,
    0.7186, 0.6732, 0.6213, 0.5722, 0.5322
  ],
  Y = [
    0, 0.062, 0.124, 0.186, 0.248, 0.31, 0.372, 0.434, 0.4958, 0.5571, 0.6176, 0.6769, 0.7346, 0.7903, 0.8435,
    0.8936, 0.9394, 0.9761, 1
  ];
function interp(a, lat) {
  let v = Math.min(18, Math.abs(lat) / 5),
    i = Math.floor(v);
  return a[i] + ((a[i + 1] ?? a[i]) - a[i]) * (v - i);
}
export function project([lon, lat]) {
  return [500 + (lon / 180) * 495 * interp(X, lat), 251 - Math.sign(lat) * 249 * interp(Y, lat)];
}
export const geoState = { features: [], relationships: [], boundaries: [], ready: false };
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const stateRegions = {
  Africa: [19, 1, 2.8],
  Americas: [-81, 8, 1.65],
  Europe: [13, 50, 4],
  Asia: [88, 32, 2.25],
  'Middle East': [49, 29, 3.8],
  Oceania: [140, -18, 3.2],
  'Asia and the Pacific': [102, 19, 1.7],
  'West Asia and Eurasia': [59, 34, 2.4]
};
const labels = [
  ['NORTH AMERICA', -102, 47],
  ['SOUTH AMERICA', -60, -14],
  ['AFRICA', 17, 5],
  ['EUROPE', 20, 59],
  ['ASIA', 96, 51],
  ['OCEANIA', 137, -26],
  ['Pacific Ocean', -137, -9],
  ['Atlantic Ocean', -34, 15],
  ['Indian Ocean', 75, -16],
  ['Pacific Ocean', 160, 9]
];
function pathLine(coordinates) {
  let previousLongitude;
  return coordinates
    .map(([lon, lat]) => {
      let [x, y] = project([lon, lat]);
      // A disconnected fragment at the date line must never draw across the sheet.
      const start = previousLongitude === undefined || Math.abs(lon - previousLongitude) > 180;
      previousLongitude = lon;
      return (start ? 'M' : 'L') + x.toFixed(2) + ',' + y.toFixed(2);
    })
    .join(' ');
}
const grid = [];
for (let lon = -180; lon <= 180; lon += 30) {
  grid.push(pathLine(Array.from({ length: 85 }, (_, i) => [lon, i * 2 - 84])));
}
for (let lat = -60; lat <= 80; lat += 20) {
  grid.push(pathLine(Array.from({ length: 91 }, (_, i) => [i * 4 - 180, lat])));
}
export function featuresFor(slug) {
  return geoState.features.filter((f) => f.properties.profiles?.includes(slug));
}
function activeDate(f, date) {
  if (!date) return true;
  let p = f.properties;
  if (!p.validFrom) return false;
  return String(p.validFrom) <= date && (!p.validTo || p.validTo >= date);
}
const lineStyles = {
  operating: { label: 'Operating', dash: '' },
  works: { label: 'Under construction', dash: '7 4' },
  proposed: { label: 'Proposed', dash: '1 4' },
  mapped: { label: 'Service unconfirmed', dash: '7 3 1 3' }
};
function lineState(p) {
  const service = String(p.serviceStatus || '').toLowerCase();
  const stage = String(p.deliveryStage || '').toLowerCase();
  if (/^(operating|operational|in service)$/.test(service)) return 'operating';
  if (/under construction|in construction|works underway/.test(stage + ' ' + service)) return 'works';
  if (/propos|planned/.test(stage + ' ' + service)) return 'proposed';
  return 'mapped';
}
function slugOf(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
function legendLine(key) {
  const { label, dash } = lineStyles[key];
  return (
    '<span class="key"><svg aria-hidden="true" width="22" height="8" viewBox="0 0 22 8"><path d="M1 4H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="' +
    dash +
    '"/></svg>' +
    label +
    '</span>'
  );
}
const panOffsets = { north: [0, -1], west: [-1, 0], east: [1, 0], south: [0, 1] };
function control(act, label, symbol, size = 16) {
  return (
    '<button type="button" class="square" data-act="' +
    act +
    '" aria-label="' +
    label +
    '" title="' +
    label +
    '">' +
    icon(symbol, size) +
    '</button>'
  );
}
const interactiveMapLabel =
  'Interactive map. Use the arrow keys to pan, plus or minus to zoom, and Home to fit the view. Map navigation also lists the visible features.';
const localFeature = (f) => /loca|city|town/i.test(f.properties.kind);

function featuredPoint(places, slug) {
  if (!slug) return null;
  return (
    places
      .filter((p) => p.f.properties.profiles?.includes(slug))
      .sort(
        (a, b) =>
          profileTokenScore(b.f, slug) - profileTokenScore(a.f, slug) ||
          Number(a.local) - Number(b.local) ||
          a.f.properties.name.localeCompare(b.f.properties.name)
      )[0]?.f || null
  );
}

function featureLegend(places, lineKeys, date) {
  const keys = [];
  if (places.some((p) => p.local)) keys.push('<span class="key"><i class="dotloc"></i>Locality</span>');
  if (places.some((p) => !p.local))
    keys.push('<span class="key"><i class="dotasset"></i>Infrastructure</span>');
  for (const key of Object.keys(lineStyles)) if (lineKeys.has(key)) keys.push(legendLine(key));
  if (!keys.length) keys.push('<span class="key">Base map</span>');
  if (date)
    keys.push('<span class="key map-context-line">As of ' + esc(date) + ' · Reference boundaries</span>');
  return keys.join('');
}

const worldPaths = new WeakMap();
export function worldPath(f) {
  if (worldPaths.has(f)) return worldPaths.get(f);
  const g = f.geometry,
    parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const fragments = [];
  for (const part of parts) {
    let last, previousLon;
    const path = [];
    for (let i = 0; i < part.length; i++) {
      const lon = part[i][0],
        point = project(part[i]);
      const move = previousLon === undefined || Math.abs(lon - previousLon) > 180;
      previousLon = lon;
      // At world scale keep the two ends of each part, plus intermediate vertices
      // that would move the stroke by at least half a map unit.
      if (!move && i < part.length - 1 && Math.hypot(point[0] - last[0], point[1] - last[1]) < 0.5) continue;
      path.push((move ? 'M' : 'L') + point.map((n) => n.toFixed(1)).join(','));
      last = point;
    }
    fragments.push(path.join(''));
  }
  const d = fragments.join('');
  worldPaths.set(f, d);
  return d;
}

function initialWorldMap({ features, date, layers, spotlight }) {
  const points = [],
    lines = [],
    classes = new Set();
  const enabled =
    layers == null
      ? new Set(['sections', 'localities', 'infrastructure'])
      : layers instanceof Set
        ? layers
        : new Set(typeof layers === 'string' ? layers.split(',') : layers);
  const qs = new URLSearchParams();
  if (date) qs.set('date', date);
  if (layers != null) qs.set('layers', [...enabled].join(','));
  const query = qs.size ? '?' + esc(qs.toString()) : '';
  function link(f, mark) {
    const name = esc(f.properties.name);
    const id = encodeURIComponent(f.properties.id || f.id);
    return (
      '<a href="/places/' +
      esc(id) +
      '/' +
      query +
      '" aria-label="' +
      name +
      '"><title>' +
      name +
      '</title>' +
      mark +
      '</a>'
    );
  }
  for (const f of features) {
    if (!activeDate(f, date)) continue;
    if (f.geometry.type === 'Point') {
      const local = localFeature(f);
      if (enabled.has(local ? 'localities' : 'infrastructure'))
        points.push({ f, local, xy: project(f.geometry.coordinates) });
    } else if (enabled.has('sections') && f.geometry.type.includes('LineString')) {
      const key = lineState(f.properties);
      classes.add(key);
      const path = '<path d="' + worldPath(f) + '"';
      const line =
        path +
        ' fill="none" stroke="#303030" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="' +
        lineStyles[key].dash +
        '"/>';
      lines.push(
        link(
          f,
          (date
            ? path +
              ' fill="none" stroke="#888" stroke-width="5"/>' +
              path +
              ' fill="none" stroke="#fff" stroke-width="3.5"/>'
            : '') + line
        )
      );
    }
  }
  const focus = featuredPoint(points, spotlight);
  points.sort(
    (a, b) =>
      Number(b.f === focus) - Number(a.f === focus) ||
      b.f.properties.profiles.length - a.f.properties.profiles.length ||
      Number(a.local) - Number(b.local) ||
      a.f.properties.name.localeCompare(b.f.properties.name)
  );
  const marks = [],
    drawn = [],
    occupied = [];
  let spotlightLabel = '';
  for (const p of points) {
    const [x, y] = p.xy.map((n) => Math.round(n * 10) / 10);
    if (drawn.some(([a, b]) => Math.hypot(a - x, b - y) < 18)) continue;
    drawn.push([x, y]);
    const hot = p.f === focus,
      radius = hot ? 4.5 : 3;
    let mark = '<circle cx="' + x + '" cy="' + y + '" r="8" fill="transparent"/>';
    if (hot) mark += '<circle cx="' + x + '" cy="' + y + '" r="8.4" fill="white" stroke="#333"/>';
    mark += p.local
      ? '<circle cx="' +
        x +
        '" cy="' +
        y +
        '" r="' +
        radius +
        '" fill="' +
        (hot ? '#222' : 'white') +
        '" stroke="#333" stroke-width="1.4"/>'
      : '<rect x="' +
        (x - radius) +
        '" y="' +
        (y - radius) +
        '" width="' +
        2 * radius +
        '" height="' +
        2 * radius +
        '" fill="#292929" stroke="white"/>';
    marks.push(link(p.f, mark));
    if (hot) {
      const label = p.f.properties.name,
        width = Math.ceil(label.length * 6.8 + 12);
      const left = x + width + 10 <= 990 ? x + 10 : x - 10 - width;
      occupied.push([left, y - 10, width, 20]);
      spotlightLabel = link(
        p.f,
        '<rect x="' +
          left +
          '" y="' +
          (y - 10) +
          '" width="' +
          width +
          '" height="20" rx="1" fill="#202020"/><text x="' +
          (left + 6) +
          '" y="' +
          (y + 4) +
          '" fill="#fff" font-family="Inter, sans-serif" font-size="12">' +
          esc(label) +
          '</text>'
      );
    }
  }
  const background = [
    '<image href="/data/world-land.svg" width="1000" height="502" preserveAspectRatio="none"/>'
  ];
  for (const [name, lon, lat] of labels.filter(([label]) => !label.includes('Ocean'))) {
    const [x, y] = project([lon, lat]),
      water = name.includes('Ocean'),
      width = name.length * (water ? 7 : 8);
    if (!hasRoom(occupied, x - width / 2, y - 7, width, 15)) continue;
    background.push(
      '<text aria-hidden="true" x="' +
        x.toFixed(1) +
        '" y="' +
        y.toFixed(1) +
        '" text-anchor="middle" fill="#555" stroke="#eee" stroke-width="2.3" paint-order="stroke" font-family="' +
        (water ? 'Georgia,serif' : 'Inter,sans-serif') +
        '" font-style="' +
        (water ? 'italic' : 'normal') +
        '" font-size="' +
        (water ? 14 : 11) +
        '" letter-spacing="' +
        (water ? 0.5 : 1.9) +
        '">' +
        name +
        '</text>'
    );
  }
  return {
    svg: background.join('') + lines.join('') + marks.join('') + spotlightLabel,
    legend: featureLegend(points, classes, date)
  };
}

function corridorPicker({ profiles, corridor, params }) {
  const options = [...profiles].sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const filters = ['date', 'layers', 'region', 'q', 'mode', 'status', 'order'].filter(key => params.has(key))
    .map(key => `<input type="hidden" name="${key}" value="${esc(params.get(key))}">`).join('');
  const unknown = corridor && !options.some(profile => profile.slug === corridor);
  return `<form class="map-corridor-picker" action="/atlas/#world-atlas" method="get">
    ${filters}<label for="map-corridor-select">Corridor</label><select name="corridor" id="map-corridor-select">
      <option value="">All corridors</option>${unknown ? '<option selected disabled>Outside this selection</option>' : ''}
      ${options.map(profile => `<option value="${esc(profile.slug)}"${profile.slug === corridor ? ' selected' : ''}>${esc(profile.name)}</option>`).join('')}
    </select><button type="submit">Show</button></form>`;
}

export function mapShell(preview, picker) {
  const snapshot = Array.isArray(preview?.features) ? initialWorldMap(preview) : null;
  const [cx, cy] = project([3, 13]);
  const viewport = snapshot
    ? 'viewBox="' + (cx - 485).toFixed(2) + ' ' + (cy - 215).toFixed(2) + ' 970 430"'
    : '';
  return `<div class="mapwrap">
    <div class="mapcanvas" id="mapcanvas">
      <svg id="map-svg" role="group" tabindex="0" ${viewport} aria-label="${snapshot ? 'World map. Select a mapped feature to open its record.' : interactiveMapLabel}">${snapshot?.svg || ''}</svg>
      <div class="maptools">
        ${picker ? corridorPicker(picker) : ''}
        <button class="chipbtn" data-pop="region" aria-expanded="false">${icon('world')}<span id="map-view-name">World view</span>${icon('down', 12)}</button>
        <button class="chipbtn" data-pop="layers" aria-expanded="false">${icon('layers', 14)}Layers</button>
      </div>
      <div class="map-geo" aria-hidden="true"><span class="north">N</span></div>
      <div class="map-controls">
        <div class="ctrlgroup">${control('zoom-in', 'Zoom in', 'plus')}${control('zoom-out', 'Zoom out', 'minus')}</div>
        ${control('fit', 'Fit selected geography', 'fit', 15)}
        <button class="square expand-map" data-act="expand-map" aria-label="Expand map" title="Expand map" aria-pressed="false">${icon('upRight', 15)}</button>
        <details class="map-tools-help"><summary class="square" aria-label="Map navigation" title="Map navigation">${icon('compass', 15)}</summary>
          <div class="map-nav-panel"><strong>Move the map</strong><div class="pan-options">${Object.keys(
            panOffsets
          )
            .map(
              (dir) =>
                '<button type="button" class="btn" data-pan="' +
                dir +
                '">' +
                dir[0].toUpperCase() +
                dir.slice(1) +
                '</button>'
            )
            .join('')}</div>
          <p>Drag the map or focus it and use the arrow keys. Press Home to fit the view.</p>
          <label>Search features in view<input class="map-location-query" type="search" autocomplete="off" aria-controls="visible-feature-list" placeholder="Name or feature type"></label>
          <label>Features in view<select class="map-location-list" id="visible-feature-list"><option value="">Choose a feature</option></select></label>
          <span class="map-filter-feedback" role="status" aria-live="polite"></span>
          </div>
        </details>
      </div>
      <div class="map-scale" id="scale"></div><div id="map-status" role="status"></div><div id="section-places"></div><div id="place-popup"></div><div id="map-popover"></div>
    </div>
    <div class="map-legend"><details class="atlas-key"><summary>Map key</summary><span class="legend-items">${snapshot?.legend || ''}</span></details><a class="attribution" href="/about/#geography">Map credits</a></div>
  </div>`;
}
function allPoints(f) {
  let g = f.geometry;
  return g.type === 'Point'
    ? [g.coordinates]
    : g.type === 'LineString'
      ? g.coordinates
      : g.type === 'MultiLineString'
        ? g.coordinates.flat()
        : [];
}
const displayedGeometry = new WeakMap();
function lineGeometry(feature) {
  let saved = displayedGeometry.get(feature);
  if (saved) return saved;
  const g = feature.geometry;
  const parts = g.type === 'LineString' ? [g.coordinates] : g.coordinates;
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const segments = [];
  for (const part of parts) {
    let previous, previousLon;
    for (const coord of part) {
      const point = project(coord);
      bounds[0] = Math.min(bounds[0], point[0]);
      bounds[1] = Math.min(bounds[1], point[1]);
      bounds[2] = Math.max(bounds[2], point[0]);
      bounds[3] = Math.max(bounds[3], point[1]);
      if (previous && Math.abs(coord[0] - previousLon) <= 180) segments.push([previous, point]);
      previous = point;
      previousLon = coord[0];
    }
  }
  saved = { d: parts.map(pathLine).join(' '), segments, bounds };
  displayedGeometry.set(feature, saved);
  return saved;
}
// Clip the actual projected stroke. A multipart extent can span an empty sea.
// Returning a point on the clipped segment also lets a crossing be labelled
// when its surveyed endpoints both lie outside the current viewport.
function visibleStroke(geometry, box, label) {
  const [left, top, right, bottom] = geometry.bounds;
  if (left > box[2] || right < box[0] || top > box[3] || bottom < box[1]) return null;
  let best = null, longest = -1;
  for (const [a, b] of geometry.segments) {
    let enter = 0, leave = 1;
    for (let axis = 0; axis < 2; axis++) {
      const delta = b[axis] - a[axis];
      if (delta === 0) {
        if (a[axis] < box[axis] || a[axis] > box[axis + 2]) { leave = -1; break; }
      } else {
        const t0 = (box[axis] - a[axis]) / delta, t1 = (box[axis + 2] - a[axis]) / delta;
        enter = Math.max(enter, Math.min(t0, t1));
        leave = Math.min(leave, Math.max(t0, t1));
        if (enter > leave) break;
      }
    }
    if (enter > leave) continue;
    if (!label) return true;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const length = (leave - enter) * Math.hypot(dx, dy);
    if (length > longest) {
      longest = length;
      const mid = (enter + leave) / 2;
      best = [a[0] + mid * dx, a[1] + mid * dy];
    }
  }
  return best;
}
function safeRange(n, a, b) {
  return Math.max(a, Math.min(b, n));
}
// Country labels use an interior point of the largest polygon in the released
// basemap. They identify context and carry no corridor membership.
const anchorsByDataset = new WeakMap();
function countryAnchors(boundaries) {
  if (anchorsByDataset.has(boundaries)) return anchorsByDataset.get(boundaries);
  const anchors = [];
  for (const shape of boundaries) {
    let largest = 0,
      ring;
    for (const part of shape.d.match(/M[^M]+/g) || []) {
      const pts = [...part.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
      if (pts.length < 3) continue;
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i],
          b = pts[(i + 1) % pts.length];
        area += a[0] * b[1] - a[1] * b[0];
      }
      if (Math.abs(area) > largest) {
        largest = Math.abs(area);
        ring = pts;
      }
    }
    if (!ring) continue;
    const ys = ring.map((p) => p[1]),
      lo = Math.min(...ys),
      hi = Math.max(...ys);
    let best = 0,
      point;
    for (const t of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const y = lo + t * (hi - lo),
        cross = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        if (a[1] > y !== b[1] > y) cross.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
      }
      cross.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cross.length; i += 2) {
        const span = cross[i + 1] - cross[i];
        if (span > best) {
          best = span;
          point = [(cross[i] + cross[i + 1]) / 2, y];
        }
      }
    }
    if (point) anchors.push({ name: shape.name, point, span: best, area: largest });
  }
  anchors.sort((a, b) => b.area - a.area);
  anchorsByDataset.set(boundaries, anchors);
  return anchors;
}
function hasRoom(occupied, x, y, width, height, pad = 4) {
  return !occupied.some(
    ([left, top, w, h]) =>
      x < left + w + pad && x + width + pad > left && y < top + h + pad && y + height + pad > top
  );
}
function profileTokenScore(f, slug) {
  const name = slugOf(f.properties.name);
  return slug.split('-').some((word) => word.length > 3 && name.split('-').includes(word)) ? 1 : 0;
}
export class AtlasMap {
  constructor(node, opts) {
    this.node = node;
    this.svg = node.querySelector('svg');
    this.svg.setAttribute('aria-label', interactiveMapLabel);
    this.opts = opts;
    this.center = project([4, 12]);
    this.z = 1;
    this.drag = null;
    this.touches = new Map();
    this.moved = false;
    this.observer = new ResizeObserver(() => this.paint());
    this.observer.observe(node);
    this.pointerDown = (e) => {
      if (e.button !== 0) return;
      if (this.raf) cancelAnimationFrame(this.raf);
      if (e.pointerType === 'touch') {
        this.touches.set(e.pointerId, [e.clientX, e.clientY]);
        if (this.touches.size > 1) {
          this.drag = null;
          if (this.touches.size === 2) {
            const { distance, midpoint } = this.gesture();
            this.pinch = { distance, anchor: this.mapAt(midpoint), z: this.z };
            this.moved = true;
          }
          for (const id of this.touches.keys()) this.svg.setPointerCapture(id);
          return;
        }
      }
      this.drag = [e.clientX, e.clientY, ...this.center];
      this.moved = false;
    };
    this.pointerMove = (e) => {
      if (this.touches.has(e.pointerId)) this.touches.set(e.pointerId, [e.clientX, e.clientY]);
      if (this.pinch && this.touches.size >= 2) {
        const { distance, midpoint } = this.gesture();
        this.z = safeRange(this.pinch.z * distance / this.pinch.distance, 0.75, 160);
        this.keepAt(this.pinch.anchor, midpoint);
        this.paint();
        return;
      }
      if (!this.drag) return;
      let dx = e.clientX - this.drag[0],
        dy = e.clientY - this.drag[1];
      if (Math.abs(dx) + Math.abs(dy) < 4 && !this.moved) return;
      if (e.pointerType === 'touch' && this.z <= 1 && Math.abs(dy) > Math.abs(dx)) {
        this.drag = null;
        return;
      }
      this.moved = true;
      this.svg.setPointerCapture(e.pointerId);
      this.svg.classList.add('drag');
      this.center = [this.drag[2] - dx / this.k, this.drag[3] - dy / this.k];
      this.constrain();
      this.paint();
    };
    this.pointerUp = (e) => {
      this.touches.delete(e.pointerId);
      if (this.pinch && this.touches.size >= 2) {
        const { distance, midpoint } = this.gesture();
        this.pinch = { distance, anchor: this.mapAt(midpoint), z: this.z };
      } else if (this.pinch) {
        this.save();
        this.pinch = null;
      } else if (this.drag && this.moved) {
        this.save();
      }
      this.drag = null;
      this.svg.classList.remove('drag');
      if (this.svg.hasPointerCapture(e.pointerId)) this.svg.releasePointerCapture(e.pointerId);
    };
    this.key = (e) => {
      const dir = { ArrowLeft: 'west', ArrowRight: 'east', ArrowUp: 'north', ArrowDown: 'south' }[e.key];
      if (dir) {
        e.preventDefault();
        this.pan(dir);
      } else if (['+', '=', '-'].includes(e.key)) {
        e.preventDefault();
        this.zoom(e.key === '-' ? 1 / 1.5 : 1.5);
      } else if (e.key === 'Home') {
        e.preventDefault();
        this.node.querySelector('[data-act="fit"]')?.click();
      }
    };
    this.help = node.querySelector('.map-tools-help');
    this.placeSelect = node.querySelector('.map-location-list');
    this.placeQuery = node.querySelector('.map-location-query');
    this.placeFeedback = node.querySelector('.map-filter-feedback');
    this.selectorItems = [];
    this.placeQuery.oninput = () => this.filterVisibleFeatures();
    this.help.onclick = (e) => {
      const direction = e.target.closest('[data-pan]')?.dataset.pan;
      if (direction) this.pan(direction);
    };
    this.placeSelect.onchange = () => {
      const id = this.placeSelect.value;
      if (!id) return;
      this.help.open = false;
      this.placeSelect.value = '';
      this.opts.select(id);
      this.node.querySelector('.map-pop .pop-close')?.focus({ preventScroll: true });
    };
    this.svg.addEventListener('pointerdown', this.pointerDown);
    this.svg.addEventListener('pointermove', this.pointerMove);
    this.svg.addEventListener('pointerup', this.pointerUp);
    this.svg.addEventListener('pointercancel', this.pointerUp);
    this.svg.addEventListener('keydown', this.key);
    this.svg.onclick = (e) => {
      if (this.moved) {
        this.moved = false;
        return;
      }
      let marker = e.target.closest('[data-feature]');
      if (marker) opts.select(marker.dataset.feature);
      else opts.close?.();
    };
    this.svg.ondblclick = (e) => {
      if (!e.target.closest('[data-feature]')) this.zoom(1.55, [e.clientX, e.clientY]);
    };
    this.svg.onwheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      this.zoom(e.deltaY < 0 ? 1.18 : 1 / 1.18, [e.clientX, e.clientY]);
    };
    this.setView(opts.view);
  }
  filterVisibleFeatures() {
    const terms = norm(this.placeQuery.value).split(' ').filter(Boolean);
    const matches = this.selectorItems.filter(feature => {
      const text = norm(feature.properties.name + ' ' + feature.properties.kind);
      return terms.every(term => text.includes(term));
    });
    const prompt = matches.length ? 'Choose a feature'
      : terms.length ? 'No matching features' : 'No features in view';
    this.placeSelect.innerHTML = '<option value="">' + prompt + '</option>' + matches.map(feature =>
      '<option value="' + esc(feature.properties.id || feature.id) + '">' + esc(feature.properties.name) + '</option>'
    ).join('');
    this.placeSelect.disabled = !matches.length;
    this.placeFeedback.textContent = !terms.length ? '' : matches.length
      ? matches.length + (matches.length === 1 ? ' match in view.' : ' matches in view.')
      : 'No features in view match your search.';
  }
  destroy() {
    this.observer.disconnect();
    if (this.raf) cancelAnimationFrame(this.raf);
  }
  transitionFrom(start) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let target = [...this.center],
      tz = this.z,
      begin = performance.now(),
      duration = 315;
    const frame = (now) => {
      let t = Math.min(1, (now - begin) / duration),
        ease = 1 - Math.pow(1 - t, 3);
      this.center = target.map((n, i) => start.center[i] + (n - start.center[i]) * ease);
      this.z = Math.exp(Math.log(start.z) + (Math.log(tz) - Math.log(start.z)) * ease);
      this.paint();
      if (t < 1) this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }
  selectionScope() {
    const { slugs, section } = this.opts;
    if (!slugs?.length || !section) return null;
    const matches = geoState.features.filter((f) =>
      f.properties.memberships?.some((m) => m.profile === slugs[0] && slugOf(m.label) === section)
    );
    // A branch with no approved coordinates must stay empty even when the main
    // corridor has a released alignment.
    if (matches.length || /(?:^|-)(?:branch|extension)(?:$|-)/.test(section)) {
      return new Set(matches.map((f) => f.properties.id));
    }
    return null;
  }
  validFeatures() {
    const o = this.opts,
      scope = this.selectionScope();
    return geoState.features.filter(
      (f) =>
        activeDate(f, o.date) &&
        (!o.filterSlugs || f.properties.profiles?.some((s) => o.filterSlugs.has(s))) &&
        (!scope || !f.properties.profiles?.includes(o.slugs[0]) || scope.has(f.properties.id))
    );
  }
  pan(dir) {
    if (this.raf) cancelAnimationFrame(this.raf);
    const offset = panOffsets[dir];
    if (!offset || !this.k) return;
    const step = Math.max(40, Math.min(this.node.clientWidth, this.node.clientHeight) * 0.19) / this.k;
    this.center = this.center.map((v, i) => v + offset[i] * step);
    this.constrain();
    this.paint();
    this.save();
  }
  setView(view) {
    this.fit(false);
    if (view && /^[\d.,-]+$/.test(view)) {
      let v = view.split(',').map(Number);
      if (v.length === 3 && v.every(Number.isFinite)) {
        this.center = v.slice(0, 2);
        this.z = safeRange(v[2], 0.75, 160);
        this.constrain();
        this.paint();
      }
    }
  }
  fit(save = true) {
    let o = this.opts,
      fs = this.validFeatures().filter((f) => o.slugs?.some((s) => f.properties.profiles?.includes(s)));
    if (o.pin) {
      let fp = this.validFeatures().find((f) => f.properties.id === o.pin || f.id === o.pin);
      if (fp?.geometry.type === 'Point') {
        this.center = project(fp.geometry.coordinates);
        this.z = 5;
        if (save) this.save();
        this.paint();
        return;
      }
      if (fp) fs = [fp];
    }
    let coords = fs.flatMap(allPoints).map(project),
      w = this.node.clientWidth || 800,
      h = this.node.clientHeight || 420,
      base = Math.min(w / 970, h / 430);
    if (coords.length) {
      let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
      for (const [x, y] of coords) {
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
        ymin = Math.min(ymin, y);
        ymax = Math.max(ymax, y);
      }
      this.center = [(xmin + xmax) / 2, (ymin + ymax) / 2];
      this.z = safeRange(
        Math.min((w * 0.75) / Math.max(2, xmax - xmin), (h * 0.6) / Math.max(2, ymax - ymin)) / base,
        1.15,
        coords.length === 1 ? 6 : 25
      );
    } else if (o.region && stateRegions[o.region]) {
      let [x, y, z] = stateRegions[o.region];
      this.center = project([x, y]);
      this.z = z;
    } else {
      this.center = project([3, 13]);
      this.z = 1;
    }
    if (save) this.save();
    this.paint();
  }
  save() {
    this.opts.onView(
      this.center
        .map((x) => x.toFixed(2))
        .concat(this.z.toFixed(3))
        .join(',')
    );
  }
  constrain() {
    this.center = [safeRange(this.center[0], 0, 1000), safeRange(this.center[1], 0, 502)];
  }
  gesture() {
    const [a, b] = this.touches.values();
    return {
      midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      distance: Math.max(1, Math.hypot(a[0] - b[0], a[1] - b[1]))
    };
  }
  offsetAt(point) {
    const rect = this.svg.getBoundingClientRect();
    return [point[0] - rect.left - rect.width / 2, point[1] - rect.top - rect.height / 2];
  }
  mapAt(point) {
    return this.offsetAt(point).map((p, i) => this.center[i] + p / this.k);
  }
  keepAt(mapPoint, viewportPoint) {
    const k = Math.min(this.node.clientWidth / 970, this.node.clientHeight / 430) * this.z;
    this.center = this.offsetAt(viewportPoint).map((p, i) => mapPoint[i] - p / k);
    this.constrain();
  }
  zoom(n, point) {
    if (this.raf) cancelAnimationFrame(this.raf);
    const anchor = point && this.k ? this.mapAt(point) : null;
    this.z = safeRange(this.z * n, 0.75, 160);
    if (anchor) this.keepAt(anchor, point);
    this.paint();
    this.save();
  }
  paint() {
    if (!this.svg) return;
    let w = this.node.clientWidth,
      h = this.node.clientHeight;
    if (!w || !h) return;
    let o = this.opts,
      k = (this.k = Math.min(w / 970, h / 430) * this.z),
      tx = w / 2 - this.center[0] * k,
      ty = h / 2 - this.center[1] * k;
    let screen = (p) => {
      let [x, y] = project(p);
      return [x * k + tx, y * k + ty];
    };
    const world = this.z < 2.1,
      small = w < 580;
    const slugs = o.slugs || [],
      focused = slugs.length > 0,
      compare = slugs.length === 2;
    const all = this.validFeatures(),
      visible = [],
      places = [],
      lineTags = [],
      strokes = [],
      lineKeys = new Set();
    const selected = (f) => f.properties.profiles?.some((s) => slugs.includes(s));
    const idOf = (f) => f.properties.id || f.id;
    const titleOf = (f) => String(f.properties.name || '');
    const viewportBox = [-tx / k, -ty / k, (w - tx) / k, (h - ty) / k];
    const inFrame = (x, y) => x > 4 && x < w - 4 && y > 4 && y < h - 4;
    const side = (f) =>
      compare
        ? slugs
            .map((s, i) => (f.properties.profiles.includes(s) ? (i ? 'B' : 'A') : ''))
            .filter(Boolean)
            .join('/')
        : '';
    const group = (a, id, title) =>
      '<g data-feature="' +
      esc(id) +
      '" style="cursor:pointer"><title>' +
      esc(title) +
      '</title>' +
      a +
      '</g>';
    this.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    this.svg.dataset.zoomed = this.z > 1;
    for (let f of all) {
      const g = f.geometry,
        sel = selected(f),
        p = f.properties;
      if (g.type === 'Point') {
        const local = localFeature(f);
        if (!o.layers.has(local ? 'localities' : 'infrastructure')) continue;
        const [x, y] = screen(g.coordinates);
        if (!inFrame(x, y)) continue;
        places.push({ f, x, y, local, sel });
        visible.push(f);
        continue;
      }
      if (!o.layers.has('sections')) continue;
      const drawn = lineGeometry(f);
      const d = drawn.d;
      const key = lineState(p),
        letter = side(f),
        second = letter.includes('B'),
        pinned = idOf(f) === o.pin,
        ink = pinned ? '#080808' : sel ? '#171717' : focused ? '#999' : '#484848';
      const hit = visibleStroke(drawn, viewportBox, letter || pinned);
      if (!hit) continue;
      const dash = lineStyles[key].dash;
      const path = (color, width, pattern = '') =>
        '<path d="' +
        d +
        '" fill="none" stroke="' +
        color +
        '" stroke-width="' +
        width +
        '" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="' +
        pattern +
        '" vector-effect="non-scaling-stroke"/>';
      let paths = path('#fafafa', pinned ? 9.2 : second ? 6.5 : 4.6);
      if (o.date) paths = path('#868686', second ? 8 : 6.4) + paths;
      paths += path(ink, pinned ? 5.2 : second ? 4.6 : sel ? 3.1 : 1.75, dash);
      if (second) paths += path('#f7f7f7', 1.3, dash);
      paths += path('transparent', 15);
      strokes.push({ priority: pinned ? 2 : sel ? 1 : 0, html: group(paths, idOf(f), titleOf(f) + ', ' + lineStyles[key].label) });
      visible.push(f);
      lineKeys.add(key);
      if (letter || pinned) {
        const xy = [hit[0] * k + tx, hit[1] * k + ty];
        if (inFrame(...xy)) lineTags.push({ f, xy, letter, pinned });
      }
    }
    const baseLayer = !world && geoState.boundaries.length
      ? geoState.boundaries.map(country =>
          `<path d="${country.d}" fill="#d7d7d4" fill-rule="evenodd" stroke="#fafafa" stroke-width=".75" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`
        ).join('')
      : '<image href="/data/world-land.svg" width="1000" height="502" preserveAspectRatio="none"/>';
    const gridLines = world ? '' : grid.map(d =>
      `<path d="${d}" stroke-width=".55" stroke-dasharray="2 4" vector-effect="non-scaling-stroke"/>`
    ).join('');
    const elements = [
      `<g aria-hidden="true" transform="translate(${tx} ${ty}) scale(${k})">${baseLayer}<g stroke="#6d6d6d" opacity=".28" fill="none">${gridLines}</g></g>`,
      '<g transform="translate(' +
        tx +
        ' ' +
        ty +
        ') scale(' +
        k +
        ')">' +
        strokes
          .sort((a, b) => a.priority - b.priority)
          .map((r) => r.html)
          .join('') +
        '</g>'
    ];
    // Latitude on a Robinson map depends only on the vertical coordinate.
    // The margin stays registered to the map through panning and zooming.
    const latitudeMargins = [];
    const latitudeStep = this.z > 18 ? 1 : this.z > 5 ? 5 : this.z > 2 ? 15 : 30;
    if (!world && w > 485) {
      for (let lat = -90 + latitudeStep; lat < 90; lat += latitudeStep) {
        const [, y] = screen([0, lat]);
        if (y < 48 || y > h - 52) continue;
        const value = Math.abs(lat) + '°' + (lat > 0 ? 'N' : lat < 0 ? 'S' : '');
        latitudeMargins.push([w - 44, y - 7, 44, 14]);
        elements.push(`<g class="latitude-tick" aria-hidden="true"><path d="M${w-6} ${y}h6"/><text x="${w-10}" y="${y+3}" text-anchor="end">${value}</text></g>`);
      }
    }
    const pinned = o.pin;
    const spotlight = focused ? null : featuredPoint(places, o.spotlight);
    const emphasised = (a) => idOf(a.f) === pinned || a.sel || a.f === spotlight;
    places.sort(
      (a, b) =>
        Number(idOf(b.f) === pinned) - Number(idOf(a.f) === pinned) ||
        Number(b.f === spotlight) - Number(a.f === spotlight) ||
        Number(b.sel) - Number(a.sel) ||
        b.f.properties.profiles.length - a.f.properties.profiles.length ||
        Number(a.local) - Number(b.local) ||
        titleOf(a.f).localeCompare(titleOf(b.f))
    );
    const occupied = [
      ...latitudeMargins,
      [0, 0, Math.min(w - 55, 211), 55],
      [w - 51, 0, 51, 48],
      [0, h - 57, small ? 186 : 211, 57],
      [w - 109, h - 39, 109, 39]
    ];
    const pointLayer = [],
      labelLayer = [],
      plotted = [];
    const placeLabel = (a) => {
      const { f, x, y } = a,
        hot = idOf(f) === pinned || f === spotlight || Boolean(side(f)),
        identity = side(f);
      let label = titleOf(f);
      if (label.length > 27) label = label.slice(0, 25) + '…';
      if (identity) label = identity + ' · ' + label;
      const fs = hot ? 12 : 11,
        width = Math.ceil(label.length * (hot ? 6.7 : 5.8) + 10),
        height = hot ? 21 : 17;
      const positions = [
        ...(hot ? [[x + 18, y - height - 16], [x - width - 18, y - height - 16]] : []),
        [x + 10, y - height / 2],
        [x - width - 10, y - height / 2],
        [x - width / 2, y - height - 10],
        [x - width / 2, y + 10]
      ];
      const fit = positions.find(
        ([lx, ly]) =>
          lx >= 3 &&
          ly >= 3 &&
          lx + width < w - 3 &&
          ly + height < h - 3 &&
          hasRoom(occupied, lx, ly, width, height, world ? 5 : 2)
      );
      if (!fit) return false;
      const [lx, ly] = fit;
      occupied.push([lx, ly, width, height]);
      const background = hot
        ? '<rect x="' +
          lx +
          '" y="' +
          ly +
          '" width="' +
          width +
          '" height="' +
          height +
          '" rx="1" fill="#202020"/>'
        : '';
      const type = hot
        ? 'fill="#fff"'
        : 'fill="#292929" stroke="#f3f3f3" stroke-width="3" paint-order="stroke"';
      labelLayer.push(
        group(
          (hot ? `<path d="M${x} ${y} L${lx > x ? lx : lx + width} ${ly + height / 2}" fill="none" stroke="#262626" stroke-width="1"/>` : '') +
            background +
            '<text x="' +
            (lx + 5) +
            '" y="' +
            (ly + height / 2 + fs * 0.34) +
            '" font-size="' +
            fs +
            '" font-family="Inter, sans-serif" ' +
            type +
            '>' +
            esc(label) +
            '</text>',
          idOf(f),
          titleOf(f)
        )
      );
      return true;
    };
    for (const a of places) {
      const { f, x, y, local } = a,
        hot = emphasised(a);
      // Keep all points queryable even when two symbols would obscure each other.
      const separation = hot ? 4 : world ? Math.max(18, Math.min(30, w / 35)) : 9;
      if (plotted.some((b) => Math.hypot(b.x - x, b.y - y) < separation)) continue;
      plotted.push(a);
      const r = hot ? 4.1 : local ? 2.5 : 3;
      let mark = '<circle cx="' + x + '" cy="' + y + '" r="11" fill="transparent"/>';
      if (hot)
        mark +=
          '<circle cx="' +
          x +
          '" cy="' +
          y +
          '" r="8" fill="#fff" fill-opacity=".8" stroke="#404040" stroke-width="1"/>';
      const ink = focused && !hot ? '#939393' : '#303030';
      mark += local
        ? '<circle cx="' +
          x +
          '" cy="' +
          y +
          '" r="' +
          r +
          '" fill="' +
          (hot ? ink : '#fff') +
          '" stroke="' +
          ink +
          '" stroke-width="1.4"/>'
        : '<rect x="' +
          (x - r) +
          '" y="' +
          (y - r) +
          '" width="' +
          r * 2 +
          '" height="' +
          r * 2 +
          '" fill="' +
          ink +
          '" stroke="#fff" stroke-width="1"/>';
      pointLayer.unshift(group(mark, idOf(f), titleOf(f)));
    }
    let labelBudget = world ? (small ? 2 : Math.min(5, Math.floor(w / 170))) : small ? 9 : 20;
    for (const {
      f,
      xy: [x, y],
      letter,
      pinned: linePinned
    } of lineTags.sort((a, b) => Number(b.pinned) - Number(a.pinned))) {
      const label = linePinned ? [letter, titleOf(f)].filter(Boolean).join(' · ') : letter;
      const width = linePinned ? Math.ceil(label.length * 6.7 + 15) : letter.length > 1 ? 30 : 18;
      const place = [
        [x + 5, y - 16],
        [x - width - 4, y + 4],
        [x + 6, y + 5]
      ].find(
        ([a, b]) => a >= 0 && b >= 0 && a + width <= w && b + 17 <= h && hasRoom(occupied, a, b, width, 17, 1)
      );
      if (!place) continue;
      const [lx, ly] = place;
      occupied.push([lx, ly, width, 17]);
      labelLayer.push(
        group(
          '<rect x="' +
            lx +
            '" y="' +
            ly +
            '" width="' +
            width +
            '" height="17" rx="1" fill="' + (linePinned ? '#171717' : 'white') + '" stroke="#303030"/>' +
            '<text x="' +
            (lx + width / 2) +
            '" y="' +
            (ly + 12) +
            '" text-anchor="middle" font-family="Inter, sans-serif" font-size="11" fill="' + (linePinned ? '#fff' : '#151515') + '">' +
            esc(label) +
            '</text>',
          idOf(f),
          titleOf(f)
        )
      );
    }
    for (const item of plotted.filter(emphasised)) if (labelBudget > 0 && placeLabel(item)) labelBudget--;
    const contextLabel = (name, x, y, type, span = Infinity) => {
      const ocean = type === 'water',
        country = type === 'country';
      const size = ocean ? (small ? 10 : 14) : small ? 9 : country ? 10 : 10.8;
      const tracking = ocean ? 0.4 : small ? 1.05 : 1.9;
      const width = name.length * (size * (ocean ? 0.54 : 0.64) + tracking),
        height = size + 3;
      const left = x - width / 2,
        top = y - height / 2;
      if (
        width > span ||
        left < 4 ||
        top < 3 ||
        x + width / 2 > w - 4 ||
        top + height > h - 3 ||
        !hasRoom(occupied, left, top, width, height, 5)
      )
        return;
      occupied.push([left, top, width, height]);
      elements.push(
        '<text aria-hidden="true" x="' +
          x +
          '" y="' +
          (y + size * 0.33) +
          '" text-anchor="middle" font-size="' +
          size +
          '" ' +
          'font-style="' +
          (ocean ? 'italic' : 'normal') +
          '" font-family="' +
          (ocean ? 'Georgia, serif' : 'Inter, sans-serif') +
          '" fill="' +
          (ocean ? '#626262' : '#4b4b4b') +
          '" stroke="#f2f2f2" stroke-opacity=".85" stroke-width="2.5" paint-order="stroke" letter-spacing="' +
          tracking +
          '">' +
          esc(name) +
          '</text>'
      );
    };
    if (world)
      for (const [name, lon, lat] of labels.filter(([label]) => !label.includes('Ocean')))
        contextLabel(name, ...screen([lon, lat]), name.includes('Ocean') ? 'water' : 'region');
    else
      for (const b of countryAnchors(geoState.boundaries))
        contextLabel(
          b.name.toUpperCase(),
          b.point[0] * k + tx,
          b.point[1] * k + ty,
          'country',
          b.span * k * 0.85
        );
    const candidates = plotted.filter((a) => !emphasised(a));
    if (world && !focused) {
      // Spread the limited world-scale names across the visible sheet.
      const cellOf = (a) => Math.floor(a.x / (w / 4)) + ',' + Math.floor(a.y / (h / 3));
      const cells = new Set(plotted.filter(emphasised).map(cellOf));
      for (const place of candidates) {
        if (!labelBudget) break;
        const cell = cellOf(place);
        if (!cells.has(cell) && placeLabel(place)) {
          cells.add(cell);
          place.labelled = true;
          labelBudget--;
        }
      }
    }
    for (const place of candidates) {
      if (!labelBudget || (focused && this.z > 2.5)) break;
      if (!place.labelled && placeLabel(place)) labelBudget--;
    }
    elements.push(pointLayer.join(''), labelLayer.join(''));
    this.svg.innerHTML = elements.join('');
    const selectorItems = visible.slice().sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
    const selectorValue = selectorItems.map(idOf).join(',');
    if (this.selectorValue !== selectorValue) {
      this.selectorValue = selectorValue;
      this.selectorItems = selectorItems;
      this.filterVisibleFeatures();
    }
    const keyEl = this.node.parentElement.querySelector('.legend-items');
    if (keyEl) keyEl.innerHTML = featureLegend(places, lineKeys, o.date);
    let sc = document.getElementById('scale');
    if (sc) {
      const y = Math.abs((251 - this.center[1]) / 249);
      const i = Y.findIndex((v) => v >= y);
      const lat = Math.min(85, i < 1 ? (i < 0 ? 90 : 0) : (i - 1 + (y - Y[i - 1]) / (Y[i] - Y[i - 1])) * 5);
      const kmPerPixel = (40075 * Math.cos((lat * Math.PI) / 180)) / (990 * interp(X, lat) * k);
      const km =
        [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]
          .filter((v) => v / kmPerPixel < (small ? 55 : 82))
          .pop() || 0.05;
      sc.title = 'Approximate east to west scale at the map centre';
      sc.innerHTML =
        km.toLocaleString('en') +
        ' km<div class="scale-line" style="width:' +
        (km / kmPerPixel).toFixed(2) +
        'px"></div>';
    }
    const msg = document.getElementById('map-status');
    if (msg) {
      const matching = all.filter(selected);
      let message = '';
      if (geoState.failed) message = 'Map data could not load. Read the profiles in the index.';
      else if (!o.layers.size)
        message = 'All map layers are hidden. Open Layers to show features.';
      else if (o.unavailableCorridor) message = 'This corridor falls outside the current selection. Choose another corridor or change the filters.';
      else if (geoState.ready && focused && !matching.length)
        message = o.date ? 'No mapped feature is documented for this selection at that date.' :
          'No verified geography for this selection. The dossier gives its scope.';
      else if (focused && matching.length && !matching.some((f) => f.geometry.type.includes('LineString')))
        message = 'Documented locations only. The route alignment is unverified in this edition.';
      else if (geoState.ready && !geoState.features.length)
        message = 'This edition has no released map features. Browse the index.';
      else if (geoState.ready && !all.length)
        message = 'No mapped features match this selection.';
      if (message !== this.message) {
        this.message = message;
        msg.innerHTML = message ? '<span class="map-message">' + esc(message) + '</span>' : '';
      }
    }
    const stops = document.getElementById('section-places');
    if (stops) {
      const section =
        focused && !o.date && !o.pin && !compare && o.layers.has('sections')
          ? visible.find((f) => selected(f) && f.geometry.type.includes('LineString'))
          : null;
      const precision = section
        ? '<div class="waypoint-card"><span class="eyebrow">Mapped section</span><button class="map-context-line" data-place="' +
          esc(idOf(section)) +
          '">' +
          esc(titleOf(section)) +
          '</button></div>'
        : '';
      if (stops.innerHTML !== precision) stops.innerHTML = precision;
    }
    let viewName = document.getElementById('map-view-name');
    if (viewName) viewName.textContent = focused ? 'Corridor view' : o.region || 'World view';
  }
}
