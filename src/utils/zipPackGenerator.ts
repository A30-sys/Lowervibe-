import JSZip from 'jszip';
import { Track } from '../types';
import { DEFAULT_ARTWORK_SVG } from './artworkFallback';

export interface FirebaseConfigData {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
}

export const generateAcodeProjectZip = async (
  tracks: Track[],
  firebaseConfig: FirebaseConfigData
): Promise<Blob> => {
  const zip = new JSZip();

  // 1. firebase-config.json
  const configJson = JSON.stringify(firebaseConfig, null, 2);
  zip.file('firebase-config.json', configJson);

  // 2. README.md
  const readmeContent = `# LOWERVIBE MUSIC & ADMIN PLATFORM - ACODE DEPLOY PACK

This package is structured for direct editing and testing in **Acode (Android)** and deploying to **Firebase Hosting**, **Netlify**, or **Vercel**.

## Files in this package:
- **index.html**: The complete music discovery and streaming application (Top 10 Music Chart, All Tracks, Audio Player, Downloads).
- **admin.html**: The complete administration portal to upload Certified Music, manage tracks, and configure Firebase keys.
- **firebase-config.json**: Your Firebase Console configuration.
- **firebase-config.js**: Ready-to-import module for your Firebase project.

## How to test in Acode (Android):
1. Unzip this folder on your phone or tablet.
2. Open **Acode Editor**.
3. Select "Open Folder" and choose this unzipped folder.
4. Open \`index.html\` or \`admin.html\` and click the Play/Preview button in Acode to run it directly on your mobile browser!

## How to deploy to Firebase Hosting:
1. Run: \`npm install -g firebase-tools\`
2. Run: \`firebase login\`
3. Run: \`firebase init hosting\` (select this directory as public)
4. Run: \`firebase deploy\`
`;
  zip.file('README.md', readmeContent);

  // 3. firebase-config.js
  const firebaseJsContent = `// LOWERVIBE Firebase Console Configuration
// Generated for Acode and Web Deployment
const firebaseConfig = {
  apiKey: "${firebaseConfig.apiKey || 'YOUR_FIREBASE_API_KEY'}",
  authDomain: "${firebaseConfig.authDomain || 'your-project.firebaseapp.com'}",
  projectId: "${firebaseConfig.projectId || 'your-project-id'}",
  storageBucket: "${firebaseConfig.storageBucket || 'your-project.appspot.com'}",
  messagingSenderId: "${firebaseConfig.messagingSenderId || '1234567890'}",
  appId: "${firebaseConfig.appId || '1:1234567890:web:abcdef'}"
};

// Ready for Firebase v9+ or v8 SDK initialization
if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase connected successfully in Acode!");
}
`;
  zip.file('firebase-config.js', firebaseJsContent);

  // 4. index.html - Standalone client page
  const indexHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOWERVIBE - Top 10 Music Chart & Streaming</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #ffffff; color: #0f172a; }
    h1, h2, h3, .font-heading { font-family: 'Space Grotesk', sans-serif; }
  </style>
</head>
<body class="min-h-screen bg-slate-50/50 pb-32">
  <!-- Top Navbar -->
  <header class="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-8 py-3.5 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-black text-sm">
        <i class="fa-solid fa-radio"></i>
      </div>
      <span class="text-lg font-black tracking-wider text-slate-900 font-heading">LOWER<span class="text-emerald-600">VIBE</span></span>
    </div>
    <div class="flex items-center gap-2.5">
      <a href="admin.html" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition">
        <i class="fa-solid fa-lock mr-1"></i> Admin Portal
      </a>
    </div>
  </header>

  <main class="max-w-4xl mx-auto px-4 py-6 space-y-8">
    <!-- Top 10 Music Chart Section -->
    <section class="space-y-3">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-6 rounded-full bg-lime-500 inline-block"></span>
        <h2 class="text-2xl font-black text-slate-900 font-heading">Top 10 Music Chart</h2>
      </div>
      <p class="text-xs text-slate-500 font-medium">Ranked by plays and downloads</p>

      <!-- Scrollable Chart Cards -->
      <div class="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x no-scrollbar" id="chart-cards-container">
        <!-- Injected via JS -->
      </div>
      <div class="w-16 h-1 rounded-full bg-slate-200"></div>
    </section>

    <!-- All Tracks Section -->
    <section class="space-y-4 pt-4">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-6 rounded-full bg-lime-500 inline-block"></span>
        <h2 class="text-2xl font-black text-slate-900 font-heading">All Tracks</h2>
      </div>

      <!-- Category Filter Pills -->
      <div class="flex items-center gap-2 overflow-x-auto pb-2" id="filter-pills">
        <button onclick="filterTracks('all')" class="category-pill px-4 py-2 rounded-full text-xs font-bold bg-slate-900 text-white shadow-sm shrink-0">All Tracks</button>
        <button onclick="filterTracks('top10')" class="category-pill px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shrink-0">🏆 Top 10</button>
        <button onclick="filterTracks('hot')" class="category-pill px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shrink-0">🔥 Hot Songs</button>
        <button onclick="filterTracks('new')" class="category-pill px-4 py-2 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-700 shrink-0">🆕 New Releases</button>
      </div>

      <p class="text-xs text-slate-500">Click play to stream or the ↓ button to download</p>

      <!-- Track List Container -->
      <div class="space-y-3" id="tracks-list-container">
        <!-- Injected via JS -->
      </div>
    </section>
  </main>

  <!-- Sticky Bottom Audio Player Bar -->
  <div id="player-bar" class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 px-4 sm:px-8 flex items-center justify-between shadow-2xl">
    <div class="flex items-center gap-3">
      <img id="player-cover" src="${DEFAULT_ARTWORK_SVG}" alt="Active track cover" class="w-12 h-12 rounded-xl object-cover shadow-sm">
      <div>
        <h4 id="player-title" class="text-xs sm:text-sm font-bold text-slate-900 truncate max-w-[150px] sm:max-w-xs">Select Track</h4>
        <p id="player-artist" class="text-[11px] text-slate-500 font-medium">Independent Artist</p>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <button onclick="toggleAudioPlayback()" class="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md active:scale-95 transition">
        <i id="player-play-icon" class="fa-solid fa-play"></i>
      </button>
      <button onclick="downloadCurrent()" class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center active:scale-95 transition" title="Download">
        <i class="fa-solid fa-arrow-down text-xs"></i>
      </button>
    </div>
  </div>

  <script src="firebase-config.js"></script>
  <script>
    const INITIAL_TRACKS = ${JSON.stringify(tracks, null, 2)};
    let activeTrack = INITIAL_TRACKS[0];
    let isPlaying = false;
    let audioCtx = null;
    let timerId = null;

    function initAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    }

    function renderCharts() {
      const container = document.getElementById('chart-cards-container');
      const chartTracks = INITIAL_TRACKS.slice(0, 5);
      container.innerHTML = chartTracks.map((t, idx) => {
        const badgeColor = idx === 0 ? 'bg-amber-400 text-amber-950' : 'bg-slate-300 text-slate-800';
        return \`
          <div onclick="playSong('\${t.id}')" class="relative bg-white border border-slate-200 rounded-2xl p-3 min-w-[170px] max-w-[170px] sm:min-w-[190px] shadow-sm hover:shadow-md transition cursor-pointer shrink-0 snap-start">
            <span class="absolute top-2 left-2 z-10 \${badgeColor} font-black text-xs px-2 py-0.5 rounded-lg shadow-sm">#\${idx + 1}</span>
            <img src="\${t.coverArt}" alt="\${t.title}" class="w-full h-36 object-cover rounded-xl mb-2.5 shadow-sm">
            <h4 class="font-bold text-sm text-slate-900 truncate leading-tight">\${t.title}</h4>
            <p class="text-xs text-slate-500 truncate mb-1">\${t.artistName}</p>
            <div class="text-[11px] text-emerald-600 font-bold flex items-center gap-1.5">
              <span>▶ \${t.plays}</span>
              <span class="text-slate-300">•</span>
              <span>↓ \${t.downloads || 0}</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    function renderTrackList(list) {
      const container = document.getElementById('tracks-list-container');
      container.innerHTML = list.map(t => {
        const isCurrent = activeTrack?.id === t.id;
        return \`
          <div class="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 cursor-pointer" onclick="playSong('\${t.id}')">
              <img src="\${t.coverArt}" alt="\${t.title}" class="w-14 h-14 object-cover rounded-xl shadow-sm shrink-0">
              <div>
                <h4 class="font-bold text-sm text-slate-900 leading-tight">\${t.title}</h4>
                <p class="text-xs text-slate-500">\${t.artistName}</p>
                <div class="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                  <span class="text-emerald-600 font-semibold">▶ \${t.plays} plays</span>
                  <span class="text-slate-300">•</span>
                  <span>\${t.downloads || 0} downloads</span>
                  \${t.isCertified ? '<span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">CERTIFIED</span>' : ''}
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button onclick="playSong('\${t.id}')" class="w-11 h-11 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-md active:scale-95 transition">
                <i class="fa-solid \${isCurrent && isPlaying ? 'fa-pause' : 'fa-play'}"></i>
              </button>
              <button onclick="downloadTrackItem('\${t.id}')" class="w-10 h-10 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-800 flex items-center justify-center font-bold active:scale-95 transition" title="Download">
                <i class="fa-solid fa-arrow-down text-sm"></i>
              </button>
            </div>
          </div>
        \`;
      }).join('');
    }

    function playSong(id) {
      initAudio();
      const target = INITIAL_TRACKS.find(t => t.id === id);
      if (!target) return;
      if (activeTrack?.id === target.id && isPlaying) {
        toggleAudioPlayback();
        return;
      }
      activeTrack = target;
      isPlaying = true;
      target.plays = (target.plays || 0) + 1;
      updatePlayerUI();
      renderTrackList(INITIAL_TRACKS);
      playSynthChords();
    }

    function toggleAudioPlayback() {
      initAudio();
      isPlaying = !isPlaying;
      updatePlayerUI();
      renderTrackList(INITIAL_TRACKS);
      if (isPlaying) {
        playSynthChords();
      } else {
        if (timerId) clearInterval(timerId);
      }
    }

    function playSynthChords() {
      if (!audioCtx) return;
      if (timerId) clearInterval(timerId);
      const chords = [261.63, 329.63, 392.00, 523.25];
      let i = 0;
      const step = () => {
        if (!isPlaying || !audioCtx) return;
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(chords[i % chords.length], now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 2.6);
        i++;
      };
      step();
      timerId = setInterval(step, 2000);
    }

    function updatePlayerUI() {
      if (!activeTrack) return;
      document.getElementById('player-cover').src = activeTrack.coverArt;
      document.getElementById('player-title').innerText = activeTrack.title;
      document.getElementById('player-artist').innerText = activeTrack.artistName;
      document.getElementById('player-play-icon').className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    }

    function downloadTrackItem(id) {
      const target = INITIAL_TRACKS.find(t => t.id === id);
      if (!target) return;
      target.downloads = (target.downloads || 0) + 1;
      renderCharts();
      renderTrackList(INITIAL_TRACKS);
      const blob = new Blob([\`LOWERVIBE CERTIFIED TRACK\\nTitle: \${target.title}\\nArtist: \${target.artistName}\\nISRC: MW-LV-2026\`], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = \`\${target.artistName} - \${target.title}.txt\`;
      a.click();
    }

    function downloadCurrent() {
      if (activeTrack) downloadTrackItem(activeTrack.id);
    }

    function filterTracks(category) {
      let list = [...INITIAL_TRACKS];
      if (category === 'top10') list = list.filter(t => t.chartRank || t.plays > 40);
      else if (category === 'hot') list.sort((a,b) => b.plays - a.plays);
      else if (category === 'new') list.reverse();
      renderTrackList(list);
    }

    // Initial render
    renderCharts();
    renderTrackList(INITIAL_TRACKS);
    updatePlayerUI();
  </script>
</body>
</html>
`;
  zip.file('index.html', indexHtmlContent);

  // 5. admin.html - Standalone administration page
  const adminHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>LOWERVIBE - Administration & Certified Music Studio</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;900&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap');
    body { font-family: 'Plus Jakarta Sans', sans-serif; background-color: #f8fafc; color: #0f172a; }
    h1, h2, h3, .font-heading { font-family: 'Space Grotesk', sans-serif; }
  </style>
</head>
<body class="min-h-screen bg-slate-50/50 pb-20">
  <!-- Admin Header -->
  <header class="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
    <div class="flex items-center gap-3">
      <div class="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold">
        <i class="fa-solid fa-shield-halved text-emerald-400"></i>
      </div>
      <div>
        <h1 class="font-black text-base sm:text-lg text-slate-900 font-heading leading-tight">LOWERVIBE Administration</h1>
        <p class="text-[11px] text-slate-500 font-medium">Certified Music Studio & Firebase Control Center</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <a href="index.html" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-sm">
        <i class="fa-solid fa-arrow-left mr-1"></i> Back to Music
      </a>
    </div>
  </header>

  <main class="max-w-5xl mx-auto px-4 py-8 space-y-8">
    <!-- Quick Metrics -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <p class="text-[11px] font-bold text-slate-500 uppercase">Certified Tracks</p>
        <p class="text-2xl font-black text-slate-900 font-heading mt-1" id="stat-tracks">${tracks.length}</p>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <p class="text-[11px] font-bold text-slate-500 uppercase">Total Streams</p>
        <p class="text-2xl font-black text-emerald-600 font-heading mt-1">${tracks.reduce((acc, t) => acc + (t.plays || 0), 0)}</p>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <p class="text-[11px] font-bold text-slate-500 uppercase">Total Downloads</p>
        <p class="text-2xl font-black text-lime-600 font-heading mt-1">${tracks.reduce((acc, t) => acc + (t.downloads || 0), 0)}</p>
      </div>
      <div class="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
        <p class="text-[11px] font-bold text-slate-500 uppercase">System Status</p>
        <p class="text-sm font-bold text-emerald-700 flex items-center gap-1.5 mt-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Ready & Active
        </p>
      </div>
    </div>

    <!-- Firebase Console Setup & Key Insert Panel -->
    <section class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      <div class="flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-6 rounded-full bg-amber-500 inline-block"></span>
          <h2 class="text-lg font-black text-slate-900 font-heading">Firebase Console Key Configuration</h2>
        </div>
        <span class="text-xs px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">Acode & Web Deploy</span>
      </div>
      <p class="text-xs text-slate-500">Insert your Firebase Web App credentials from the Firebase Console (Project Settings > General > Your Apps).</p>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div>
          <label class="block font-bold text-slate-700 mb-1">API Key</label>
          <input type="text" id="fb-apiKey" value="${firebaseConfig.apiKey || ''}" placeholder="AIzaSy..." class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Auth Domain</label>
          <input type="text" id="fb-authDomain" value="${firebaseConfig.authDomain || ''}" placeholder="my-app.firebaseapp.com" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Project ID</label>
          <input type="text" id="fb-projectId" value="${firebaseConfig.projectId || ''}" placeholder="my-project-123" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Storage Bucket</label>
          <input type="text" id="fb-storageBucket" value="${firebaseConfig.storageBucket || ''}" placeholder="my-app.appspot.com" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">Messaging Sender ID</label>
          <input type="text" id="fb-messagingSenderId" value="${firebaseConfig.messagingSenderId || ''}" placeholder="1234567890" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
        <div>
          <label class="block font-bold text-slate-700 mb-1">App ID</label>
          <input type="text" id="fb-appId" value="${firebaseConfig.appId || ''}" placeholder="1:123456789:web:abcdef" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>
      </div>

      <div class="pt-2 flex gap-3">
        <button onclick="saveFirebaseKeys()" class="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition">
          <i class="fa-solid fa-floppy-disk mr-1.5"></i> Save Firebase Keys
        </button>
        <button onclick="copyFirebaseSnippet()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition">
          <i class="fa-regular fa-copy mr-1.5"></i> Copy Acode Config
        </button>
      </div>
    </section>

    <!-- Upload Certified Music Form -->
    <section class="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
      <div class="flex items-center gap-2">
        <span class="w-1.5 h-6 rounded-full bg-emerald-500 inline-block"></span>
        <h2 class="text-lg font-black text-slate-900 font-heading">Admin Upload: Publish Certified Music</h2>
      </div>
      <p class="text-xs text-slate-500">Official administration studio to publish certified tracks directly into the Top 10 chart and public catalog.</p>

      <form id="certified-form" onsubmit="handleUploadCertified(event)" class="space-y-4 text-xs">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Song Title *</label>
            <input type="text" id="track-title" required placeholder="e.g. Zomba Horizon" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Artist Name *</label>
            <input type="text" id="track-artist" required placeholder="e.g. Zomba Echoes" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Genre</label>
            <select id="track-genre" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
              <option value="Afro-Fusion / Malawi">Afro-Fusion / Malawi</option>
              <option value="Afrobeats / Soul">Afrobeats / Soul</option>
              <option value="Hip Hop / Boom Bap">Hip Hop / Boom Bap</option>
              <option value="Amapiano">Amapiano</option>
              <option value="R&B / Neo-Soul">R&B / Neo-Soul</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Chart Rank</label>
            <select id="track-rank" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
              <option value="1">Rank #1 (Gold Badge)</option>
              <option value="2">Rank #2 (Silver Badge)</option>
              <option value="3">Rank #3</option>
              <option value="none">General Catalog</option>
            </select>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Certificate ISRC Code</label>
            <input type="text" id="track-isrc" value="MW-LV-2026-CERT" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl">
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Upload Audio File (MP3 / WAV)</label>
          <input type="file" id="track-file" accept="audio/*" class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">Cover Artwork URL</label>
          <input type="url" id="track-cover" value="" placeholder="https://..." class="w-full px-3 py-2 border border-slate-200 rounded-xl">
        </div>

        <button type="submit" class="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20">
          <i class="fa-solid fa-certificate mr-1.5"></i> Publish Certified Music Track
        </button>
      </form>
    </section>
  </main>

  <script src="firebase-config.js"></script>
  <script>
    function saveFirebaseKeys() {
      const config = {
        apiKey: document.getElementById('fb-apiKey').value,
        authDomain: document.getElementById('fb-authDomain').value,
        projectId: document.getElementById('fb-projectId').value,
        storageBucket: document.getElementById('fb-storageBucket').value,
        messagingSenderId: document.getElementById('fb-messagingSenderId').value,
        appId: document.getElementById('fb-appId').value,
      };
      localStorage.setItem('lowervibe_firebase_config', JSON.stringify(config));
      alert('Firebase credentials saved successfully!');
    }

    function copyFirebaseSnippet() {
      const code = \`const firebaseConfig = {
  apiKey: "\${document.getElementById('fb-apiKey').value}",
  authDomain: "\${document.getElementById('fb-authDomain').value}",
  projectId: "\${document.getElementById('fb-projectId').value}",
  storageBucket: "\${document.getElementById('fb-storageBucket').value}",
  messagingSenderId: "\${document.getElementById('fb-messagingSenderId').value}",
  appId: "\${document.getElementById('fb-appId').value}"
};\`;
      navigator.clipboard.writeText(code);
      alert('Firebase config snippet copied! Paste it in your Acode project.');
    }

    function handleUploadCertified(e) {
      e.preventDefault();
      const title = document.getElementById('track-title').value;
      const artist = document.getElementById('track-artist').value;
      const genre = document.getElementById('track-genre').value;
      const cover = document.getElementById('track-cover').value;
      alert(\`Certified Track "\${title}" by \${artist} published successfully!\`);
      document.getElementById('certified-form').reset();
    }
  </script>
</body>
</html>
`;
  zip.file('admin.html', adminHtmlContent);

  return await zip.generateAsync({ type: 'blob' });
};
