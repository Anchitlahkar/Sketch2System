/**
 * Layered graph layout.
 *
 * The model used to be asked for exact pixel coordinates inside a fixed box. That box
 * only ever had room for eight cards, so any graph larger than that came back with
 * nodes stacked on top of each other and edges buried underneath them — no prompt
 * wording can fix an instruction that is arithmetically impossible to satisfy.
 *
 * Placement is now computed here instead. The model's coordinates are kept only as
 * *ordering* hints (which node sits above which), which is the part it is actually good
 * at; exact spacing is arithmetic and belongs in code. The result is overlap-free for
 * any node count.
 */

import type { SketchAnalysisResult } from '../types';
import { NODE_H, NODE_W } from './graphLayout';

const COL_GAP = 120;
const ROW_GAP = 56;
const PAD = 50;

export interface LayoutInput {
  id: string;
  /** Model-suggested coordinates, used only to break ties in ordering. */
  x?: number;
  y?: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
}

export type LayoutResult = Map<string, { x: number; y: number }>;

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Longest-path layering. Nodes with no inbound edge start at layer 0; every other node
 * sits one layer past its deepest predecessor, so edges point consistently rightward.
 * Nodes left unresolved by the Kahn sweep are inside a cycle and are placed one layer
 * past whichever predecessors did resolve.
 */
function assignLayers(nodes: LayoutInput[], edges: LayoutEdge[]): Map<string, number> {
  const ids = new Set(nodes.map((n) => n.id));
  const outgoing = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of nodes) {
    outgoing.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    outgoing.get(edge.from)!.push(edge.to);
    indegree.set(edge.to, (indegree.get(edge.to) ?? 0) + 1);
  }

  const layer = new Map<string, number>();
  const queue: string[] = [];

  for (const node of nodes) {
    if ((indegree.get(node.id) ?? 0) === 0) {
      layer.set(node.id, 0);
      queue.push(node.id);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const id = queue[head++]!;
    const current = layer.get(id) ?? 0;
    for (const next of outgoing.get(id) ?? []) {
      layer.set(next, Math.max(layer.get(next) ?? 0, current + 1));
      const remaining = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  // Cycle members never reached indegree 0. Seat them after their resolved predecessors.
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    push(incoming, edge.to, edge.from);
  }
  for (const node of nodes) {
    if (layer.has(node.id)) continue;
    const preds = (incoming.get(node.id) ?? []).map((p) => layer.get(p)).filter((v): v is number => v !== undefined);
    layer.set(node.id, preds.length ? Math.max(...preds) + 1 : 0);
  }

  return layer;
}

/**
 * Barycenter ordering: repeatedly place each node next to the average position of its
 * neighbours in the adjacent layer. Two passes removes most edge crossings; more passes
 * rarely pay for themselves on graphs this size.
 */
function orderWithinLayers(
  columns: string[][],
  edges: LayoutEdge[],
  hintY: Map<string, number>,
): void {
  const incoming = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    push(incoming, edge.to, edge.from);
    push(outgoing, edge.from, edge.to);
  }

  const indexOf = new Map<string, number>();
  const reindex = () => {
    for (const column of columns) column.forEach((id, i) => indexOf.set(id, i));
  };
  reindex();

  const barycenter = (id: string, neighbours: Map<string, string[]>, fallback: number): number => {
    const list = (neighbours.get(id) ?? []).map((n) => indexOf.get(n)).filter((v): v is number => v !== undefined);
    if (!list.length) return fallback;
    return list.reduce((sum, v) => sum + v, 0) / list.length;
  };

  for (let pass = 0; pass < 2; pass += 1) {
    // Forward: order each column by its predecessors.
    for (let c = 1; c < columns.length; c += 1) {
      const column = columns[c]!;
      const keys = new Map(column.map((id, i) => [id, barycenter(id, incoming, i)]));
      column.sort((a, b) => (keys.get(a)! - keys.get(b)!) || (hintY.get(a)! - hintY.get(b)!));
      reindex();
    }
    // Backward: order each column by its successors.
    for (let c = columns.length - 2; c >= 0; c -= 1) {
      const column = columns[c]!;
      const keys = new Map(column.map((id, i) => [id, barycenter(id, outgoing, i)]));
      column.sort((a, b) => (keys.get(a)! - keys.get(b)!) || (hintY.get(a)! - hintY.get(b)!));
      reindex();
    }
  }
}

export function layoutGraph(nodes: LayoutInput[], edges: LayoutEdge[]): LayoutResult {
  const result: LayoutResult = new Map();
  if (!nodes.length) return result;

  const layer = assignLayers(nodes, edges);
  const hintY = new Map(nodes.map((n, i) => [n.id, n.y ?? i * 10]));

  const maxLayer = Math.max(...nodes.map((n) => layer.get(n.id) ?? 0));
  const columns: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  for (const node of nodes) columns[layer.get(node.id) ?? 0]!.push(node.id);

  // Seed each column with the model's vertical ordering before optimising crossings.
  for (const column of columns) column.sort((a, b) => (hintY.get(a) ?? 0) - (hintY.get(b) ?? 0));
  orderWithinLayers(columns, edges, hintY);

  const tallest = Math.max(...columns.map((c) => c.length));
  const contentH = tallest * NODE_H + (tallest - 1) * ROW_GAP;

  columns.forEach((column, columnIndex) => {
    const columnH = column.length * NODE_H + (column.length - 1) * ROW_GAP;
    // Centre shorter columns against the tallest one so the graph reads as a band.
    const offset = (contentH - columnH) / 2;
    column.forEach((id, rowIndex) => {
      result.set(id, {
        x: PAD + columnIndex * (NODE_W + COL_GAP),
        y: Math.round(PAD + offset + rowIndex * (NODE_H + ROW_GAP)),
      });
    });
  });

  return result;
}

/**
 * Returns the analysis with every node repositioned by the layered layout. Applied to
 * each new result, and again whenever the user hits auto-arrange after moving things
 * around by hand.
 */
export function applyAutoLayout(result: SketchAnalysisResult): SketchAnalysisResult {
  if (!result.nodes.length) return result;
  const positions = layoutGraph(result.nodes, result.edges);
  return {
    ...result,
    nodes: result.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, x: position.x, y: position.y } : node;
    }),
  };
}
