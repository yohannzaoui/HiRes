const player = document.getElementById('player');
const playPauseBtn = document.getElementById('play-pause-btn');
const muteBtn = document.getElementById('mute-btn');
const progressBar = document.getElementById('progress-bar');
const progressContainer = document.getElementById('progress-container');
const volumeBar = document.getElementById('volume-bar');
const volumeContainer = document.getElementById('volume-container');
const volumePercent = document.getElementById('volume-percent');
const currentTimeDisp = document.getElementById('current-time');
const durationDisp = document.getElementById('duration');
const fileInput = document.getElementById('file-input');
const playlistContainer = document.getElementById('playlist');
const repeatBtn = document.getElementById('repeat-btn');

let playlist = [];
let currentIndex = 0;
let repeatMode = 'off';
let isDraggingVolume = false;
let currentArtUrl = null;

window.onload = () => {
    const settings = JSON.parse(localStorage.getItem('my_player_settings')) || {volume: 0.05};
    player.volume = settings.volume;
    updateVolumeUI(settings.volume);
};

function updateVolumeFromEvent(e) {
    const rect = volumeContainer.getBoundingClientRect();
    let offsetX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const vol = offsetX / rect.width;
    player.volume = vol;
    player.muted = false;
    updateVolumeUI(vol);
    muteBtn.classList.remove('mute-active');
    muteBtn.textContent = 'Mute: OFF';
    localStorage.setItem('my_player_settings', JSON.stringify({volume: vol}));
}

volumeContainer.onmousedown = (e) => { isDraggingVolume = true; updateVolumeFromEvent(e); };
window.onmousemove = (e) => { if (isDraggingVolume) updateVolumeFromEvent(e); };
window.onmouseup = () => { isDraggingVolume = false; };

function updateVolumeUI(v) {
    const pc = Math.round(v * 100);
    volumeBar.style.width = `${pc}%`;
    volumePercent.textContent = `${pc}%`;
}

function toggleMute() {
    player.muted = !player.muted;
    muteBtn.textContent = player.muted ? 'Mute: ON' : 'Mute: OFF';
    player.muted ? muteBtn.classList.add('mute-active') : muteBtn.classList.remove('mute-active');
    updateVolumeUI(player.muted ? 0 : player.volume);
}

fileInput.onchange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const startIdx = playlist.length;
    files.forEach((f, i) => {
        const itemIndex = startIdx + i;
        playlist.push({ file: f, displayName: f.name.replace(/\.[^/.]+$/, ""), artist: "Unknown Artist", format: f.name.split('.').pop().toUpperCase() });
        jsmediatags.read(f, {
            onSuccess: (tag) => {
                if (tag.tags.title) playlist[itemIndex].displayName = tag.tags.title;
                if (tag.tags.artist) playlist[itemIndex].artist = tag.tags.artist;
                renderPlaylist();
                if (itemIndex === currentIndex) updateInfoDisplay();
            },
            onError: () => renderPlaylist()
        });
    });
    renderPlaylist();
    if (startIdx === 0) playTrack(0);
    fileInput.value = "";
};

function playTrack(i) {
    if (i < 0 || i >= playlist.length) return;
    currentIndex = i;
    if (player.src) URL.revokeObjectURL(player.src);
    player.src = URL.createObjectURL(playlist[i].file);
    updateInfoDisplay();
    loadArt(playlist[i].file);
    player.play();
}

function loadArt(f) {
    const artImg = document.getElementById('album-art');
    const artContainer = document.getElementById('art-container');
    if (currentArtUrl) URL.revokeObjectURL(currentArtUrl);
    jsmediatags.read(f, {
        onSuccess: (tag) => {
            const p = tag.tags.picture;
            if (p) {
                const blob = new Blob([new Uint8Array(p.data)], { type: p.format });
                currentArtUrl = URL.createObjectURL(blob);
                artImg.src = currentArtUrl;
                artContainer.style.display = 'block';
            } else { artContainer.style.display = 'none'; }
        },
        onError: () => artContainer.style.display = 'none'
    });
}

function updateInfoDisplay() {
    const item = playlist[currentIndex];
    if (!item) return;
    document.getElementById('file-name').textContent = item.displayName;
    document.getElementById('artist-name').textContent = item.artist;
    const badge = document.getElementById('format-badge');
    badge.textContent = item.format;
    badge.style.display = 'inline-block';
    renderPlaylist();
}

player.ontimeupdate = () => {
    if (player.duration) {
        progressBar.style.width = `${(player.currentTime / player.duration) * 100}%`;
        currentTimeDisp.textContent = formatTime(player.currentTime);
        durationDisp.textContent = formatTime(player.duration);
    }
};

progressContainer.onclick = (e) => {
    if(player.duration) {
        const rect = progressContainer.getBoundingClientRect();
        player.currentTime = ((e.clientX - rect.left) / rect.width) * player.duration;
    }
};

function nextTrack() {
    if (repeatMode === 'one' && playlist.length > 0) playTrack(currentIndex);
    else if (currentIndex < playlist.length - 1) playTrack(currentIndex + 1);
    else if (repeatMode === 'all') playTrack(0);
}

function prevTrack() { if (currentIndex > 0) playTrack(currentIndex - 1); }

function toggleRepeat() {
    repeatBtn.classList.remove('rep-one', 'rep-all');
    if (repeatMode === 'off') {
        repeatMode = 'all';
        repeatBtn.textContent = 'Rep: ALL';
        repeatBtn.classList.add('rep-all');
    } else if (repeatMode === 'all') {
        repeatMode = 'one';
        repeatBtn.textContent = 'Rep: ONE';
        repeatBtn.classList.add('rep-one');
    } else {
        repeatMode = 'off';
        repeatBtn.textContent = 'Rep: OFF';
    }
}

player.onended = () => {
    if (repeatMode === 'one') {
        player.currentTime = 0;
        player.play();
    } else {
        nextTrack();
    }
};

playPauseBtn.onclick = () => { if(player.src) player.paused ? player.play() : player.pause(); };
player.onplay = () => playPauseBtn.textContent = 'PAUSE';
player.onpause = () => playPauseBtn.textContent = 'PLAY';

function renderPlaylist() {
    playlistContainer.innerHTML = '';
    playlist.forEach((item, i) => {
        const div = document.createElement('div');
        div.className = `playlist-item text-truncate ${i === currentIndex ? 'active' : ''}`;
        div.textContent = `${i + 1}. ${item.displayName}`;
        div.onclick = () => playTrack(i);
        playlistContainer.appendChild(div);
    });
}

function formatTime(t) { const m = Math.floor(t/60), s = Math.floor(t%60); return `${m}:${s<10?'0'+s:s}`; }
function shufflePlaylist() { if(playlist.length > 0) { playlist.sort(() => Math.random() - 0.5); playTrack(0); } }
function clearPlaylist() { 
    playlist = []; currentIndex = 0; player.pause(); player.src = ''; 
    document.getElementById('file-name').textContent = "No track selected";
    document.getElementById('artist-name').textContent = "";
    document.getElementById('format-badge').style.display = 'none';
    document.getElementById('art-container').style.display = 'none';
    renderPlaylist(); 
}