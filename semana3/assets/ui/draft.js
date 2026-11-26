/** Borrador del formulario de parámetros: compara lo tecleado con los parámetros de la última ejecución. */
export const toDraft = (params) => Object.fromEntries(Object.entries(params || {}).map(([k, v]) => [k, String(v)]));

/** Campos cuyo valor actual del formulario difiere (o está vacío) respecto de la última ejecución. */
export function changedFields(defs, draft, params) {
  return defs.filter((d) => {
    const raw = draft?.[d.key];
    return raw === undefined || String(raw).trim() === '' || Number(raw) !== Number(params?.[d.key]);
  }).map((d) => ({ key: d.key, label: d.label, from: String(params?.[d.key]), to: String(draft?.[d.key] ?? '') === '' ? '(vacío)' : String(draft[d.key]) }));
}
export const isDirty = (defs, draft, params) => changedFields(defs, draft, params).length > 0;

/** Lee el borrador y lo convierte en parámetros numéricos; lanza si falta un campo. */
export function parseDraft(defs, draft) {
  const o = {};
  for (const d of defs) {
    const raw = draft?.[d.key];
    if (raw === undefined || String(raw).trim() === '') throw Error(`Completa el campo «${d.label}».`);
    o[d.key] = Number(raw);
  }
  return o;
}
