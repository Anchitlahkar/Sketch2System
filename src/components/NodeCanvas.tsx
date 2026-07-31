import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Cpu,
  Database,
  Globe,
  Layers,
  Maximize2,
  Network,
  Server,
  ShieldCheck,
  Sparkles,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { ArchitectureEdge, ArchitectureNode, NodeType } from '../types';
import { MIN_LABEL_BUDGET, NODE_H, NODE_W, canvasBounds, edgeGeometry, labelPlacement } from '../shared/graphLayout';

interface NodeCanvasProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: ArchitectureNode | null) => void;
}

const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;

const NODE_ICONS: Record<NodeType, React.ReactNode> = {
  frontend: <Globe className="w-4 h-4" />,
  gateway: <Layers className="w-4 h-4" />,
  database: <Database className="w-4 h-4" />,
  cache: <Cpu className="w-4 h-4" />,
  auth: <ShieldCheck className="w-4 h-4" />,
  external: <Sparkles className="w-4 h-4" />,
  queue: <Workflow className="w-4 h-4" />,
  service: <Network className="w-4 h-4" />,
  backend: <Server className="w-4 h-4" />,
};

const NODE_BADGE_CLASSES: Record<NodeType, string> = {
  frontend: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  gateway: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  database: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  cache: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  auth: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  external: 'border-blue-500/40 bg-blue-500/20 text-blue-300',
  queue: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  service: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
  backend: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
};

