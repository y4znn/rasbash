export const shapes = {
  arrow: '<path d="M3.5 12h16M14 6l6 6-6 6"/>',
  upRight: '<path d="M5 19 19 5M7 5h12v12"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  right: '<path d="m9 6 6 6-6 6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15.3 15.3 5 5"/>',
  world: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4.7" ry="9"/><path d="M3 12h18"/>',
  layers: '<path d="m2.5 8 9.5-5 9.5 5-9.5 5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>',
  index:
    '<path d="M8 5h13M8 12h13M8 19h13"/><circle cx="3.5" cy="5" r=".7"/><circle cx="3.5" cy="12" r=".7"/><circle cx="3.5" cy="19" r=".7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1.5"/>',
  date: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v5m10-5v5M3 11h18"/>',
  sliders: '<path d="M3 6h6m4 0h8M3 12h10m4 0h4M3 18h2m4 0h12M9 4v4m4 2v4m-8 2v4"/>',
  share: '<path d="M10 13l4-4m-6 2L5 14a3.5 3.5 0 0 0 5 5l3-3m-2-8 3-3a3.5 3.5 0 1 1 5 5l-3 3"/>',
  compare:
    '<rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/>',
  book: '<path d="M3 5c4-1 6-1 9 1 3-2 5-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1zM12 6v14"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  rail: '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18l-3 4m11-4 3 4M9 14h1m4 0h1"/>',
  compass: '<path d="m12 2 5 17-5-4-5 4z"/>',
  list: '<path d="M4 5h16M4 12h16M4 19h16"/>',
  copy: '<rect x="8" y="8" width="12" height="13" rx="1.8"/><path d="M15 8V3H3v13h5"/>',
  check: '<path d="m4 12 5 5 11-11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7l4 2"/>',
  sort: '<path d="M5 6h14M5 12h10M5 18h6"/>'
};
export function icon(name, size = 16) {
  return (
    '<svg aria-hidden="true" width="' +
    size +
    '" height="' +
    size +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">' +
    (shapes[name] || '') +
    '</svg>'
  );
}
