import React from 'react';
import { BookOpen, FileCode, MapPin, Plus, ShieldAlert, Workflow } from 'lucide-react';

import { EditorTab } from './CodeEditorPane';
import { LOGO_MARK } from '../data/thumbnails';

interface SideNavProps {
  activeTab: EditorTab;
  onSelectTab: (tab: EditorTab) => void;
  onNewPipeline: () => void;
  onOpenDocs: () => void;
  nodeCount: number;
  edgeCount: number;
}

/**
 * Every entry drives real state. The previous version had six items writing to a
 * variable nothing read, so the whole sidebar was inert.
 */
const NAV_ITEMS: Array<{ id: EditorTab; label: string; icon: React.ReactNode }> = [
  { id: 'yaml', label: 'Deploy Spec', icon: <FileCode className="w-4 h-4" /> },
  { id: 'review', label: 'Architecture Review', icon: <ShieldAlert className="w-4 h-4" /> },
  { id: 'mermaid', label: 'Mermaid Diagram', icon: <Workflow className="w-4 h-4" /> },
  { id: 'roadmap', label: 'Implementation Plan', icon: <MapPin className="w-4 h-4" /> },
];

export const SideNav: React.FC<SideNavProps> = ({
  activeTab,
  onSelectTab,
  onNewPipeline,
  onOpenDocs,
  nodeCount,
  edgeCount,
}) => {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-60 z-40 bg-[#15181E] text-[#E0E0E0] font-sans text-xs border-r border-white/10 flex flex-col py-4">
      <div className="px-5 mb-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          <img className="w-full h-full object-cover" alt="" src={LOGO_MARK} />
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-white text-sm truncate">Sketch2System</div>
          <div className="text-white/40 text-[10px] font-mono truncate">
            {nodeCount} nodes · {edgeCount} edges
          </div>
        </div>
      </div>

      <div className="px-5 mb-5">
        <button
          type="button"
          onClick={onNewPipeline}
          className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded transition-all flex items-center justify-center gap-2 font-mono text-xs font-bold cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Pipeline</span>
        </button>
      </div>

      <nav className="flex-1 px-3 space-y-1 font-mono" aria-label="Generated artifacts">
        {NAV_ITEMS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            aria-current={activeTab === item.id ? 'true' : undefined}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
              activeTab === item.id
                ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500 font-bold'
                : 'text-white/60 hover:text-blue-400 hover:bg-white/5'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-3 space-y-1 border-t border-white/10 pt-4 font-mono">
        <button
          type="button"
          onClick={onOpenDocs}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-left text-white/60 hover:text-blue-400 hover:bg-white/5 transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Prompt & Schema Docs</span>
        </button>
      </div>
    </aside>
  );
};
