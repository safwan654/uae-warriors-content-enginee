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
  Search,
  Trash2,
  Edit2,
  Download,
  Image as ImageIcon,
  FolderOpen,
  RefreshCw,
  FileWarning
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Firebase Imports
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, update, remove } from "firebase/database";
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
  round?: number | null;
  winner?: 'red' | 'blue' | 'draw' | null;
  staffCaption?: string;
  xCaption?: string;
  originalStaffCaption?: string;
  teamIntel?: string;
  instaHandle?: string;
  hashtags?: string;
  postedX?: boolean;
  postedInstagram?: boolean;
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
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [newEventInfo, setNewEventInfo] = useState({ name: '', date: '', location: '' });
  const [copyFeedback, setCopyFeedback] = useState<'insta' | 'twitter' | null>(null);
  const [isLive, setIsLive] = useState(false);
  
  // Photo Panel State
  const [rootHandle, setRootHandle] = useState<any>(null);
  const [fightPhotos, setFightPhotos] = useState<{name: string, url: string}[]>([]);
  const [selectedPhotoIdx, setSelectedPhotoIdx] = useState<number | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmedPhotos, setConfirmedPhotos] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const eventsRef = ref(db, 'events');
    onValue(eventsRef, (snapshot) => {
      const data = snapshot.val() || {};
      setEventsList(data);
      setIsLive(true);
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

  const updateHashtagsGlobally = (tags: string) => {
    if (!activeEventId || !activeEvent) return;
    const updates: any = {};
    activeEvent.fights.forEach((_, idx) => {
      updates[`events/${activeEventId}/fights/${idx}/hashtags`] = tags;
    });
    update(ref(db), updates);
  };

  const toggleCompleted = () => {
    if (!currentFight) return;
    const isFinishing = !currentFight.completed;
    updateFight({ completed: isFinishing });
    if (isFinishing && activeEvent && selectedFightIdx !== null && selectedFightIdx < activeEvent.fights.length - 1) {
      setTimeout(() => setSelectedFightIdx(selectedFightIdx + 1), 300);
    }
  };

  const deleteEvent = (id: string) => {
    if (window.confirm("Are you sure you want to permanently delete this event?")) {
      remove(ref(db, `events/${id}`));
      if (activeEventId === id) {
        setActiveEventId(null);
        setSelectedFightIdx(null);
      }
    }
  };

  // PHOTO PANEL LOGIC
  const selectRootFolder = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });
      setRootHandle(handle);
      setPhotoError(null);
      // Try to trigger an immediate load
      if (currentFight?.No) {
        setTimeout(() => loadPhotosForFight(), 100);
      }
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setPhotoError("Permission denied. Click again and select 'Allow' or 'Read Access'.");
      } else if (err.name !== 'AbortError') {
        setPhotoError("Selection failed. Use Chrome/Edge and select the base 'AppMaster' folder.");
      }
    }
  };

  const loadPhotosForFight = async () => {
    if (!rootHandle || !currentFight) return;
    
    // Check permissions
    try {
      if (await (rootHandle as any).queryPermission({ mode: 'read' }) !== 'granted') {
          if (await (rootHandle as any).requestPermission({ mode: 'read' }) !== 'granted') {
            setPhotoError("Grant read access to reload fight photos.");
            return;
          }
      }
    } catch (e) {
      setPhotoError("Folder connection lost. Re-initialize Root Folder.");
      return;
    }

    setIsPhotoLoading(true);
    setPhotoError(null);
    setSelectedPhotoIdx(null);
    setConfirmedPhotos(new Set());
    
    try {
      const targetNo = currentFight.No.toString().trim().toLowerCase();
      let fightFolder = null;
      
      // DEEP SEARCH: Iterate all subfolders to find a match (case-insensitive)
      for await (const entry of (rootHandle as any).values()) {
        if (entry.kind === 'directory') {
          const folderName = entry.name.trim().toLowerCase();
          // Matches "1", "01", "Fight 1", "F1", "Fight01"
          if (folderName === targetNo || 
              folderName === `fight ${targetNo}` || 
              folderName === `fight${targetNo}` ||
              folderName === `f${targetNo}` ||
              folderName.includes(` ${targetNo}`)) {
            fightFolder = entry;
            break;
          }
        }
      }

      if (!fightFolder) {
        setFightPhotos([]);
        setPhotoError(`Could not find folder for #${targetNo} in "${rootHandle.name}"`);
        setIsPhotoLoading(false);
        return;
      }

      const photos: {name: string, url: string}[] = [];
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];

      for await (const entry of (fightFolder as any).values()) {
        if (entry.kind === 'file') {
          const name = entry.name;
          const lowerName = name.toLowerCase();
          if (imageExtensions.some(ext => lowerName.endsWith(ext))) {
            const file = await entry.getFile();
            photos.push({
              name: name,
              url: URL.createObjectURL(file)
            });
          }
        }
      }

      if (photos.length === 0) {
        setPhotoError(`No images found in folder "${fightFolder.name}"`);
      }

      setFightPhotos(photos.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})));
      if (photos.length > 0) setSelectedPhotoIdx(0);
    } catch (err: any) {
      setPhotoError(`Sync Error: ${err.message || "Cannot read fight folder"}`);
    } finally {
      setIsPhotoLoading(false);
    }
  };

  const toggleConfirmPhoto = (name: string) => {
    const newSubset = new Set(confirmedPhotos);
    if (newSubset.has(name)) {
      newSubset.delete(name);
    } else {
      newSubset.add(name);
    }
    setConfirmedPhotos(newSubset);
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const imageExtensions = ['image/jpeg', 'image/png', 'image/webp'];
    
    const droppedPhotos = files
      .filter(f => imageExtensions.includes(f.type))
      .map(f => ({
        name: f.name,
        url: URL.createObjectURL(f)
      }));

    if (droppedPhotos.length > 0) {
      const newPhotos = [...fightPhotos, ...droppedPhotos];
      setFightPhotos(newPhotos.sort((a,b) => a.name.localeCompare(b.name, undefined, {numeric: true})));
      if (selectedPhotoIdx === null) setSelectedPhotoIdx(fightPhotos.length);
    }
  };

  // Revoke URLs on unmount or refresh
  useEffect(() => {
    return () => {
      fightPhotos.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [fightPhotos]);

  useEffect(() => {
    if (rootHandle && currentFight?.No) {
      loadPhotosForFight();
    }
  }, [rootHandle, currentFight?.No]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (results: any) => {
          const fights = results.data.map((f: any) => ({
            ...f, completed: false, resultType: '', round: null, winner: null, staffCaption: '', xCaption: '', teamIntel: '', instaHandle: '', hashtags: '#UAEWarriors', postedX: false, postedInstagram: false
          }));
          const eId = newEventInfo.name.replace(/\s+/g, '_') || `EVENT_${Date.now()}`;
          const finalData = { id: eId, info: newEventInfo, fights };
          set(ref(db, `events/${eId}`), finalData);
          setActiveEventId(eId);
          setSelectedFightIdx(0);
          setShowEventModal(false);
          setIsEditingEvent(false);
        },
      });
    }
  };

  const exportResults = () => {
    if (!activeEvent) return;
    const results = activeEvent.fights
      .filter(f => f.completed)
      .map(f => ({
        'Fight No': f.No,
        'Division': f.Weight,
        'Winner': f.winner === 'red' ? f['Red Corner'] : f.winner === 'blue' ? f['Blue Corner'] : 'DRAW/NC',
        'Loser': f.winner === 'red' ? f['Blue Corner'] : f.winner === 'blue' ? f['Red Corner'] : 'N/A',
        'Method': f.resultType || 'N/A',
        'Round': f.round || 'N/A',
        'Live Notes': f.staffCaption || ''
      }));
    
    if (results.length === 0) {
      alert("No fights completed in this event yet!");
      return;
    }

    const csv = Papa.unparse(results);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeEvent.info.name}_Results.csv`;
    a.click();
  };

  const saveEditedInfo = () => {
    if (!activeEventId) return;
    update(ref(db, `events/${activeEventId}/info`), newEventInfo);
    setShowEventModal(false);
    setIsEditingEvent(false);
  };

  const getCaptions = (type: 'insta' | 'twitter'): string => {
    if (!currentFight) return '';
    const res = currentFight.resultType || 'Result';
    const roundTxt = currentFight.round ? ` in Round ${currentFight.round}` : '';
    const winnerType = currentFight.winner;
    const winnerName = winnerType === 'red' ? currentFight['Red Corner'] : winnerType === 'blue' ? currentFight['Blue Corner'] : null;
    
    // Main Body Logic
    let bodyText = type === 'insta' ? (currentFight.staffCaption || '') : (currentFight.xCaption || '');
    
    if (!bodyText && winnerName) {
      const line1 = "Kicking off with fireworks! 💥";
      const line2 = `${res}${roundTxt} victory for ${winnerName}.`;
      bodyText = `${line1}\n${line2}`;
    }

    let header = winnerType === 'red' ? `🔴🏆 ${currentFight['Red Corner']} wins` : winnerType === 'blue' ? `🔵🏆 ${currentFight['Blue Corner']} wins` : `🔥 ${currentFight['Red Corner']} vs ${currentFight['Blue Corner']}`;
    const tags = currentFight.hashtags || '#UAEWarriors';
    const vocab = type === 'twitter' ? `💥 ACTION! ${res}${roundTxt} in ${currentFight.Weight}` : `📊 Result: ${res}${roundTxt}\n⚖️ ${currentFight.Weight}`;
    const handleLine = (type === 'insta' && currentFight.instaHandle) ? `${currentFight.instaHandle.startsWith('@') ? currentFight.instaHandle : '@' + currentFight.instaHandle}` : '';
    
    if (type === 'insta') return `${bodyText}${handleLine ? '\n' + handleLine : ''}\n\n${header}\n\n${vocab}\n\n${tags}`;
    return `${header}\n\n${vocab}\n\n${bodyText}\n\n${tags}`;
  };

  const regenerateCaption = () => {
    if (!currentFight) return;
    
    const res = currentFight.resultType || 'Result';
    const rd = currentFight.round ? ` Round ${currentFight.round}` : '';
    const winnerType = currentFight.winner;
    const winner = winnerType === 'red' ? currentFight['Red Corner'] : winnerType === 'blue' ? currentFight['Blue Corner'] : 'the fighter';
    const baseIntel = currentFight.teamIntel || '';
    
    // 30+ MASSIVE Openers Pool with Platform-Specific Emojis
    const getOpeners = (isInsta: boolean) => {
        const instaEmojis = ["🔥 ", "📸 ", "✨ ", "🥋 ", "🏆 ", "📊 ", "🌟 ", "💥 "];
        const xEmojis = ["⚡ ", "🚨 ", "🥊 ", "🌪️ ", "📉 ", "📈 ", "👑 ", "🌊 "];
        const e = isInsta ? instaEmojis : xEmojis;
        const pick = () => e[Math.floor(Math.random() * e.length)];
        
        return [
            `${pick()}History made! `, `${pick()}Incredible! `, `${pick()}Pure elite skill! `, `${pick()}The arena erupted! `, 
            `${pick()}Absolute dominance! `, `${pick()}A tactical masterpiece! `, `${pick()}Stunning performance! `,
            `${pick()}Abu Dhabi witnessess greatness! `, `${pick()}Total striking clinical! `, `${pick()}High-level action! `,
            `${pick()}Spectacular finish! `, `${pick()}The warrior spirit is alive! `, `${pick()}Unbelievable scenes! `,
            `${pick()}A masterclass in the cage! `, `${pick()}Pure heart! `, `${pick()}What a moment in the capital! `,
            `${pick()}Sensational effort! `, `${pick()}The judges are stunned! `, `${pick()}A defining career win! `,
            `${pick()}The crowd is on its feet! `, `${pick()}Clinical execution! `, `${pick()}Pure fireworks tonight! `,
            `${pick()}Warrior mentality! `, `${pick()}Simply world-class! `, `${pick()}Abu Dhabi is roaring! `,
            `${pick()}Inspirational effort! `, `${pick()}A total dismantling! `, `${pick()}The momentum shifts! `,
            `${pick()}Everything on the line! `, `${pick()}The results are in! `, `${pick()}A legacy defining victory! `
        ];
    };

    // 30+ MASSIVE Closers Pool
    const getClosers = (isInsta: boolean) => {
        const instaEmojis = [" ✨", " 🇦🇪", " 🥋", " 🔥", " 🥇"];
        const xEmojis = [" ⚡", " 👊", " 🚨", " 🌪️", " 👑"];
        const e = isInsta ? instaEmojis : xEmojis;
        const pick = () => e[Math.floor(Math.random() * e.length)];

        return [
            ` to finish the fight in dominant fashion.${pick()}`,
            ` to seal a defining victory here in Abu Dhabi.${pick()}`,
            ` clinching a spectacular win tonight.${pick()}`,
            ` walking away with a high-level professional victory.${pick()}`,
            ` proving once again they are a force in the division.${pick()}`,
            ` and remains undefeated in spirit tonight.${pick()}`,
            ` for a highlight-reel conclusion to this battle.${pick()}`,
            ` in what will be remembered as a classic UAE Warriors moment.${pick()}`,
            `. A professional display of technique and will.${pick()}`,
            ` to capture the hearts of the Abu Dhabi fans.${pick()}`,
            ` and leaves the octagon as the definitive victor.${pick()}`,
            ` with a performance for the history books.${pick()}`,
            ` to earn their place among the elite in the cage.${pick()}`,
            ` as the arena continues to echo with applause.${pick()}`,
            ` in a staggering showcase of mixed martial arts.${pick()}`,
            ` for a high-energy finish to their intense battle.${pick()}`,
            ` as the result is officially read by the announcer.${pick()}`,
            ` to celebrate a truly incredible professional win.${pick()}`,
            ` in what was a tactical clinic from start to finish.${pick()}`,
            ` and remains the one to watch in this weight class.${pick()}`,
            `. The excellence of UAE Warriors was on full display.${pick()}`,
            ` in a total masterclass performance tonight.${pick()}`,
            ` and makes it look easy in the center of the cage.${pick()}`,
            ` for a stunning professional victory in the desert.${pick()}`,
            ` to silence the skeptics and claim the cage.${pick()}`,
            ` and secures the professional victory they earned.${pick()}`,
            ` in a defining moment for their professional career.${pick()}`,
            ` to earn massive respect from the cageside staff.${pick()}`,
            ` to capture a spectacular professional win here.${pick()}`
        ];
    };

    const generateSpecific = (isInsta: boolean) => {
        const ops = getOpeners(isInsta);
        const cls = getClosers(isInsta);
        const opener = ops[Math.floor(Math.random() * ops.length)];
        const closer = cls[Math.floor(Math.random() * cls.length)];
        
        if (baseIntel.length > 3) {
            const alreadyHasName = baseIntel.toLowerCase().includes(winner.toLowerCase());
            const subject = alreadyHasName ? "" : `${winner} `;
            let cleanIntel = baseIntel.trim();
            if (cleanIntel.endsWith('.')) cleanIntel = cleanIntel.slice(0, -1);
            return `${opener}${subject}${cleanIntel}${closer}`;
        }
        return `${opener}${winner} captures a professional ${res}${rd} victory.`;
    };

    updateFight({ 
        staffCaption: generateSpecific(true),
        xCaption: generateSpecific(false)
    });
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
            <button onClick={() => setShowEventSelector(true)} className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] mt-0.5 hover:text-red-500 flex items-center gap-2 group transition-all text-left">
                {activeEvent?.info.name || 'SELECT EVENT'} <ChevronRight className="w-3 h-3 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={exportResults} className="flex items-center gap-2 bg-green-600/20 text-green-500 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-green-500/20 hover:bg-green-600 hover:text-white transition-all"><Download className="w-4 h-4"/> EXPORT LOG</button>
           <button onClick={() => { setNewEventInfo({name:'',date:'',location:''}); setShowEventModal(true); setIsEditingEvent(false); }} className="flex items-center gap-2 bg-red-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg hover:scale-105 transition-all"><Plus className="w-4 h-4"/> NEW EVENT</button>
           <button onClick={() => setShowEventSelector(true)} className="flex items-center gap-2 bg-gray-800 text-gray-300 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border border-white/5 hover:bg-gray-700 transition-all"><Database className="w-4 h-4"/> HISTORY</button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <aside className="w-[300px] bg-[#0c0d12] border-r border-white/5 flex flex-col">
          <div className="p-5 border-b border-white/5 bg-black/20 font-black text-gray-500 text-[10px] tracking-widest uppercase flex items-center justify-between">
              <span className="flex items-center gap-2"><History className="w-4 h-4" /> FIGHT CARD</span>
              {activeEvent && <button onClick={() => { setNewEventInfo(activeEvent.info); setIsEditingEvent(true); setShowEventModal(true); }} className="text-gray-600 hover:text-white transition-colors"><Edit2 className="w-3 h-3" /></button>}
          </div>
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
                        <div className={cn("p-10 text-right border-r border-white/5 transition-all relative group", currentFight.winner === 'red' && 'bg-red-600/20')}>
                           <div className="text-red-500 text-[10px] font-black tracking-widest uppercase mb-2">Red Corner</div>
                           <h2 className="text-3xl font-black uppercase italic leading-none">{currentFight['Red Corner']}</h2>
                        </div>
                        <div className="bg-black/20 flex flex-col items-center justify-center p-6"><div className="bg-white/10 px-4 py-1 rounded-full text-[10px] font-black uppercase italic mb-2 tracking-widest text-gray-400">{currentFight.Weight}</div><div className="text-gray-700 font-black italic text-2xl uppercase opacity-40">VS</div></div>
                        <div className={cn("p-10 text-left border-l border-white/5 transition-all relative group", currentFight.winner === 'blue' && 'bg-blue-600/20')}>
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
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">1. Round Selection</label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map(r => (
                                            <button key={r} onClick={() => updateFight({ round: r })} className={cn("w-12 h-12 rounded-xl text-xs font-black transition-all border", currentFight.round === r ? "bg-white text-black border-white" : "bg-white/5 border-white/10 text-gray-600 hover:text-white")}>R{r}</button>
                                        ))}
                                        <button onClick={() => updateFight({ round: null })} className={cn("px-4 h-12 rounded-xl text-[9px] font-black uppercase border transition-all", !currentFight.round ? "bg-gray-800 text-white" : "bg-white/5 border-white/10 text-gray-600")}>NONE</button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">2. Victory Method</label>
                                    <div className="flex flex-wrap gap-2">{RESULT_TYPES.map(type => (
                                        <button key={type} onClick={() => updateFight({ resultType: type })} className={cn("px-4 py-2 rounded-lg text-[10px] font-black uppercase border transition-all", currentFight.resultType === type ? "bg-white text-black border-white" : "bg-white/5 border-white/5 text-gray-500 hover:text-white")}>{type}</button>
                                    ))}</div>
                                </div>
                            </div>
                            <div className="bg-[#12141c] p-8 rounded-2xl border border-white/5 space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="text" value={currentFight.instaHandle} onChange={(e) => updateFight({ instaHandle: e.target.value })} placeholder="@FIGHTER_HANDLE" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-black focus:border-red-500 outline-none" />
                                    <input type="text" value={currentFight.hashtags} onChange={(e) => updateHashtagsGlobally(e.target.value)} placeholder="#UAEWARRIORS68" className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-4 text-xs font-black focus:border-red-500 outline-none border-dashed border-red-500/50" title="Changes hashtags for ALL fights in this event" />
                                </div>
                                <div className="space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest pl-2">1. Team Professional Intel</label></div>
                                        <textarea value={currentFight.teamIntel} onChange={(e) => updateFight({ teamIntel: e.target.value })} placeholder="Paste professional staff notes/caption here..." className="w-full h-32 bg-black/40 border-2 border-dashed border-white/5 rounded-xl p-5 text-sm font-bold focus:border-red-500 outline-none resize-none" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-blue-500 uppercase italic tracking-widest pl-2">2. Instagram Narrative </label><button onClick={regenerateCaption} className="text-[10px] text-red-500 font-black uppercase flex items-center gap-1.5 hover:text-white transition-all transform active:scale-95 bg-white/5 px-3 py-1.5 rounded-full"><Sparkles className="w-3.5 h-3.5"/> REGENERATE BOTH</button></div>
                                        <textarea value={currentFight.staffCaption} onChange={(e) => updateFight({ staffCaption: e.target.value })} placeholder="AI will enhance team intel for Instagram..." className="w-full h-24 bg-blue-600/5 border border-blue-500/20 rounded-xl p-4 text-[11px] font-bold focus:border-blue-500 outline-none resize-none text-blue-50" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center"><label className="text-[10px] font-black text-gray-500 uppercase italic tracking-widest pl-2">3. Twitter/X Narrative </label></div>
                                        <textarea value={currentFight.xCaption} onChange={(e) => updateFight({ xCaption: e.target.value })} placeholder="AI will enhance team intel for X..." className="w-full h-24 bg-white/5 border border-white/10 rounded-xl p-4 text-[11px] font-bold focus:border-red-500 outline-none resize-none text-gray-300" />
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-6">
                            {(['insta', 'twitter'] as const).map(p => (
                                <div key={p} className="bg-black/40 rounded-2xl border border-white/10 overflow-hidden flex flex-col shadow-xl">
                                    <div className="px-5 py-3 border-b border-white/5 flex justify-between items-center bg-white/5">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                                            {p === 'insta' ? 'Instagram' : 'Twitter/X'}
                                        </span>
                                        <button 
                                            onClick={() => { navigator.clipboard.writeText(getCaptions(p)); setCopyFeedback(p); setTimeout(() => setCopyFeedback(null), 1000); }} 
                                            className="text-[10px] font-black text-gray-400 hover:text-white uppercase"
                                        >
                                            {copyFeedback === p ? 'READY ✅' : 'COPY'}
                                        </button>
                                    </div>
                                    <div className="p-5 flex-1 h-[140px] overflow-y-auto">
                                        <pre className="text-[11px] text-gray-400 font-sans whitespace-pre-wrap leading-relaxed italic">
                                            {getCaptions(p)}
                                        </pre>
                                    </div>
                                </div>
                            ))}

                            <div className="bg-[#12141c] p-6 rounded-2xl border border-white/5 space-y-4 shadow-2xl">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2 opacity-50">Content Status Confirmation</label>
                                <div className="space-y-3">
                                    <button 
                                        onClick={() => updateFight({ postedX: !currentFight.postedX })}
                                        className={cn(
                                            "w-full p-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-between transition-all border",
                                            currentFight.postedX ? "bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]" : "bg-white/5 border-white/10 text-gray-500 hover:border-blue-500/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", currentFight.postedX ? "bg-blue-500" : "bg-gray-700")} />
                                            <span>Posted to Twitter / X</span>
                                        </div>
                                        {currentFight.postedX ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-white/10" />}
                                    </button>
                                    <button 
                                        onClick={() => updateFight({ postedInstagram: !currentFight.postedInstagram })}
                                        className={cn(
                                            "w-full p-4 rounded-xl text-[10px] font-black uppercase flex items-center justify-between transition-all border",
                                            currentFight.postedInstagram ? "bg-pink-600/20 border-pink-500 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.1)]" : "bg-white/5 border-white/10 text-gray-500 hover:border-pink-500/50"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={cn("w-2 h-2 rounded-full", currentFight.postedInstagram ? "bg-pink-500" : "bg-gray-700")} />
                                            <span>Posted to Instagram</span>
                                        </div>
                                        {currentFight.postedInstagram ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border-2 border-white/10" />}
                                    </button>
                                </div>
                            </div>

                            <button 
                                onClick={toggleCompleted} 
                                disabled={!currentFight.completed && (!currentFight.postedX || !currentFight.postedInstagram)}
                                className={cn(
                                    "w-full py-6 rounded-2xl font-black text-xs uppercase italic transition-all flex items-center justify-center gap-4 shadow-2xl border-2", 
                                    currentFight.completed 
                                        ? "bg-red-600/10 text-red-500 border-red-600/40 hover:bg-red-600 hover:text-white" 
                                        : (currentFight.postedX && currentFight.postedInstagram 
                                            ? "bg-green-600 border-green-400 text-white hover:scale-[1.02] active:scale-95 shadow-[0_0_30px_rgba(34,197,94,0.3)]" 
                                            : "bg-gray-800 border-white/5 text-gray-500 cursor-not-allowed opacity-50 grayscale")
                                )}
                            >
                                {currentFight.completed ? <><Undo2 className="w-6 h-6"/> UNDO FIGHT</> : <><CheckCircle2 className="w-6 h-6"/> FINISH FIGHT</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>

        {/* PHOTO PANEL (RIGHT) */}
        <aside 
            className="w-[420px] bg-[#0c0d12] border-l border-white/5 flex flex-col shadow-[inset_10px_0_30px_rgba(0,0,0,0.5)]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handlePhotoDrop}
        >
            <div className="p-5 border-b border-white/5 bg-black/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-600/20 p-2 rounded-lg"><ImageIcon className="w-4 h-4 text-blue-500" /></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Fight Media</span>
                        {rootHandle && <span className="text-[8px] text-gray-600 font-bold uppercase truncate max-w-[120px]">@{rootHandle.name}</span>}
                    </div>
                </div>
                {!rootHandle ? (
                    <button onClick={selectRootFolder} className="text-[9px] font-black uppercase text-blue-500 hover:text-white flex items-center gap-1.5 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20"><FolderOpen className="w-3 h-3"/> Initialize Root</button>
                ) : (
                    <button onClick={loadPhotosForFight} className="text-gray-500 hover:text-white transition-colors" title="Refresh folder"><RefreshCw className={cn("w-4 h-4", isPhotoLoading && "animate-spin")} /></button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!rootHandle && fightPhotos.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6"><FolderOpen className="w-8 h-8 text-gray-700" /></div>
                        <h3 className="text-xs font-black uppercase text-gray-500 mb-2">No Folder Selected</h3>
                        <p className="text-[10px] text-gray-700 font-bold uppercase leading-relaxed mb-6">Select "AppMaster" folder to auto-sync fight images.</p>
                        <button onClick={selectRootFolder} className="bg-white text-black text-[9px] font-black uppercase px-6 py-3 rounded-xl hover:bg-blue-600 hover:text-white transition-all">Select Master Folder</button>
                    </div>
                ) : isPhotoLoading ? (
                    <div className="h-full flex items-center justify-center"><RefreshCw className="w-8 h-8 text-blue-600 animate-spin opacity-20" /></div>
                ) : fightPhotos.length > 0 ? (
                    <div className="p-4 space-y-4">
                        {/* MAIN PREVIEW */}
                        {selectedPhotoIdx !== null && (
                            <div className="space-y-4">
                                <div className="aspect-video bg-black rounded-2xl border-4 border-white/5 overflow-hidden shadow-2xl relative group">
                                    <img src={fightPhotos[selectedPhotoIdx].url} alt="Preview" className="w-full h-full object-contain" />
                                    {confirmedPhotos.has(fightPhotos[selectedPhotoIdx].name) && (
                                        <div className="absolute top-4 left-4 bg-blue-600 text-white text-[8px] font-black px-3 py-1 rounded-full shadow-lg border border-blue-400 animate-in zoom-in-50">READY TO POST</div>
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                        <div className="text-[9px] font-black text-white/50 uppercase truncate w-full">{fightPhotos[selectedPhotoIdx].name}</div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => toggleConfirmPhoto(fightPhotos[selectedPhotoIdx].name)}
                                        className={cn(
                                            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2 border",
                                            confirmedPhotos.has(fightPhotos[selectedPhotoIdx].name) 
                                                ? "bg-blue-600 border-blue-400 text-white shadow-lg" 
                                                : "bg-white/5 border-white/10 text-gray-500 hover:bg-white/10"
                                        )}
                                    >
                                        <ImageIcon className="w-3.5 h-3.5" />
                                        {confirmedPhotos.has(fightPhotos[selectedPhotoIdx].name) ? "Confirmed Ready" : "Mark for Posting"}
                                    </button>
                                    <button 
                                        onClick={() => { window.open(fightPhotos[selectedPhotoIdx].url, '_blank'); }}
                                        className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-white transition-all"
                                        title="Open full size"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* THUMBNAIL GRID */}
                        <div className="grid grid-cols-3 gap-2">
                            {fightPhotos.map((photo, idx) => (
                                <button 
                                    key={idx} 
                                    onClick={() => setSelectedPhotoIdx(idx)}
                                    className={cn(
                                        "aspect-square rounded-xl overflow-hidden border-2 transition-all relative group",
                                        selectedPhotoIdx === idx ? "border-blue-500 scale-95 shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "border-white/5 grayscale group-hover:grayscale-0",
                                        confirmedPhotos.has(photo.name) && "border-blue-500/50 grayscale-0 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                    )}
                                >
                                    <img src={photo.url} className="w-full h-full object-cover" loading="lazy" />
                                    {confirmedPhotos.has(photo.name) && (
                                        <div className="absolute top-1 right-1 bg-blue-600 rounded-full p-0.5 border border-white/20">
                                            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                        <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mb-6"><FileWarning className="w-8 h-8 text-red-500/50" /></div>
                        {photoError ? (
                            <>
                                <h3 className="text-xs font-black uppercase text-red-500 mb-2">Folder Problem</h3>
                                <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed">{photoError}</p>
                            </>
                        ) : (
                            <>
                                <h3 className="text-xs font-black uppercase text-gray-500 mb-2">No Media Found</h3>
                                <p className="text-[10px] text-gray-600 font-bold uppercase leading-relaxed">Add images to folder "{currentFight?.No}" inside AppMaster.</p>
                            </>
                        )}
                        <div className="mt-8 p-4 bg-white/5 rounded-xl border border-dashed border-white/10 w-full">
                            <p className="text-[9px] text-gray-500 font-black uppercase mb-1">Backup: Drag & Drop</p>
                            <p className="text-[8px] text-gray-400 font-medium">Drop photos directly here</p>
                        </div>
                    </div>
                )}
            </div>
        </aside>
      </main>

      {/* EVENT SELECTOR MODAL */}
      {showEventSelector && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
              <div className="bg-[#12141c] max-w-2xl w-full rounded-3xl border-4 border-white/5 shadow-2xl overflow-hidden">
                  <div className="p-8 border-b border-white/5 flex justify-between items-center"><h2 className="text-2xl font-black uppercase italic text-white leading-none">Global Event History</h2><button onClick={() => setShowEventSelector(false)} className="text-gray-500 hover:text-red-500"><Monitor className="w-6 h-6"/></button></div>
                  <div className="p-4 bg-black/30"><div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600"/><input type="text" placeholder="Search archive..." className="w-full bg-black/40 border border-white/5 rounded-xl pl-11 pr-4 py-3 text-xs font-bold outline-none uppercase italic focus:border-red-600" /></div></div>
                  <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                       {Object.values(eventsList).length === 0 ? (
                            <div className="text-center py-20 text-gray-600 font-black uppercase tracking-[0.3em] text-[10px]">No archives found</div>
                       ) : (
                           Object.values(eventsList).sort((a,b) => b.info.date.localeCompare(a.info.date)).map(ev => (
                               <div key={ev.id} className="relative group p-1">
                                    <button onClick={() => { setActiveEventId(ev.id); setSelectedFightIdx(0); setShowEventSelector(false); }} className={cn("w-full p-6 rounded-2xl border transition-all flex items-center justify-between", activeEventId === ev.id ? "bg-red-600 border-red-500 shadow-xl" : "bg-white/5 border-white/5 hover:bg-white/10")}>
                                        <div className="flex items-center gap-6">
                                            <div className="bg-black/30 p-4 rounded-xl text-xs font-black text-gray-400">{ev.info.date.split('-')[2]}</div>
                                            <div className="text-left"><div className="text-lg font-black uppercase italic leading-none mb-1">{ev.info.name}</div><div className="flex items-center gap-4 text-[10px] text-gray-500 font-bold uppercase"><span className="flex items-center gap-1.5"><MapPin className="w-3 h-3"/> {ev.info.location}</span><span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3"/> {ev.fights.length} FIGHTS</span></div></div>
                                        </div>
                                        <ChevronRight className={cn("w-6 h-6 transition-all", activeEventId === ev.id ? "text-white" : "text-gray-700 opacity-0 group-hover:opacity-100 group-hover:translate-x-2")} />
                                    </button>
                                    <div className="absolute right-6 bottom-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                        <button onClick={(e) => { e.stopPropagation(); deleteEvent(ev.id); }} className="p-2 bg-black/40 rounded-lg text-red-500 hover:bg-red-600 hover:text-white transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                               </div>
                           ))
                       )}
                  </div>
              </div>
          </div>
      )}

      {/* NEW/EDIT EVENT SETUP MODAL */}
      {showEventModal && (
          <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl animate-in zoom-in-95 duration-200">
              <div className="bg-[#12141c] max-md w-full rounded-3xl border-4 border-white/10 shadow-[0_0_100px_rgba(220,38,38,0.2)] p-10 space-y-8 text-center relative">
                  <button onClick={() => setShowEventModal(false)} className="absolute right-6 top-6 text-gray-600 hover:text-white"><Monitor className="w-5 h-5"/></button>
                  <div className="mx-auto w-20 h-20 bg-red-600 rounded-2xl rotate-12 flex items-center justify-center shadow-2xl mb-8">{isEditingEvent ? <Edit2 className="w-10 h-10 text-white" /> : <Plus className="w-10 h-10 text-white" />}</div>
                  <div><h2 className="text-3xl font-black uppercase italic text-white leading-none mb-2">{isEditingEvent ? "Adjust Intel" : "Initialize Event"}</h2><p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em]">Configure fight synchronization</p></div>
                  <div className="space-y-4 text-left">
                      <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Event Title</label><input type="text" value={newEventInfo.name} onChange={(e) => setNewEventInfo({...newEventInfo, name: e.target.value})} placeholder="UAE WARRIORS 68" className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600 transition-all" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Date</label><input type="date" value={newEventInfo.date} onChange={(e) => setNewEventInfo({...newEventInfo, date: e.target.value})} className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600 [color-scheme:dark]" /></div>
                        <div className="space-y-1"><label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-2">Location</label><input type="text" value={newEventInfo.location} onChange={(e) => setNewEventInfo({...newEventInfo, location: e.target.value})} placeholder="ABU DHABI" className="w-full bg-black/60 border border-white/10 rounded-2xl px-6 py-4 text-white font-black outline-none focus:border-red-600" /></div>
                      </div>
                  </div>
                  <div className="space-y-3 pt-4">
                    {isEditingEvent ? (
                        <button onClick={saveEditedInfo} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-all shadow-xl">SAVE CHANGES</button>
                    ) : (
                        <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-black py-5 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl flex items-center justify-center gap-3"><Upload className="w-5 h-5"/> UPLOAD FIGHT CARD (CSV)</button>
                    )}
                    <button onClick={() => setShowEventModal(false)} className="w-full text-gray-600 font-black text-xs uppercase hover:text-white transition-colors">Abort setup</button>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
              </div>
          </div>
      )}
    </div>
  );
}
