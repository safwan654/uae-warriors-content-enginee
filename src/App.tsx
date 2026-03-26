import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import {
  CheckCircle2,
  Twitter,
  Instagram,
  Calendar,
  MapPin,
  AtSign,
  Hash,
  Upload,
  History,
  TrendingUp,
  Activity,
  CloudLightning,
  Monitor,
  Undo2,
  Sparkles
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update } from "firebase/database";
import { getAnalytics } from "firebase/analytics";

// UAEWCC Firebase Configuration
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
if (typeof window !== 'undefined') {
  getAnalytics(app);
}

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Fight {
  No: string;
  Weight: string;
  'Red Corner': string;
  'Red Nickname': string;
  'Red Record': string;
  'Red Nationality': string;
  'Blue Corner': string;
  'Blue Nickname': string;
  'Blue Record': string;
  'Blue Nationality': string;
  completed?: boolean;
  resultType?: string;
  winner?: 'red' | 'blue' | 'draw' | null;
  staffCaption?: string;
  originalStaffCaption?: string;
  instaHandle?: string;
  hashtags?: string;
}

interface EventInfo {
  name: string;
  date: string;
  location: string;
}

const RESULT_TYPES = [
  'Disqualify', 'Draw', 'KO/TKO', 'Majority Decision', 'Majority Draw',
  'No Contest', 'Split Decision', 'Submission', 'Unanimous Decision',
  'Verbal Submission', 'Canceled', 'Technical Decision'
];

