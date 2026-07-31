import React, { useState } from 'react';
import { ArchitectureNode, ArchitectureEdge } from '../types';
import { Globe, Server, Database, Cpu, Layers, ShieldCheck, Box, Sparkles, ZoomIn, ZoomOut, Maximize2, Activity } from 'lucide-react';

interface NodeCanvasProps {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  onSelectNode?: (node: ArchitectureNode) => void;
}

export const NodeCanvas: React.FC<NodeCanvasProps> = ({ nodes, edges, onSelectNode }) => {
  const [zoom, setZoom] = useState<number>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'frontend':
        return <Globe className="w-4 h-4 text-blue-400" />;
      case 'gateway':
        return <Layers className="w-4 h-4 text-blue-400" />;
      case 'database':
        return <Database className="w-4 h-4 text-blue-400" />;
      case 'cache':
        return <Cpu className="w-4 h-4 text-sky-400" />;
      case 'auth':
        return <ShieldCheck className="w-4 h-4 text-indigo-400" />;
      case 'external':
        return <Sparkles className="w-4 h-4 text-blue-400" />;
      case 'backend':
      default:
        return <Server className="w-4 h-4 text-blue-400" />;
    }
  };

  const getNodeTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'frontend':
      case 'gateway':
        return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
      case 'database':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
      case 'cache':
      case 'auth':
        return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300';
      case 'external':
        return 'border-blue-500/40 bg-blue-500/20 text-blue-300';
      case 'backend':
      default:
        return 'border-blue-500/30 bg-blue-500/10 text-blue-400';
    }
  };

  return (
    <div className="flex-1 relative bg-[#0A0C10] bg-grid-pattern border-b border-white/10 p-8 overflow-hidden min-h-[350px] flex items-center justify-center">
      {/* Canvas Zoom Tools */}
      <div className="absolute top-4 right-4 flex gap-2 z-30 font-mono">
        <button
          onClick={() => setZoom((prev) => Math.min(prev + 0.15, 1.5))}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((prev) => Math.max(prev - 0.15, 0.6))}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom(1)}
          className="w-8 h-8 flex items-center justify-center bg-[#15181E] border border-white/10 text-white/70 hover:text-blue-400 hover:border-blue-500/50 rounded transition-all cursor-pointer"
          title="Reset Zoom"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Scalable Node Container */}
      <div
        className="relative w-full h-full min-w-[800px] min-h-[320px] transition-transform duration-200 ease-out flex items-center justify-around flex-wrap gap-8 p-6"
        style={{ transform: `scale(${zoom})` }}
      >
        {/* Render SVG Dynamic Connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="#3B82F6" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const fromNode = nodes.find((n) => n.id === edge.from);
            const toNode = nodes.find((n) => n.id === edge.to);

            if (!fromNode || !toNode) return null;

            // Generate quadratic Bezier or horizontal curve
            const x1 = fromNode.x || 100 + idx * 220;
            const y1 = (fromNode.y || 180) + 40;
            const x2 = toNode.x || 300 + idx * 220;
            const y2 = (toNode.y || 180) + 40;

            const cx1 = x1 + (x2 - x1) / 2;
            const cy1 = y1;
            const cx2 = x1 + (x2 - x1) / 2;
            const cy2 = y2;

            const pathD = `M ${x1 + 180} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

            return (
              <g key={`edge-${idx}`}>
                <path
                  d={pathD}
                  fill="none"
                  stroke={edge.status === 'error' ? '#ef4444' : '#3B82F6'}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                  className="flow-line opacity-75"
                  markerEnd="url(#arrowhead)"
                />
                {edge.label && (
                  <text
                    x={(x1 + x2) / 2 + 80}
                    y={(y1 + y2) / 2 - 8}
                    fill="#60A5FA"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    className="bg-black/80 px-1 py-0.5 rounded fill-blue-400"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Render Architecture Nodes */}
        {nodes.map((node) => {
          const isSelected = selectedNodeId === node.id;
          const badgeClass = getNodeTypeBadgeColor(node.type);

          return (
            <div
              key={node.id}
              onClick={() => {
                setSelectedNodeId(node.id);
                if (onSelectNode) onSelectNode(node);
              }}
              className={`w-52 relative bg-[#15181E] border rounded overflow-hidden transition-all duration-200 cursor-pointer z-10 pb-6 group select-none ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-105'
                  : 'border-white/10 hover:border-blue-500/60 hover:shadow-[0_0_15px_rgba(59,130,246,0.15)]'
              }`}
            >
              {/* Background Watermark Icon */}
              <div className="absolute right-[-10px] top-[-10px] text-7xl text-white/5 pointer-events-none">
                <Box className="w-20 h-20 text-white/5" />
              </div>

              {/* Node Header */}
              <div className={`border-b px-3 py-2 flex items-center justify-between relative z-10 ${badgeClass}`}>
                <div className="flex items-center gap-2">
                  {getNodeIcon(node.type)}
                  <span className="font-mono font-bold text-xs uppercase tracking-wider truncate max-w-[120px]">
                    {node.label}
                  </span>
                </div>
                <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              </div>

              {/* Node Metadata Body */}
              <div className="p-3 font-mono text-[11px] text-white/70 space-y-1.5 relative z-10">
                <div className="flex justify-between items-center">
                  <span className="text-white/40">tech:</span>
                  <span className="text-white font-bold truncate max-w-[110px]">{node.tech}</span>
                </div>

                {node.details?.port && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">port:</span>
                    <span className="text-blue-400">{node.details.port}</span>
                  </div>
                )}

                {node.details?.status && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">status:</span>
                    <span className="text-blue-400 font-bold">{node.details.status}</span>
                  </div>
                )}

                {node.details?.latency && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">latency:</span>
                    <span className="text-sky-400">{node.details.latency}</span>
                  </div>
                )}

                {node.details?.routes && (
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">routes:</span>
                    <span className="text-indigo-300 text-[10px]">{node.details.routes}</span>
                  </div>
                )}
              </div>

              {/* Input & Output Ports */}
              <div className="absolute top-1/2 -left-[5px] w-2.5 h-2.5 bg-blue-500 transform -translate-y-1/2 rounded-sm shadow-[0_0_8px_#3B82F6]" />
              <div className="absolute top-1/2 -right-[5px] w-2.5 h-2.5 bg-blue-400 transform -translate-y-1/2 rounded-sm shadow-[0_0_8px_#60A5FA]" />

              {/* Bottom Corner Port Info */}
              <div className="absolute bottom-1 right-2 flex items-center gap-1 z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_#3B82F6]" />
                <span className="font-mono text-[9px] text-white/40">
                  :{node.details?.port || 'auto'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

