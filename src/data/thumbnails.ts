/**
 * Locally generated sample thumbnails.
 *
 * These were remote googleusercontent URLs, which broke the app's own "works
 * offline" claim and would rot the demo the moment those links expired. Inline
 * SVG data URIs ship with the bundle and need no network.
 */

interface SketchBox {
  label: string;
  x: number;
  y: number;
}

function sketchSvg(caption: string, boxes: SketchBox[]): string {
  const w = 320;
  const h = 200;
  const boxW = 72;
  const boxH = 40;

  const arrows = boxes
    .slice(0, -1)
    .map((box, index) => {
      const next = boxes[index + 1];
      if (!next) return '';
      const x1 = box.x + boxW;
      const y1 = box.y + boxH / 2;
      const x2 = next.x;
      const y2 = next.y + boxH / 2;
      return `<path d="M${x1} ${y1} C${x1 + 18} ${y1}, ${x2 - 18} ${y2}, ${x2 - 6} ${y2}" fill="none" stroke="#1f2a44" stroke-width="2" marker-end="url(#a)"/>`;
    })
    .join('');

  const rects = boxes
    .map(
      (box) =>
        `<g><rect x="${box.x}" y="${box.y}" width="${boxW}" height="${boxH}" rx="4" fill="#fdfcf7" stroke="#1f2a44" stroke-width="2"/>` +
        `<text x="${box.x + boxW / 2}" y="${box.y + boxH / 2 + 4}" font-family="Comic Sans MS, cursive, sans-serif" font-size="10" fill="#1f2a44" text-anchor="middle">${box.label}</text></g>`,
    )
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><marker id="a" markerWidth="7" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0, 7 3, 0 6" fill="#1f2a44"/></marker>
<pattern id="p" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0v16" fill="none" stroke="#e6e0cf" stroke-width="1"/></pattern></defs>
<rect width="${w}" height="${h}" fill="#f6f1e0"/><rect width="${w}" height="${h}" fill="url(#p)"/>
${arrows}${rects}
<text x="16" y="${h - 16}" font-family="Comic Sans MS, cursive, sans-serif" font-size="11" fill="#3b4a6b">${caption}</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const MICROSERVICES_THUMB = sketchSvg('microservices sketch', [
  { label: 'client', x: 20, y: 40 },
  { label: 'gateway', x: 124, y: 40 },
  { label: 'core', x: 228, y: 40 },
  { label: 'postgres', x: 124, y: 110 },
]);

export const RAG_THUMB = sketchSvg('RAG pipeline sketch', [
  { label: 'app', x: 20, y: 40 },
  { label: 'orchestr.', x: 124, y: 40 },
  { label: 'gemini', x: 228, y: 40 },
  { label: 'vectors', x: 124, y: 110 },
]);

export const LOGO_MARK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="10" fill="#0F1115"/><rect x="8" y="14" width="20" height="14" rx="3" fill="none" stroke="#3B82F6" stroke-width="3"/><rect x="36" y="36" width="20" height="14" rx="3" fill="none" stroke="#60A5FA" stroke-width="3"/><path d="M28 21h10a6 6 0 0 1 6 6v9" fill="none" stroke="#3B82F6" stroke-width="3"/></svg>`,
)}`;
