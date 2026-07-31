import React from 'react';
import { Network, Layers, Rocket, Terminal, Settings, BookOpen, Plus } from 'lucide-react';

interface SideNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onNewPipeline: () => void;
}

export const SideNav: React.FC<SideNavProps> = ({ activeTab, setActiveTab, onNewPipeline }) => {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-64px)] w-60 z-40 bg-[#15181E] text-[#E0E0E0] font-sans text-xs border-r border-white/10 flex flex-col py-4 select-none">
      {/* Profile Header */}
      <div className="px-5 mb-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
          <img
            className="w-full h-full object-cover"
            alt="Sketch2System Engine"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCCwOPU0pIS3LS0vcFpExR5CkOGYsdZ-T7QUoK2klKwsvnUO37MiWCX9ChIi_xYRBZHq_UeWqOZzRke1sCtVUt-VsShu8YHbvnyhBQuzlAtj4i7NI0-ovuXkB7VgGTD1gPRaEfTqWGnZCzHDTTbRIQDydTg15dsMXK_UlB_sreMQQsHgvRHIBgKUSPilOoajxe1Hf2VFoe7lLmbwKauIBW0-4RiPA2cEgLQLK4oO8_CJgzT1JX4OQ8E"
          />
        </div>
        <div className="overflow-hidden">
          <div className="font-bold text-white text-sm truncate">Sketch2System</div>
          <div className="text-white/40 text-[10px] font-mono truncate">Gemini 3.6 Vision</div>
        </div>
      </div>

      {/* Action Button */}
      <div className="px-5 mb-5">
        <button
          onClick={onNewPipeline}
          className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded transition-all flex items-center justify-center gap-2 font-mono text-xs font-bold cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.1)]"
        >
          <Plus className="w-4 h-4 text-blue-400" />
          <span>New Pipeline</span>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 space-y-1 font-mono">
        <button
          onClick={() => setActiveTab('nodes')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
            activeTab === 'nodes'
              ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500 font-bold'
              : 'text-white/60 hover:text-blue-400 hover:bg-white/5'
          }`}
        >
          <Network className="w-4 h-4" />
          <span>Nodes Graph</span>
        </button>

        <button
          onClick={() => setActiveTab('canvas')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
            activeTab === 'canvas'
              ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500 font-bold'
              : 'text-white/60 hover:text-blue-400 hover:bg-white/5'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Interactive Canvas</span>
        </button>

        <button
          onClick={() => setActiveTab('deploy')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
            activeTab === 'deploy'
              ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500 font-bold'
              : 'text-white/60 hover:text-blue-400 hover:bg-white/5'
          }`}
        >
          <Rocket className="w-4 h-4" />
          <span>Deploy Spec</span>
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-left transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'text-blue-400 bg-blue-500/10 border-l-2 border-blue-500 font-bold'
              : 'text-white/60 hover:text-blue-400 hover:bg-white/5'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>Compiler Logs</span>
        </button>
      </nav>

      {/* Footer Nav */}
      <div className="px-3 space-y-1 border-t border-white/10 pt-4 font-mono">
        <button
          onClick={() => setActiveTab('settings')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-left text-white/60 hover:text-blue-400 hover:bg-white/5 transition-all cursor-pointer"
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className="w-full flex items-center gap-3 px-3 py-2 rounded text-left text-white/60 hover:text-blue-400 hover:bg-white/5 transition-all cursor-pointer"
        >
          <BookOpen className="w-4 h-4" />
          <span>Documentation</span>
        </button>
      </div>
    </aside>
  );
};

