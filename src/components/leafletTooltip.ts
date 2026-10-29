// Leaflet puts a string tooltip into the page with innerHTML. Marker names come
// from customers (a diwaniya name is free text typed by whoever created it), so
// every value has to be escaped before it goes into the markup.
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const markerTooltipHtml = (marker: { name: string; subtitle?: string; value?: number }): string => {
  const valueLine =
    marker.value !== undefined
      ? `<div style="color:#d97706;font-weight:900;margin-top:2px">${Number(marker.value || 0).toFixed(3)} د.ك</div>`
      : '';
  const subtitleLine = marker.subtitle
    ? `<div style="color:#64748b;font-size:11px;margin-top:2px">${escapeHtml(marker.subtitle)}</div>`
    : '';
  return `<div dir="rtl" style="text-align:right;font-family:system-ui;font-weight:800">${escapeHtml(marker.name)}${subtitleLine}${valueLine}</div>`;
};
