const audio = document.querySelector('#audioElement');
const fileInput = document.querySelector('#fileInput');
const trackRows = document.querySelector('#trackRows');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');

const themeData = {
  clear: { label: 'Cielo despejado', sky: '#e6f5ff', deep: '#b8e1f5', pale: '#f8fcff', accent: '#e3ad4b', accentDeep: '#bf8124', accentSoft: '#fff0c8' },
  sunset: { label: 'Amanecer suave', sky: '#fff0df', deep: '#efb6a0', pale: '#fffaf5', accent: '#e27861', accentDeep: '#b9564c', accentSoft: '#ffe1c5' },
  night: { label: 'Noche estrellada', sky: '#dfe6fb', deep: '#9caeda', pale: '#f5f7ff', accent: '#dfb95e', accentDeep: '#926f2e', accentSoft: '#f9eabe', ink: '#26395f', inkSoft: '#7180a3', surface: 'rgba(255,255,255,.48)' },
  aurora: { label: 'Aurora boreal', sky: '#d9f5f2', deep: '#a6d7d4', pale: '#f6fffe', accent: '#48a995', accentDeep: '#267b70', accentSoft: '#c7eee5', ink: '#174e59', inkSoft: '#648b91' },
  cloud: { label: 'Día nublado', sky: '#e5edf1', deep: '#bdcdd5', pale: '#fafcfc', accent: '#d49356', accentDeep: '#a96334', accentSoft: '#f5dfcb', ink: '#3d5662', inkSoft: '#738993' },
  purple: { label: 'Violeta cósmico', sky: '#eee6ff', deep: '#c7b5ed', pale: '#fcfaff', accent: '#8861d8', accentDeep: '#6740a9', accentSoft: '#e7dcff', ink: '#39265c', inkSoft: '#7d6b9b' },
  fuchsia: { label: 'Fucsia eléctrico', sky: '#ffe3f2', deep: '#f1afd3', pale: '#fff8fc', accent: '#df4f9d', accentDeep: '#b52d78', accentSoft: '#ffd4e9', ink: '#602348', inkSoft: '#996281' }
};

const customThemeStorageKey = 'starseeked-custom-themes';
let customThemes = [];
let pendingCustomImage = '';
try {
  const storedCustomThemes = JSON.parse(localStorage.getItem(customThemeStorageKey) || '[]');
  customThemes = Array.isArray(storedCustomThemes) ? storedCustomThemes : [];
} catch {
  customThemes = [];
}

let tracks = [];
let currentIndex = -1;
let isShuffle = false;
let isRepeat = false;
let searchTerm = '';
let activeView = 'inicio';
let toastTimer;
let selectedThemeName = 'clear';
let selectedAccent = null;
let deferredInstallPrompt = null;
const libraryDbName = 'starseeked-library';
let libraryDbPromise;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installButton = $('#androidDownloadBtn');
  if (installButton) {
    installButton.href = '#';
    installButton.innerHTML = '<span>↧</span><span>Instalar en Android</span>';
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  showToast('starseeked se ha instalado en tu móvil.');
});

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !window.MediaMetadata || currentIndex < 0 || !tracks[currentIndex]) return;
  const track = tracks[currentIndex];
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: [{ src: 'icon.svg', sizes: '512x512', type: 'image/svg+xml' }]
  });
}

function updateMediaSessionPosition() {
  if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
  } catch {
    // Algunos navegadores móviles todavía no aceptan todos los estados de posición.
  }
}

function seekBy(seconds) {
  if (!Number.isFinite(audio.duration)) return;
  audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + seconds));
  updateMediaSessionPosition();
}

function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;
  const actions = {
    play: () => audio.play(),
    pause: () => audio.pause(),
    stop: () => { audio.pause(); audio.currentTime = 0; },
    previoustrack: playPrevious,
    nexttrack: playNext,
    seekbackward: () => seekBy(-10),
    seekforward: () => seekBy(10),
    seekto: (details) => {
      if (!Number.isFinite(audio.duration) || !Number.isFinite(details.seekTime)) return;
      audio.currentTime = details.seekTime;
      updateMediaSessionPosition();
    }
  };
  Object.entries(actions).forEach(([action, handler]) => {
    try { navigator.mediaSession.setActionHandler(action, handler); } catch { /* Acción no compatible en este navegador. */ }
  });
}

function getTitle(fileName) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Canción sin título';
}


