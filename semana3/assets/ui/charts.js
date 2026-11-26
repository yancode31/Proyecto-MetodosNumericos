/** Gráficos SVG sin dependencias: líneas, dispersión, barras (histogramas), ejes logarítmicos, líneas guía. */
const COLORS = ['#2f63df', '#0f9d88', '#e48a2b', '#8a63d2', '#d8485f', '#5b6b82'];
export const esc = (s) => String(s ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function niceTicks(lo, hi, n = 5) {
  const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
  const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag, out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}
const fmt = (x) => { const a = Math.abs(x); if (x === 0) return '0'; if (a >= 1e5 || a < 1e-3) return x.toExponential(0).replace('e+', 'e'); return Number(x.toPrecision(3)).toString(); };

export function chartSvg(cfg, { id = 'c' } = {}) {
  const series = (cfg.series || []).map((s) => ({ ...s, points: (s.points || []).filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]) && (!cfg.logY || p[1] > 0) && (!cfg.logX || p[0] > 0)) })).filter((s) => s.points.length);
  if (!series.length) return '<div class="empty-state">Sin datos para graficar.</div>';
  const tx = cfg.logX ? Math.log10 : (v) => v, ty = cfg.logY ? Math.log10 : (v) => v;
  const all = series.flatMap((s) => s.points);
  let xmin = Math.min(...all.map((p) => tx(p[0]))), xmax = Math.max(...all.map((p) => tx(p[0]))), ymin = Math.min(...all.map((p) => ty(p[1]))), ymax = Math.max(...all.map((p) => ty(p[1])));
  for (const v of cfg.vlines || []) if (Number.isFinite(v.x) && (!cfg.logX || v.x > 0)) { xmin = Math.min(xmin, tx(v.x)); xmax = Math.max(xmax, tx(v.x)); }
  for (const h of cfg.hlines || []) if (h.y > 0 || !cfg.logY) { ymin = Math.min(ymin, ty(h.y)); ymax = Math.max(ymax, ty(h.y)); }
  if (cfg.kind === 'bars') { ymin = Math.min(0, ymin); const dx = series[0].points.length > 1 ? (series[0].points[1][0] - series[0].points[0][0]) / 2 : 0.5; xmin -= dx; xmax += dx; }
  if (xmin === xmax) { xmin -= 1; xmax += 1; }
  if (ymin === ymax) { const e = Math.max(Math.abs(ymin) * 0.2, 1e-6); ymin -= e; ymax += e; } else if (cfg.kind !== 'bars') { const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad; } else ymax += (ymax - ymin) * 0.06;
  const W = 640, H = 300, L = 66, R = 18, T = 16, B = 50, pw = W - L - R, ph = H - T - B;
  const sx = (v) => L + ((tx(v) - xmin) / (xmax - xmin)) * pw, sy = (v) => T + ((ymax - ty(v)) / (ymax - ymin)) * ph;
  const ticks = (lo, hi, log) => (log ? Array.from({ length: Math.floor(hi) - Math.ceil(lo) + 1 }, (_, i) => Math.ceil(lo) + i).filter((_, i, a) => a.length <= 9 || i % Math.ceil(a.length / 8) === 0).map((e) => ({ pos: e, label: fmt(10 ** e) })) : niceTicks(lo, hi).map((v) => ({ pos: v, label: fmt(v) })));
  const xt = ticks(xmin, xmax, cfg.logX), yt = ticks(ymin, ymax, cfg.logY);
  const px = (p) => L + ((p - xmin) / (xmax - xmin)) * pw, py = (p) => T + ((ymax - p) / (ymax - ymin)) * ph;
  const grid = xt.map((t) => `<line x1="${px(t.pos)}" y1="${T}" x2="${px(t.pos)}" y2="${T + ph}" class="gl"/><text x="${px(t.pos)}" y="${T + ph + 17}" text-anchor="middle" class="tk">${t.label}</text>`).join('')
    + yt.map((t) => `<line x1="${L}" y1="${py(t.pos)}" x2="${W - R}" y2="${py(t.pos)}" class="gl"/><text x="${L - 8}" y="${py(t.pos) + 3}" text-anchor="end" class="tk">${t.label}</text>`).join('');
  let body = '';
  const guides = [];
  for (const h of cfg.hlines || []) if (h.y > 0 || !cfg.logY) guides.push(`<line x1="${L}" y1="${sy(h.y)}" x2="${W - R}" y2="${sy(h.y)}" class="guide"/><text x="${W - R - 4}" y="${sy(h.y) - 4}" text-anchor="end" class="gt">${esc(h.label || '')}</text>`);
  for (const v of cfg.vlines || []) if (Number.isFinite(v.x)) guides.push(`<line x1="${sx(v.x)}" y1="${T}" x2="${sx(v.x)}" y2="${T + ph}" class="guide"/><text x="${sx(v.x) + 4}" y="${T + 11}" class="gt">${esc(v.label || '')}</text>`);
  series.forEach((s, i) => {
    const col = COLORS[i % COLORS.length];
    if (cfg.kind === 'bars') {
      const bw = Math.max(2, (pw / s.points.length) * 0.82);
      body += s.points.map((p) => `<rect x="${sx(p[0]) - bw / 2}" y="${sy(p[1])}" width="${bw}" height="${Math.max(0, T + ph - sy(p[1]))}" fill="${col}" opacity=".78"/>`).join('');
      return;
    }
    if (s.scatter) { body += s.points.map((p) => (s.cross ? `<path d="M${sx(p[0]) - 5},${sy(p[1]) - 5}l10,10m0,-10l-10,10" stroke="${col}" stroke-width="2.4" fill="none"/>` : `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="4.6" fill="${col}" stroke="#fff" stroke-width="1.8"/>`)).join(''); return; }
    const pts = s.points.length > 400 ? s.points.filter((_, k) => k % Math.ceil(s.points.length / 400) === 0 || k === s.points.length - 1) : s.points;
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join('');
    const dash = s.dashed ? 'stroke-dasharray="8 5"' : s.dotted ? 'stroke-dasharray="2 4"' : '';
    body += `<path d="${d}" fill="none" stroke="${col}" stroke-width="${i === 0 ? 2.6 : 2.1}" stroke-linejoin="round" stroke-linecap="round" ${dash}/>`;
    if (s.markers) body += s.points.map((p) => `<circle cx="${sx(p[0])}" cy="${sy(p[1])}" r="3.6" fill="${col}" stroke="#fff" stroke-width="1.5"/>`).join('');
  });
  const legend = series.map((s, i) => `<span class="legend-item"><i class="legend-marker" style="background:${COLORS[i % COLORS.length]}"></i>${esc(s.name)}</span>`).join('');
  return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.title)}"><rect x="${L}" y="${T}" width="${pw}" height="${ph}" class="plotbg"/>${grid}<line x1="${L}" y1="${T + ph}" x2="${W - R}" y2="${T + ph}" class="ax"/><line x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}" class="ax"/>${guides.join('')}${body}<text x="${L + pw / 2}" y="${H - 6}" text-anchor="middle" class="al">${esc(cfg.xLabel)}${cfg.logX ? ' (escala log)' : ''}</text><text x="14" y="${T + ph / 2}" transform="rotate(-90 14 ${T + ph / 2})" text-anchor="middle" class="al">${esc(cfg.yLabel)}${cfg.logY ? ' (escala log)' : ''}</text></svg><div class="chart-legend">${legend}</div>`;
}
