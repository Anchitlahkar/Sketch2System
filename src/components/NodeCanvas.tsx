import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Box,
  Cpu,
  Database,
  Globe,
  Layers,
  LayoutGrid,
  Link2,
  Maximize2,
  Minimize2,
  Network,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Workflow,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { ArchitectureEdge, ArchitectureNode, NodeType } from '../types';
import {
  MIN_LABEL_BUDGET,
  NODE_H,
  NODE_W,
  type Rect,
  canvasBounds,
  edgeGeometry,
  labelPlacement,
} from '../shared/graphLayout';

interface NodeCanvasProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: ArchitectureNode | null) => void;
  onNodesChange: (nodes: ArchitectureNode[]) => void;
  onEdgesChange: (edges: ArchitectureEdge[]) => void;
  onRelayout: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;

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

const LABEL_CHAR_W = 5.6;
const LABEL_PADDING = 10;

function labelWidth(text: string): number {
  return text.length * LABEL_CHAR_W + LABEL_PADDING;
}

function fitLabel(text: string, budget: number): string | null {
  if (budget < MIN_LABEL_BUDGET) return null;
  if (labelWidth(text) <= budget) return text;
  const maxChars = Math.floor((budget - LABEL_PADDING) / LABEL_CHAR_W);
  if (maxChars < 2) return null;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

const edgeKey = (edge: ArchitectureEdge) => `${edge.from}->${edge.to}`;

interface DragState {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  x: number;
  y: number;
  moved: boolean;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onNodesChange,
  onEdgesChange,
  onRelayout,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  // While dragging, the moved node is rendered from local state so a pointermove does
  // not round-trip through the parent on every frame. The final position is committed
  // on pointerup.
  const positioned = useMemo(
    () => (drag ? nodes.map((n) => (n.id === drag.id ? { ...n, x: drag.x, y: drag.y } : n)) : nodes),
    [drag, nodes],
  );

  const bounds = useMemo(() => canvasBounds(positioned), [positioned]);

  const nodesById = useMemo(() => {
    const map = new Map<string, ArchitectureNode>();
    for (const node of positioned) map.set(node.id, node);
    return map;
  }, [positioned]);

  const drawnEdges = useMemo(() => {
    // Labels are placed in sequence, each avoiding the cards and every label already
    // placed, so parallel edges cannot stack their labels on the same spot.
    const claimed: Rect[] = [];

    return edges.flatMap((edge) => {
      const fromNode = nodesById.get(edge.from);
      const toNode = nodesById.get(edge.to);
      if (!fromNode || !toNode) return [];

      const status = edge.status ?? 'ok';
      const text = edge.label ?? edge.protocol ?? '';
      const placement = text ? labelPlacement(fromNode, toNode, positioned, labelWidth(text), claimed) : null;

      if (placement) {
        const shown = fitLabel(text, placement.budget);
        if (shown) {
          claimed.push({
            x: placement.x - labelWidth(shown) / 2,
            y: placement.y - 9,
            w: labelWidth(shown),
            h: 15,
          });
        }
      }

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
    });
  }, [edges, nodesById, positioned, selectedNodeId]);

  // Latest zoom, readable synchronously inside pointer/wheel handlers.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  /**
   * Zooms about an anchor point, defaulting to the centre of the viewport, and keeps
   * whatever is under that anchor fixed. Anchoring at the top-left corner instead made
   * the graph lurch away from wherever the user was looking.
   */
  const applyZoom = useCallback((next: number, anchorClientX?: number, anchorClientY?: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const previous = zoomRef.current;
    const target = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(3))));
    if (target === previous) return;

    const rect = viewport.getBoundingClientRect();
    const anchorX = (anchorClientX ?? rect.left + viewport.clientWidth / 2) - rect.left;
    const anchorY = (anchorClientY ?? rect.top + viewport.clientHeight / 2) - rect.top;

    // Content-space point currently under the anchor.
    const contentX = (viewport.scrollLeft + anchorX) / previous;
    const contentY = (viewport.scrollTop + anchorY) / previous;

    zoomRef.current = target;
    setZoom(target);

    // Restore after the new size is laid out.
    requestAnimationFrame(() => {
      viewport.scrollLeft = contentX * target - anchorX;
      viewport.scrollTop = contentY * target - anchorY;
    });
  }, []);

  const fitToView = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const availableW = viewport.clientWidth - 32;
    const availableH = viewport.clientHeight - 32;
    if (availableW <= 0 || availableH <= 0) return;
    const next = Math.max(MIN_ZOOM, Math.min(1, availableW / bounds.width, availableH / bounds.height));
    // Ignore hair-thin changes. Auto-fit shrinks the graph, which can remove a
    // scrollbar, which grows the viewport, which would refit again — this stops that
    // loop from oscillating.
    setZoom((prev) => (Math.abs(prev - next) < 0.01 ? prev : Number(next.toFixed(3))));
  }, [bounds.height, bounds.width]);

  // Held in a ref so the auto-fit effects do not re-subscribe every time the bounds
  // change (which happens on every pointermove during a drag).
  const fitRef = useRef(fitToView);
  fitRef.current = fitToView;

  // True once the user zooms by hand. Auto-fit then stops touching their zoom level.
  const userZoomedRef = useRef(false);

  const zoomBy = useCallback(
    (delta: number) => {
      userZoomedRef.current = true;
      applyZoom(zoomRef.current + delta);
    },
    [applyZoom],
  );

  const handleFitClick = useCallback(() => {
    userZoomedRef.current = false;
    fitRef.current();
  }, []);

  // Fit when the graph itself changes — not when its bounds shift because a node was
  // dragged, and not on every resize.
  const graphKey = useMemo(() => nodes.map((n) => n.id).join('|'), [nodes]);

  useLayoutEffect(() => {
    userZoomedRef.current = false;
    fitRef.current();
  }, [graphKey]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      // Only while the user has not taken manual control of the zoom. Otherwise the
      // scrollbar that appears when zooming in resizes the viewport, refits, and snaps
      // the zoom straight back.
      if (!userZoomedRef.current) fitRef.current();
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // Ctrl/⌘ + wheel zooms about the cursor, matching map and design tools. Plain wheel
  // still scrolls the viewport.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      userZoomedRef.current = true;
      // Multiplicative so each notch feels the same at any zoom level.
      const factor = Math.exp(-event.deltaY * 0.0015);
      applyZoom(zoomRef.current * factor, event.clientX, event.clientY);
    };
    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  /** Pointer position in canvas units, accounting for zoom and scroll. */
  const toCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const surface = surfaceRef.current;
    if (!surface) return { x: 0, y: 0 };
    const rect = surface.getBoundingClientRect();
    const scale = rect.width / (surface.offsetWidth || 1);
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, node: ArchitectureNode) => {
    if (event.button !== 0 || isConnecting) return;
    const point = toCanvasPoint(event.clientX, event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      id: node.id,
      pointerId: event.pointerId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y,
      x: node.x,
      y: node.y,
      moved: false,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const point = toCanvasPoint(event.clientX, event.clientY);
    const x = Math.max(0, point.x - drag.offsetX);
    const y = Math.max(0, point.y - drag.offsetY);
    // A few pixels of slop so a click is not mistaken for a drag.
    const moved = drag.moved || Math.abs(x - drag.x) > 2 || Math.abs(y - drag.y) > 2;
    setDrag({ ...drag, x, y, moved });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>, node: ArchitectureNode) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (drag.moved) {
      onNodesChange(
        nodes.map((n) => (n.id === drag.id ? { ...n, x: Math.round(drag.x), y: Math.round(drag.y) } : n)),
      );
    } else {
      onSelectNode(selectedNodeId === node.id ? null : node);
    }
    setDrag(null);
  };

  const handleNodeActivate = (node: ArchitectureNode) => {
    if (!isConnecting) {
      onSelectNode(selectedNodeId === node.id ? null : node);
      return;
    }
    if (!connectFrom) {
      setConnectFrom(node.id);
      return;
    }
    if (connectFrom !== node.id && !edges.some((e) => e.from === connectFrom && e.to === node.id)) {
      onEdgesChange([...edges, { from: connectFrom, to: node.id, label: 'new connection', status: 'ok' }]);
    }
    setConnectFrom(null);
    setIsConnecting(false);
  };

  const addNode = () => {
    let index = nodes.length + 1;
    while (nodes.some((n) => n.id === `node_${index}`)) index += 1;
    const id = `node_${index}`;
    // Drop it clear of everything, to the right of the current content.
    const x = nodes.length ? Math.max(...nodes.map((n) => n.x)) + NODE_W + 120 : 50;
    const y = nodes.length ? Math.min(...nodes.map((n) => n.y)) : 50;
    const node: ArchitectureNode = {
      id,
      label: 'New Component',
      type: 'service',
      tech: 'unspecified',
      details: {},
      x,
      y,
    };
    onNodesChange([...nodes, node]);
    onSelectNode(node);
  };

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    onNodesChange(nodes.filter((n) => n.id !== selectedNodeId));
    onEdgesChange(edges.filter((e) => e.from !== selectedNodeId && e.to !== selectedNodeId));
    onSelectNode(null);
  }, [edges, nodes, onEdgesChange, onNodesChange, onSelectNode, selectedNodeId]);

  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    onEdgesChange(edges.filter((e) => edgeKey(e) !== selectedEdge));
    setSelectedEdge(null);
  }, [edges, onEdgesChange, selectedEdge]);

  // Delete/Backspace removes whatever is selected, unless focus is in a text field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (event.key === 'Escape') {
        setIsConnecting(false);
        setConnectFrom(null);
        setSelectedEdge(null);
        return;
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return;
      if (selectedEdge) {
        event.preventDefault();
        deleteSelectedEdge();
      } else if (selectedNodeId) {
        event.preventDefault();
        deleteSelectedNode();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [deleteSelectedEdge, deleteSelectedNode, selectedEdge, selectedNodeId]);

  const toolButton =
    'w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex-1 min-w-0 relative bg-[#0A0C10] border-b border-white/10 overflow-hidden min-h-[350px]">
      <div className="absolute top-4 right-4 flex flex-wrap justify-end gap-2 z-30 font-mono max-w-[calc(100%-2rem)]">
        <button type="button" onClick={addNode} className={toolButton} title="Add component" aria-label="Add component">
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setIsConnecting((prev) => !prev);
            setConnectFrom(null);
          }}
          className={`${toolButton} ${isConnecting ? 'border-blue-500 text-blue-400 bg-blue-500/10' : ''}`}
          title="Connect two components"
          aria-label="Connect two components"
          aria-pressed={isConnecting}
        >
          <Link2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={selectedEdge ? deleteSelectedEdge : deleteSelectedNode}
          disabled={!selectedNodeId && !selectedEdge}
          className={toolButton}
          title={selectedEdge ? 'Delete selected connection' : 'Delete selected component'}
          aria-label="Delete selection"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button type="button" onClick={onRelayout} className={toolButton} title="Auto-arrange" aria-label="Auto-arrange">
          <LayoutGrid className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => zoomBy(0.15)} className={toolButton} title="Zoom in" aria-label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => zoomBy(-0.15)} className={toolButton} title="Zoom out" aria-label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </button>
        <button type="button" onClick={handleFitClick} className={toolButton} title="Fit to view" aria-label="Fit to view">
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleFullscreen}
          className={toolButton}
          title={isFullscreen ? 'Exit full screen' : 'Full screen canvas'}
          aria-label={isFullscreen ? 'Exit full screen' : 'Full screen canvas'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Network className="w-4 h-4" />}
        </button>
        <span className="h-8 px-2 flex items-center bg-[#15181E] border border-white/10 rounded text-[10px] text-white/50 tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {isConnecting && (
        <div className="absolute top-4 left-4 z-30 bg-blue-600/20 border border-blue-500/50 text-blue-200 rounded px-3 py-1.5 font-mono text-[11px]">
          {connectFrom ? 'Now click the target component' : 'Click the source component'} · Esc to cancel
        </div>
      )}

      {nodes.length === 0 ? (
        <div className="h-full w-full flex flex-col items-center justify-center gap-3 text-center px-6 bg-grid-pattern">
          <Network className="w-10 h-10 text-white/15" />
          <p className="font-mono text-xs text-white/50 max-w-sm">
            No nodes on the canvas. Capture a sketch, upload a photo, or load a sample to compile an architecture graph.
          </p>
          <button
            type="button"
            onClick={addNode}
            className="mt-1 px-3 py-1.5 bg-white/5 border border-blue-500/40 text-blue-400 rounded hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1.5 text-[11px] font-mono cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add a component manually</span>
          </button>
        </div>
      ) : (
        <div ref={viewportRef} className="h-full w-full overflow-auto bg-grid-pattern p-4">
          <div style={{ width: bounds.width * zoom, height: bounds.height * zoom }}>
            <div
              ref={surfaceRef}
              className="relative origin-top-left"
              style={{ width: bounds.width, height: bounds.height, transform: `scale(${zoom})` }}
            >
              <svg
                className="absolute inset-0 z-0"
                width={bounds.width}
                height={bounds.height}
                viewBox={`0 0 ${bounds.width} ${bounds.height}`}
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

                {drawnEdges.map(({ edge, color, status, path, isDimmed }) => {
                  const key = edgeKey(edge);
                  const isSelected = selectedEdge === key;
                  return (
                    <g key={key}>
                      {/* Invisible fat stroke: a 2px line is far too thin to click. */}
                      <path
                        d={path}
                        fill="none"
                        stroke="transparent"
                        strokeWidth={14}
                        className="cursor-pointer pointer-events-auto"
                        onClick={() => setSelectedEdge(isSelected ? null : key)}
                      />
                      <path
                        d={path}
                        fill="none"
                        stroke={isSelected ? '#ffffff' : color}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeDasharray={edge.style === 'solid' ? undefined : '6 4'}
                        className={`pointer-events-none ${edge.style === 'animated' && !isSelected ? 'flow-line' : ''}`}
                        markerEnd={`url(#arrowhead-${status})`}
                        opacity={isDimmed ? 0.25 : 1}
                      />
                    </g>
                  );
                })}
              </svg>

              {positioned.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const isConnectSource = connectFrom === node.id;
                const isDragging = drag?.id === node.id && drag.moved;
                const badgeClass = NODE_BADGE_CLASSES[node.type];

                return (
                  <div
                    key={node.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${node.label}, ${node.type}, ${node.tech}`}
                    onPointerDown={(event) => handlePointerDown(event, node)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={(event) => handlePointerUp(event, node)}
                    onClick={() => {
                      if (isConnecting) handleNodeActivate(node);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        handleNodeActivate(node);
                      }
                    }}
                    style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H, touchAction: 'none' }}
                    className={`absolute bg-[#15181E] border rounded overflow-hidden z-10 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                      isDragging ? 'cursor-grabbing shadow-[0_8px_30px_rgba(0,0,0,0.6)] z-20' : 'cursor-grab'
                    } ${
                      isConnectSource
                        ? 'border-blue-400 ring-2 ring-blue-400/60'
                        : isSelected
                          ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)]'
                          : 'border-white/10 hover:border-blue-500/60'
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

                    <div className="px-3 py-2 font-mono text-[11px] text-white/70 space-y-1 relative z-10 select-none">
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

                    <div className="absolute top-1/2 -left-[5px] w-2.5 h-2.5 bg-blue-500 -translate-y-1/2 rounded-sm shadow-[0_0_8px_#3B82F6]" />
                    <div className="absolute top-1/2 -right-[5px] w-2.5 h-2.5 bg-blue-400 -translate-y-1/2 rounded-sm shadow-[0_0_8px_#60A5FA]" />
                  </div>
                );
              })}

              {/* Label layer above the cards; placement already guarantees no overlap. */}
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
                  const isSelected = selectedEdge === edgeKey(edge);

                  return (
                    <g key={`label-${edgeKey(edge)}`} opacity={isDimmed ? 0.25 : 1}>
                      <title>{text}</title>
                      <rect
                        x={placement.x - labelWidth(shown) / 2}
                        y={placement.y - 9}
                        width={labelWidth(shown)}
                        height={15}
                        rx={3}
                        fill="#0A0C10"
                        stroke={isSelected ? '#ffffff' : color}
                        strokeOpacity={isSelected ? 1 : 0.35}
                      />
                      <text
                        x={placement.x}
                        y={placement.y - 1}
                        fill={isSelected ? '#ffffff' : color}
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
