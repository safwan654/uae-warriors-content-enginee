import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import { 
  CheckCircle2, 
  MapPin,
  History,
  TrendingUp,
  Activity,
  CloudLightning,
  Monitor,
  Undo2,
  Sparkles,
  Upload,
  Plus,
  ChevronRight,
  Database,
  Search
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyD20BfSjhK-uXpXQ2GvDBQSLBwSrfaKoGo",
  authDomain: "uaewcc.firebaseapp.com",
  databaseURL: "https://uaewcc-default-rtdb.firebaseio.com",
  projectId: "uaewcc",
  storageBucket: "uaewcc.firebasestorage.app",
  messagingSenderId: "297340532616",
  appId: "1:297340532616:web:80d41e277e89ac01a9ac3d",
  measurementId: "G-WHPW7Y5J5L"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
if (typeof window !== 'undefined') { getAnalytics(app); }

function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }

interface Fight {
  No: string;
  Weight: string;
  'Red Corner': string;
  'Red Nickname'?: string;
  'Blue Corner': string;
  'Blue Nickname'?: string;
  completed?: boolean;
  resultType?: string;
  winner?: 'red' | 'blue' | 'draw' | null;
  staffCaption?: string;
  originalStaffCaption?: string;
  instaHandle?: string;
  hashtags?: string;
}

interface EventData {
  id: string;
  info: { name: string; date: string; location: string; };
  fights: Fight[];
}

const RESULT_TYPES = [
  'Disqualify', 'Draw', 'KO/TKO', 'Majority Decision', 'Majority Draw',
  'No Contest', 'Split Decision', 'Submission', 'Unanimous Decision',
  'Verbal Submission', 'Canceled', 'Technical Decision'
];