const EDGE_COLORS = {
  ok: '#3B82F6',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

/** Approximate advance width of the 10px monospace label face. */
const LABEL_CHAR_W = 5.6;
const LABEL_PADDING = 10;

/** Approximate width of a monospace label at 10px, for the halo behind edge text. */
function labelWidth(text: string): number {
  return text.length * LABEL_CHAR_W + LABEL_PADDING;
}

/**
 * Ellipsizes a label to the width it was allotted. Only reached when no
 * collision-free position was available; otherwise the full text is drawn.
 */
function fitLabel(text: string, budget: number): string | null {
  if (budget < MIN_LABEL_BUDGET) return null;
  if (labelWidth(text) <= budget) return text;

  const maxChars = Math.floor((budget - LABEL_PADDING) / LABEL_CHAR_W);
  if (maxChars < 2) return null;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({ nodes, edges, selectedNodeId, onSelectNode }) => {
  const [zoom, setZoom] = useState<number>(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const bounds = useMemo(() => canvasBounds(nodes), [nodes]);

  const nodesById = useMemo(() => {
    const map = new Map<string, ArchitectureNode>();
    for (const node of nodes) map.set(node.id, node);
    return map;
  }, [nodes]);

  const drawnEdges = useMemo(
    () =>
      edges.flatMap((edge) => {
        const fromNode = nodesById.get(edge.from);
        const toNode = nodesById.get(edge.to);
        if (!fromNode || !toNode) return []; // validator drops these; belt and braces

        const status = edge.status ?? 'ok';
        const text = edge.label ?? edge.protocol ?? '';
        // Placement is resolved against every card, so a label never lands on a node.
        const placement = text ? labelPlacement(fromNode, toNode, nodes, labelWidth(text)) : null;

        return [
          {
            edge,
            status,
            color: EDGE_COLORS[status],
            isDimmed: selectedNodeId !== null && edge.from !== selectedNodeId && edge.to !== selectedNodeId,
            text,
            placement,
            ...edgeGeometry(fromNode, toNode),
          },
        ];
      }),
    [edges, nodes, nodesById, selectedNodeId],
  );

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    // Fit both axes — fitting width alone still clipped tall graphs vertically.
    const availableW = viewport.clientWidth - 32;
    const availableH = viewport.clientHeight - 32;
    if (availableW <= 0 || availableH <= 0) return;
    const next = Math.min(1, availableW / bounds.width, availableH / bounds.height);
    setZoom(Math.max(MIN_ZOOM, Number(next.toFixed(3))));
  }, [bounds.height, bounds.width]);

  // Refit when the graph changes shape *and* whenever the viewport resizes.
  // A one-shot layout effect measured whatever width the container happened to
  // have at that moment, which is not necessarily its settled width.
  useLayoutEffect(() => {
    fitToView();
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => fitToView());
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [fitToView]);

  const zoomBy = (delta: number) =>
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number((prev + delta).toFixed(3)))));

  return (
    <div className="flex-1 min-w-0 relative bg-[#0A0C10] border-b border-white/10 overflow-hidden min-h-[350px]">
      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-30 font-mono">
        <button
          type="button"
          onClick={() => zoomBy(0.15)}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Zoom in"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-0.15)}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Zoom out"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={fitToView}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Fit to view"
          aria-label="Fit graph to view"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <span className="h-8 px-2 flex items-center bg-[#15181E] border border-white/10 rounded text-[10px] text-white/50 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {nodes.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-grid-pattern">
          <Network className="w-10 h-10 text-white/15" />
          <p className="font-mono text-xs text-white/50 max-w-sm">
            No nodes on the canvas. Capture a sketch, upload a photo, or load a sample to compile an architecture graph.
          </p>
        </div>
      ) : (
        <div ref={viewportRef} className="h-full w-full overflow-auto bg-grid-pattern p-4">
          {/* Sizer carries the scaled footprint so scrollbars match what is drawn. */}
          <div style={{ width: bounds.width * zoom, height: bounds.height * zoom }}>
            <div
              className="relative origin-top-left transition-transform duration-150 ease-out"
              style={{ width: bounds.width, height: bounds.height, transform: `scale(${zoom})` }}
            >
              {/* Edges share the node coordinate space, so arrows land on the cards. */}
              <svg
                className="absolute inset-0 pointer-events-none z-0"
                width={bounds.width}
                height={bounds.height}
                viewBox={`0 0 ${bounds.width} ${bounds.height}`}
                aria-hidden="true"
              >
                <defs>
                  {Object.entries(EDGE_COLORS).map(([status, color]) => (
                    <marker
                      key={status}
                      id={`arrowhead-${status}`}
                      markerWidth="9"
                      markerHeight="7"
                      refX="8"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon points="0 0, 9 3.5, 0 7" fill={color} />
                    </marker>
                  ))}
                </defs>

                {drawnEdges.map(({ edge, color, status, path, isDimmed }) => (
                  <path
                    key={`${edge.from}->${edge.to}`}
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={edge.style === 'solid' ? undefined : '6 4'}
                    className={edge.style === 'animated' ? 'flow-line' : undefined}
                    markerEnd={`url(#arrowhead-${status})`}
                    opacity={isDimmed ? 0.25 : 1}
                  />
                ))}
              </svg>

              {/* Node cards, absolutely placed at the coordinates the edges were drawn from. */}
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const badgeClass = NODE_BADGE_CLASSES[node.type];

                return (
                  <div
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${node.label}, ${node.type}, ${node.tech}`}
                    onClick={() => onSelectNode(isSelected ? null : node)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectNode(isSelected ? null : node);
                      }
                      if (event.key === 'Escape') onSelectNode(null);
                    }}
                    style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                    className={`absolute bg-[#15181E] border rounded overflow-hidden transition-colors duration-150 cursor-pointer z-10 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                        : 'border-white/10 hover:border-blue-500/60 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                    }`}
                  >
                    <div className="absolute right-[-10px] top-[-10px] pointer-events-none">
                      <Box className="w-20 h-20 text-white/5" />
                    </div>

                    <div className={`border-b px-3 py-2 flex items-center justify-between relative z-10 ${badgeClass}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {NODE_ICONS[node.type]}
                        <span className="font-mono font-bold text-xs uppercase tracking-wider truncate">{node.label}</span>
                      </div>
                      <Activity className="w-3.5 h-3.5 shrink-0" />
                    </div>

                    <div className="px-3 py-2 font-mono text-[11px] text-white/70 space-y-1 relative z-10">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-white/40 shrink-0">tech:</span>
                        <span className="text-white font-bold truncate">{node.tech}</span>
                      </div>
                      {node.details.port && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-white/40 shrink-0">port:</span>
                          <span className="text-blue-400 truncate">{node.details.port}</span>
                        </div>
                      )}
                      {node.details.status && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-white/40 shrink-0">status:</span>
                          <span className="text-blue-400 font-bold truncate">{node.details.status}</span>
                        </div>
                      )}
                      {node.details.latency && (
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-white/40 shrink-0">latency:</span>
                          <span className="text-sky-400 truncate">{node.details.latency}</span>
                        </div>
                      )}
                    </div>

                    {/* Connector studs, aligned with the edge anchor points. */}
                    <div className="absolute top-1/2 -left-[5px] w-2.5 h-2.5 bg-blue-500 -translate-y-1/2 rounded-sm shadow-[0_0_8px_#3B82F6]" />
                    <div className="absolute top-1/2 -right-[5px] w-2.5 h-2.5 bg-blue-400 -translate-y-1/2 rounded-sm shadow-[0_0_8px_#60A5FA]" />
                  </div>
                );
              })}

              {/*
                Edge labels ride in their own layer above the cards. Drawn inside the
                path SVG they were hidden behind adjacent nodes whenever two nodes sat
                close together — exactly where the label matters most.
              */}
              <svg
                className="absolute inset-0 pointer-events-none z-20"
                width={bounds.width}
                height={bounds.height}
                viewBox={`0 0 ${bounds.width} ${bounds.height}`}
                aria-hidden="true"
              >
                {drawnEdges.map(({ edge, color, text, placement, isDimmed }) => {
                  if (!placement) return null;
                  const shown = fitLabel(text, placement.budget);
                  if (!shown) return null;

                  return (
                    <g key={`label-${edge.from}->${edge.to}`} opacity={isDimmed ? 0.25 : 1}>
                      {/* Full text on hover, for the rare label that still had to be shortened. */}
                      <title>{text}</title>
                      <rect
                        x={placement.x - labelWidth(shown) / 2}
                        y={placement.y - 9}
                        width={labelWidth(shown)}
                        height={15}
                        rx={3}
                        fill="#0A0C10"
                        stroke={color}
                        strokeOpacity={0.35}
                      />
                      <text
                        x={placement.x}
                        y={placement.y - 1}
                        fill={color}
                        fontSize={10}
                        fontFamily="JetBrains Mono, monospace"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {shown}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
