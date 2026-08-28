import React from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { 
  Search, 
  Mic, 
  Calendar, 
  Clock, 
  Star, 
  Plus, 
  TrendingUp, 
  Users, 
  Cpu, 
  FileText,
  Trash2
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    meetings,
    selectedMeetingId,
    selectMeeting,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery,
    toggleNewMeetingModal,
    deleteMeeting,
    toggleStarMeeting,
  } = useMeetingStore();

  const filteredMeetings = meetings.filter((meeting) => {
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = meeting.title.toLowerCase().includes(q);
      const matchSummary = meeting.executiveSummary.some((s) => s.toLowerCase().includes(q));
      const matchTags = meeting.tags.some((t) => t.toLowerCase().includes(q));
      const matchTranscript = meeting.rawTranscript.some((t) => t.text.toLowerCase().includes(q));
      if (!matchTitle && !matchSummary && !matchTags && !matchTranscript) return false;
    }

    // Filter by active category
    if (activeCategory === 'today') return meeting.category === 'today';
    if (activeCategory === 'this_week') return meeting.category === 'this_week' || meeting.category === 'today';
    if (activeCategory === 'sales') return meeting.templateType === 'sales';
    if (activeCategory === 'one_on_one') return meeting.templateType === 'one_on_one';
    if (activeCategory === 'engineering') return meeting.templateType === 'standup';
    if (activeCategory === 'starred') return !!meeting.isStarred;

    return true;
  });

  const categories = [
    { id: 'all', label: 'Todas las Reuniones', icon: FileText, count: meetings.length },
    { id: 'today', label: 'Hoy', icon: Clock, count: meetings.filter((m) => m.category === 'today').length },
    { id: 'this_week', label: 'Esta Semana', icon: Calendar, count: meetings.filter((m) => m.category === 'this_week' || m.category === 'today').length },
    { id: 'sales', label: 'Ventas (MEDDIC)', icon: TrendingUp, count: meetings.filter((m) => m.templateType === 'sales').length },
    { id: 'one_on_one', label: '1-on-1s', icon: Users, count: meetings.filter((m) => m.templateType === 'one_on_one').length },
    { id: 'engineering', label: 'Ingeniería / Syncs', icon: Cpu, count: meetings.filter((m) => m.templateType === 'standup').length },
    { id: 'starred', label: 'Destacadas', icon: Star, count: meetings.filter((m) => m.isStarred).length },
  ];

  return (
    <div className="w-[300px] flex-shrink-0 h-full glass-sidebar border-r border-black/[0.08] dark:border-white/[0.08] flex flex-col justify-between select-none">
      {/* Top Search & Filter Bar */}
      <div className="p-3 border-b border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-2.5">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar reuniones, temas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-8 pl-8 pr-8 rounded-lg bg-white/90 dark:bg-black/40 border border-black/[0.08] dark:border-white/[0.1] text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 shadow-sm"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              ✕
            </button>
          ) : (
            <button 
              type="button" 
              title="Búsqueda por voz"
              className="absolute right-2.5 text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick New Meeting CTA */}
        <button
          onClick={() => toggleNewMeetingModal(true)}
          className="w-full h-8 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border border-indigo-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nueva Reunión</span>
        </button>
      </div>

      {/* Categorized Nav & Meetings List */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        {/* Navigation Categories */}
        <div className="space-y-0.5">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Categorías
          </div>
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-black/[0.08] dark:bg-white/[0.12] text-indigo-600 dark:text-indigo-400 font-semibold shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`} />
                  <span>{cat.label}</span>
                </div>
                {cat.count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'
                  }`}>
                    {cat.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Meeting Cards List */}
        <div className="space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center justify-between">
            <span>Historial ({filteredMeetings.length})</span>
          </div>

          {filteredMeetings.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">
              No hay reuniones en esta categoría.
            </div>
          ) : (
            filteredMeetings.map((meeting) => {
              const isSelected = selectedMeetingId === meeting.id;
              const meetingDate = new Date(meeting.date);
              const formattedTime = meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={meeting.id}
                  onClick={() => selectMeeting(meeting.id)}
                  className={`group relative p-2.5 rounded-xl transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-white dark:bg-[#1c202a] border-indigo-500/40 shadow-sm'
                      : 'bg-white/40 dark:bg-black/10 hover:bg-white/70 dark:hover:bg-white/[0.05] border-transparent'
                  }`}
                >
                  {/* Left Active Line */}
                  {isSelected && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-r-full" />
                  )}

                  <div className="flex items-start justify-between gap-1 mb-1">
                    <h4 className={`text-xs font-semibold line-clamp-1 ${
                      isSelected ? 'text-indigo-950 dark:text-indigo-200' : 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {meeting.title}
                    </h4>

                    {/* Star toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStarMeeting(meeting.id);
                      }}
                      className="text-gray-300 hover:text-amber-400 dark:text-gray-600 dark:hover:text-amber-400 p-0.5"
                    >
                      <Star className={`w-3 h-3 ${meeting.isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>

                  {/* Summary Preview snippet */}
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mb-2 leading-relaxed">
                    {meeting.executiveSummary[0] || 'Sin resumen disponible.'}
                  </p>

                  {/* Footer: Time, Duration & Avatar Stack */}
                  <div className="flex items-center justify-between pt-1 border-t border-black/[0.04] dark:border-white/[0.04]">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      <span>{formattedTime}</span>
                      <span>•</span>
                      <span>{meeting.durationMinutes}m</span>
                    </div>

                    <div className="flex items-center">
                      {/* Avatar Stack */}
                      <div className="flex -space-x-1.5 overflow-hidden">
                        {meeting.participants.slice(0, 3).map((p, i) => (
                          <img
                            key={i}
                            src={p.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&auto=format&fit=crop&q=80'}
                            alt={p.name}
                            title={p.name}
                            className="inline-block h-4 w-4 rounded-full ring-1 ring-white dark:ring-gray-900 object-cover"
                          />
                        ))}
                      </div>

                      {/* Quick Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMeeting(meeting.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-gray-400 hover:text-rose-500 transition-opacity"
                        title="Eliminar reunión"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Info: Offline & Storage Status */}
      <div className="p-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.02] text-[11px] text-gray-400 dark:text-gray-500 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span>Local SQLite & Zero Retention</span>
        </div>
        <span className="font-mono text-[10px]">v0.1.0</span>
      </div>
    </div>
  );
};
