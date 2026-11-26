/** Dibuja el DER (entidad–relación) de la base como SVG a partir del esquema. */
import { TABLES, TABLE_ORDER } from '../db/schema.js';
import { esc } from './charts.js';
const POS = { caso_estudio: [20, 20], escenario: [270, 20], simulacion: [520, 20], verificacion: [770, 20], ejecucion_metodo: [520, 330], iteracion_resultado: [270, 400], resultado_resumen: [770, 330], auditoria: [20, 400] };
const POS_SIMPLE = { caso_estudio: [20, 20], escenario: [270, 20], simulacion: [520, 20], verificacion: [770, 20], auditoria: [20, 170], iteracion_resultado: [270, 170], ejecucion_metodo: [520, 170], resultado_resumen: [770, 170] };
export function derSvg(counts = {}, opts = {}) {
  const W = 230, rowH = 18, head = 28, boxes = {};
  const parts = TABLE_ORDER.map((t) => {
    const [x, y] = (opts.simple ? POS_SIMPLE : POS)[t], cols = opts.simple ? TABLES[t].columns.filter((c) => c.pk || c.fk) : TABLES[t].columns, h = head + cols.length * rowH + 8; boxes[t] = { x, y, h };
    const rows = cols.map((c, i) => { const tag = c.pk ? 'PK' : c.fk ? 'FK' : c.unique ? 'UQ' : ''; return `<text x="${x + 12}" y="${y + head + 14 + i * rowH}" class="der-col${c.pk ? ' pk' : ''}">${esc(c.name)}</text><text x="${x + W - 12}" y="${y + head + 14 + i * rowH}" text-anchor="end" class="der-type">${tag ? `<tspan class="der-tag">${tag}</tspan> ` : ''}${opts.simple ? '' : c.type}</text>`; }).join('');
    return `<g><rect x="${x}" y="${y}" width="${W}" height="${h}" rx="9" class="der-box"/><rect x="${x}" y="${y}" width="${W}" height="${head}" rx="9" class="der-head"/><text x="${x + 12}" y="${y + 19}" class="der-title">${t}</text><text x="${x + W - 12}" y="${y + 19}" text-anchor="end" class="der-count">${counts[t] ?? ''}</text>${rows}</g>`;
  });
  const lines = [];
  for (const t of TABLE_ORDER) for (const c of TABLES[t].columns) if (c.fk) {
    const a = boxes[c.fk.table], b = boxes[t]; const ay = a.y + a.h / 2, by = b.y + b.h / 2;
    const horizontal = Math.abs(a.y - b.y) < 100;
    let d;
    if (horizontal) { const [x1, x2] = a.x < b.x ? [a.x + W, b.x] : [a.x, b.x + W]; d = `M${x1},${ay} L${x2},${by}`; }
    else if (a.y < b.y) { const x1 = a.x + W / 2, x2 = b.x + W / 2; d = `M${x1},${a.y + a.h} C${x1},${(a.y + a.h + b.y) / 2} ${x2},${(a.y + a.h + b.y) / 2} ${x2},${b.y}`; }
    else { const x1 = a.x + W / 2, x2 = b.x + W / 2; d = `M${x1},${a.y} C${x1},${(a.y + b.y + b.h) / 2} ${x2},${(a.y + b.y + b.h) / 2} ${x2},${b.y + b.h}`; }
    lines.push(`<path d="${d}" class="der-rel"/>`);
  }
  return `<svg viewBox="0 0 1030 ${opts.simple ? 290 : 700}" class="der-svg" role="img" aria-label="Diagrama entidad–relación de SIMTELE-RISK"><g>${lines.join('')}</g>${parts.join('')}</svg>`;
}
