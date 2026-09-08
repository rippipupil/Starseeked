const audio = document.querySelector('#audioElement');
const fileInput = document.querySelector('#fileInput');
const trackRows = document.querySelector('#trackRows');
const emptyState = document.querySelector('#emptyState');
const toast = document.querySelector('#toast');

// Iconos SVG reutilizados donde antes había glifos unicode sueltos (♪ ♫ ♥ ♡ ▶ Ⅱ ＋ ☷ ✎ 🗑 ↑ ↓ × ›),
// para que coincidan con el sprite de <symbol> definido en index.html.
const icon = (id, solid = false) => `<svg class="icon${solid ? ' icon-solid' : ''}"><use href="#${id}" xlink:href="#${id}" /></svg>`;
const noteIcon = icon('i-note');
const sunIcon = icon('i-sun');
const heartIcon = icon('i-heart');
const heartFilledIcon = icon('i-heart-filled', true);
const playIcon = icon('i-play');
const pauseIcon = icon('i-pause');
const queueAddIcon = icon('i-plus');
const playlistAddIcon = icon('i-list-plus');
const editIcon = icon('i-edit');
const trashIcon = icon('i-trash');
const arrowUpIcon = icon('i-arrow-up');
const arrowDownIcon = icon('i-arrow-down');
const closeIcon = icon('i-close');
const chevronIcon = icon('i-chevron-right');
const moreIcon = icon('i-more');

