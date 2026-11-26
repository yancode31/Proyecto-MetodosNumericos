export const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  brake: '<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8 8h8M8 13h8M9 21l-2 2m10-2 2 2"/>',
  tool: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 17.7 6.3 21l5.4-5.3a5 5 0 0 0 6.4-6.4L15 12l-3-3z"/>',
  wind: '<path d="M3 8h11c4 0 4-5 1-5-2 0-3 1-3 2M2 12h16c4 0 4 6 0 6-2 0-3-1-3-2M3 16h7c4 0 4 5 1 5-2 0-3-1-3-2"/>',
  activity: '<path d="M2 12h4l3-7 4 14 3-7h6"/>', chart: '<path d="M3 3v18h18M7 16l4-5 3 2 6-7"/>',
  history: '<path d="M3 12a9 9 0 1 0 2-6M3 4v5h5M12 7v5l3 2"/>', layers: '<path d="m12 3 9 5-9 5-9-5zm-9 9 9 5 9-5M3 16l9 5 9-5"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>', chevron: '<path d="m15 18-6-6 6-6"/>', calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h2m4 0h2M8 15h2m4 0h2"/>',
  play: '<path d="m8 5 12 7-12 7z"/>', save: '<path d="M4 3h14l3 3v15H3V3zm2 0v7h11V3M7 21v-8h10v8"/>', reset: '<path d="M3 11a9 9 0 1 1 3 7M3 4v7h7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>', check: '<path d="m4 12 5 5L20 6"/>', flask: '<path d="M9 3h6m-5 0v7l-6 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-6-9V3M8 15h8"/>',
  shield: '<path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6zM9 12l2 2 4-4"/>', database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 4 18 4 18 0V5M3 12c0 4 18 4 18 0"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 18v3h16v-3"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v7m4-7v7"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', terminal: '<path d="m4 7 5 5-5 5M12 18h8"/><rect x="2" y="3" width="20" height="18" rx="2"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
};
export const icon = (name, size = 18) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