export default function App() {
  const [fights, setFights] = useState<Fight[]>([]);
  const [selectedFightIndex, setSelectedFightIndex] = useState<number | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo>({ name: '', date: '', location: '' });
  const [showEventModal, setShowEventModal] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<'insta' | 'twitter' | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const eventRef = ref(db, 'eventInfo');
    const fightsRef = ref(db, 'fights');
    onValue(eventRef, (snapshot) => {
      const data = snapshot.val();
      if (data) { setEventInfo(data); setIsLive(true); }
    });
    onValue(fightsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setFights(Object.values(data));
        if (selectedFightIndex === null) setSelectedFightIndex(0);
      }
    });
  }, []);

  const currentFight = selectedFightIndex !== null ? fights[selectedFightIndex] : null;

  const updateCurrentFight = (updates: Partial<Fight>) => {
    if (selectedFightIndex === null) return;
    const fightRef = ref(db, `fights/${selectedFightIndex}`);
    update(fightRef, updates);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const data = results.data as any[];
          const initializedFights = data.reduce((acc, f, idx) => {
            acc[idx] = { ...f, completed: false, resultType: '', winner: null, staffCaption: '', instaHandle: '', hashtags: '#UAEWarriors #InAbuDhabi' };
            return acc;
          }, {} as Record<string, Fight>);
          set(ref(db, 'fights'), initializedFights);
          if (data.length > 0) setShowEventModal(true);
        },
      });
    }
  };

  const getCaptions = (type: 'insta' | 'twitter') => {
    if (!currentFight) return '';
    const red = currentFight['Red Corner'];
    const blue = currentFight['Blue Corner'];
    const res = currentFight.resultType || 'Decision';
    const winner = currentFight.winner;
    let resultHeader = winner === 'red' ? `🔴🏆 ${red} defeats ${blue}` : winner === 'blue' ? `🔵🏆 ${blue} defeats ${red}` : winner === 'draw' ? `🤝 ${red} vs ${blue} ends in a DRAW/NC` : `🔥 ${red} vs ${blue}`;
    const punchyIntro = type === 'twitter' ? `💥 RAW POWER! ${res} for the win in the ${currentFight.Weight} division.` : `⚖️ Division: ${currentFight.Weight}\n📊 Official Result: ${res}`;
    const mainBody = currentFight.staffCaption || 'What an incredible display of skill and heart tonight!';
    const handle = currentFight.instaHandle ? `\n${currentFight.instaHandle.startsWith('@') ? '' : '@'}${currentFight.instaHandle}` : '';
    const tagLines = currentFight.hashtags || '#UAEWarriors #FightNight #MMA';
    if (type === 'insta') return `${mainBody}${handle}\n\n${resultHeader}\n\n${punchyIntro}\n\n${tagLines}`;
    const shortBody = mainBody.length > 150 ? mainBody.slice(0, 147) + '...' : mainBody;
    return `${resultHeader}\n\n${punchyIntro}\n\n${shortBody}${handle}\n\n${tagLines}`;
  };

  const copyToClipboard = (text: string, type: 'insta' | 'twitter') => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const toggleCompleted = () => {
    if (selectedFightIndex !== null && currentFight) {
      const isFinishing = !currentFight.completed;
      updateCurrentFight({ completed: isFinishing });
      if (isFinishing && selectedFightIndex < fights.length - 1) {
        setTimeout(() => setSelectedFightIndex(selectedFightIndex + 1), 300);
      }
    }
  };

  const exportResults = () => {
    const completedFights = fights.filter(f => f.completed);
    if (completedFights.length === 0) return alert("No completed fights!");
    const csvData = completedFights.map(f => ({ No: f.No, Matchup: `${f['Red Corner']} vs ${f['Blue Corner']}`, Weight: f.Weight, Winner: f.winner === 'red' ? f['Red Corner'] : f.winner === 'blue' ? f['Blue Corner'] : 'Draw/NC', Result: f.resultType }));
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `${eventInfo.name || 'UAE_Warriors'}_Results.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const regenerateCaption = () => {
    if (!currentFight) return;
    const staffNote = currentFight.originalStaffCaption || currentFight.staffCaption || '';
    if (!staffNote) return;
    const lower = staffNote.toLowerCase();
    let theme: 'ko' | 'sub' | 'dec' | 'general' = 'general';
    if (lower.includes('ko') || lower.includes('tko') || lower.includes('knockout')) theme = 'ko';
    else if (lower.includes('submission') || lower.includes('choke') || lower.includes('tap')) theme = 'sub';
    else if (lower.includes('decision') || lower.includes('unanimous') || lower.includes('judges')) theme = 'dec';
    const templates = {
      ko: ["UNBELIEVABLE FINISH! Absolute fireworks in the cage! 💥", "SHOCKWAVES! A knockout for the history books! ⚡", "TOTAL DESTRUCTION! Heavy hands take the night! 👊"],
      sub: ["A JIU-JITSU MASTERCLASS! Pure technique on the mats. 🥋", "THE TRAP IS SET! A clinical submission finish! 🐍", "GRAPPLING CLINIC! Total dominance on the floor! ♟️"],
      dec: ["A TACTICAL BATTLE! Both fighters left it all in the cage. ⚖️", "THE JUDGES HAVE SPOKEN! A technical chess match! 📜", "WHAT A WAR! Grit and determination on full display tonight! ⚔️"],
      general: ["Kicking off with fireworks! A clinic in the cage! 🔥", "What a performance! UAE Warriors delivering as always! 🌍", "PURE HEART! An athlete reaching new heights! 🏆"]
    };
    const randIntro = templates[theme][Math.floor(Math.random() * templates[theme].length)];
    if (!currentFight.originalStaffCaption) updateCurrentFight({ originalStaffCaption: staffNote, staffCaption: `${randIntro} ${staffNote}`.trim() });
    else updateCurrentFight({ staffCaption: `${randIntro} ${currentFight.originalStaffCaption}`.trim() });
  };

  return (
    <div className="min-h-screen bg-[#05060a] text-white flex flex-col font-sans selection:bg-red-600/50">
      <div className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] flex justify-between items-center bg-black transition-colors shadow-lg", isLive ? "border-b border-green-600" : "border-b border-yellow-600")}>
        <div className="flex items-center gap-4"><span className="flex items-center gap-1.5 text-green-500"><CloudLightning className="w-3.5 h-3.5" /> CLOUD SYNC ACTIVE</span><span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {eventInfo.location || 'LIVE COVERAGE'}</span></div>
        <div className="flex items-center gap-1.5 text-gray-400"><Monitor className="w-3.5 h-3.5" /> {fights.length} FIGHTS LOADED</div>
      </div>

      <header className="bg-black border-b-2 border-white/5 px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-red-600 p-2 rounded-lg rotate-3 shadow-[0_0_15px_rgba(220,38,38,0.3)]"><TrendingUp className="w-6 h-6 text-white" /></div>
          <div className="flex flex-col">
            <h1 className="text-xl font-black uppercase tracking-tight leading-none italic">UAE WARRIORS <span className="text-red-600">CONTENT ENGINE</span></h1>
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.4em] mt-0.5">{eventInfo.name || 'READY FOR BROADCAST'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowEventModal(true)} className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all">SET EVENT</button>
          {fights.some(f => f.completed) && <button onClick={exportResults} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all shadow-lg italic">EXPORT LOG</button>}
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white px-4 py-2 rounded-lg border border-red-600/50 text-xs font-bold uppercase transition-all"><Upload className="w-4 h-4" /> LOAD CARD</button>
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-[280px] bg-[#0c0d12] border-r border-white/5 overflow-y-auto hidden lg:block">
          <div className="p-4 border-b border-white/5 bg-black/30 flex justify-between items-center sticky top-0 z-10 font-black text-gray-400 text-[10px] tracking-widest uppercase"><History className="w-3.5 h-3.5" /> FIGHT LIST</div>
          <div className="divide-y divide-white/5">
            {fights.map((f, idx) => (
              <button key={idx} onClick={() => setSelectedFightIndex(idx)} className={cn("w-full p-4 text-left transition-all hover:bg-white/5 flex flex-col gap-1.5 relative border-l-4", selectedFightIndex === idx ? "bg-red-600/10 border-red-600" : "border-transparent", f.completed ? "opacity-30" : "")}>
                <div className="flex justify-between items-center"><span className="text-[9px] font-bold text-gray-500 uppercase px-1.5 bg-white/5 rounded leading-none py-1">{f.Weight}</span>{f.completed && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}</div>
                <div className="space-y-0.5">
                  <div className={cn("text-xs font-black uppercase truncate", f.winner === 'red' ? "text-red-500" : "text-gray-300")}>{f['Red Corner']}</div>
                  <div className={cn("text-xs font-black uppercase truncate", f.winner === 'blue' ? "text-blue-500" : "text-gray-300")}>{f['Blue Corner']}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-[#05060a]">
          {!currentFight ? (
            <div className="h-full flex items-center justify-center opacity-30"><div className="text-center animate-pulse"><Activity className="w-12 h-12 mx-auto mb-4" /><p className="font-bold uppercase tracking-[0.3em] text-[10px]">READY TO TRANSMIT...</p></div></div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-6">

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 bg-[#12141c] rounded-xl border border-white/10 overflow-hidden shadow-2xl relative">
                <div className={cn("p-8 text-center lg:text-right border-b lg:border-b-0 lg:border-r border-white/5 transition-colors", currentFight.winner === 'red' && 'bg-red-600/20')}>
                  <div className="text-red-500 text-[10px] font-black tracking-widest uppercase mb-2">Red Corner</div>
                  <h3 className="text-2xl lg:text-3xl font-black uppercase text-white leading-tight italic">{currentFight['Red Corner']}</h3>
                  {currentFight.winner === 'red' && <div className="mt-3 inline-flex bg-red-600 text-white px-4 py-0.5 rounded text-[10px] font-black uppercase">WINNER</div>}
                </div>
                <div className="p-6 flex flex-col items-center justify-center bg-black/20">
                  <div className="bg-white/10 px-3 py-1 rounded-full text-[10px] font-black uppercase italic mb-2 tracking-widest">{currentFight.Weight}</div>
                  <div className="text-gray-600 font-bold italic text-sm opacity-50 font-mono text-center">#{currentFight.No} <br /> VS</div>
                </div>
                <div className={cn("p-8 text-center lg:text-left border-t lg:border-t-0 lg:border-l border-white/5 transition-colors", currentFight.winner === 'blue' && 'bg-blue-600/20')}>
                  <div className="text-blue-500 text-[10px] font-black tracking-widest uppercase mb-2">Blue Corner</div>
                  <h3 className="text-2xl lg:text-3xl font-black uppercase text-white leading-tight italic">{currentFight['Blue Corner']}</h3>
                  {currentFight.winner === 'blue' && <div className="mt-3 inline-flex bg-blue-600 text-white px-4 py-0.5 rounded text-[10px] font-black uppercase">WINNER</div>}
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

                <div className="xl:col-span-3 space-y-6">
                  <div className="bg-[#12141c] p-6 rounded-xl border border-white/5 space-y-6">
                    <div>
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 block">1. Fight Outcome</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button onClick={() => updateCurrentFight({ winner: 'red' })} className={cn("py-3 rounded-lg font-black text-xs transition-all border", currentFight.winner === 'red' ? "bg-red-600 border-red-400 shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:border-red-600/50")}>RED WINS</button>
                        <button onClick={() => updateCurrentFight({ winner: 'blue' })} className={cn("py-3 rounded-lg font-black text-xs transition-all border", currentFight.winner === 'blue' ? "bg-blue-600 border-blue-400 shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:border-blue-600/50")}>BLUE WINS</button>
                        <button onClick={() => updateCurrentFight({ winner: 'draw' })} className={cn("py-3 rounded-lg font-black text-xs transition-all border", currentFight.winner === 'draw' ? "bg-zinc-600 border-zinc-400 shadow-lg" : "bg-white/5 border-white/10 text-gray-400 hover:border-gray-500")}>DRAW/NC</button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">2. Method</label>
                      <div className="flex flex-wrap gap-1.5">
                        {RESULT_TYPES.map(type => (
                          <button
                            key={type}
                            onClick={() => updateCurrentFight({ resultType: type })}
                            className={cn(
                              "px-2.5 py-1.5 rounded-md text-[9px] font-black uppercase transition-all border",
                              currentFight.resultType === type ? "bg-white border-white text-black" : "bg-white/5 border-white/5 text-gray-500 hover:text-white"
                            )}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-[#12141c] p-6 rounded-xl border border-white/5 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1.5"><AtSign className="w-3 h-3 text-red-600" /> @Handle</label>
                        <input type="text" value={currentFight.instaHandle} onChange={(e) => updateCurrentFight({ instaHandle: e.target.value })} placeholder="@username" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-3 text-xs font-bold focus:border-red-500 outline-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase flex items-center gap-1.5"><Hash className="w-3 h-3 text-red-600" /> #TAGS</label>
                        <input type="text" value={currentFight.hashtags} onChange={(e) => updateCurrentFight({ hashtags: e.target.value })} placeholder="#UAEW68" className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-3 text-xs font-bold focus:border-red-500 outline-none" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-gray-500 uppercase">OFFICIAL STAFF CAPTION</label>
                        <div className="flex gap-4">
                          <button onClick={regenerateCaption} className="text-[10px] text-white bg-red-600 hover:bg-red-700 px-3 py-1 rounded-full font-black uppercase flex items-center gap-1.5 transition-all shadow-lg active:scale-95"><Sparkles className="w-3.5 h-3.5" /> REGENERATE</button>
                          <button onClick={() => updateCurrentFight({ staffCaption: '', originalStaffCaption: '' })} className="text-[9px] text-gray-600 hover:text-red-500 font-bold uppercase transition-colors">Reset</button>
                        </div>
                      </div>
                      <textarea
                        value={currentFight.staffCaption}
                        onChange={(e) => updateCurrentFight({ staffCaption: e.target.value, originalStaffCaption: e.target.value })}
                        placeholder="Input details..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-5 text-sm font-bold focus:border-red-500 outline-none h-44 resize-none leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                <div className="xl:col-span-2 space-y-4">
                  {(['insta', 'twitter'] as const).map(pType => (
                    <div key={pType} className="bg-black/40 rounded-xl border border-white/10 overflow-hidden flex flex-col shadow-2xl">
                      <div className="px-4 py-2 bg-white/5 border-b border-white/5 flex justify-between items-center bg-black/20">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                          {pType === 'insta' ? <Instagram className="w-3.5 h-3.5 text-pink-500" /> : <Twitter className="w-3.5 h-3.5 text-blue-500" />}
                          {pType === 'insta' ? 'Instagram' : 'X / Twitter'}
                        </span>
                        <button onClick={() => copyToClipboard(getCaptions(pType), pType)} className={cn("px-3 py-1 rounded text-[10px] font-black uppercase transition-all shadow-inner", copyFeedback === pType ? "bg-green-600 text-white" : "bg-white/10 text-gray-500 hover:bg-white/20")}>
                          {copyFeedback === pType ? "COPIED ✓" : "COPY"}
                        </button>
                      </div>
                      <div className="p-4 flex-1 h-[150px] overflow-y-auto">
                        <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-sans leading-relaxed tracking-tight">
                          {getCaptions(pType)}
                        </pre>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={toggleCompleted}
                    className={cn(
                      "w-full py-5 rounded-xl font-black text-sm uppercase italic transition-all flex items-center justify-center gap-3 shadow-2xl border-2",
                      currentFight.completed ? "bg-red-600/20 text-red-500 border-red-600/50" : "bg-green-600 border-green-500 text-white hover:scale-[1.02]"
                    )}
                  >
                    {currentFight.completed ? <><Undo2 className="w-5 h-5" /> UNDO FIGHT</> : <><CheckCircle2 className="w-5 h-5" /> FINISHED ✓</>}
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {showEventModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-md">
          <div className="bg-[#12141c] max-w-md w-full rounded-2xl border border-white/10 shadow-2xl p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <Calendar className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-black uppercase italic text-white leading-none">Event Setup</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Event Name</label>
                <input type="text" value={eventInfo.name} onChange={(e) => setEventInfo({ ...eventInfo, name: e.target.value.toUpperCase() })} placeholder="UAE WARRIORS 68" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-bold outline-none focus:border-red-600" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="space-y-2"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Fight Date</label><input type="date" value={eventInfo.date} onChange={(e) => setEventInfo({ ...eventInfo, date: e.target.value })} className="w-full bg-black/60 border border-white/10 rounded-xl px-5 py-4 text-white font-black outline-none [color-scheme:dark]" /></div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Location</label>
                  <input type="text" value={eventInfo.location} onChange={(e) => setEventInfo({ ...eventInfo, location: e.target.value.toUpperCase() })} placeholder="ABU DHABI" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white font-bold outline-none focus:border-red-600" />
                </div>
              </div>
            </div>
            <button onClick={() => { set(ref(db, 'eventInfo'), eventInfo); setShowEventModal(false); }} className="w-full bg-red-600 hover:bg-black hover:text-red-500 py-4 rounded-xl text-white font-black transition-all border border-transparent hover:border-red-600 uppercase tracking-widest text-xs">INITIATE LIVE SYNC</button>
          </div>
        </div>
      )}
    </div>
  );
}
