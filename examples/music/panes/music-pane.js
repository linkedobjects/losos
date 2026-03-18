import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Music',
  icon: '\uD83C\uDFB5',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('MusicApp')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__musicData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { url: '', debounce: 800 })
    var root = store.get('#this')

    var currentTrack = null
    var isPlaying = false
    var progress = 0
    var audio = new Audio()
    var progressTimer = null
    var activeView = 'tracks'

    // ========== HELPERS ==========
    function formatDuration(s) {
      s = parseInt(s) || 0
      var m = Math.floor(s / 60)
      var sec = s % 60
      return m + ':' + (sec < 10 ? '0' : '') + sec
    }

    // ========== PLAYER UI UPDATE (no full re-render) ==========
    function updatePlayerUI() {
      if (!audio.duration) return
      progress = (audio.currentTime / audio.duration) * 100
      var fill = container.querySelector('.mu-progress-fill')
      var elapsed = container.querySelector('.mu-time-elapsed')
      var total = container.querySelector('.mu-time-total')
      if (fill) fill.style.width = progress + '%'
      if (elapsed) elapsed.textContent = formatDuration(Math.floor(audio.currentTime))
      if (total) total.textContent = formatDuration(Math.floor(audio.duration))
    }

    // ========== AUDIO PLAYER ==========
    function playTrack(track) {
      if (currentTrack && currentTrack['@id'] === track['@id'] && isPlaying) {
        audio.pause()
        isPlaying = false
        clearInterval(progressTimer)
        renderApp()
        return
      }

      currentTrack = track
      audio.src = track['preview']
      audio.play().catch(function() {})
      isPlaying = true
      progress = 0

      clearInterval(progressTimer)
      progressTimer = setInterval(updatePlayerUI, 250)

      audio.onended = function() {
        // Auto-play next
        var tracks = store.propAll(root, 'track')
        var idx = -1
        for (var i = 0; i < tracks.length; i++) {
          if (tracks[i]['@id'] === currentTrack['@id']) { idx = i; break }
        }
        if (idx >= 0 && idx < tracks.length - 1) {
          playTrack(tracks[idx + 1])
        } else {
          isPlaying = false
          progress = 0
          clearInterval(progressTimer)
          renderApp()
        }
      }

      renderApp()
    }

    function seekTo(e) {
      var rect = e.currentTarget.getBoundingClientRect()
      var pct = (e.clientX - rect.left) / rect.width
      if (audio.duration) {
        audio.currentTime = pct * audio.duration
        progress = pct * 100
        renderApp()
      }
    }

    function prevTrack() {
      if (!currentTrack) return
      var tracks = store.propAll(root, 'track')
      var idx = -1
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i]['@id'] === currentTrack['@id']) { idx = i; break }
      }
      if (idx > 0) playTrack(tracks[idx - 1])
    }

    function nextTrack() {
      if (!currentTrack) return
      var tracks = store.propAll(root, 'track')
      var idx = -1
      for (var i = 0; i < tracks.length; i++) {
        if (tracks[i]['@id'] === currentTrack['@id']) { idx = i; break }
      }
      if (idx >= 0 && idx < tracks.length - 1) playTrack(tracks[idx + 1])
    }

    // ========== RENDER TRACK ROW ==========
    function renderTrackRow(track) {
      var isCurrent = currentTrack && currentTrack['@id'] === track['@id']
      var playing = isCurrent && isPlaying

      return html`
        <div class="${'mu-track-row' + (isCurrent ? ' mu-track-active' : '')}"
             onclick="${function() { playTrack(track) }}">
          <div class="mu-track-num">
            ${playing ? html`<span class="mu-eq">\u266B</span>` : html`<span>${track['rank']}</span>`}
          </div>
          <img class="mu-track-art" src="${track['albumCover']}" alt="" loading="lazy" />
          <div class="mu-track-info">
            <div class="${'mu-track-title' + (isCurrent ? ' mu-track-title-green' : '')}">${track['trackTitle']}</div>
            <div class="mu-track-artist">
              ${track['explicit'] ? html`<span class="mu-explicit">E</span>` : null}
              ${track['artist']}
            </div>
          </div>
          <div class="mu-track-album">${track['album']}</div>
          <div class="mu-track-dur">${formatDuration(track['duration'])}</div>
        </div>
      `
    }

    // ========== RENDER ARTIST CARD ==========
    function renderArtistCard(a) {
      return html`
        <div class="mu-artist-card">
          <div class="mu-artist-img-wrap">
            <img class="mu-artist-img" src="${a['artistPhoto']}" alt="${a['artistName']}" loading="lazy" />
          </div>
          <div class="mu-artist-name">${a['artistName']}</div>
          <div class="mu-artist-label">Artist</div>
        </div>
      `
    }

    // ========== RENDER ALBUM CARD ==========
    function renderAlbumCard(a) {
      return html`
        <div class="mu-album-card">
          <img class="mu-album-art" src="${a['albumArt']}" alt="${a['albumTitle']}" loading="lazy" />
          <div class="mu-album-title">${a['albumTitle']}</div>
          <div class="mu-album-artist">${a['albumArtist']}</div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========
    function renderApp() {
      var tracks = store.propAll(root, 'track')
      var artists = store.propAll(root, 'topArtist')
      var albums = store.propAll(root, 'topAlbum')

      var heroTrack = tracks[0]
      var heroGrad = heroTrack ? 'url(' + heroTrack['albumCoverBig'] + ')' : '#1a1a1a'

      render(container, html`
        <style>
          .mu-layout { background: #0a0a0a; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #fff; padding-bottom: 100px; }

          /* Hero */
          .mu-hero {
            position: relative; padding: 60px 40px 40px;
            background: linear-gradient(180deg, rgba(30,215,96,0.3) 0%, #0a0a0a 100%);
            overflow: hidden;
          }
          .mu-hero-inner { max-width: 1200px; margin: 0 auto; position: relative; z-index: 2; }
          .mu-hero-greeting { font-size: 32px; font-weight: 700; margin-bottom: 24px; }

          /* Nav tabs */
          .mu-view-tabs {
            max-width: 1200px; margin: 0 auto;
            display: flex; gap: 8px; padding: 0 40px 16px;
          }
          .mu-view-tab {
            background: #1a1a1a; border: none; border-radius: 18px;
            padding: 8px 20px; font: 500 14px/1 inherit; color: #fff;
            cursor: pointer; transition: background 0.15s;
          }
          .mu-view-tab:hover { background: #2a2a2a; }
          .mu-view-tab-active { background: #1ed760; color: #000; }
          .mu-view-tab-active:hover { background: #1fdf64; }

          /* Content */
          .mu-content { max-width: 1200px; margin: 0 auto; padding: 0 40px; }
          .mu-section-title { font-size: 24px; font-weight: 700; margin: 32px 0 16px; }

          /* Track list */
          .mu-track-header {
            display: flex; align-items: center; gap: 16px;
            padding: 0 16px 8px; border-bottom: 1px solid #1a1a1a;
            font-size: 12px; font-weight: 500; color: #a7a7a7;
            text-transform: uppercase; letter-spacing: 0.1em;
          }
          .mu-track-header-num { width: 40px; text-align: center; }
          .mu-track-header-title { flex: 1; margin-left: 56px; }
          .mu-track-header-album { width: 200px; }
          .mu-track-header-dur { width: 60px; text-align: right; }

          .mu-track-row {
            display: flex; align-items: center; gap: 16px;
            padding: 8px 16px; border-radius: 4px;
            cursor: pointer; transition: background 0.1s;
          }
          .mu-track-row:hover { background: #1a1a1a; }
          .mu-track-active { background: #1a1a1a; }
          .mu-track-num { width: 40px; text-align: center; font-size: 15px; color: #a7a7a7; flex-shrink: 0; }
          .mu-eq { color: #1ed760; font-size: 18px; animation: eqPulse 0.8s ease-in-out infinite alternate; }
          @keyframes eqPulse { from { opacity: 0.6; } to { opacity: 1; } }
          .mu-track-art { width: 44px; height: 44px; border-radius: 4px; flex-shrink: 0; object-fit: cover; }
          .mu-track-info { flex: 1; min-width: 0; }
          .mu-track-title { font-size: 15px; font-weight: 400; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mu-track-title-green { color: #1ed760; }
          .mu-track-artist { font-size: 13px; color: #a7a7a7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 6px; }
          .mu-explicit { background: #a7a7a7; color: #000; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 2px; flex-shrink: 0; }
          .mu-track-album { width: 200px; font-size: 13px; color: #a7a7a7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
          .mu-track-dur { width: 60px; text-align: right; font-size: 13px; color: #a7a7a7; flex-shrink: 0; }

          @media (max-width: 800px) {
            .mu-track-album, .mu-track-header-album { display: none; }
          }

          /* Artist grid */
          .mu-artist-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px;
          }
          .mu-artist-card {
            background: #161616; border-radius: 8px; padding: 20px;
            text-align: center; cursor: pointer; transition: background 0.2s;
          }
          .mu-artist-card:hover { background: #1a1a1a; }
          .mu-artist-img-wrap { width: 140px; height: 140px; margin: 0 auto 16px; border-radius: 50%; overflow: hidden; }
          .mu-artist-img { width: 100%; height: 100%; object-fit: cover; }
          .mu-artist-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
          .mu-artist-label { font-size: 13px; color: #a7a7a7; }

          /* Album grid */
          .mu-album-grid {
            display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 24px;
          }
          .mu-album-card {
            background: #161616; border-radius: 8px; padding: 16px;
            cursor: pointer; transition: background 0.2s;
          }
          .mu-album-card:hover { background: #1a1a1a; }
          .mu-album-art { width: 100%; aspect-ratio: 1; border-radius: 6px; object-fit: cover; margin-bottom: 12px; }
          .mu-album-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mu-album-artist { font-size: 13px; color: #a7a7a7; }

          /* Player bar */
          .mu-player {
            position: fixed; bottom: 0; left: 0; right: 0;
            background: #181818; border-top: 1px solid #282828;
            padding: 0 16px; height: 90px;
            display: flex; align-items: center; gap: 16px; z-index: 100;
          }
          .mu-player-left { display: flex; align-items: center; gap: 12px; width: 280px; min-width: 0; }
          .mu-player-art { width: 56px; height: 56px; border-radius: 4px; flex-shrink: 0; object-fit: cover; }
          .mu-player-info { min-width: 0; }
          .mu-player-title { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .mu-player-artist { font-size: 12px; color: #a7a7a7; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

          .mu-player-center { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; max-width: 600px; }
          .mu-player-controls { display: flex; align-items: center; gap: 16px; }
          .mu-ctrl-btn {
            background: none; border: none; color: #a7a7a7; font-size: 18px;
            cursor: pointer; padding: 4px; transition: color 0.15s;
          }
          .mu-ctrl-btn:hover { color: #fff; }
          .mu-play-btn {
            background: #fff; border: none; color: #000; width: 36px; height: 36px;
            border-radius: 50%; font-size: 16px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.1s;
          }
          .mu-play-btn:hover { transform: scale(1.05); }

          .mu-progress-wrap { width: 100%; display: flex; align-items: center; gap: 8px; }
          .mu-progress-time { font-size: 11px; color: #a7a7a7; width: 36px; text-align: center; }
          .mu-progress-bar {
            flex: 1; height: 4px; background: #404040; border-radius: 2px;
            cursor: pointer; position: relative;
          }
          .mu-progress-bar:hover { height: 6px; }
          .mu-progress-fill { height: 100%; background: #1ed760; border-radius: 2px; transition: width 0.1s; }

          .mu-player-right { width: 200px; display: flex; align-items: center; justify-content: flex-end; gap: 8px; }
          .mu-vol-icon { background: none; border: none; color: #a7a7a7; font-size: 16px; cursor: pointer; }
          .mu-vol-bar { width: 100px; height: 4px; background: #404040; border-radius: 2px; }
          .mu-vol-fill { height: 100%; width: 70%; background: #1ed760; border-radius: 2px; }

          @media (max-width: 700px) {
            .mu-player-right { display: none; }
            .mu-player-left { width: auto; flex: 1; }
          }
        </style>

        <div class="mu-layout">
          <div class="mu-hero">
            <div class="mu-hero-inner">
              <h1 class="mu-hero-greeting">Top Charts</h1>
            </div>
          </div>

          <div class="mu-view-tabs">
            ${['tracks', 'artists', 'albums'].map(function(v) {
              return html`<button class="${'mu-view-tab' + (activeView === v ? ' mu-view-tab-active' : '')}"
                                  onclick="${function() { activeView = v; renderApp() }}">${v.charAt(0).toUpperCase() + v.slice(1)}</button>`
            })}
          </div>

          <div class="mu-content">
            ${activeView === 'tracks' ? html`
              <div>
                <div class="mu-track-header">
                  <div class="mu-track-header-num">#</div>
                  <div class="mu-track-header-title">Title</div>
                  <div class="mu-track-header-album">Album</div>
                  <div class="mu-track-header-dur">\u23F1</div>
                </div>
                ${keyed(tracks, function(t) { return t['@id'] }, function(t) { return renderTrackRow(t) })}
              </div>
            ` : null}

            ${activeView === 'artists' ? html`
              <div class="mu-artist-grid">
                ${artists.map(function(a) { return renderArtistCard(a) })}
              </div>
            ` : null}

            ${activeView === 'albums' ? html`
              <div class="mu-album-grid">
                ${albums.map(function(a) { return renderAlbumCard(a) })}
              </div>
            ` : null}
          </div>
        </div>

        ${currentTrack ? html`
          <div class="mu-player">
            <div class="mu-player-left">
              <img class="mu-player-art" src="${currentTrack['albumCoverBig'] || currentTrack['albumCover']}" alt="" />
              <div class="mu-player-info">
                <div class="mu-player-title">${currentTrack['trackTitle']}</div>
                <div class="mu-player-artist">${currentTrack['artist']}</div>
              </div>
            </div>

            <div class="mu-player-center">
              <div class="mu-player-controls">
                <button class="mu-ctrl-btn" onclick="${prevTrack}">\u23EE</button>
                <button class="mu-play-btn" onclick="${function() { playTrack(currentTrack) }}">
                  ${isPlaying ? '\u23F8' : '\u25B6'}
                </button>
                <button class="mu-ctrl-btn" onclick="${nextTrack}">\u23ED</button>
              </div>
              <div class="mu-progress-wrap">
                <span class="mu-progress-time mu-time-elapsed">${audio.currentTime ? formatDuration(Math.floor(audio.currentTime)) : '0:00'}</span>
                <div class="mu-progress-bar" onclick="${seekTo}">
                  <div class="mu-progress-fill" style="${'width: ' + progress + '%'}"></div>
                </div>
                <span class="mu-progress-time mu-time-total">${audio.duration ? formatDuration(Math.floor(audio.duration)) : '0:30'}</span>
              </div>
            </div>

            <div class="mu-player-right">
              <span class="mu-vol-icon">\uD83D\uDD0A</span>
              <div class="mu-vol-bar"><div class="mu-vol-fill"></div></div>
            </div>
          </div>
        ` : null}
      `)
    }

    // ========== INIT ==========
    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, function() {
      unsub()
      audio.pause()
      clearInterval(progressTimer)
    })
  }
}
