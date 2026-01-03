
import React, { useState, useMemo } from 'react';
import { useInventory } from '../context/InventoryContext';
import { useNavigate } from 'react-router-dom';
import { FarmEvent } from '../types';

type EventType = 'TASK' | 'HEALTH' | 'HARVEST' | 'GENERAL' | 'MEETING' | 'MAINTENANCE';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  type: EventType;
  details?: string;
  link?: string;
  location?: string;
  recurrence?: string;
}

const CalendarManagement: React.FC = () => {
  const { tasks, healthRecords, flocks, customEvents, addCustomEvent, deleteCustomEvent } = useInventory();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  
  // Form State
  const [form, setForm] = useState<Partial<FarmEvent>>({
      title: '',
      date: new Date().toISOString().split('T')[0],
      type: 'GENERAL',
      location: '',
      description: '',
      recurrence: 'NONE',
      time: '',
      attachments: []
  });

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

    // 4. Custom Events (With Recurrence Logic)
    customEvents.forEach(ce => {
        // Add Base Event
        allEvents.push({
            id: ce.id,
            date: ce.date,
            title: ce.title,
            type: ce.type,
            details: ce.description,
            location: ce.location,
            recurrence: ce.recurrence
        });

        // Generate Recurrences for current view (Simulated)
        if (ce.recurrence === 'WEEKLY') {
            const start = new Date(ce.date);
            const viewStart = new Date(year, month, 1);
            const viewEnd = new Date(year, month + 1, 0);
            
            // If event started before or during this month
            if (start <= viewEnd) {
                // Find first occurrence in this month
                const dayOfWeek = start.getDay(); // 0-6
                let pointer = new Date(viewStart);
                
                // Adjust pointer to first occurrence of that day in the month
                while (pointer.getDay() !== dayOfWeek) {
                    pointer.setDate(pointer.getDate() + 1);
                }

                // Add events while in month
                while (pointer <= viewEnd) {
                    const dateStr = pointer.toISOString().split('T')[0];
                    // Don't duplicate the original date if it falls in this month
                    if (dateStr !== ce.date && pointer >= start) {
                        allEvents.push({
                            id: `${ce.id}-${dateStr}`,
                            date: dateStr,
                            title: ce.title,
                            type: ce.type,
                            details: ce.description,
                            location: ce.location,
                            recurrence: 'WEEKLY'
                        });
                    }
                    pointer.setDate(pointer.getDate() + 7);
                }
            }
        } else if (ce.recurrence === 'MONTHLY') {
            const start = new Date(ce.date);
            const dayOfMonth = start.getDate();
            // Create a date for this month with that day
            const targetDate = new Date(year, month, dayOfMonth);
            
            // Check if valid date (e.g. not Feb 30) and if after start date
            if (targetDate.getMonth() === month && targetDate >= start) {
                 const dateStr = targetDate.toISOString().split('T')[0];
                 if (dateStr !== ce.date) {
                     allEvents.push({
                        id: `${ce.id}-${dateStr}`,
                        date: dateStr,
                        title: ce.title,
                        type: ce.type,
                        details: ce.description,
                        location: ce.location,
                        recurrence: 'MONTHLY'
                    });
                 }
            }
        }
    });

    return allEvents;
  }, [tasks, healthRecords, flocks, customEvents, year, month]);

  // Group by Date for Rendering
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  // --- Handlers ---
  const handleEventClick = (ev: CalendarEvent) => {
      if (ev.link) {
          navigate(ev.link);
      } else {
          // View details for custom event
          const original = customEvents.find(c => c.id === ev.id || ev.id.startsWith(c.id));
          if (original) {
              setForm(original);
              setSelectedEvent(ev);
              setIsModalOpen(true);
          }
      }
  };

  const handleCreateEvent = () => {
      setForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        type: 'GENERAL',
        location: '',
        description: '',
        recurrence: 'NONE',
        time: '',
        attachments: []
      });
      setSelectedEvent(null);
      setIsModalOpen(true);
  };

  const handleSaveEvent = (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.title || !form.date) return;

      if (selectedEvent) {
          // This is a view-only for now or delete, simplified for demo
          // We could add update logic here if ID matches
      } else {
          const newEvent: FarmEvent = {
              id: `EVT-${Date.now()}`,
              title: form.title!,
              date: form.date!,
              type: form.type as any,
              location: form.location,
              description: form.description,
              recurrence: form.recurrence as any,
              attachments: form.attachments,
              time: form.time
          };
          addCustomEvent(newEvent);
      }
      setIsModalOpen(false);
  };

  const handleDeleteEvent = () => {
      if (selectedEvent) {
          // Extract original ID if it's a recurring instance
          const originalId = selectedEvent.id.split('-')[0] === 'EVT' ? selectedEvent.id.split('-').slice(0, 2).join('-') : selectedEvent.id; 
          
          // Simple check: if ID starts with EVT, it's ours.
          if (originalId.startsWith('EVT')) {
             if(confirm("Delete this event series?")) {
                 deleteCustomEvent(originalId);
                 setIsModalOpen(false);
             }
          }
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const fileName = e.target.files[0].name;
          setForm(prev => ({
              ...prev,
              attachments: [...(prev.attachments || []), fileName]
          }));
      }
  };

  // --- Render Helpers ---
  const getEventStyle = (type: EventType) => {
    switch (type) {
      case 'TASK': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'HEALTH': return 'bg-red-100 text-red-700 border-red-200';
      case 'HARVEST': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'MEETING': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'MAINTENANCE': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
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
              onClick={(e) => { e.stopPropagation(); handleEventClick(ev); }}
              className={`text-[10px] px-1.5 py-1 rounded border cursor-pointer hover:opacity-80 truncate font-medium ${getEventStyle(ev.type)}`}
              title={ev.details || ev.title}
            >
              {ev.recurrence && ev.recurrence !== 'NONE' && '🔁 '}
              {ev.type === 'HARVEST' ? '🌾 ' : ev.type === 'HEALTH' ? '🩺 ' : ev.type === 'MEETING' ? '👥 ' : ev.type === 'MAINTENANCE' ? '🛠️ ' : '📋 '}
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
        <div className="flex items-center gap-4">
            <button 
                onClick={handleCreateEvent}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition-all flex items-center gap-2"
            >
                <span>+</span> Add Event
            </button>
            <div className="flex items-center gap-4 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">◀</button>
                <span className="font-bold text-lg w-40 text-center text-slate-800">{monthNames[month]} {year}</span>
                <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600">▶</button>
            </div>
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
            <span className="w-3 h-3 bg-red-100 border border-red-300 rounded"></span> Health
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></span> Harvest
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-purple-100 border border-purple-300 rounded"></span> Meeting
         </div>
         <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded"></span> Maintenance
         </div>
      </div>

      {/* Add/View Event Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-800">{selectedEvent ? 'Event Details' : 'New Event'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="p-6 space-y-4">
              {/* Type Selection */}
              {!selectedEvent && (
                  <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
                    {['GENERAL', 'MEETING', 'MAINTENANCE'].map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setForm({...form, type: t as any})}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${form.type === t ? 'bg-white shadow-sm text-teal-700' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {t}
                        </button>
                    ))}
                  </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Title</label>
                <input 
                  required
                  disabled={!!selectedEvent}
                  type="text" 
                  className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-slate-50 disabled:text-slate-500"
                  placeholder="e.g. Weekly Staff Meeting"
                  value={form.title}
                  onChange={e => setForm({...form, title: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input 
                      required
                      disabled={!!selectedEvent}
                      type="date" 
                      className="w-full p-3 rounded-xl border border-slate-200 disabled:bg-slate-50"
                      value={form.date}
                      onChange={e => setForm({...form, date: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Time (Optional)</label>
                    <input 
                      type="time" 
                      disabled={!!selectedEvent}
                      className="w-full p-3 rounded-xl border border-slate-200 disabled:bg-slate-50"
                      value={form.time || ''}
                      onChange={e => setForm({...form, time: e.target.value})}
                    />
                  </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Location</label>
                <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">📍</span>
                    <input 
                    type="text" 
                    disabled={!!selectedEvent}
                    className="w-full pl-9 pr-3 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 outline-none disabled:bg-slate-50"
                    placeholder="e.g. Main Office / House 2"
                    value={form.location || ''}
                    onChange={e => setForm({...form, location: e.target.value})}
                    />
                </div>
              </div>

              {/* Recurrence (Create Only) */}
              {!selectedEvent && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Recurrence</label>
                    <select 
                        className="w-full p-3 rounded-xl border border-slate-200 bg-white"
                        value={form.recurrence}
                        onChange={e => setForm({...form, recurrence: e.target.value as any})}
                    >
                        <option value="NONE">Does not repeat</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea 
                  className="w-full p-3 rounded-xl border border-slate-200 h-24 resize-none disabled:bg-slate-50"
                  disabled={!!selectedEvent}
                  placeholder="Additional details..."
                  value={form.description || ''}
                  onChange={e => setForm({...form, description: e.target.value})}
                />
              </div>

              {/* Attachments */}
              <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Attachments</label>
                  {!selectedEvent && (
                      <div className="flex items-center gap-2 mb-2">
                          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                              Choose File
                              <input type="file" className="hidden" onChange={handleFileChange} />
                          </label>
                          <span className="text-xs text-slate-400">Supported: PDF, JPG, PNG</span>
                      </div>
                  )}
                  {form.attachments && form.attachments.length > 0 ? (
                      <div className="space-y-1">
                          {form.attachments.map((file, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg border border-teal-100">
                                  <span>📎</span>
                                  <span className="truncate flex-1">{file}</span>
                              </div>
                          ))}
                      </div>
                  ) : (
                      <p className="text-xs text-slate-400 italic">No attachments.</p>
                  )}
              </div>

              <div className="pt-2 flex gap-3">
                {selectedEvent ? (
                    <button 
                        type="button"
                        onClick={handleDeleteEvent}
                        className="flex-1 py-3 bg-red-100 text-red-600 hover:bg-red-200 rounded-xl font-bold transition-all"
                    >
                        Delete Event
                    </button>
                ) : (
                    <button 
                        type="submit" 
                        className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-lg shadow-teal-500/20 transition-all"
                    >
                        Save Event
                    </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManagement;
