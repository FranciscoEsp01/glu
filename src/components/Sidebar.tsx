import React from 'react';
import { useMeetingStore } from '../store/useMeetingStore';
import { Search, Mic, Star, Trash2 } from 'lucide-react';
import { Meeting } from '../types/meeting';

export const Sidebar: React.FC = () => {
  const {
    meetings,
    selectedMeetingId,
    selectMeeting,
    searchQuery,
    setSearchQuery,
    deleteMeeting,
    toggleStarMeeting,
  } = useMeetingStore();

  const filteredMeetings = meetings.filter((meeting) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = meeting.title.toLowerCase().includes(q);
      const matchSummary = meeting.executiveSummary.some((s) => s.toLowerCase().includes(q));
      return matchTitle || matchSummary;
    }
    return true;
  });

  const getGroupedMeetings = () => {
    const groups: { [key: string]: Meeting[] } = {
      'Hoy': [],
      'Esta Semana': [],
      'Ventas': [],
      '1-on-1s': []
    };
    
    filteredMeetings.forEach(m => {
       if (m.category === 'today') groups['Hoy'].push(m);
       else if (m.category === 'this_week') groups['Esta Semana'].push(m);
       else if (m.templateType === 'sales') groups['Ventas'].push(m);
       else if (m.templateType === 'one_on_one') groups['1-on-1s'].push(m);
       else groups['Esta Semana'].push(m); // Fallback
    });
    
    return groups;
  };

  const groupedMeetings = getGroupedMeetings();

  return (
    <div 
      className="w-[300px] flex-shrink-0 h-full flex flex-col justify-between select-none relative z-10"
      style={{
         backgroundColor: 'rgba(243, 244, 246, 0.8)', // #F3F4F6 at 80%
         backdropFilter: 'blur(30px)',
         WebkitBackdropFilter: 'blur(30px)',
         borderRight: '1px solid rgba(0,0,0,0.08)'
      }}
    >
      {/* Top Search Bar */}
      <div className="pt-[52px] pb-4 px-4">
        <div className="relative flex items-center w-[268px] h-[34px]">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar reuniones, temas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-full pl-8 pr-8 rounded-lg bg-white shadow-sm border border-black/5 text-[12px] text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-[10px] text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          ) : (
            <button className="absolute right-2.5 text-gray-400 hover:text-indigo-500 transition-colors">
              <Mic className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Categorized Meetings List */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5">
         {Object.entries(groupedMeetings).map(([groupName, groupMeetings]) => {
            if (groupMeetings.length === 0) return null;
            return (
               <div key={groupName} className="space-y-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                     {groupName}
                  </h3>
                  <div className="space-y-1">
                     {groupMeetings.map((meeting) => {
                        const isSelected = selectedMeetingId === meeting.id;
                        const meetingDate = new Date(meeting.date);
                        const formattedTime = meetingDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        return (
                           <div
                              key={meeting.id}
                              onClick={() => selectMeeting(meeting.id)}
                              className={`group relative p-3 rounded-xl transition-all cursor-pointer ${
                                 isSelected 
                                    ? 'bg-white border-l-[3px] border-l-indigo-500 rounded-l-md shadow-[0_2px_8px_rgba(0,0,0,0.06)]' 
                                    : 'hover:bg-black/[0.04] border-l-[3px] border-transparent'
                              }`}
                           >
                              <div className="flex items-start justify-between gap-1 mb-1">
                                 <h4 className="text-[13px] font-semibold text-gray-900 line-clamp-1">
                                    {meeting.title}
                                 </h4>
                                 <button
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       toggleStarMeeting(meeting.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                 >
                                    <Star className={`w-3 h-3 ${meeting.isStarred ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                                 </button>
                              </div>
                              
                              <div className="flex items-center justify-between">
                                 <div className="text-[11px] text-gray-500 font-medium">
                                    {formattedTime} ({meeting.durationMinutes}m)
                                 </div>
                                 <div className="flex items-center">
                                    <div className="flex -space-x-1.5 overflow-hidden">
                                       {meeting.participants.slice(0, 4).map((p, i) => (
                                          <img
                                             key={i}
                                             src={p.avatar}
                                             alt={p.name}
                                             className="inline-block h-[18px] w-[18px] rounded-full ring-1 ring-white object-cover"
                                          />
                                       ))}
                                    </div>
                                    <button
                                       onClick={(e) => {
                                          e.stopPropagation();
                                          deleteMeeting(meeting.id);
                                       }}
                                       className="opacity-0 group-hover:opacity-100 ml-2 p-0.5 text-gray-400 hover:text-rose-500 transition-opacity"
                                    >
                                       <Trash2 className="w-3 h-3" />
                                    </button>
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>
            );
         })}
      </div>
    </div>
  );
};