const themeData = {
  clear: { label: 'Cielo despejado', sky: '#dff2ff', deep: '#b3ddf2', pale: '#f8fcff', accent: '#f0a93e', accentDeep: '#b97418', accentSoft: '#ffedc4', ink: '#12293f', inkSoft: '#5c7a8d' },
  sunset: { label: 'Amanecer suave', sky: '#fff0df', deep: '#efb6a0', pale: '#fffaf5', accent: '#e27861', accentDeep: '#b9564c', accentSoft: '#ffe1c5', ink: '#5b3628', inkSoft: '#8a6255' },
  night: { label: 'Noche estrellada', sky: '#dfe6fb', deep: '#9caeda', pale: '#f5f7ff', accent: '#dfb95e', accentDeep: '#926f2e', accentSoft: '#f9eabe', ink: '#26395f', inkSoft: '#7180a3', surface: 'color-mix(in srgb, var(--sky-deep) 30%, white 55%)' },
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
let activePlaylistId = '';
let toastTimer;
let selectedThemeName = 'clear';
let selectedAccent = null;
let deferredInstallPrompt = null;
const libraryDbName = 'starseeked-library';
let libraryDbPromise;
const playlistStorageKey = 'starseeked-playlists';
const queueStorageKey = 'starseeked-queue';
// Sin listas de muestra: tu biblioteca empieza vacía y creces tus propias
// listas desde "Mis listas".
const defaultPlaylists = [];
let playlists = loadPlaylists();
let queueIds = loadQueueIds();
let editingTrackId = '';
let pickerTrackIndex = -1;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function loadPlaylists() {
  try {
    const stored = JSON.parse(localStorage.getItem(playlistStorageKey) || 'null');
    if (Array.isArray(stored) && stored.length) return stored;
  } catch {
    // Si el almacenamiento no está disponible, se usan las listas iniciales.
  }
  return defaultPlaylists.map((playlist) => ({ ...playlist, trackIds: [] }));
}

function savePlaylists() {
  localStorage.setItem(playlistStorageKey, JSON.stringify(playlists));
}

function loadQueueIds() {
  try {
    const stored = JSON.parse(localStorage.getItem(queueStorageKey) || '[]');
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function saveQueue() {
  localStorage.setItem(queueStorageKey, JSON.stringify(queueIds));
}

function getQueueTracks() {
  const availableIds = new Set(tracks.map((track) => track.id));
  queueIds = queueIds.filter((id) => availableIds.has(id));
  return queueIds.map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
}

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

// Duración total de una lista, al estilo "3 h 12 min" / "42 min" (no tiene
// sentido mostrar segundos cuando se suman decenas de canciones).
function formatPlaylistDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

// Genera una portada de repuesto (para canciones sin carátula propia) a partir
// de los colores del tema activo, para que la notificación de Android y la
// pantalla de bloqueo cambien de color junto con el resto de la app.
let cachedArtwork = { key: '', url: '' };
function generateThemeArtwork() {
  try {
    const styles = getComputedStyle(document.documentElement);
    const sky = styles.getPropertyValue('--sky').trim() || '#dff2ff';
    const skyDeep = styles.getPropertyValue('--sky-deep').trim() || '#b3ddf2';
    const accent = styles.getPropertyValue('--accent').trim() || '#f0a93e';
    const accentDeep = styles.getPropertyValue('--accent-deep').trim() || '#b97418';
    const key = `${sky}|${skyDeep}|${accent}|${accentDeep}`;
    if (cachedArtwork.key === key) return cachedArtwork.url;
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    const backdrop = ctx.createLinearGradient(0, 0, size, size);
    backdrop.addColorStop(0, sky);
    backdrop.addColorStop(1, skyDeep);
    ctx.fillStyle = backdrop;
    ctx.fillRect(0, 0, size, size);
    const sun = ctx.createRadialGradient(size * .66, size * .36, size * .04, size * .66, size * .36, size * .34);
    sun.addColorStop(0, accent);
    sun.addColorStop(1, accentDeep);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(size * .66, size * .36, size * .19, 0, Math.PI * 2);
    ctx.fill();
    const url = canvas.toDataURL('image/png');
    cachedArtwork = { key, url };
    return url;
  } catch {
    return '';
  }
}

function updateMediaSession() {
  if (!('mediaSession' in navigator) || !window.MediaMetadata || currentIndex < 0 || !tracks[currentIndex]) return;
  const track = tracks[currentIndex];
  const artworkSrc = track.coverData || generateThemeArtwork() || 'icon.svg';
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album,
    artwork: [{ src: artworkSrc, sizes: '512x512', type: track.coverData ? 'image/*' : 'image/png' }]
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

function coverMarkup(track, iconHtml = noteIcon) {
  const style = track.coverData
    ? `background-image:url("${track.coverData}");background-size:cover;background-position:center;background-color:${track.gradient}`
    : `background:${track.gradient}`;
  return `<span class="track-cover${track.coverData ? ' has-cover' : ''}" style="${escapeHtml(style)}">${track.coverData ? '' : iconHtml}</span>`;
}

function applyCover(element, track, iconHtml = noteIcon) {
  if (!element) return;
  if (track?.coverData) {
    element.style.background = track.gradient;
    element.style.backgroundImage = `url("${track.coverData}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.innerHTML = '';
  } else {
    element.style.backgroundImage = '';
    element.style.backgroundSize = '';
    element.style.backgroundPosition = '';
    element.style.background = track?.gradient || '';
    element.innerHTML = `<span>${iconHtml}</span>`;
  }
}

// Miniatura de una lista: la portada elegida al crearla, o si no puso
// ninguna, el mismo degradado de color que ya se usaba como puntito plano.
function playlistCoverMarkup(playlist) {
  const style = playlist.cover ? `background-image:url("${playlist.cover}")` : '';
  return `<span class="playlist-cover-mini ${escapeHtml(playlist.color || 'aurora')}" style="${escapeHtml(style)}"></span>`;
}

function renderPlaylists() {
  const list = $('#playlistList');
  if (!list) return;
  list.innerHTML = playlists.map((playlist) => `<button class="nav-item playlist-item${activePlaylistId === playlist.id ? ' active' : ''}" data-playlist-id="${escapeHtml(playlist.id)}">${playlistCoverMarkup(playlist)}<span>${escapeHtml(playlist.name)}</span><small>${playlist.trackIds?.length || 0}</small></button>`).join('');
  list.querySelectorAll('[data-playlist-id]').forEach((button) => button.addEventListener('click', () => openPlaylistDrawer(button.dataset.playlistId)));
  renderPlaylistManager();
}

function renderPlaylistManager() {
  const list = $('#playlistManagerList');
  if (!list) return;
  list.innerHTML = playlists.map((playlist) => `<button class="playlist-picker-item" data-manager-playlist-id="${escapeHtml(playlist.id)}">${playlistCoverMarkup(playlist)}<span>${escapeHtml(playlist.name)}</span><small>${playlist.trackIds?.length || 0} canciones</small><b>${chevronIcon}</b></button>`).join('');
  list.querySelectorAll('[data-manager-playlist-id]').forEach((button) => button.addEventListener('click', () => { closeModal('playlistManagerModal'); openPlaylistDrawer(button.dataset.managerPlaylistId); }));
}

// Collage de portadas (estilo Spotify) para que la lista se identifique de
// un vistazo en vez de mostrar solo un título; con la lista vacía cae en un
// icono de nota, y con una sola canción ocupa el hueco entero en vez de
// dejar tres celdas en blanco.
function renderPlaylistDrawerCollage(playlist, playlistTracks) {
  const collage = $('#playlistDrawerCollage');
  if (!collage) return;
  if (playlist.cover) {
    collage.className = 'playlist-drawer-collage single';
    collage.innerHTML = `<span style="${escapeHtml(`background-image:url("${playlist.cover}")`)}"></span>`;
    return;
  }
  const covers = playlistTracks.slice(0, 4);
  if (!covers.length) {
    collage.className = 'playlist-drawer-collage empty';
    collage.innerHTML = noteIcon;
    return;
  }
  const layoutClass = covers.length === 1 ? ' single' : covers.length === 2 ? ' double' : '';
  collage.className = `playlist-drawer-collage${layoutClass}`;
  collage.innerHTML = covers.map((track) => {
    const style = track.coverData
      ? `background-image:url("${track.coverData}");background-color:${track.gradient}`
      : `background:${track.gradient}`;
    return `<span style="${escapeHtml(style)}"></span>`;
  }).join('');
}

// Ventana lateral izquierda (hermana de .theme-drawer, pero desde el otro
// borde) con las canciones de UNA lista concreta, para no perder el
// contexto de la pantalla principal al mirar dentro de una lista.
function renderPlaylistDrawerTracks(playlistId) {
  const list = $('#playlistDrawerRows');
  const playlist = playlists.find((item) => item.id === playlistId);
  if (!list || !playlist) return;
  const playlistTracks = (playlist.trackIds || []).map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
  const totalDuration = playlistTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
  const durationLabel = formatPlaylistDuration(totalDuration);
  const countLabel = `${playlistTracks.length} ${playlistTracks.length === 1 ? 'canción' : 'canciones'}`;
  $('#playlistDrawerName').textContent = playlist.name;
  $('#playlistDrawerCount').textContent = durationLabel ? `${countLabel} · ${durationLabel}` : countLabel;
  $('#playlistDrawerEmpty').hidden = playlistTracks.length !== 0;
  renderPlaylistDrawerCollage(playlist, playlistTracks);
  list.innerHTML = playlistTracks.map((track) => {
    const actualIndex = tracks.indexOf(track);
    return `<div class="queue-item${actualIndex === currentIndex ? ' active' : ''}">
      <button class="queue-item-play" data-drawer-action="play" data-drawer-index="${actualIndex}" aria-label="Reproducir ${escapeHtml(track.title)}">${coverMarkup(track)}<span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></button>
      <span class="queue-item-actions"><button data-drawer-action="queue" data-drawer-index="${actualIndex}" aria-label="Añadir a la cola">${queueAddIcon}</button><button data-drawer-action="remove" data-drawer-index="${actualIndex}" aria-label="Quitar de la lista">${closeIcon}</button></span>
    </div>`;
  }).join('');
}

function openPlaylistDrawer(playlistId) {
  activePlaylistId = playlistId;
  renderPlaylists();
  renderPlaylistDrawerTracks(playlistId);
  openModal('playlistDrawer');
}

// Reproduce una lista entera de golpe (botón grande de play o el de
// aleatorio junto al collage), sustituyendo la cola actual por sus
// canciones — así "reproducir lista" hace lo mismo que en cualquier otro
// reproductor en vez de limitarse a abrir el primer tema suelto.
function playPlaylist(playlistId, shuffle = false) {
  const playlist = playlists.find((item) => item.id === playlistId);
  const playlistTracks = (playlist?.trackIds || []).map((id) => tracks.find((track) => track.id === id)).filter(Boolean);
  if (!playlist || !playlistTracks.length) return showToast('Añade canciones a esta lista para reproducirla.');
  queueIds = playlistTracks.map((track) => track.id);
  saveQueue();
  renderQueue();
  isShuffle = shuffle;
  $('#shuffleBtn').classList.toggle('active', isShuffle);
  const startTrack = shuffle ? playlistTracks[Math.floor(Math.random() * playlistTracks.length)] : playlistTracks[0];
  selectTrack(tracks.indexOf(startTrack));
  showToast(shuffle ? `Reproduciendo “${playlist.name}” en orden aleatorio.` : `Reproduciendo “${playlist.name}”.`);
}

$('#playlistDrawerPlayBtn').addEventListener('click', () => playPlaylist(activePlaylistId, false));
$('#playlistDrawerShuffleBtn').addEventListener('click', () => playPlaylist(activePlaylistId, true));

$('#playlistDrawerRows').addEventListener('click', (event) => {
  const target = event.target.closest('[data-drawer-action]');
  if (!target) return;
  const index = Number(target.dataset.drawerIndex);
  if (target.dataset.drawerAction === 'play') selectTrack(index);
  if (target.dataset.drawerAction === 'queue') addTrackToQueue(index);
  if (target.dataset.drawerAction === 'remove') {
    const playlist = playlists.find((item) => item.id === activePlaylistId);
    const track = tracks[index];
    if (!playlist || !track) return;
    playlist.trackIds = (playlist.trackIds || []).filter((id) => id !== track.id);
    savePlaylists();
    renderPlaylists();
    renderPlaylistDrawerTracks(activePlaylistId);
  }
});

// Ventana "Añadir canciones": toda la biblioteca con un botón de
// añadir/quitar por fila, para completar una lista sin tener que ir
// canción por canción desde el menú "···" de cada tema.
function renderPlaylistAddTracks() {
  const list = $('#playlistAddTracksList');
  const playlist = playlists.find((item) => item.id === activePlaylistId);
  if (!list || !playlist) return;
  const trackIds = new Set(playlist.trackIds || []);
  $('#playlistAddTracksEmpty').hidden = tracks.length !== 0;
  list.innerHTML = tracks.map((track, index) => {
    const inList = trackIds.has(track.id);
    return `<div class="queue-item${inList ? ' active' : ''}">
      <span class="queue-item-play">${coverMarkup(track)}<span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></span>
      <span class="queue-item-actions"><button data-add-track-index="${index}" aria-label="${inList ? `Quitar ${escapeHtml(track.title)} de la lista` : `Añadir ${escapeHtml(track.title)} a la lista`}">${inList ? closeIcon : queueAddIcon}</button></span>
    </div>`;
  }).join('');
}

function openPlaylistAddTracks() {
  if (!activePlaylistId) return;
  renderPlaylistAddTracks();
  openModal('playlistAddTracksModal');
}

$('#playlistDrawerAddBtn').addEventListener('click', openPlaylistAddTracks);

$('#playlistAddTracksList').addEventListener('click', (event) => {
  const target = event.target.closest('[data-add-track-index]');
  if (!target) return;
  const track = tracks[Number(target.dataset.addTrackIndex)];
  const playlist = playlists.find((item) => item.id === activePlaylistId);
  if (!track || !playlist) return;
  playlist.trackIds = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
  if (playlist.trackIds.includes(track.id)) {
    playlist.trackIds = playlist.trackIds.filter((id) => id !== track.id);
  } else {
    playlist.trackIds.push(track.id);
    showToast(`“${track.title}” añadida a “${playlist.name}”.`);
  }
  savePlaylists();
  renderPlaylists();
  renderPlaylistDrawerTracks(activePlaylistId);
  renderPlaylistAddTracks();
});

function addTrackToQueue(index, shouldNotify = true) {
  const track = tracks[index];
  if (!track) return;
  if (!queueIds.includes(track.id)) {
    queueIds.push(track.id);
    saveQueue();
    renderQueue();
    if (shouldNotify) showToast(`“${track.title}” añadida a la cola.`);
  } else if (shouldNotify) {
    showToast('Esa canción ya está en la cola.');
  }
}

function addTrackToPlaylist(trackIndex, playlistId) {
  const track = tracks[trackIndex];
  const playlist = playlists.find((item) => item.id === playlistId);
  if (!track || !playlist) return;
  playlist.trackIds = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
  if (playlist.trackIds.includes(track.id)) {
    showToast('Esa canción ya está en la lista.');
  } else {
    playlist.trackIds.push(track.id);
    savePlaylists();
    renderPlaylists();
    showToast(`“${track.title}” añadida a “${playlist.name}”.`);
  }
  closeModal('playlistPickerModal');
}

function openPlaylistPicker(index) {
  pickerTrackIndex = index;
  const list = $('#playlistPickerList');
  list.innerHTML = playlists.map((playlist) => `<button class="playlist-picker-item" data-playlist-id="${escapeHtml(playlist.id)}">${playlistCoverMarkup(playlist)}<span>${escapeHtml(playlist.name)}</span><small>${playlist.trackIds?.length || 0} canciones</small><b>${chevronIcon}</b></button>`).join('');
  list.querySelectorAll('[data-playlist-id]').forEach((button) => button.addEventListener('click', () => addTrackToPlaylist(pickerTrackIndex, button.dataset.playlistId)));
  openModal('playlistPickerModal');
}

function renderTracks() {
  let visibleTracks = tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(searchTerm.toLowerCase()));
  if (activeView === 'favoritos') visibleTracks = visibleTracks.filter((track) => track.favorite);
  if (activeView === 'recientes') visibleTracks = visibleTracks.filter((track) => track.playedAt).sort((a, b) => b.playedAt - a.playedAt);
  if (activeView === 'playlist') {
    const playlist = playlists.find((item) => item.id === activePlaylistId);
    const trackIds = new Set(playlist?.trackIds || []);
    visibleTracks = visibleTracks.filter((track) => trackIds.has(track.id));
  }
  trackRows.innerHTML = '';
  const activePlaylist = playlists.find((item) => item.id === activePlaylistId);
  const emptyTitle = activeView === 'favoritos' ? 'Aún no tienes favoritos' : activeView === 'recientes' ? 'Aún no hay historial' : activeView === 'playlist' ? `“${activePlaylist?.name || 'Lista'}” está vacía` : searchTerm ? 'No encontramos esa canción' : 'aun no has subido música';
  const emptyDescription = activeView === 'favoritos' ? 'Pulsa el corazón de una canción para guardarla aquí.' : activeView === 'recientes' ? 'Las canciones que escuches aparecerán en este espacio.' : activeView === 'playlist' ? 'Añade canciones desde el botón + de tu biblioteca.' : searchTerm ? 'Prueba con otro título, artista o álbum.' : 'Sube archivos MP3, MP4 u otros formatos compatibles.';
  $('#emptyState h3').textContent = emptyTitle;
  $('#emptyState p').textContent = emptyDescription;
  $('#emptyState .small-button').hidden = Boolean(searchTerm || activeView === 'favoritos' || activeView === 'recientes' || activeView === 'playlist');
  emptyState.hidden = visibleTracks.length !== 0;

  visibleTracks.forEach((track, visibleIndex) => {
    const actualIndex = tracks.indexOf(track);
    const row = document.createElement('div');
    row.className = `track-row${actualIndex === currentIndex ? ' active' : ''}`;
    row.innerHTML = `
      <span class="track-number">${String(visibleIndex + 1).padStart(2, '0')}</span>
      <button class="track-info" data-action="play" data-index="${actualIndex}" aria-label="Reproducir ${track.title}">
        ${coverMarkup(track)}
        <span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span>
      </button>
      <span class="track-album">${escapeHtml(track.album)}</span>
      <span class="track-duration">${track.duration ? formatTime(track.duration) : '--:--'}</span>
      <span class="track-actions">
        <div class="track-more-wrap">
          <button class="track-action track-more" data-action="more" data-index="${actualIndex}" aria-haspopup="true" aria-expanded="false" aria-label="Más opciones para ${track.title}">${moreIcon}</button>
          <div class="track-menu-popover" role="menu">
            <button class="track-menu-item" data-action="queue" data-index="${actualIndex}" role="menuitem">${queueAddIcon}<span>Añadir a la cola</span></button>
            <button class="track-menu-item" data-action="playlist" data-index="${actualIndex}" role="menuitem">${playlistAddIcon}<span>Añadir a una lista</span></button>
            <button class="track-menu-item" data-action="edit" data-index="${actualIndex}" role="menuitem">${editIcon}<span>Editar canción</span></button>
            <button class="track-menu-item danger" data-action="delete" data-index="${actualIndex}" role="menuitem">${trashIcon}<span>Borrar canción</span></button>
          </div>
        </div>
        <button class="track-menu heart-button${track.favorite ? ' liked' : ''}" data-action="favorite" data-index="${actualIndex}" aria-label="Añadir ${track.title} a favoritos">${track.favorite ? heartFilledIcon : heartIcon}</button>
      </span>`;
    trackRows.appendChild(row);
  });
  $('#trackCountLabel').textContent = `${tracks.length} ${tracks.length === 1 ? 'canción' : 'canciones'}`;
  $('.storage-bar span').style.width = `${Math.min(100, Math.max(10, tracks.length * 8))}%`;
  renderPlaylists();
  renderQueue();
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

function deleteTrackFromLibrary(trackId) {
  return openLibraryDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readwrite');
    transaction.objectStore('tracks').delete(trackId);
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
  if (!queueIds.includes(track.id)) {
    queueIds.push(track.id);
    saveQueue();
  }
  audio.src = track.url;
  $('#nowTitle').textContent = track.title;
  $('#nowArtist').textContent = track.artist;
  applyCover($('#nowCover'), track);
  $('#favoriteBtn').classList.toggle('liked', track.favorite);
  updateMediaSession();
  if (autoplay) audio.play().catch(() => showToast('Pulsa reproducir para comenzar la canción.'));
  renderTracks();
  updatePlayButton();
}

function updatePlayButton() {
  const isPlaying = !audio.paused && currentIndex >= 0;
  $('#playBtn').innerHTML = isPlaying ? pauseIcon : playIcon;
  $('#playBtn').setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
  if ('mediaSession' in navigator && currentIndex >= 0) navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function playNext() {
  const queuedTracks = getQueueTracks();
  if (!queuedTracks.length) return showToast('Añade canciones para llenar tu cola.');
  let nextIndex;
  if (isShuffle) {
    nextIndex = tracks.indexOf(queuedTracks[Math.floor(Math.random() * queuedTracks.length)]);
  } else {
    const currentQueueIndex = queuedTracks.findIndex((track) => track.id === tracks[currentIndex]?.id);
    const nextTrack = queuedTracks[(currentQueueIndex + 1 + queuedTracks.length) % queuedTracks.length];
    nextIndex = tracks.indexOf(nextTrack);
  }
  selectTrack(nextIndex);
}

function playPrevious() {
  const queuedTracks = getQueueTracks();
  if (!queuedTracks.length) return showToast('Añade canciones para llenar tu cola.');
  if (audio.currentTime > 4) { audio.currentTime = 0; return; }
  const currentQueueIndex = queuedTracks.findIndex((track) => track.id === tracks[currentIndex]?.id);
  const previousTrack = queuedTracks[(currentQueueIndex - 1 + queuedTracks.length) % queuedTracks.length];
  selectTrack(tracks.indexOf(previousTrack));
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
  root.style.setProperty('--surface', theme.surface || 'color-mix(in srgb, var(--sky-deep) 32%, white 68%)');
  root.style.setProperty('--sky-image', theme.backgroundImage ? `url("${theme.backgroundImage}")` : 'none');
  $('#activeThemeLabel').textContent = themeName === 'realtime' ? getRealtimeLabel() : theme.label;
  $('#accentColor').value = customAccent || theme.accent;
  $('#accentHex').textContent = (customAccent || theme.accent).toUpperCase();
  $$('.theme-option').forEach((button) => button.classList.toggle('active', button.dataset.theme === themeName));
  $$('.mood-item').forEach((button) => button.classList.toggle('selected', button.dataset.theme === resolvedThemeName));
  renderCustomThemes();
  localStorage.setItem('cieloplay-theme', JSON.stringify({ name: themeName, accent: customAccent || null }));
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme.sky);
  // La portada de repuesto de la notificación usa los colores del tema, así
  // que si cambias de cielo mientras suena algo, la refrescamos al momento.
  updateMediaSession();
}

function openDrawer() { $('#themeDrawer').classList.add('open'); $('#themeDrawer').setAttribute('aria-hidden', 'false'); }
function closeDrawer() { $('#themeDrawer').classList.remove('open'); $('#themeDrawer').setAttribute('aria-hidden', 'true'); }
function openModal(id) { const modal = $(`#${id}`); if (!modal) return; modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
function closeModal(id) { const modal = $(`#${id}`); if (!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }

function renderQueue() {
  const list = $('#queueList');
  if (!list) return;
  const queuedTracks = getQueueTracks();
  $('#queueCount').textContent = `${queuedTracks.length} ${queuedTracks.length === 1 ? 'canción' : 'canciones'}`;
  $('#queueEmpty').hidden = queuedTracks.length !== 0;
  list.innerHTML = queuedTracks.map((track, queueIndex) => {
    const trackIndex = tracks.indexOf(track);
    const isCurrent = trackIndex === currentIndex;
    return `<div class="queue-item${isCurrent ? ' active' : ''}">
      <button class="queue-item-play" data-queue-action="play" data-queue-index="${queueIndex}" aria-label="Reproducir ${escapeHtml(track.title)}">${coverMarkup(track)}<span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></button>
      <span class="queue-item-actions"><button data-queue-action="up" data-queue-index="${queueIndex}" aria-label="Subir canción">${arrowUpIcon}</button><button data-queue-action="down" data-queue-index="${queueIndex}" aria-label="Bajar canción">${arrowDownIcon}</button><button data-queue-action="remove" data-queue-index="${queueIndex}" aria-label="Quitar canción">${closeIcon}</button></span>
    </div>`;
  }).join('');
  saveQueue();
}

function editTrack(index) {
  const track = tracks[index];
  if (!track) return;
  editingTrackId = track.id;
  $('#editTrackName').value = track.title;
  $('#editTrackArtist').value = track.artist;
  $('#editTrackAlbum').value = track.album;
  $('#editTrackCover').value = '';
  $('#editTrackCoverName').textContent = track.coverData ? 'Portada actual · elige otra para sustituirla' : 'Opcional · máximo 2 MB';
  openModal('editTrackModal');
  window.setTimeout(() => $('#editTrackName').focus(), 80);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

async function deleteTrack(index) {
  const track = tracks[index];
  if (!track || !window.confirm(`¿Borrar “${track.title}” de la biblioteca?`)) return;
  try {
    await deleteTrackFromLibrary(track.id);
  } catch {
    showToast('No se pudo borrar la canción de la biblioteca.');
    return;
  }
  const wasCurrent = currentIndex === index;
  if (wasCurrent) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    currentIndex = -1;
    $('#nowTitle').textContent = 'Pon música q me aburro';
    $('#nowArtist').textContent = 'eres un irreverente y un deslenguado';
    $('#totalTime').textContent = '0:00';
    $('#currentTime').textContent = '0:00';
    $('#progressRange').value = 0;
    $('#favoriteBtn').classList.remove('liked');
    applyCover($('#nowCover'), null, sunIcon);
  } else if (currentIndex > index) {
    currentIndex -= 1;
  }
  URL.revokeObjectURL(track.url);
  tracks.splice(index, 1);
  queueIds = queueIds.filter((id) => id !== track.id);
  playlists.forEach((playlist) => { playlist.trackIds = (playlist.trackIds || []).filter((id) => id !== track.id); });
  saveQueue();
  savePlaylists();
  renderTracks();
  showToast(`“${track.title}” borrada de tu biblioteca.`);
}

async function importFiles(files) {
  const selectedFiles = [...files];
  const importedTracks = [];
  for (const [index, file] of selectedFiles.entries()) {
    const track = { id: `${file.name}-${file.lastModified}`, title: getTitle(file.name), artist: 'Tu biblioteca local', album: 'Archivos importados', blob: file, url: URL.createObjectURL(file), duration: 0, favorite: false, playedAt: 0, gradient: gradientFor(tracks.length + index), coverData: '', createdAt: Date.now() + index };
    try {
      await saveTrackToLibrary(track);
      tracks.push(track);
      queueIds.push(track.id);
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
  saveQueue();
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
// El menú "más opciones" de cada canción (⋮) es un popover simple: un botón
// lo abre, cualquier clic fuera o un Escape lo cierra. Solo hay uno abierto
// a la vez para que la biblioteca no se llene de menús sueltos.
function closeAllTrackMenus(exceptWrap) {
  $$('.track-more-wrap.open').forEach((wrap) => {
    if (wrap === exceptWrap) return;
    wrap.classList.remove('open');
    wrap.querySelector('.track-more')?.setAttribute('aria-expanded', 'false');
  });
}

trackRows.addEventListener('click', (event) => {
  const moreBtn = event.target.closest('[data-action="more"]');
  if (moreBtn) {
    const wrap = moreBtn.closest('.track-more-wrap');
    const willOpen = !wrap.classList.contains('open');
    closeAllTrackMenus();
    wrap.classList.toggle('open', willOpen);
    moreBtn.setAttribute('aria-expanded', String(willOpen));
    return;
  }
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const index = Number(target.dataset.index);
  if (target.dataset.action === 'play') selectTrack(index);
  if (target.dataset.action === 'favorite') { tracks[index].favorite = !tracks[index].favorite; persistTrackState(tracks[index]); renderTracks(); }
  if (target.dataset.action === 'queue') addTrackToQueue(index);
  if (target.dataset.action === 'playlist') openPlaylistPicker(index);
  if (target.dataset.action === 'edit') editTrack(index);
  if (target.dataset.action === 'delete') deleteTrack(index);
  closeAllTrackMenus();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.track-more-wrap')) closeAllTrackMenus();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeAllTrackMenus();
});

$('#editTrackCover').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) $('#editTrackCoverName').textContent = `${file.name} · lista para guardar`;
});
$('#removeTrackCoverBtn').addEventListener('click', () => {
  const track = tracks.find((item) => item.id === editingTrackId);
  if (!track) return;
  track.coverData = '';
  $('#editTrackCover').value = '';
  $('#editTrackCoverName').textContent = 'Sin portada · se usará el degradado del tema';
  persistTrackState(track);
  if (currentIndex === tracks.indexOf(track)) applyCover($('#nowCover'), track);
  renderTracks();
  showToast('Portada quitada.');
});

$('#editTrackForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const track = tracks.find((item) => item.id === editingTrackId);
  if (!track) return closeModal('editTrackModal');
  const coverFile = $('#editTrackCover').files[0];
  if (coverFile) {
    if (coverFile.size > 2 * 1024 * 1024) return showToast('La portada no puede superar 2 MB.');
    try {
      track.coverData = await readFileAsDataUrl(coverFile);
    } catch {
      return showToast('No se pudo leer la portada.');
    }
  }
  track.title = $('#editTrackName').value.trim() || 'Canción sin título';
  track.artist = $('#editTrackArtist').value.trim() || 'Tu biblioteca local';
  track.album = $('#editTrackAlbum').value.trim() || 'Archivos importados';
  persistTrackState(track);
  if (currentIndex === tracks.indexOf(track)) {
    $('#nowTitle').textContent = track.title;
    $('#nowArtist').textContent = track.artist;
    applyCover($('#nowCover'), track);
    updateMediaSession();
  }
  closeModal('editTrackModal');
  renderTracks();
  showToast('Datos de la canción actualizados.');
});

$$('[data-close-modal]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.closeModal)));
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
function changeView(view, playlistId = '') {
  if (view === 'temas') {
    openDrawer();
    return;
  }
  activeView = view;
  activePlaylistId = view === 'playlist' ? playlistId : '';
  $$('.nav-item[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  const titles = { inicio: 'Escuchadas recientemente', biblioteca: 'Toda tu música', favoritos: 'Tus favoritos', recientes: 'Escuchadas recientemente' };
  $('#sectionTitle').textContent = view === 'playlist' ? (playlists.find((item) => item.id === playlistId)?.name || 'Mi lista') : titles[view] || titles.inicio;
  renderPlaylists();
  $('#librarySection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  renderTracks();
}
$$('.nav-item[data-view]').forEach((button) => button.addEventListener('click', () => changeView(button.dataset.view)));
document.addEventListener('keydown', (event) => { if (event.key === '/' && document.activeElement.tagName !== 'INPUT') { event.preventDefault(); $('#searchInput').focus(); } if (event.code === 'Space' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'BUTTON') { event.preventDefault(); $('#playBtn').click(); } });
$('#openThemeBtn').addEventListener('click', openDrawer); $('#inspirationThemeBtn').addEventListener('click', openDrawer); $('#viewMoodsBtn')?.addEventListener('click', openDrawer); $('#closeThemeBtn').addEventListener('click', closeDrawer); $('#doneThemeBtn').addEventListener('click', () => { closeDrawer(); showToast('Tu cielo se ha guardado.'); }); $('#drawerBackdrop').addEventListener('click', closeDrawer);
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
// Menú "Nueva lista": reemplaza el window.prompt() de antes (feo, sin
// estilo y sin sitio para una portada) por un modal con la misma estética
// retro del resto de la app, con nombre + imagen opcional.
const playlistColorCycle = ['aurora', 'sunset', 'night'];
let createPlaylistReturnTo = null;

function resetCreatePlaylistForm() {
  $('#createPlaylistForm').reset();
  const preview = $('#createPlaylistPreview');
  preview.className = 'playlist-cover-preview';
  preview.style.backgroundImage = '';
  preview.innerHTML = noteIcon;
  $('#createPlaylistCoverHelp').textContent = 'Imagen opcional · máximo 2 MB';
}

function openCreatePlaylistModal(returnTo = null) {
  createPlaylistReturnTo = returnTo;
  resetCreatePlaylistForm();
  openModal('createPlaylistModal');
  window.setTimeout(() => $('#createPlaylistName').focus(), 80);
}

$('#createPlaylistCover').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    $('#createPlaylistCoverHelp').textContent = 'La imagen supera el límite de 2 MB.';
    event.target.value = '';
    return;
  }
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const preview = $('#createPlaylistPreview');
    preview.style.backgroundImage = `url("${dataUrl}")`;
    preview.classList.add('has-image');
    $('#createPlaylistCoverHelp').textContent = `${file.name} · lista para guardar`;
  } catch {
    $('#createPlaylistCoverHelp').textContent = 'No se pudo leer la imagen.';
  }
});

$('#createPlaylistForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('#createPlaylistName').value.trim();
  if (!name) return;
  const coverFile = $('#createPlaylistCover').files[0];
  let cover = '';
  if (coverFile) {
    if (coverFile.size > 2 * 1024 * 1024) return showToast('La portada no puede superar 2 MB.');
    try {
      cover = await readFileAsDataUrl(coverFile);
    } catch {
      return showToast('No se pudo leer la portada.');
    }
  }
  const playlist = { id: `playlist-${Date.now()}`, name, color: playlistColorCycle[playlists.length % playlistColorCycle.length], cover, trackIds: [] };
  playlists.push(playlist);
  savePlaylists();
  renderPlaylists();
  closeModal('createPlaylistModal');
  showToast(`Lista “${name}” creada.`);
  if (createPlaylistReturnTo === 'picker') {
    openPlaylistPicker(pickerTrackIndex);
  } else {
    openPlaylistDrawer(playlist.id);
  }
});

$('#newPlaylistBtn').addEventListener('click', () => openCreatePlaylistModal());
$('#playlistsBtn').addEventListener('click', () => { renderPlaylistManager(); openModal('playlistManagerModal'); });
$('#viewAllBtn').addEventListener('click', () => changeView('biblioteca'));
$('#queueBtn').addEventListener('click', () => { renderQueue(); openModal('queueModal'); });
$('#clearQueueBtn').addEventListener('click', () => {
  if (!queueIds.length) return;
  queueIds = currentIndex >= 0 && tracks[currentIndex] ? [tracks[currentIndex].id] : [];
  saveQueue();
  renderQueue();
  showToast('Cola vaciada.');
});
$('#queueList').addEventListener('click', (event) => {
  const target = event.target.closest('[data-queue-action]');
  if (!target) return;
  const queueIndex = Number(target.dataset.queueIndex);
  const queuedTracks = getQueueTracks();
  const track = queuedTracks[queueIndex];
  if (!track) return;
  if (target.dataset.queueAction === 'play') selectTrack(tracks.indexOf(track));
  if (target.dataset.queueAction === 'remove') {
    queueIds = queueIds.filter((id) => id !== track.id);
    saveQueue();
    renderQueue();
  }
  if (target.dataset.queueAction === 'up' && queueIndex > 0) {
    [queueIds[queueIndex - 1], queueIds[queueIndex]] = [queueIds[queueIndex], queueIds[queueIndex - 1]];
    saveQueue();
    renderQueue();
  }
  if (target.dataset.queueAction === 'down' && queueIndex < queueIds.length - 1) {
    [queueIds[queueIndex + 1], queueIds[queueIndex]] = [queueIds[queueIndex], queueIds[queueIndex + 1]];
    saveQueue();
    renderQueue();
  }
});
$('#pickerNewPlaylistBtn').addEventListener('click', () => openCreatePlaylistModal('picker'));
$('#managerNewPlaylistBtn').addEventListener('click', () => { closeModal('playlistManagerModal'); openCreatePlaylistModal(); });

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