function gradientFor(index) {
  const gradients = [
    'linear-gradient(145deg, #8fd9ed, #ecb66f)',
    'linear-gradient(145deg, #ef9c78, #7464a6)',
    'linear-gradient(145deg, #203b78, #8298db)',
    'linear-gradient(145deg, #3cae9c, #8065b2)',
    'linear-gradient(145deg, #afcfe0, #708fa4)'
  ];
  return gradients[index % gradients.length];
}

function renderTracks() {
  let visibleTracks = tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(searchTerm.toLowerCase()));
  if (activeView === 'favoritos') visibleTracks = visibleTracks.filter((track) => track.favorite);
  if (activeView === 'recientes') visibleTracks = visibleTracks.filter((track) => track.playedAt).sort((a, b) => b.playedAt - a.playedAt);
  trackRows.innerHTML = '';
  const emptyTitle = activeView === 'favoritos' ? 'Aún no tienes favoritos' : activeView === 'recientes' ? 'Aún no hay historial' : searchTerm ? 'No encontramos esa canción' : 'Aún no hay música en tu cielo';
  const emptyDescription = activeView === 'favoritos' ? 'Pulsa el corazón de una canción para guardarla aquí.' : activeView === 'recientes' ? 'Las canciones que escuches aparecerán en este espacio.' : searchTerm ? 'Prueba con otro título, artista o álbum.' : 'Sube archivos MP3, MP4 u otros formatos compatibles.';
  $('#emptyState h3').textContent = emptyTitle;
  $('#emptyState p').textContent = emptyDescription;
  $('#emptyState .small-button').hidden = Boolean(searchTerm || activeView === 'favoritos' || activeView === 'recientes');
  emptyState.hidden = visibleTracks.length !== 0;

  visibleTracks.forEach((track, visibleIndex) => {
    const actualIndex = tracks.indexOf(track);
    const row = document.createElement('div');
    row.className = `track-row${actualIndex === currentIndex ? ' active' : ''}`;
    row.innerHTML = `
      <span class="track-number">${String(visibleIndex + 1).padStart(2, '0')}</span>
      <button class="track-info" data-action="play" data-index="${actualIndex}" aria-label="Reproducir ${track.title}">
        <span class="track-cover" style="background:${track.gradient}">${actualIndex === currentIndex && !audio.paused ? '♫' : '♪'}</span>
        <span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span>
      </button>
      <span class="track-album">${escapeHtml(track.album)}</span>
      <span class="track-duration">${track.duration ? formatTime(track.duration) : '--:--'}</span>
      <button class="track-menu" data-action="favorite" data-index="${actualIndex}" aria-label="Añadir ${track.title} a favoritos">♡</button>`;
    trackRows.appendChild(row);
  });
  $('#trackCountLabel').textContent = `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}`;
  $('.storage-bar span').style.width = `${Math.min(100, Math.max(10, tracks.length * 8))}%`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function openLibraryDb() {
  if (libraryDbPromise) return libraryDbPromise;
  libraryDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(libraryDbName, 1);
    request.addEventListener('upgradeneeded', () => request.result.createObjectStore('tracks', { keyPath: 'id' }));
    request.addEventListener('success', () => resolve(request.result));
    request.addEventListener('error', () => reject(request.error));
  });
  return libraryDbPromise;
}

function saveTrackToLibrary(track) {
  return openLibraryDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readwrite');
    const { url, ...storedTrack } = track;
    transaction.objectStore('tracks').put(storedTrack);
    transaction.addEventListener('complete', resolve);
    transaction.addEventListener('error', () => reject(transaction.error));
  }));
}

function persistTrackState(track) {
  if (track) saveTrackToLibrary(track).catch(() => {});
}

async function loadStoredTracks() {
  try {
    const db = await openLibraryDb();
    const records = await new Promise((resolve, reject) => {
      const request = db.transaction('tracks', 'readonly').objectStore('tracks').getAll();
      request.addEventListener('success', () => resolve(request.result));
      request.addEventListener('error', () => reject(request.error));
    });
    tracks = records.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map((record) => ({ ...record, url: URL.createObjectURL(record.blob) }));
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  } catch {
    showToast('No se pudo abrir la biblioteca interna de starseeked.');
  }
}

function selectTrack(index, autoplay = true) {
  if (!tracks[index]) return;
  currentIndex = index;
  const track = tracks[index];
  audio.src = track.url;
  $('#nowTitle').textContent = track.title;
  $('#nowArtist').textContent = track.artist;
  $('#nowCover').style.background = track.gradient;
  $('#nowCover').innerHTML = '<span>♫</span>';
  $('#favoriteBtn').classList.toggle('liked', track.favorite);
  updateMediaSession();
  if (autoplay) audio.play().catch(() => showToast('Pulsa reproducir para comenzar la canción.'));
  renderTracks();
  updatePlayButton();
}

