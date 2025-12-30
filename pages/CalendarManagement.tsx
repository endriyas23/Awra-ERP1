
import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useNavigate } from 'react-router-dom';

type EventType = 'TASK' | 'HEALTH' | 'HARVEST';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: EventType;
  details?: string;
  link?: string;
}

const CalendarManagement: React.FC = () => {
  const { tasks, healthRecords, flocks } = useInventory();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());

  // --- Date Helpers ---
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay(); // 0 = Sun

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Format MM as 01-12, DD as 01-31
  const formatDateKey = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const changeMonth = (delta: number) => {
    setCurrentDate(new Date(year, month + delta, 1));
  };

  // --- Aggregate Events ---
  const events = useMemo(() => {
    const allEvents: CalendarEvent[] = [];

    // 1. Tasks
    tasks.forEach(task => {
      if (task.status !== 'COMPLETED') {
        allEvents.push({
          id: task.id,
          date: task.due,
          title: `Task: ${task.title}`,
          type: 'TASK',
          details: `Assignee: ${task.assignee}`,
          link: '/hr'
        });
      }
    });

    // 2. Health Schedules
    healthRecords.forEach(record => {
      if (record.status === 'SCHEDULED' || record.status === 'PENDING') {
        allEvents.push({
          id: record.id,
          date: record.date,
          title: `Vet: ${record.diagnosis}`,
          type: 'HEALTH',
          details: `Flock: ${flocks.find(f => f.id === record.flockId)?.name || record.flockId}`,
          link: '/health'
        });
      }
      // Recurring/Next scheduled
      if (record.nextScheduledDate) {
        allEvents.push({
          id: `${record.id}-next`,
          date: record.nextScheduledDate,
          title: `Follow-up: ${record.diagnosis}`,
          type: 'HEALTH',
          link: '/health'
        });
      }
    });

    // 3. Harvest Projections (Broilers only ~42 days)
    flocks.forEach(flock => {
      if (flock.type === 'BROILER' && flock.status === 'ACTIVE') {
        const startDate = new Date(flock.startDate);
        const harvestDate = new Date(startDate);
        harvestDate.setDate(startDate.getDate() + 42 - (flock.initialAge || 0)); // Approx 42 days cycle target
        
        allEvents.push({
          id: `harv-${flock.id}`,
          date: harvestDate.toISOString().split('T')[0],
          title: `Harvest: ${flock.name}`,
          type: 'HARVEST',
          details: 'Target Depletion Date',
          link: `/flock/${flock.id}`
        });
      }
    });

    return allEvents;
  }, [tasks, healthRecords, flocks]);

  // Group by Date for Rendering
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  // --- Render Helpers ---
  const getEventStyle = (type: EventType) => {
    switch (type) {
      case 'TASK': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'HEALTH': return 'bg-red-100 text-red-700 border-red-200';
      case 'HARVEST': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Generate Calendar Cells
  const calendarCells = [];
  // Empty cells for previous month padding
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(<div key={`empty-${i}`} className="h-32 bg-slate-50 border-b border-r border-slate-100"></div>);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDateKey(d);
    const dayEvents = eventsByDate[dateKey] || [];
    const isToday = dateKey === new Date().toISOString().split('T')[0];

    calendarCells.push(
      <div key={d} className={`h-32 border-b border-r border-slate-100 p-2 relative group hover:bg-slate-50 transition-colors ${isToday ? 'bg-blue-50/30' : 'bg-white'}`}>
        <span className={`text-sm font-bold ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-slate-700'}`}>
          {d}
        </span>
        <div className="mt-1 space-y-1 overflow-y-auto max-h-[90px] custom-scrollbar">
          {dayEvents.map(ev => (
            <div 
              key={ev.id}
              onClick={() => ev.link && navigate(ev.link)}
              className={`text-[10px] px-1.5 py-1 rounded border cursor-pointer hover:opacity-80 truncate font-medium ${getEventStyle(ev.type)}`}
              title={ev.details || ev.title}
            >
              {ev.type === 'HARVEST' ? '🌾 ' : ev.type === 'HEALTH' ? '🩺 ' : '📋 '}
              {ev.title}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Farm Calendar</h2>
          <p className="text-slate-500 mt-1">Schedule, tasks, and harvest projections.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">◀</button>
          <span className="font-bold text-lg w-40 text-center text-slate-800">{monthNames[month]} {year}</span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">▶</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {calendarCells}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-600 justify-center">
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded"></span> Task
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span> Health / Vet
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></span> Harvest / Depletion
         </div>
      </div>
    </div>
  );
};

export default CalendarManagement;