export default function App() {
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [eventsList, setEventsList] = useState<Record<string, EventData>>({});
  const [selectedFightIdx, setSelectedFightIdx] = useState<number | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [newEventInfo, setNewEventInfo] = useState({ name: '', date: '', location: '' });
  const [copyFeedback, setCopyFeedback] = useState<'insta' | 'twitter' | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch all events for the selector
  useEffect(() => {
    const eventsRef = ref(db, 'events');
    onValue(eventsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setEventsList(data);
      setIsLive(true);
      // Auto-select latest if none active
      if (!activeEventId && Object.keys(data).length > 0) {
        setActiveEventId(Object.keys(data).sort().reverse()[0]);
      } else if (Object.keys(data).length === 0) {
        setShowEventModal(true);
      }
    });
  }, []);

  const activeEvent = activeEventId ? eventsList[activeEventId] : null;
  const currentFight = (activeEvent && selectedFightIdx !== null) ? activeEvent.fights[selectedFightIdx] : null;

  const updateFight = (updates: Partial<Fight>) => {
    if (!activeEventId || selectedFightIdx === null) return;
    update(ref(db, `events/${activeEventId}/fights/${selectedFightIdx}`), updates);
  };

  const toggleCompleted = () => {
    if (!currentFight) return;
    const isFinishing = !currentFight.completed;
    updateFight({ completed: isFinishing });
    if (isFinishing && activeEvent && selectedFightIdx !== null && selectedFightIdx < activeEvent.fights.length - 1) {
      setTimeout(() => setSelectedFightIdx(selectedFightIdx + 1), 300);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results: any) => {
          const fights = results.data.map((f: any) => ({
            ...f, completed: false, resultType: '', winner: null, staffCaption: '', instaHandle: '', hashtags: '#UAEWarriors'
          }));
          const eId = newEventInfo.name.replace(/\s+/g, '_') || `EVENT_${Date.now()}`;
          const finalData = { id: eId, info: newEventInfo, fights };
          set(ref(db, `events/${eId}`), finalData);
          setActiveEventId(eId);
          setSelectedFightIdx(0);
          setShowEventModal(false);
        },
      });
    }
  };

  const getCaptions = (type: 'insta' | 'twitter') => {
    if (!currentFight) return '';
    const res = currentFight.resultType || 'Selection';
    const winner = currentFight.winner;
    let header = winner === 'red' ? `🔴🏆 ${currentFight['Red Corner']} wins` : winner === 'blue' ? `🔵🏆 ${currentFight['Blue Corner']} wins` : `🔥 ${currentFight['Red Corner']} vs ${currentFight['Blue Corner']}`;
    const tags = currentFight.hashtags || '#UAEWarriors';
    const body = currentFight.staffCaption || 'Incredible fight!';
    const vocab = type === 'twitter' ? `💥 ACTION! ${res} in ${currentFight.Weight}` : `📊 Result: ${res}\n⚖️ ${currentFight.Weight}`;
    if (type === 'insta') return `${body}\n\n${header}\n\n${vocab}\n\n${tags}`;
    return `${header}\n\n${vocab}\n\n${body}\n\n${tags}`;
  };

  const regenerateCaption = () => {
    if (!currentFight) return;
    const staff = currentFight.originalStaffCaption || currentFight.staffCaption || '';
    const themes = {
      ko: ["KNOCKOUT! 💥", "Power unleashed! ⚡"],
      sub: ["Technique wins! 🥋", "Tap out! 🐍"],
      general: ["Fireworks! 🔥", "UAE Warriors delivers! 🌍"]
    };
    const intro = themes.general[0];
    updateFight({ originalStaffCaption: staff, staffCaption: `${intro} ${staff}` });
  };

  return (
    <div className="min-h-screen bg-[#05060a] text-white flex flex-col font-sans selection:bg-red-600/50">
      <div className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] flex justify-between items-center bg-black border-b transition-colors", isLive ? "border-green-600" : "border-yellow-600")}>
          <div className="flex items-center gap-4 text-green-500"><CloudLightning className="w-3.5 h-3.5" /> CLOUD SYNC LIVE</div>
          <div className="flex items-center gap-1.5 text-gray-500 uppercase"><MapPin className="w-3.5 h-3.5" /> {activeEvent?.info.location || 'NO SECTOR'}</div>
      </div>

      <header className="bg-black/90 backdrop-blur-md border-b-2 border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-6">
          <div className="bg-red-600 p-2 rounded-lg rotate-3"><TrendingUp className="w-6 h-6 text-white text-3xl" /></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase italic tracking-tighter">UAE WARRIORS <span className="text-red-600">CONTENT ENGINE</span></h1>
            <button onClick={() => setShowEventSelector(true)} className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-0.5 hover:text-red-500 flex items-center gap-2 group transition-all">
                {activeEvent?.info.name || 'SELECT EVENT'} <ChevronRight className="w-3 h-3 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => { setNewEventInfo({name:'',date:'',location:''}); setShowEventModal(true); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-all"><Plus className="w-4 h-4"/> NEW EVENT</button>
           <button onClick={() => setShowEventSelector(true)} className="flex items-center gap-2 bg-gray-800 text-gray-300 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-white/5 hover:bg-gray-700 transition-all"><Database className="w-4 h-4"/> HISTORY</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-[300px] bg-[#0c0d12] border-r border-white/5 flex flex-col">
          <div className="p-5 border-b border-white/5 bg-black/20 font-black text-gray-500 text-[10px] tracking-widest uppercase flex items-center gap-2"><History className="w-4 h-4" /> FIGHT CARD</div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {activeEvent?.fights.map((f, idx) => (
              <button key={idx} onClick={() => setSelectedFightIdx(idx)} className={cn("w-full p-5 text-left transition-all hover:bg-white/5 flex gap-4 border-l-4", selectedFightIdx === idx ? "bg-red-600/10 border-red-600" : "border-transparent", f.completed ? "opacity-30": "")}>
                <div className="w-6 h-6 bg-white/5 rounded flex items-center justify-center text-[9px] font-black text-gray-600 italic shrink-0">#{f.No}</div>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-bold text-gray-500 uppercase">{f.Weight}</span>{f.completed && <CheckCircle2 className="w-3 h-3 text-green-500" />}</div>
                    <div className={cn("text-[11px] font-black uppercase truncate", f.winner === 'red' ? "text-red-500" : "text-gray-300")}>{f['Red Corner']}</div>
                    <div className={cn("text-[11px] font-black uppercase truncate", f.winner === 'blue' ? "text-blue-500" : "text-gray-300")}>{f['Blue Corner']}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto bg-[#05060a] p-8">
            {!currentFight ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20"><Activity className="w-16 h-16 mb-4 animate-pulse"/><p className="text-sm font-black uppercase tracking-[0.4em]">Ready for Transmission</p></div>
            ) : (
                <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-3 bg-[#12141c] rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
                        <div className={cn("p-10 text-right border-r border-white/5 transition-all", currentFight.winner === 'red' && 'bg-red-600/20')}>
                           <div className="text-red-500 text-[10px] font-black tracking-widest uppercase mb-2">Red Corner</div>
                           <h2 className="text-3xl font-black uppercase italic leading-none">{currentFight['Red Corner']}</h2>
                        </div>
                        <div className="bg-black/20 flex flex-col items-center justify-center p-6"><div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-black uppercase italic mb-2 tracking-widest text-gray-400">{currentFight.Weight}</div><div className="text-gray-700 font-black italic text-2xl uppercase opacity-40">VS</div></div>
                        <div className={cn("p-10 text-left border-l border-white/5 transition-all", currentFight.winner === 'blue' && 'bg-blue-600/20')}>
                           <div className="text-blue-500 text-[10px] font-black tracking-widest uppercase mb-2">Blue Corner</div>
                           <h2 className="text-3xl font-black uppercase italic leading-none">{currentFight['Blue Corner']}</h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-2 space-y-6">
                            <div className="bg-[#12141c] p-8 rounded-2xl border border-white/5 space-y-8">
                                <div className="grid grid-cols-3 gap-4">
                                    <button onClick={() => updateFight({ winner: 'red' })} className={cn("py-4 rounded-xl text-xs font-black uppercase border transition-all", currentFight.winner === 'red' ? "bg-red-600 border-red-400 shadow-[0_0_20px_rgba(220,38,38,0.4)]" : "bg-white/5 border-white/10 text-gray-500")}>RED WIN</button>
                                    <button onClick={() => updateFight({ winner: 'blue' })} className={cn("py-4 rounded-xl text-xs font-black uppercase border transition-all", currentFight.winner === 'blue' ? "bg-blue-600 border-blue-400 shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "bg-white/5 border-white/10 text-gray-500")}>BLUE WIN</button>
                                    <button onClick={() => updateFight({ winner: 'draw' })} className={cn("py-4 rounded-xl text-xs font-black uppercase border transition-all", currentFight.winner === 'draw' ? "bg-zinc-600" : "bg-white/5 border-white/10 text-gray-500")}>DRAW/NC</button>
                                </div>
                                <div className="flex flex-wrap gap-2">{RESULT_TYPES.map(type => (
                                    <button key={type} onClick={() => updateFight({ resultType: type })} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase border transition-all", currentFight.resultType === type ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-gray-500 hover:text-white")}>{type}</button>
                                ))}</div>
                            </div>
                            <div className="bg-[#12141c] p-8 rounded-2xl border border-white/5 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" value={currentFight.instaHandle} onChange={(e) => updateFight({ instaHandle: e.target.value })} placeholder="@FIGHTER_HANDLE" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-black uppercase focus:border-red-500 outline-none" />
                                    <input type="text" value={currentFight.hashtags} onChange={(e) => updateFight({ hashtags: e.target.value })} placeholder="#UAEWARRIORS68" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-black uppercase focus:border-red-500 outline-none" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest">Live Staff Intel</label><button onClick={regenerateCaption} className="text-[10px] text-red-500 font-black uppercase flex items-center gap-1.5 hover:text-white"><Sparkles className="w-3.5 h-3.5"/> REMIX</button></div>
                                    <textarea value={currentFight.staffCaption} onChange={(e) => updateFight({ staffCaption: e.target.value })} placeholder="Type cageside updates..." className="w-full h-44 bg-black/40 border border-white/10 rounded-xl p-5 text-sm font-bold focus:border-red-500 outline-none resize-none" />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {(['insta', 'twitter'] as const).map(p => (
                                <div key={p} className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-xl">
                                    <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/5"><span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{p === 'insta' ? 'Instagram' : 'Twitter/X'}</span><button onClick={() => { navigator.clipboard.writeText(getCaptions(p)); setCopyFeedback(p); setTimeout(() => setCopyFeedback(null), 1000); }} className="text-[10px] font-black text-gray-400 hover:text-white uppercase ">{copyFeedback === p ? 'READY ✅' : 'COPY'}</button></div>
                                    <div className="p-5 flex-1 h-[140px] overflow-y-auto"><pre className="text-[11px] text-gray-400 font-sans whitespace-pre-wrap leading-relaxed italic">{getCaptions(p)}</pre></div>
                                </div>
                            ))}
                            <button onClick={toggleCompleted} className={cn("w-full py-6 rounded-2xl font-black text-xs uppercase italic transition-all flex items-center justify-center gap-4 shadow-2xl border-2", currentFight.completed ? "bg-red-600/10 text-red-500 border-red-600/40 hover:bg-red-600 hover:text-white" : "bg-green-600 border-green-400 text-white")}>
                                {currentFight.completed ? <><Undo2 className="w-6 h-6"/> UNDO FIGHT</> : <><CheckCircle2 className="w-6 h-6"/> FINISH FIGHT</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
      </main>

      {/* EVENT SELECTOR MODAL */}
      {showEventSelector && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
              <div className="bg-[#12141c] max-w-2xl w-full rounded-3xl border-4 border-white/5 shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center"><h2 className="text-2xl font-black uppercase italic text-white leading-none">Global Event History</h2><button onClick={() => setShowEventSelector(false)} className="text-gray-500 hover:text-red-500"><Monitor className="w-6 h-6"/></button></div>
                  <div className="p-4 bg-black/30"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/><input type="text" placeholder="Search archive..." className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-xs font-bold outline-none uppercase italic focus:border-red-600" /></div></div>
                  <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                       {Object.values(eventsList).length === 0 ? (
                            <div className="text-center py-20 text-gray-600 font-black uppercase tracking-[0.3em] text-[10px]">No archives found</div>
                       ) : (
                           Object.values(eventsList).sort((a,b) => b.info.date.localeCompare(a.info.date)).map(ev => (
                               <button key={ev.id} onClick={() => { setActiveEventId(ev.id); setSelectedFightIdx(0); setShowEventSelector(false); }} className={cn("w-full p-6 rounded-2xl border transition-all flex items-center justify-between group", activeEventId === ev.id ? "bg-red-600 border-red-500 shadow-xl" : "bg-white/5 border-white/5 hover:bg-white/10")}>
                                   <div className="flex items-center gap-6">
                                       <div className="bg-black/30 p-4 rounded-xl text-xs font-black text-gray-400">{ev.info.date.split('-')[2]}</div>
                                       <div className="text-left"><div className="text-lg font-black uppercase italic leading-none mb-1">{ev.info.name}</div><div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase"><span className="flex items-center gap-1.5"><MapPin className="w-3 h-3"/> {ev.info.location}</span><span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3"/> {ev.fights.length} FIGHTS</span></div></div>
                                   </div>
                                   <ChevronRight className={cn("w-6 h-6 transition-all", activeEventId === ev.id ? "text-white" : "text-gray-700 group-hover:translate-x-2")} />
                               </button>
                           ))
                       )}
                  </div>
              </div>
          </div>
      )}

      {/* NEW EVENT SETUP MODAL */}
      {showEventModal && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-200">
              <div className="bg-[#12141c] max-w-md w-full rounded-3xl border-4 border-white/10 shadow-[0_0_100px_rgba(220,38,38,0.2)] p-10 space-y-8 text-center">
                  <div className="mx-auto w-20 h-20 bg-red-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl mb-8"><Plus className="w-10 h-10 text-white" /></div>
                  <div><h2 className="text-3xl font-black uppercase italic text-white leading-none mb-2">Initialize Event</h2><p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Configure fight synchronization</p></div>
                  <div className="space-y-4 text-left">
                      <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Event Title</label><input type="text" value={newEventInfo.name} onChange={(e) => setNewEventInfo({...newEventInfo, name: e.target.value.toUpperCase()})} placeholder="UAE WARRIORS 68" className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600 transition-all uppercase" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Date</label><input type="date" value={newEventInfo.date} onChange={(e) => setNewEventInfo({...newEventInfo, date: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600 [color-scheme:dark]" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Location</label><input type="text" value={newEventInfo.location} onChange={(e) => setNewEventInfo({...newEventInfo, location: e.target.value.toUpperCase()})} placeholder="ABU DHABI" className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600 uppercase" /></div>
                      </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl flex items-center justify-center gap-3"><Upload className="w-5 h-5"/> UPLOAD FIGHT CARD (CSV)</button>
                    <button onClick={() => setShowEventModal(false)} className="w-full text-gray-600 font-black text-xs uppercase hover:text-white transition-colors">Abort setup</button>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              </div>
          </div>
      )}
    </div>
  );
}