function updatePlayButton() {
  const isPlaying = !audio.paused && currentIndex >= 0;
  $('#playBtn').textContent = isPlaying ? 'Ⅱ' : '▶';
  $('#playBtn').setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
  if ('mediaSession' in navigator && currentIndex >= 0) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function playNext() {
  if (!tracks.length) return showToast('Añade canciones para llenar tu cola.');
  let nextIndex;
  if (isShuffle) nextIndex = Math.floor(Math.random() * tracks.length);
  else nextIndex = currentIndex < tracks.length - 1 ? currentIndex + 1 : 0;
  selectTrack(nextIndex);
}

function playPrevious() {
  if (!tracks.length) return showToast('Añade canciones para llenar tu cola.');
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  const previousIndex = currentIndex > 0 ? currentIndex - 1 : tracks.length - 1;
  selectTrack(previousIndex);
}

function getRealtimeThemeName() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'clear';
  if (hour >= 12 && hour < 18) return 'cloud';
  if (hour >= 18 && hour < 21) return 'sunset';
  return 'night';
}

function getRealtimeLabel() {
  return `Tiempo real · ${new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date())}`;
}

function getThemeByName(themeName) {
  return themeData[themeName] || customThemes.find((theme) => theme.id === themeName) || themeData.clear;
}

