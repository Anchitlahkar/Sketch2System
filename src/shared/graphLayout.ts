/**
 * Geometry shared by the validator (which fills in missing coordinates) and
 * NodeCanvas (which draws cards and edges). Both must agree or the arrows drift
 * away from the boxes.
 */

/** Card width in canvas units. Matches the `w-52` Tailwind class on the node card. */
export const NODE_W = 208;
/** Card height in canvas units. The card is fixed to this height so edge endpoints are exact. */
export const NODE_H = 132;

export const CANVAS_PADDING = 60;

const AUTO_COLS = 4;
const AUTO_COL_GAP = 90;
const AUTO_ROW_GAP = 70;

/** Deterministic grid slot for a node the model gave no usable coordinates for. */
export function autoPosition(index: number): { x: number; y: number } {
  const col = index % AUTO_COLS;
  const row = Math.floor(index / AUTO_COLS);
  return {
    x: CANVAS_PADDING + col * (NODE_W + AUTO_COL_GAP),
    y: CANVAS_PADDING + row * (NODE_H + AUTO_ROW_GAP),
  };
}

export interface CanvasBounds {
  width: number;
  height: number;
}

export function canvasBounds(nodes: Array<{ x: number; y: number }>): CanvasBounds {
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    if (node.x > maxX) maxX = node.x;
    if (node.y > maxY) maxY = node.y;
  }
  return {
    width: Math.max(maxX + NODE_W + CANVAS_PADDING, 900),
    height: Math.max(maxY + NODE_H + CANVAS_PADDING, 420),
  };
}

export interface EdgeGeometry {
  path: string;
  labelX: number;
  labelY: number;
  /**
   * Horizontal room the label may occupy without covering either card. Labels are
   * truncated to this budget: drawn at full length they spill over the node cards
   * and hide the tech/port rows underneath.
   */
  labelBudget: number;
}

/** Labels narrower than this are illegible once truncated, so they are dropped. */
export const MIN_LABEL_BUDGET = 44;

/**
 * Anchors an edge to the facing sides of the two cards and returns a horizontal
 * cubic Bezier between them. The end point is pulled back by `arrowGap` so the
 * marker tip lands on the card border rather than under it.
 */
export function edgeGeometry(
  from: { x: number; y: number },
  to: { x: number; y: number },
  arrowGap = 10,
): EdgeGeometry {
  const goesRight = to.x >= from.x;

  const x1 = goesRight ? from.x + NODE_W : from.x;
  const x2raw = goesRight ? to.x : to.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const y2 = to.y + NODE_H / 2;

  const x2 = x2raw + (goesRight ? -arrowGap : arrowGap);

  // Self-reference: draw a small loop off the right edge instead of a zero-length line.
  if (Math.abs(x2 - x1) < 1 && Math.abs(y2 - y1) < 1) {
    const loopX = from.x + NODE_W;
    const loopY = from.y + NODE_H / 2;
    return {
      path: `M ${loopX} ${loopY - 20} C ${loopX + 70} ${loopY - 60}, ${loopX + 70} ${loopY + 60}, ${loopX + arrowGap} ${loopY + 20}`,
      labelX: loopX + 60,
      labelY: loopY - 34,
      labelBudget: 130,
    };
  }

  const dx = (x2 - x1) / 2;
  return {
    path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
    labelX: (x1 + x2) / 2,
    labelY: (y1 + y2) / 2 - 10,
    labelBudget: Math.max(0, Math.abs(x2 - x1) - 12),
  };
}

const LABEL_H = 15;

function intersectsAnyCard(
  rect: { x: number; y: number; w: number; h: number },
  nodes: ReadonlyArray<{ x: number; y: number }>,
): boolean {
  return nodes.some(
    (n) => rect.x < n.x + NODE_W && rect.x + rect.w > n.x && rect.y < n.y + NODE_H && rect.y + rect.h > n.y,
  );
}

export interface LabelPlacement {
  x: number;
  y: number;
  /** Width the label may use at this position. */
  budget: number;
}

/**
 * Chooses where an edge label can sit without covering any node card.
 *
 * Drawn naively at the path midpoint, a long label lands squarely on top of the
 * cards it runs between and hides their tech/port rows. Truncating it to the gap
 * between those two cards fixes the overlap but shreds the text ("Service C…"), so
 * candidate positions clear of the cards are tried first, at full width:
 *
 *   1. on the line at the midpoint
 *   2. lifted just above the taller card
 *   3. dropped just below the lower card
 *
 * Each candidate is tested against *every* card, not just the two endpoints — a
 * third card sitting diagonally is the case a two-node check misses. Only if all
 * three collide does the label fall back to the midpoint, ellipsized to the corridor.
 */
export function labelPlacement(
  from: { x: number; y: number },
  to: { x: number; y: number },
  nodes: ReadonlyArray<{ x: number; y: number }>,
  textWidth: number,
): LabelPlacement | null {
  const { labelX, labelY, labelBudget: corridor } = edgeGeometry(from, to);

  const candidates = [
    labelY,
    Math.min(from.y, to.y) - 8, // above the row
    Math.max(from.y, to.y) + NODE_H + 16, // below the row
  ];

  for (const y of candidates) {
    if (y - 9 < 0) continue; // would be clipped by the canvas top
    const rect = { x: labelX - textWidth / 2, y: y - 9, w: textWidth, h: LABEL_H };
    if (!intersectsAnyCard(rect, nodes)) return { x: labelX, y, budget: textWidth };
  }

  return corridor >= MIN_LABEL_BUDGET ? { x: labelX, y: labelY, budget: corridor } : null;
}
