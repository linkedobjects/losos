import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Browse',
  icon: '\uD83C\uDFB5',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('MusicCatalog')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__musicData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data)
    var root = store.get('#this')

    var searchQuery = ''
    var activeGenre = null
    var activeType = null
    var sortBy = 'score'
    var selected = null
    var PAGE_SIZE = 60
    var visibleCount = PAGE_SIZE

    // ========== HELPERS ==========

    function allGenres() {
      var all = store.propAll(root, 'releases')
      var counts = {}
      all.forEach(function(r) {
        var genres = (r['genre'] || '').split(', ').filter(Boolean)
        genres.forEach(function(g) {
          counts[g] = (counts[g] || 0) + 1
        })
      })
      return Object.keys(counts)
        .sort(function(a, b) { return counts[b] - counts[a] })
        .slice(0, 20)
    }

    function allTypes() {
      var all = store.propAll(root, 'releases')
      var counts = {}
      all.forEach(function(r) {
        var t = r['releaseType'] || 'Album'
        counts[t] = (counts[t] || 0) + 1
      })
      return Object.keys(counts)
        .sort(function(a, b) { return counts[b] - counts[a] })
    }

    function matchesSearch(r, q) {
      return (r['name'] || '').toLowerCase().indexOf(q) !== -1 ||
             (r['artist'] || '').toLowerCase().indexOf(q) !== -1 ||
             (r['genre'] || '').toLowerCase().indexOf(q) !== -1
    }

    function matchesGenre(r, genre) {
      var genres = (r['genre'] || '').split(', ')
      return genres.indexOf(genre) !== -1
    }

    function matchesType(r, type) {
      return (r['releaseType'] || 'Album') === type
    }

    function filterReleases() {
      var all = store.propAll(root, 'releases')
      var result = all

      if (activeGenre) {
        result = result.filter(function(r) { return matchesGenre(r, activeGenre) })
      }
      if (activeType) {
        result = result.filter(function(r) { return matchesType(r, activeType) })
      }
      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        result = result.filter(function(r) { return matchesSearch(r, q) })
      }

      if (sortBy === 'name') {
        result.sort(function(a, b) { return (a['name'] || '').localeCompare(b['name'] || '') })
      } else if (sortBy === 'year') {
        result.sort(function(a, b) { return (b['releaseYear'] || 0) - (a['releaseYear'] || 0) })
      } else if (sortBy === 'artist') {
        result.sort(function(a, b) { return (a['artist'] || '').localeCompare(b['artist'] || '') })
      }
      // 'score' keeps original order (by MusicBrainz relevance)

      return result
    }

    function mbUrl(mbid) {
      return 'https://musicbrainz.org/release-group/' + mbid
    }

    // ========== RENDER CARD ==========

    function renderCard(r) {
      var img = r['image']
      var yr = r['releaseYear']
      var genres = (r['genre'] || '').split(', ').filter(Boolean).slice(0, 2)
      var type = r['releaseType'] || 'Album'

      return html`
        <div class="mb-card" onclick="${function() { selected = r; renderApp() }}">
          <div class="mb-card-cover">
            ${img
              ? html`<img src="${img}" alt="${r['name']}" loading="lazy"
                          onerror="${function(e) { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}" />
                     <div class="mb-card-no-img" style="display: none;">\uD83C\uDFB5</div>`
              : html`<div class="mb-card-no-img">\uD83C\uDFB5</div>`
            }
          </div>
          <div class="mb-card-body">
            <div class="mb-card-title">${r['name']}</div>
            <div class="mb-card-artist">${r['artist']}</div>
            <div class="mb-card-meta">
              ${yr ? html`<span class="mb-card-year">${yr}</span>` : null}
              ${type !== 'Album' ? html`<span class="mb-card-type">${type}</span>` : null}
            </div>
            ${genres.length > 0 ? html`
              <div class="mb-card-genres">
                ${genres.map(function(g) { return html`<span class="mb-genre-tag">${g}</span>` })}
              </div>
            ` : null}
          </div>
        </div>
      `
    }

    // ========== RENDER DETAIL MODAL ==========

    function renderDetail(r) {
      if (!r) return null
      var yr = r['releaseYear']
      var genres = (r['genre'] || '').split(', ').filter(Boolean)
      var type = r['releaseType'] || 'Album'

      return html`
        <div class="mb-modal-overlay" onclick="${function(e) { if (e.target === e.currentTarget) { selected = null; renderApp() } }}">
          <div class="mb-modal">
            <div class="mb-modal-hero">
              ${r['image']
                ? html`<img src="${r['image']}" alt="${r['name']}"
                            onerror="${function(e) { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}" />
                       <div class="mb-modal-hero-icon" style="display: none;">\uD83C\uDFB5</div>`
                : html`<div class="mb-modal-hero-icon">\uD83C\uDFB5</div>`
              }
              <button class="mb-modal-close" onclick="${function() { selected = null; renderApp() }}">\u2715</button>
            </div>

            <div class="mb-modal-body">
              <h2 class="mb-modal-title">${r['name']}</h2>
              <div class="mb-modal-artist">${r['artist']}</div>

              <div class="mb-modal-info">
                ${yr ? html`<span class="mb-modal-year">${yr}</span>` : null}
                <span class="mb-modal-type">${type}</span>
              </div>

              ${genres.length > 0 ? html`
                <div class="mb-modal-genres">
                  ${genres.map(function(g) { return html`<span class="mb-genre-pill">${g}</span>` })}
                </div>
              ` : null}

              ${r['releaseDate'] ? html`
                <div class="mb-modal-field">
                  <div class="mb-modal-field-label">Release Date</div>
                  <div class="mb-modal-field-value">${r['releaseDate']}</div>
                </div>
              ` : null}

              <div class="mb-modal-links">
                <a class="mb-link" href="${mbUrl(r['mbid'])}" target="_blank" rel="noopener">
                  MusicBrainz \u2197
                </a>
              </div>
            </div>
          </div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========

    function renderApp() {
      var filtered = filterReleases()
      var total = store.propAll(root, 'releases').length
      var genres = allGenres()
      var types = allTypes()
      var visible = filtered.slice(0, visibleCount)
      var hasMore = filtered.length > visibleCount

      render(container, html`
        <style>
          .mb-layout { background: #f5f5f5; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; }

          /* Header */
          .mb-header {
            background: #fff;
            border-bottom: 1px solid #e5e5e5;
            padding: 20px 24px 16px;
            position: sticky; top: 0; z-index: 50;
          }
          .mb-header-inner { max-width: 1400px; margin: 0 auto; }
          .mb-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
          .mb-logo { font-size: 22px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 10px; }
          .mb-logo-icon { font-size: 26px; }
          .mb-logo-sub { font-size: 12px; color: #999; font-weight: 400; margin-left: 4px; }
          .mb-count { font-size: 13px; color: #999; margin-left: auto; }

          .mb-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .mb-search {
            flex: 1; min-width: 200px;
            background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 10px;
            padding: 10px 14px; font: 400 14px/1 inherit; color: #111; outline: none;
            transition: border-color 0.2s;
          }
          .mb-search:focus { border-color: #e11d48; background: #fff; }
          .mb-search::placeholder { color: #aaa; }

          .mb-sort-btn {
            background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px;
            padding: 8px 14px; font: 500 13px/1 inherit; color: #666;
            cursor: pointer; transition: all 0.15s;
          }
          .mb-sort-btn:hover { background: #eee; color: #333; }
          .mb-sort-active { background: #e11d48; color: #fff; border-color: #e11d48; }

          /* Type pills */
          .mb-types-bar {
            max-width: 1400px; margin: 10px auto 0;
            display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px;
          }
          .mb-type-btn {
            padding: 5px 14px; border-radius: 16px; border: 1px solid #e0e0e0;
            font: 500 13px/1 inherit; cursor: pointer; transition: all 0.15s;
            background: #fff; color: #666;
          }
          .mb-type-btn:hover { border-color: #ccc; color: #333; }
          .mb-type-btn-active { background: #7c3aed; color: #fff; border-color: #7c3aed; }

          /* Genre pills */
          .mb-genres-bar {
            max-width: 1400px; margin: 8px auto 0;
            display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px;
          }
          .mb-genre-btn {
            padding: 5px 14px; border-radius: 16px; border: 1px solid #e0e0e0;
            font: 500 13px/1 inherit; cursor: pointer; transition: all 0.15s;
            background: #fff; color: #666;
          }
          .mb-genre-btn:hover { border-color: #ccc; color: #333; }
          .mb-genre-btn-active { background: #e11d48; color: #fff; border-color: #e11d48; }

          /* Body */
          .mb-body { max-width: 1400px; margin: 0 auto; padding: 16px 24px 60px; }
          .mb-results { font-size: 13px; color: #999; margin-bottom: 14px; }

          /* Grid */
          .mb-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 16px;
          }

          /* Card */
          .mb-card {
            background: #fff; border-radius: 12px; overflow: hidden;
            cursor: pointer; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s;
            border: 1px solid #eee;
          }
          .mb-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          }
          .mb-card-cover {
            aspect-ratio: 1; overflow: hidden; background: #f0f0f0;
            display: flex; align-items: center; justify-content: center;
          }
          .mb-card-cover img { width: 100%; height: 100%; object-fit: cover; }
          .mb-card-no-img {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            font-size: 48px; color: #ccc; background: linear-gradient(135deg, #f0e6f6 0%, #e6e0f0 100%);
          }
          .mb-card-body { padding: 12px 14px 14px; }
          .mb-card-title {
            font-size: 14px; font-weight: 600; color: #111;
            margin-bottom: 2px; line-height: 1.3;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .mb-card-artist {
            font-size: 13px; color: #666; margin-bottom: 4px;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .mb-card-meta {
            display: flex; gap: 8px; align-items: center;
            font-size: 12px; color: #888; margin-bottom: 6px;
          }
          .mb-card-year { color: #e11d48; font-weight: 500; }
          .mb-card-type { color: #7c3aed; font-weight: 500; font-size: 11px; }
          .mb-card-genres { display: flex; gap: 4px; flex-wrap: wrap; }
          .mb-genre-tag {
            font-size: 10px; padding: 2px 8px; border-radius: 10px;
            background: #fef2f2; color: #e11d48; font-weight: 500;
          }

          /* Load more */
          .mb-load-more {
            display: flex; justify-content: center; margin-top: 32px;
          }
          .mb-load-more button {
            padding: 12px 40px; background: #fff; border: 1px solid #e0e0e0;
            border-radius: 10px; color: #e11d48; font: 500 14px/1 inherit;
            cursor: pointer; transition: all 0.2s;
          }
          .mb-load-more button:hover { background: #fff5f5; border-color: #e11d48; }

          /* Modal */
          .mb-modal-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .mb-modal {
            background: #fff; border-radius: 20px;
            width: 480px; max-width: 100%; max-height: 90vh;
            overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.15);
          }
          .mb-modal-hero {
            position: relative; aspect-ratio: 1; overflow: hidden;
            border-radius: 20px 20px 0 0; background: #f0f0f0;
            display: flex; align-items: center; justify-content: center;
          }
          .mb-modal-hero img { width: 100%; height: 100%; object-fit: cover; }
          .mb-modal-hero-icon { font-size: 80px; color: #ccc; }
          .mb-modal-close {
            position: absolute; top: 12px; right: 12px;
            width: 36px; height: 36px; border-radius: 50%;
            background: rgba(0,0,0,0.4); border: none; color: #fff;
            font-size: 16px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px); transition: background 0.2s;
          }
          .mb-modal-close:hover { background: rgba(0,0,0,0.6); }
          .mb-modal-body { padding: 24px; }
          .mb-modal-title { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 2px; line-height: 1.2; }
          .mb-modal-artist { font-size: 16px; color: #666; margin-bottom: 12px; }
          .mb-modal-info { display: flex; gap: 12px; align-items: center; margin-bottom: 14px; }
          .mb-modal-year { font-size: 15px; color: #e11d48; font-weight: 500; }
          .mb-modal-type {
            font-size: 12px; font-weight: 600; padding: 3px 10px;
            border-radius: 12px; background: #f3f0ff; color: #7c3aed;
          }
          .mb-modal-genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
          .mb-genre-pill {
            font-size: 12px; font-weight: 500; padding: 4px 12px;
            border-radius: 14px; background: #fef2f2; color: #e11d48;
          }
          .mb-modal-field { margin-bottom: 12px; }
          .mb-modal-field-label {
            font-size: 11px; font-weight: 600; color: #aaa;
            text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;
          }
          .mb-modal-field-value { font-size: 14px; color: #444; }
          .mb-modal-links {
            display: flex; gap: 10px; margin-top: 20px; padding-top: 16px;
            border-top: 1px solid #f0f0f0;
          }
          .mb-link {
            padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;
            text-decoration: none; transition: all 0.2s;
            background: #fff5f5; color: #e11d48; border: 1px solid #e0e0e0;
          }
          .mb-link:hover { background: #fef2f2; border-color: #e11d48; }

          /* Empty state */
          .mb-empty { text-align: center; padding: 80px 20px; }
          .mb-empty-icon { font-size: 56px; margin-bottom: 16px; color: #ccc; }
          .mb-empty-text { color: #999; font-size: 15px; }

          /* Scrollbar */
          .mb-modal::-webkit-scrollbar { width: 6px; }
          .mb-modal::-webkit-scrollbar-track { background: transparent; }
          .mb-modal::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
        </style>

        <div class="mb-layout">
          <div class="mb-header">
            <div class="mb-header-inner">
              <div class="mb-header-top">
                <div class="mb-logo">
                  <span class="mb-logo-icon">\uD83C\uDFB5</span>
                  Music Browser
                  <span class="mb-logo-sub">powered by MusicBrainz</span>
                </div>
                <div class="mb-count">${filtered.length} of ${total} albums</div>
              </div>
              <div class="mb-controls">
                <input class="mb-search" type="text" placeholder="Search albums, artists, genres..."
                       value="${searchQuery}"
                       oninput="${function(e) { searchQuery = e.target.value; visibleCount = PAGE_SIZE; renderApp() }}" />
                ${[
                  { id: 'score', label: 'Relevance' },
                  { id: 'year', label: 'Newest' },
                  { id: 'artist', label: 'Artist' },
                  { id: 'name', label: 'A\u2013Z' }
                ].map(function(s) {
                  return html`<button class="${sortBy === s.id ? 'mb-sort-btn mb-sort-active' : 'mb-sort-btn'}"
                                      onclick="${function() { sortBy = s.id; renderApp() }}">${s.label}</button>`
                })}
              </div>
            </div>
          </div>

          ${types.length > 1 ? html`
            <div class="mb-types-bar">
              <button class="${!activeType ? 'mb-type-btn mb-type-btn-active' : 'mb-type-btn'}"
                      onclick="${function() { activeType = null; visibleCount = PAGE_SIZE; renderApp() }}">All Types</button>
              ${types.map(function(t) {
                var active = activeType === t
                return html`<button class="${active ? 'mb-type-btn mb-type-btn-active' : 'mb-type-btn'}"
                                    onclick="${function() { activeType = active ? null : t; visibleCount = PAGE_SIZE; renderApp() }}">${t}</button>`
              })}
            </div>
          ` : null}

          <div class="mb-genres-bar">
            <button class="${!activeGenre ? 'mb-genre-btn mb-genre-btn-active' : 'mb-genre-btn'}"
                    onclick="${function() { activeGenre = null; visibleCount = PAGE_SIZE; renderApp() }}">All Genres</button>
            ${genres.map(function(g) {
              var active = activeGenre === g
              return html`<button class="${active ? 'mb-genre-btn mb-genre-btn-active' : 'mb-genre-btn'}"
                                  onclick="${function() { activeGenre = active ? null : g; visibleCount = PAGE_SIZE; renderApp() }}">${g}</button>`
            })}
          </div>

          <div class="mb-body">
            <div class="mb-results">
              ${filtered.length} albums${activeGenre ? ' in ' + activeGenre : ''}${activeType ? ' (' + activeType + ')' : ''}${searchQuery ? ' matching \u201C' + searchQuery + '\u201D' : ''}
            </div>

            ${filtered.length > 0 ? html`
              <div class="mb-grid">
                ${keyed(visible, function(r) { return r['@id'] }, function(r) { return renderCard(r) })}
              </div>
              ${hasMore ? html`
                <div class="mb-load-more">
                  <button onclick="${function() { visibleCount += PAGE_SIZE; renderApp() }}">
                    Load more (${filtered.length - visibleCount} remaining)
                  </button>
                </div>
              ` : null}
            ` : html`
              <div class="mb-empty">
                <div class="mb-empty-icon">\uD83C\uDFB5</div>
                <div class="mb-empty-text">No albums found</div>
              </div>
            `}
          </div>
        </div>

        ${selected ? renderDetail(selected) : null}
      `)
    }

    // ========== INIT ==========
    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