function hexToRgba(hex, alpha) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3 ? normalized.split('').map((part) => part + part).join('') : normalized;
  const number = Number.parseInt(value, 16);
  if (Number.isNaN(number)) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${number >> 16}, ${(number >> 8) & 255}, ${number & 255}, ${alpha})`;
}

function renderCustomThemes() {
  const list = $('#customThemeList');
  if (!list) return;
  list.innerHTML = customThemes.map((theme) => {
    const swatchStyle = theme.backgroundImage ? `background-image:url("${theme.backgroundImage}");` : `background:${theme.sky};`;
    return `<button class="saved-theme-button${selectedThemeName === theme.id ? ' active' : ''}" data-custom-theme="${escapeHtml(theme.id)}"><span class="saved-theme-swatch" style="${swatchStyle}"></span><span>${escapeHtml(theme.label)}</span></button>`;
  }).join('');
  list.querySelectorAll('[data-custom-theme]').forEach((button) => button.addEventListener('click', () => loadTheme(button.dataset.customTheme)));
}

function loadTheme(themeName, customAccent) {
  selectedThemeName = themeName;
  selectedAccent = customAccent || null;
  const resolvedThemeName = themeName === 'realtime' ? getRealtimeThemeName() : themeName;
  const theme = getThemeByName(resolvedThemeName);
  const root = document.documentElement;
  root.style.setProperty('--sky', theme.sky);
  root.style.setProperty('--sky-deep', theme.deep);
  root.style.setProperty('--sky-pale', theme.pale);
  root.style.setProperty('--accent', customAccent || theme.accent);
  root.style.setProperty('--accent-deep', theme.accentDeep);
  root.style.setProperty('--accent-soft', theme.accentSoft);
  root.style.setProperty('--ink', theme.ink || '#1b4057');
  root.style.setProperty('--ink-soft', theme.inkSoft || '#5e7c8d');
  root.style.setProperty('--surface', theme.surface || 'rgba(255, 255, 255, .58)');
  root.style.setProperty('--sky-image', theme.backgroundImage ? `url("${theme.backgroundImage}")` : 'none');
  $('#activeThemeLabel').textContent = themeName === 'realtime' ? getRealtimeLabel() : theme.label;
  $('#accentColor').value = customAccent || theme.accent;
  $('#accentHex').textContent = (customAccent || theme.accent).toUpperCase();
  $$('.theme-option').forEach((button) => button.classList.toggle('active', button.dataset.theme === themeName));
  $$('.mood-item').forEach((button) => button.classList.toggle('selected', button.dataset.theme === resolvedThemeName));
  renderCustomThemes();
  localStorage.setItem('cieloplay-theme', JSON.stringify({ name: themeName, accent: customAccent || null }));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme.sky);
}

function openDrawer() { $('#themeDrawer').classList.add('open'); $('#themeDrawer').setAttribute('aria-hidden', 'false'); }
function closeDrawer() { $('#themeDrawer').classList.remove('open'); $('#themeDrawer').setAttribute('aria-hidden', 'true'); }

async function importFiles(files) {
  const selectedFiles = [...files];
  const importedTracks = [];
  for (const [index, file] of selectedFiles.entries()) {
    const track = { id: `${file.name}-${file.lastModified}`, title: getTitle(file.name), artist: 'Tu biblioteca local', album: 'Archivos importados', blob: file, url: URL.createObjectURL(file), duration: 0, favorite: false, playedAt: 0, gradient: gradientFor(tracks.length + index), createdAt: Date.now() + index };
    try {
      await saveTrackToLibrary(track);
      tracks.push(track);
      importedTracks.push(track);
    } catch {
      URL.revokeObjectURL(track.url);
      showToast('No hay espacio suficiente para guardar esta canción en la app.');
    }
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.src = track.url;
    probe.addEventListener('loadedmetadata', () => { track.duration = probe.duration; saveTrackToLibrary(track).catch(() => {}); renderTracks(); });
  }
  renderTracks();
  if (importedTracks.length) { showToast(`${importedTracks.length} ${importedTracks.length === 1 ? 'canción añadida' : 'canciones añadidas'} a tu biblioteca interna.`); if (currentIndex < 0) selectTrack(tracks.indexOf(importedTracks[0]), false); }
}

$('#addMusicBtn').addEventListener('click', () => fileInput.click());
$('#emptyAddBtn').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (event) => { importFiles(event.target.files); event.target.value = ''; });
$('#heroPlayBtn').addEventListener('click', () => {
  if (currentIndex < 0) return fileInput.click();
  audio.play();
});
$('#playBtn').addEventListener('click', () => {
  if (currentIndex < 0) return fileInput.click();
  if (audio.paused) audio.play(); else audio.pause();
});
$('#nextBtn').addEventListener('click', playNext);
$('#previousBtn').addEventListener('click', playPrevious);
$('#shuffleBtn').addEventListener('click', (event) => { isShuffle = !isShuffle; event.currentTarget.classList.toggle('active', isShuffle); showToast(isShuffle ? 'Orden aleatorio activado.' : 'Orden aleatorio desactivado.'); });
$('#repeatBtn').addEventListener('click', (event) => { isRepeat = !isRepeat; event.currentTarget.classList.toggle('active', isRepeat); showToast(isRepeat ? 'Repetición activada.' : 'Repetición desactivada.'); });
$('#favoriteBtn').addEventListener('click', () => { if (currentIndex < 0) return; tracks[currentIndex].favorite = !tracks[currentIndex].favorite; persistTrackState(tracks[currentIndex]); $('#favoriteBtn').classList.toggle('liked', tracks[currentIndex].favorite); showToast(tracks[currentIndex].favorite ? 'Añadida a favoritos.' : 'Quitada de favoritos.'); renderTracks(); });
trackRows.addEventListener('click', (event) => { const target = event.target.closest('[data-action]'); if (!target) return; const index = Number(target.dataset.index); if (target.dataset.action === 'play') selectTrack(index); if (target.dataset.action === 'favorite') { tracks[index].favorite = !tracks[index].favorite; persistTrackState(tracks[index]); renderTracks(); } });
$('#progressRange').addEventListener('input', (event) => { if (audio.duration) audio.currentTime = (event.target.value / 100) * audio.duration; });
$('#volumeRange').addEventListener('input', (event) => { audio.volume = event.target.value; });
audio.volume = .8;
audio.addEventListener('loadedmetadata', () => { $('#totalTime').textContent = formatTime(audio.duration); updateMediaSessionPosition(); });
audio.addEventListener('timeupdate', () => { const progress = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0; $('#progressRange').value = progress; $('#currentTime').textContent = formatTime(audio.currentTime); updateMediaSessionPosition(); });
audio.addEventListener('play', () => { if (tracks[currentIndex]) { tracks[currentIndex].playedAt = Date.now(); persistTrackState(tracks[currentIndex]); } updateMediaSession(); updatePlayButton(); renderTracks(); });
audio.addEventListener('pause', () => { updatePlayButton(); renderTracks(); });
audio.addEventListener('ended', () => isRepeat ? (audio.currentTime = 0, audio.play()) : playNext());

$('#searchInput').addEventListener('input', (event) => { searchTerm = event.target.value; renderTracks(); });
$('#androidDownloadBtn').addEventListener('click', async (event) => {
  if (!deferredInstallPrompt) {
    showToast('La descarga del APK estará disponible desde Releases de GitHub.');
    return;
  }
  event.preventDefault();
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});
function changeView(view) {
  if (view === 'temas') {
    openDrawer();
    return;
  }
  activeView = view;
  $$('.nav-item[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const titles = { inicio: 'Escuchadas recientemente', biblioteca: 'Toda tu música', favoritos: 'Tus favoritos', recientes: 'Escuchadas recientemente' };
  $('#sectionTitle').textContent = titles[view] || titles.inicio;
  $('#librarySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderTracks();
}
$$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
document.addEventListener('keydown', (event) => { if (event.key === '/' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); $('#searchInput').focus(); } if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') { event.preventDefault(); $('#playBtn').click(); } });
$('#openThemeBtn').addEventListener('click', openDrawer); $('#inspirationThemeBtn').addEventListener('click', openDrawer); $('#closeThemeBtn').addEventListener('click', closeDrawer); $('#doneThemeBtn').addEventListener('click', () => { closeDrawer(); showToast('Tu cielo se ha guardado.'); }); $('#drawerBackdrop').addEventListener('click', closeDrawer);
$$('[data-theme]').forEach((button) => button.addEventListener('click', () => loadTheme(button.dataset.theme)));
$('#accentColor').addEventListener('input', (event) => { const current = JSON.parse(localStorage.getItem('cieloplay-theme') || '{"name":"clear"}'); loadTheme(current.name, event.target.value); });
$('#customThemeImage').addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    pendingCustomImage = '';
    event.target.value = '';
    $('#customThemeImageName').textContent = 'La imagen supera el límite de 2 MB.';
    showToast('Elige una imagen de 2 MB o menos.');
    return;
  }
  const reader = new FileReader();
  reader.addEventListener('load', () => {
    pendingCustomImage = reader.result;
    $('#customThemeImageName').textContent = `${file.name} · lista para guardar`;
  });
  reader.readAsDataURL(file);
});
$('#saveCustomThemeBtn').addEventListener('click', () => {
  const name = $('#customThemeName').value.trim() || 'Mi cielo';
  const sky = $('#customThemeSky').value;
  const surface = $('#customThemeSurface').value;
  const accent = $('#customThemeAccent').value;
  const theme = {
    id: `custom-${Date.now()}`,
    label: name,
    sky,
    deep: sky,
    pale: surface,
    accent,
    accentDeep: accent,
    accentSoft: hexToRgba(accent, .18),
    ink: '#1b4057',
    inkSoft: '#5e7c8d',
    surface: hexToRgba(surface, .76),
    backgroundImage: pendingCustomImage
  };
  customThemes.push(theme);
  localStorage.setItem(customThemeStorageKey, JSON.stringify(customThemes));
  renderCustomThemes();
  loadTheme(theme.id);
  $('#customThemeName').value = '';
  $('#customThemeImage').value = '';
  pendingCustomImage = '';
  $('#customThemeImageName').textContent = 'Opcional · máximo 2 MB';
  showToast(`Tema “${name}” guardado.`);
});
$('#animatedSky').addEventListener('change', (event) => { document.body.classList.toggle('reduced-motion', !event.target.checked); localStorage.setItem('cieloplay-animated', event.target.checked); });
$('#reducedMotion').addEventListener('change', (event) => { document.body.classList.toggle('reduced-motion', event.target.checked); localStorage.setItem('cieloplay-reduced', event.target.checked); });
$('#newPlaylistBtn').addEventListener('click', () => { const name = window.prompt('Nombre de tu nueva lista:'); if (!name?.trim()) return; const button = document.createElement('button'); button.className = 'nav-item playlist-item'; button.innerHTML = `<span class="playlist-dot" style="background:var(--accent)"></span>${escapeHtml(name.trim())}`; $('#playlistList').appendChild(button); showToast(`Lista “${name.trim()}” creada.`); });
$('#viewAllBtn').addEventListener('click', () => changeView('biblioteca'));
$('#queueBtn').addEventListener('click', () => { changeView('biblioteca'); showToast('Tu cola usa las canciones de tu biblioteca.'); });

const savedTheme = JSON.parse(localStorage.getItem('cieloplay-theme') || 'null');
loadTheme(savedTheme?.name || 'clear', savedTheme?.accent || undefined);
setInterval(() => { if (selectedThemeName === 'realtime') loadTheme('realtime', selectedAccent || undefined); }, 60000);
const reduced = localStorage.getItem('cieloplay-reduced') === 'true';
const animated = localStorage.getItem('cieloplay-animated');
$('#reducedMotion').checked = reduced;
$('#animatedSky').checked = animated === null ? true : animated === 'true';
document.body.classList.toggle('reduced-motion', reduced || animated === 'false');
setupMediaSession();
if ('serviceWorker' in navigator && ['http:', 'https:'].includes(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
loadStoredTracks().then(() => {
  renderTracks();
  if (tracks.length && currentIndex < 0) selectTrack(0, false);
});
