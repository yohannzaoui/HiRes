const player = document.getElementById('player');
const playPauseBtn = document.getElementById('play-pause-btn');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const volumeBar = document.getElementById('volume-bar');
const volumeContainer = document.getElementById('volume-container');
const playlistContainer = document.getElementById('playlist');
const fileInput = document.getElementById('file-input');
const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');

let audioCtx, source, analyzer, dataArray;
let isVisualizerSetup = false;
let isVisualizerEnabled = true;
let playlist = [];
let currentIndex = 0;
let isShuffle = false;
let repeatMode = 'OFF';

window.addEventListener('resize', resizeCanvas);
function resizeCanvas() {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
}
resizeCanvas();

function setupVisualizer() {
    if (isVisualizerSetup) return;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(player);
        analyzer = audioCtx.createAnalyser();
        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);
        analyzer.fftSize = 64; 
        dataArray = new Uint8Array(analyzer.frequencyBinCount);
        isVisualizerSetup = true;
        draw();
    } catch (e) { console.error("AudioContext error:", e); }
}

function draw() {
    requestAnimationFrame(draw);
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    if (!isVisualizerEnabled || !isVisualizerSetup) return;
    analyzer.getByteFrequencyData(dataArray);
    const barWidth = (canvas.width / dataArray.length) - 2;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
        let barHeight = (dataArray[i] / 255) * canvas.height;
        canvasCtx.fillStyle = '#d4af37';
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 2;
    }
}

function extractMetadata(file) {
    jsmediatags.read(file, {
        onSuccess: function(tag) {
            const t = tag.tags;
            document.getElementById('artist-name').innerText = t.artist || "Unknown Artist";
            document.getElementById('format-badge').innerText = file.name.split('.').pop();
            document.getElementById('format-badge').style.display = 'inline-block';
            if (t.picture) {
                const { data, format } = t.picture;
                let base64String = "";
                for (let i = 0; i < data.length; i++) base64String += String.fromCharCode(data[i]);
                document.getElementById('album-art').src = `data:${format};base64,${window.btoa(base64String)}`;
                document.getElementById('art-container').style.display = 'block';
            } else { document.getElementById('art-container').style.display = 'none'; }
        },
        onError: function() {
            document.getElementById('artist-name').innerText = "";
            document.getElementById('art-container').style.display = 'none';
        }
    });
}

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const wasEmpty = (playlist.length === 0);
    files.forEach(f => playlist.push({ name: f.name.replace(/\.[^/.]+$/, ""), url: URL.createObjectURL(f), file: f }));
    renderPlaylist();
    if (wasEmpty && playlist.length > 0) playTrack(0);
});

function renderPlaylist() {
    playlistContainer.innerHTML = '';
    playlist.forEach((t, i) => {
        const div = document.createElement('div');
        div.className = `playlist-item ${i === currentIndex ? 'active' : ''}`;
        div.innerText = `${i + 1}. ${t.name}`;
        div.onclick = () => playTrack(i);
        playlistContainer.appendChild(div);
    });
}

function playTrack(idx) {
    if (!playlist[idx]) return;
    if (!isVisualizerSetup) setupVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    currentIndex = idx;
    player.src = playlist[idx].url;
    player.play();
    playPauseBtn.innerText = 'PAUSE';
    document.getElementById('file-name').innerText = playlist[idx].name;
    extractMetadata(playlist[idx].file);
    renderPlaylist();
}

playPauseBtn.onclick = () => {
    if (!player.src && playlist.length > 0) { playTrack(0); return; }
    if (!player.src) return;
    if (!isVisualizerSetup) setupVisualizer();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    player.paused ? (player.play(), playPauseBtn.innerText = 'PAUSE') : (player.pause(), playPauseBtn.innerText = 'PLAY');
};

// --- LOGIQUE NEXT/PREV MODIFIÉE ---
function nextTrack() {
    if (playlist.length === 0) return;
    // Si REPEAT:ONE est actif, on recommence la même piste
    if (repeatMode === 'ONE') {
        playTrack(currentIndex);
    } else {
        let next = (currentIndex + 1) % playlist.length;
        if (isShuffle) next = Math.floor(Math.random() * playlist.length);
        playTrack(next);
    }
}

function prevTrack() {
    if (playlist.length === 0) return;
    // Si REPEAT:ONE est actif, on recommence la même piste
    if (repeatMode === 'ONE') {
        playTrack(currentIndex);
    } else {
        playTrack((currentIndex - 1 + playlist.length) % playlist.length);
    }
}

player.onended = () => {
    if (repeatMode === 'ONE') playTrack(currentIndex);
    else nextTrack();
};

player.ontimeupdate = () => {
    if (!player.duration) return;
    progressBar.style.width = (player.currentTime / player.duration) * 100 + '%';
    document.getElementById('current-time').innerText = formatTime(player.currentTime);
    document.getElementById('duration').innerText = formatTime(player.duration);
};

function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

progressContainer.onclick = (e) => {
    player.currentTime = ((e.clientX - progressContainer.getBoundingClientRect().left) / progressContainer.offsetWidth) * player.duration;
};

volumeContainer.onclick = (e) => {
    let vol = (e.clientX - volumeContainer.getBoundingClientRect().left) / volumeContainer.offsetWidth;
    player.volume = Math.max(0, Math.min(1, vol));
    volumeBar.style.width = (player.volume * 100) + '%';
    document.getElementById('volume-percent').innerText = Math.round(player.volume * 100) + '%';
};

function toggleVisualizer() {
    isVisualizerEnabled = !isVisualizerEnabled;
    const btn = document.getElementById('vu-toggle-btn');
    btn.classList.toggle('vu-active', isVisualizerEnabled);
    btn.innerText = isVisualizerEnabled ? "VU: ON" : "VU: OFF";
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    const btn = document.getElementById('shuffle-btn');
    btn.classList.toggle('shuffle-active', isShuffle);
    btn.innerText = isShuffle ? "SHUFFLE: ON" : "SHUFFLE: OFF";
}

function toggleRepeat() {
    const btn = document.getElementById('repeat-btn');
    btn.classList.remove('rep-one', 'rep-all');
    if (repeatMode === 'OFF') { repeatMode = 'ONE'; btn.innerText = "REPEAT: ONE"; btn.classList.add('rep-one'); }
    else if (repeatMode === 'ONE') { repeatMode = 'ALL'; btn.innerText = "REPEAT: ALL"; btn.classList.add('rep-all'); }
    else { repeatMode = 'OFF'; btn.innerText = "REPEAT: OFF"; }
}

function toggleMute() {
    player.muted = !player.muted;
    const btn = document.getElementById('mute-btn');
    btn.classList.toggle('mute-active', player.muted);
    btn.innerText = player.muted ? "MUTE: ON" : "MUTE: OFF";
}

function clearPlaylist() { 
    playlist = []; player.pause(); player.src = ""; renderPlaylist(); 
    document.getElementById('file-name').innerText = "No track selected";
    document.getElementById('art-container').style.display = "none";
    document.getElementById('artist-name').innerText = "";
    document.getElementById('format-badge').style.display = "none";
}