
/* Hi‑Res Web Player – Pure HTML/CSS/JS (Web Audio API)
   Limitations : pas de bit‑perfect ni contrôle direct du périphérique.
*/
let audioCtx;
let gainNode;
let analyser;
let sourceNode = null;
let currentBuffer = null;
let startTime = 0;
let pauseOffset = 0;
let isPlaying = false;
let playlist = []; // [{name, file|handle, url?, buffer, duration, sampleRate}]
let currentIndex = -1;

const els = {
  fileInput: document.getElementById('fileInput'),
  openFilesBtn: document.getElementById('openFilesBtn'),
  openDirBtn: document.getElementById('openDirBtn'),
  trackList: document.getElementById('trackList'),
  trackTitle: document.getElementById('trackTitle'),
  trackMeta: document.getElementById('trackMeta'),
  playPauseBtn: document.getElementById('playPauseBtn'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn'),
  seekBar: document.getElementById('seekBar'),
  volume: document.getElementById('volume'),
  sampleInfo: document.getElementById('sampleInfo'),
  ctxState: document.getElementById('ctxState'),
  currentTime: document.getElementById('currentTime'),
  duration: document.getElementById('duration'),
  visualizer: document.getElementById('visualizer'),
};
const canvasCtx = els.visualizer.getContext('2d');

function fmtTime(sec) {
  sec = Math.max(0, sec|0);
  const m = (sec/60)|0; const s = sec % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'playback', // privilégie la qualité
    });
    gainNode = audioCtx.createGain();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;

    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);

    els.ctxState.textContent = `AudioContext : ${audioCtx.state}, output ~${audioCtx.sampleRate} Hz`;
    audioCtx.onstatechange = () => {
      els.ctxState.textContent = `AudioContext : ${audioCtx.state}, output ~${audioCtx.sampleRate} Hz`;
    };
    drawVisualizer();
  }
}

function drawVisualizer() {
  const W = els.visualizer.width, H = els.visualizer.height;
  const data = new Uint8Array(analyser.frequencyBinCount);

  function loop() {
    requestAnimationFrame(loop);
    canvasCtx.clearRect(0,0,W,H);
    // Spectre:
    analyser.getByteFrequencyData(data);
    const barW = Math.max(1, W / data.length);
    for (let i=0;i<data.length;i++) {
      const v = data[i]/255;
      const h = v*H;
      canvasCtx.fillStyle = `hsl(${Math.round(200 + 100*v)}, 70%, ${Math.round(35+30*v)}%)`;
      canvasCtx.fillRect(i*barW, H-h, barW, h);
    }
  }
  loop();
}

// --- Playlist UI ---
function renderPlaylist() {
  els.trackList.innerHTML = '';
  playlist.forEach((t, idx) => {
    const li = document.createElement('li');
    const left = document.createElement('div');
    left.innerHTML = `<strong>${t.name}</strong><br><span style="color:#a6a6ad;font-size:12px">${t.sampleRate? t.sampleRate+' Hz' : '—'} • ${t.duration? fmtTime(t.duration) : '—'}</span>`;
    const right = document.createElement('div');
    right.textContent = idx === currentIndex ? '▶' : '';
    li.appendChild(left); li.appendChild(right);

    li.className = idx === currentIndex ? 'active' : '';
    li.addEventListener('click', () => playIndex(idx));
    els.trackList.appendChild(li);
  });
}

function updateNowPlaying() {
  const t = playlist[currentIndex];
  els.trackTitle.textContent = t ? t.name : '–';
  els.trackMeta.textContent = t && t.sampleRate
    ? `${(t.sampleRate/1000).toFixed(0)} kHz • ${t.channels||2} ch`
    : '—';
  els.sampleInfo.textContent = t && t.sampleRate ? `Sample rate : ${t.sampleRate} Hz` : `Sample rate : —`;
  els.duration.textContent = t?.duration ? fmtTime(t.duration) : '0:00';
  renderPlaylist();
}

async function decodeFile(file) {
  ensureAudioContext();
  const arrayBuf = await file.arrayBuffer();
  // decodeAudioData supporte WAV/AIFF/MP3/AAC/OGG/Opus et parfois FLAC selon navigateur
  const buf = await audioCtx.decodeAudioData(arrayBuf);
  return buf;
}

async function loadTrack(idx) {
  const item = playlist[idx];
  if (!item) return;
  // Si déjà décodé :
  if (item.buffer) return item.buffer;

  let file;
  if (item.file) {
    file = item.file;
  } else if (item.handle && item.handle.getFile) {
    file = await item.handle.getFile();
  } else if (item.url) {
    const res = await fetch(item.url);
    const blob = await res.blob();
    file = new File([blob], item.name || 'stream', { type: blob.type });
  } else {
    throw new Error('Source inconnue');
  }

  const buffer = await decodeFile(file);
  item.buffer = buffer;
  item.duration = buffer.duration;
  item.sampleRate = buffer.sampleRate;
  item.channels = buffer.numberOfChannels;
  return buffer;
}

function connectSource(buffer, offsetSec=0) {
  stopPlayback(); // nettoie si existant

  sourceNode = audioCtx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.connect(gainNode);
  sourceNode.onended = handleEnded;

  startTime = audioCtx.currentTime - offsetSec;
  sourceNode.start(0, offsetSec);
  isPlaying = true;
  els.playPauseBtn.textContent = '⏸️';
}

function handleEnded() {
  // Si fin naturelle (pas stop manuel) -> piste suivante (gapless)
  if (isPlaying) next();
}

function stopPlayback() {
  try { sourceNode && sourceNode.stop(0); } catch {}
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  isPlaying = false;
}

async function playIndex(idx) {
  ensureAudioContext();
  if (idx < 0 || idx >= playlist.length) return;
  currentIndex = idx;
  pauseOffset = 0;
  const buf = await loadTrack(idx);
  connectSource(buf, 0);
  updateNowPlaying();
}

function playPause() {
  ensureAudioContext();
  if (!currentBuffer && currentIndex >= 0 && playlist[currentIndex]?.buffer) {
    currentBuffer = playlist[currentIndex].buffer;
  }
  const item = playlist[currentIndex];
  const buf = item?.buffer;

  if (!buf) return;
  if (isPlaying) {
    // pause
    pauseOffset = audioCtx.currentTime - startTime;
    stopPlayback();
    els.playPauseBtn.textContent = '▶️';
  } else {
    connectSource(buf, pauseOffset);
  }
}

function prev() {
  if (currentIndex > 0) playIndex(currentIndex - 1);
}
function next() {
  if (currentIndex < playlist.length - 1) playIndex(currentIndex + 1);
}

function tickProgress() {
  requestAnimationFrame(tickProgress);
  if (!audioCtx || currentIndex < 0) return;
  const t = playlist[currentIndex];
  if (!t?.buffer) return;

  let cur;
  if (isPlaying) {
    cur = audioCtx.currentTime - startTime;
  } else {
    cur = pauseOffset;
  }
  cur = Math.max(0, Math.min(cur, t.duration || 0));
  els.currentTime.textContent = fmtTime(cur);
  els.duration.textContent = t.duration ? fmtTime(t.duration) : '0:00';

  if (t.duration) {
    els.seekBar.value = Math.round(1000 * cur / t.duration);
  }
}
tickProgress();

els.seekBar.addEventListener('input', () => {
  const t = playlist[currentIndex];
  if (!t?.buffer || t.duration === 0) return;
  const target = (els.seekBar.value / 1000) * t.duration;
  // Recréer la source (AudioBufferSourceNode n’est pas repositionnable)
  const wasPlaying = isPlaying;
  stopPlayback();
  pauseOffset = target;
  if (wasPlaying) connectSource(t.buffer, pauseOffset);
  els.currentTime.textContent = fmtTime(target);
});

els.volume.addEventListener('input', () => {
  ensureAudioContext();
  gainNode.gain.value = parseFloat(els.volume.value);
});

els.playPauseBtn.addEventListener('click', playPause);
els.prevBtn.addEventListener('click', prev);
els.nextBtn.addEventListener('click', next);

els.openFilesBtn.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  addFilesToPlaylist(files);
});

els.openDirBtn.addEventListener('click', async () => {
  if (!window.showDirectoryPicker) {
    alert('L’ouverture de dossier nécessite Chrome/Edge (API File System Access).');
    return;
  }
  const dirHandle = await showDirectoryPicker();
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (handle.kind === 'file' && isAudioName(name)) entries.push({ name, handle });
  }
  playlist = playlist.concat(entries);
  if (currentIndex === -1 && playlist.length) currentIndex = 0;
  updateNowPlaying();
  renderPlaylist();
});

function addFilesToPlaylist(files) {
  const audioFiles = files.filter(f => isAudioName(f.name));
  const items = audioFiles.map(f => ({ name: f.name, file: f }));
  playlist = playlist.concat(items);
  if (currentIndex === -1 && playlist.length) currentIndex = 0;
  renderPlaylist();
  updateNowPlaying();
}

function isAudioName(name) {
  const n = name.toLowerCase();
  return /\.(wav|aiff?|flac|mp3|m4a|aac|ogg|opus)$/.test(n);
}

// Drag & Drop
document.addEventListener('dragover', (e) => { e.preventDefault(); });
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  addFilesToPlaylist(files);
});

// Auto‑play le premier élément si l’utilisateur clique Play
els.playPauseBtn.addEventListener('click', async () => {
  if (currentIndex === -1 && playlist.length) currentIndex = 0;
  const t = playlist[currentIndex];
  if (t && !t.buffer) await loadTrack(currentIndex);
});

// Démarrage audio sur interaction utilisateur (requis par politiques auto-play)
['click','keydown','touchstart'].forEach(ev => {
  window.addEventListener(ev, () => {
    if (audioCtx && audioCtx.state !== 'running') { audioCtx.resume(); }
  }, { once: true });
});
``
