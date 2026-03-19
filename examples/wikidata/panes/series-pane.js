import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Browse',
  icon: '\uD83D\uDCFA',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('TVCatalog')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__seriesData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data)
    var root = store.get('#this')

    var searchQuery = ''
    var activeGenre = null
    var sortBy = 'popular'
    var selected = null
    var PAGE_SIZE = 60
    var visibleCount = PAGE_SIZE

    // ========== HELPERS ==========

    function allGenres() {
      var all = store.propAll(root, 'series')
      var counts = {}
      all.forEach(function(s) {
        var genres = (s['genre'] || '').split(', ').filter(Boolean)
        genres.forEach(function(g) {
          counts[g] = (counts[g] || 0) + 1
        })
      })
      return Object.keys(counts)
        .sort(function(a, b) { return counts[b] - counts[a] })
        .slice(0, 20)
    }

    function matchesSearch(s, q) {
      return (s['name'] || '').toLowerCase().indexOf(q) !== -1 ||
             (s['description'] || '').toLowerCase().indexOf(q) !== -1 ||
             (s['network'] || '').toLowerCase().indexOf(q) !== -1 ||
             (s['country'] || '').toLowerCase().indexOf(q) !== -1
    }

    function matchesGenre(s, genre) {
      var genres = (s['genre'] || '').split(', ')
      return genres.indexOf(genre) !== -1
    }

    function filterSeries() {
      var all = store.propAll(root, 'series')
      var result = all

      if (activeGenre) {
        result = result.filter(function(s) { return matchesGenre(s, activeGenre) })
      }
      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        result = result.filter(function(s) { return matchesSearch(s, q) })
      }

      if (sortBy === 'name') {
        result.sort(function(a, b) { return (a['name'] || '').localeCompare(b['name'] || '') })
      } else if (sortBy === 'year') {
        result.sort(function(a, b) { return (b['startYear'] || 0) - (a['startYear'] || 0) })
      } else if (sortBy === 'episodes') {
        result.sort(function(a, b) { return (b['episodes'] || 0) - (a['episodes'] || 0) })
      }

      return result
    }

    function yearRange(s) {
      if (!s['startYear']) return ''
      if (s['endYear'] && s['endYear'] !== s['startYear']) {
        return s['startYear'] + '\u2013' + s['endYear']
      }
      return String(s['startYear'])
    }

    function formatEpisodes(n) {
      if (!n) return ''
      return n + ' ep' + (n !== 1 ? 's' : '')
    }

    function wikidataUrl(id) {
      return 'https://www.wikidata.org/wiki/' + id
    }

    function imdbUrl(id) {
      if (!id) return ''
      return 'https://www.imdb.com/title/' + id + '/'
    }

    function thumbUrl(imageUrl) {
      if (!imageUrl) return ''
      if (imageUrl.indexOf('commons.wikimedia.org') !== -1 || imageUrl.indexOf('upload.wikimedia.org') !== -1) {
        if (imageUrl.indexOf('Special:FilePath') !== -1) {
          return imageUrl + '?width=400'
        }
        return imageUrl.replace('/commons/', '/commons/thumb/') + '/400px-' + imageUrl.split('/').pop()
      }
      return imageUrl
    }

    // ========== RENDER CARD ==========

    function renderCard(s) {
      var img = s['image']
      var isLogo = s['isLogo'] === true
      var yr = yearRange(s)
      var genres = (s['genre'] || '').split(', ').filter(Boolean).slice(0, 2)
      var posterClass = isLogo ? 'tv-card-poster tv-card-poster-logo' : 'tv-card-poster'

      return html`
        <div class="tv-card" onclick="${function() { selected = s; renderApp() }}">
          <div class="${posterClass}">
            ${img
              ? html`<img src="${thumbUrl(img)}" alt="${s['name']}" loading="lazy"
                          onerror="${function(e) { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex' }}" />
                     <div class="tv-card-no-img" style="display: none;">\uD83D\uDCFA</div>`
              : html`<div class="tv-card-no-img">\uD83D\uDCFA</div>`
            }
          </div>
          <div class="tv-card-body">
            <div class="tv-card-title">${s['name']}</div>
            <div class="tv-card-meta">
              ${yr ? html`<span class="tv-card-year">${yr}</span>` : null}
              ${s['episodes'] ? html`<span class="tv-card-eps">${formatEpisodes(s['episodes'])}</span>` : null}
            </div>
            ${genres.length > 0 ? html`
              <div class="tv-card-genres">
                ${genres.map(function(g) { return html`<span class="tv-genre-tag">${g}</span>` })}
              </div>
            ` : null}
          </div>
        </div>
      `
    }

    // ========== RENDER DETAIL MODAL ==========

    function renderDetail(s) {
      if (!s) return null
      var yr = yearRange(s)
      var isLogo = s['isLogo'] === true
      var genres = (s['genre'] || '').split(', ').filter(Boolean)
      var networks = (s['network'] || '').split(', ').filter(Boolean)
      var countries = (s['country'] || '').split(', ').filter(Boolean)
      var heroClass = s['image'] ? (isLogo ? 'tv-modal-hero tv-modal-hero-logo' : 'tv-modal-hero') : 'tv-modal-hero tv-modal-hero-empty'

      return html`
        <div class="tv-modal-overlay" onclick="${function(e) { if (e.target === e.currentTarget) { selected = null; renderApp() } }}">
          <div class="tv-modal">
            ${s['image'] ? html`
              <div class="${heroClass}">
                <img src="${thumbUrl(s['image'])}" alt="${s['name']}" />
                ${isLogo ? null : html`<div class="tv-modal-hero-gradient"></div>`}
                <button class="tv-modal-close" onclick="${function() { selected = null; renderApp() }}">\u2715</button>
              </div>
            ` : html`
              <div class="${heroClass}">
                <div class="tv-modal-hero-icon">\uD83D\uDCFA</div>
                <button class="tv-modal-close" onclick="${function() { selected = null; renderApp() }}">\u2715</button>
              </div>
            `}

            <div class="tv-modal-body">
              <h2 class="tv-modal-title">${s['name']}</h2>
              ${yr ? html`<div class="tv-modal-year">${yr}</div>` : null}

              ${genres.length > 0 ? html`
                <div class="tv-modal-genres">
                  ${genres.map(function(g) { return html`<span class="tv-genre-pill">${g}</span>` })}
                </div>
              ` : null}

              ${s['description'] ? html`
                <p class="tv-modal-desc">${s['description']}</p>
              ` : null}

              <div class="tv-modal-stats">
                ${s['episodes'] ? html`
                  <div class="tv-stat">
                    <div class="tv-stat-value">${s['episodes']}</div>
                    <div class="tv-stat-label">Episodes</div>
                  </div>
                ` : null}
                ${s['seasons'] ? html`
                  <div class="tv-stat">
                    <div class="tv-stat-value">${s['seasons']}</div>
                    <div class="tv-stat-label">Seasons</div>
                  </div>
                ` : null}
                ${s['sitelinks'] ? html`
                  <div class="tv-stat">
                    <div class="tv-stat-value">${s['sitelinks']}</div>
                    <div class="tv-stat-label">Wiki Links</div>
                  </div>
                ` : null}
              </div>

              ${networks.length > 0 ? html`
                <div class="tv-modal-field">
                  <div class="tv-modal-field-label">Network</div>
                  <div class="tv-modal-field-value">${networks.join(', ')}</div>
                </div>
              ` : null}

              ${countries.length > 0 ? html`
                <div class="tv-modal-field">
                  <div class="tv-modal-field-label">Country</div>
                  <div class="tv-modal-field-value">${countries.join(', ')}</div>
                </div>
              ` : null}

              <div class="tv-modal-links">
                <a class="tv-link" href="${wikidataUrl(s['wikidataId'])}" target="_blank" rel="noopener">
                  Wikidata \u2197
                </a>
                ${s['imdb'] ? html`
                  <a class="tv-link tv-link-imdb" href="${imdbUrl(s['imdb'])}" target="_blank" rel="noopener">
                    IMDb \u2197
                  </a>
                ` : null}
              </div>
            </div>
          </div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========

    function renderApp() {
      var filtered = filterSeries()
      var total = store.propAll(root, 'series').length
      var genres = allGenres()
      var visible = filtered.slice(0, visibleCount)
      var hasMore = filtered.length > visibleCount

      render(container, html`
        <style>
          .tv-layout { background: #f5f5f5; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; }

          /* Header */
          .tv-header {
            background: #fff;
            border-bottom: 1px solid #e5e5e5;
            padding: 20px 24px 16px;
            position: sticky; top: 0; z-index: 50;
          }
          .tv-header-inner { max-width: 1400px; margin: 0 auto; }
          .tv-header-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
          .tv-logo { font-size: 22px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 10px; }
          .tv-logo-icon { font-size: 26px; }
          .tv-logo-sub { font-size: 12px; color: #999; font-weight: 400; margin-left: 4px; }
          .tv-count { font-size: 13px; color: #999; margin-left: auto; }

          .tv-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .tv-search {
            flex: 1; min-width: 200px;
            background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 10px;
            padding: 10px 14px; font: 400 14px/1 inherit; color: #111; outline: none;
            transition: border-color 0.2s;
          }
          .tv-search:focus { border-color: #4f46e5; background: #fff; }
          .tv-search::placeholder { color: #aaa; }

          .tv-sort-btn {
            background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 8px;
            padding: 8px 14px; font: 500 13px/1 inherit; color: #666;
            cursor: pointer; transition: all 0.15s;
          }
          .tv-sort-btn:hover { background: #eee; color: #333; }
          .tv-sort-active { background: #4f46e5; color: #fff; border-color: #4f46e5; }

          /* Genre pills */
          .tv-genres-bar {
            max-width: 1400px; margin: 12px auto 0;
            display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px;
          }
          .tv-genre-btn {
            padding: 5px 14px; border-radius: 16px; border: 1px solid #e0e0e0;
            font: 500 13px/1 inherit; cursor: pointer; transition: all 0.15s;
            background: #fff; color: #666;
          }
          .tv-genre-btn:hover { border-color: #ccc; color: #333; }
          .tv-genre-btn-active { background: #4f46e5; color: #fff; border-color: #4f46e5; }

          /* Body */
          .tv-body { max-width: 1400px; margin: 0 auto; padding: 16px 24px 60px; }
          .tv-results { font-size: 13px; color: #999; margin-bottom: 14px; }

          /* Grid */
          .tv-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
            gap: 16px;
          }

          /* Card */
          .tv-card {
            background: #fff; border-radius: 12px; overflow: hidden;
            cursor: pointer; transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s;
            border: 1px solid #eee;
          }
          .tv-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          }
          .tv-card-poster {
            height: 160px; overflow: hidden; background: #f0f0f0;
            display: flex; align-items: center; justify-content: center;
          }
          .tv-card-poster img { width: 100%; height: 100%; object-fit: cover; }
          .tv-card-poster-logo { background: #eef0f8; }
          .tv-card-poster-logo img { object-fit: contain !important; padding: 20px; }
          .tv-card-no-img {
            width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            font-size: 48px; color: #ccc; background: #f5f5f5;
          }
          .tv-card-body { padding: 12px 14px 14px; }
          .tv-card-title {
            font-size: 14px; font-weight: 600; color: #111;
            margin-bottom: 4px; line-height: 1.3;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          }
          .tv-card-meta {
            display: flex; gap: 8px; align-items: center;
            font-size: 12px; color: #888; margin-bottom: 6px;
          }
          .tv-card-year { color: #4f46e5; font-weight: 500; }
          .tv-card-eps { color: #999; }
          .tv-card-genres { display: flex; gap: 4px; flex-wrap: wrap; }
          .tv-genre-tag {
            font-size: 10px; padding: 2px 8px; border-radius: 10px;
            background: #eef0ff; color: #4f46e5; font-weight: 500;
          }

          /* Load more */
          .tv-load-more {
            display: flex; justify-content: center; margin-top: 32px;
          }
          .tv-load-more button {
            padding: 12px 40px; background: #fff; border: 1px solid #e0e0e0;
            border-radius: 10px; color: #4f46e5; font: 500 14px/1 inherit;
            cursor: pointer; transition: all 0.2s;
          }
          .tv-load-more button:hover { background: #f5f5ff; border-color: #4f46e5; }

          /* Modal */
          .tv-modal-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .tv-modal {
            background: #fff; border-radius: 20px;
            width: 520px; max-width: 100%; max-height: 90vh;
            overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.15);
          }
          .tv-modal-hero {
            position: relative; height: 240px; overflow: hidden;
            border-radius: 20px 20px 0 0; background: #f0f0f0;
          }
          .tv-modal-hero img { width: 100%; height: 100%; object-fit: cover; }
          .tv-modal-hero-logo { background: #eef0f8; }
          .tv-modal-hero-logo img { object-fit: contain !important; padding: 32px; }
          .tv-modal-hero-gradient {
            position: absolute; inset: 0;
            background: linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.9) 100%);
          }
          .tv-modal-hero-empty {
            display: flex; align-items: center; justify-content: center;
          }
          .tv-modal-hero-icon { font-size: 64px; color: #ccc; }
          .tv-modal-close {
            position: absolute; top: 12px; right: 12px;
            width: 36px; height: 36px; border-radius: 50%;
            background: rgba(0,0,0,0.4); border: none; color: #fff;
            font-size: 16px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px); transition: background 0.2s;
          }
          .tv-modal-close:hover { background: rgba(0,0,0,0.6); }
          .tv-modal-body { padding: 24px; }
          .tv-modal-title { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 4px; line-height: 1.2; }
          .tv-modal-year { font-size: 15px; color: #4f46e5; font-weight: 500; margin-bottom: 12px; }
          .tv-modal-genres { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px; }
          .tv-genre-pill {
            font-size: 12px; font-weight: 500; padding: 4px 12px;
            border-radius: 14px; background: #eef0ff; color: #4f46e5;
          }
          .tv-modal-desc {
            font-size: 14px; color: #666; line-height: 1.6; margin-bottom: 20px;
          }
          .tv-modal-stats {
            display: flex; gap: 24px; margin-bottom: 20px;
            padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;
          }
          .tv-stat { text-align: center; }
          .tv-stat-value { font-size: 22px; font-weight: 700; color: #111; }
          .tv-stat-label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }
          .tv-modal-field { margin-bottom: 12px; }
          .tv-modal-field-label {
            font-size: 11px; font-weight: 600; color: #aaa;
            text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;
          }
          .tv-modal-field-value { font-size: 14px; color: #444; }
          .tv-modal-links {
            display: flex; gap: 10px; margin-top: 20px; padding-top: 16px;
            border-top: 1px solid #f0f0f0;
          }
          .tv-link {
            padding: 8px 18px; border-radius: 8px; font-size: 13px; font-weight: 500;
            text-decoration: none; transition: all 0.2s;
            background: #f5f5ff; color: #4f46e5; border: 1px solid #e0e0e0;
          }
          .tv-link:hover { background: #eef0ff; border-color: #4f46e5; }
          .tv-link-imdb { color: #b45309; background: #fffbeb; }
          .tv-link-imdb:hover { border-color: #b45309; }

          /* Empty state */
          .tv-empty { text-align: center; padding: 80px 20px; }
          .tv-empty-icon { font-size: 56px; margin-bottom: 16px; color: #ccc; }
          .tv-empty-text { color: #999; font-size: 15px; }

          /* Scrollbar */
          .tv-modal::-webkit-scrollbar { width: 6px; }
          .tv-modal::-webkit-scrollbar-track { background: transparent; }
          .tv-modal::-webkit-scrollbar-thumb { background: #ddd; border-radius: 3px; }
        </style>

        <div class="tv-layout">
          <div class="tv-header">
            <div class="tv-header-inner">
              <div class="tv-header-top">
                <div class="tv-logo">
                  <span class="tv-logo-icon">\uD83D\uDCFA</span>
                  TV Series
                  <span class="tv-logo-sub">powered by Wikidata</span>
                </div>
                <div class="tv-count">${filtered.length} of ${total} series</div>
              </div>
              <div class="tv-controls">
                <input class="tv-search" type="text" placeholder="Search series, networks, countries..."
                       value="${searchQuery}"
                       oninput="${function(e) { searchQuery = e.target.value; visibleCount = PAGE_SIZE; renderApp() }}" />
                ${[
                  { id: 'popular', label: 'Popular' },
                  { id: 'year', label: 'Newest' },
                  { id: 'episodes', label: 'Episodes' },
                  { id: 'name', label: 'A\u2013Z' }
                ].map(function(s) {
                  return html`<button class="${sortBy === s.id ? 'tv-sort-btn tv-sort-active' : 'tv-sort-btn'}"
                                      onclick="${function() { sortBy = s.id; renderApp() }}">${s.label}</button>`
                })}
              </div>
            </div>
          </div>

          <div class="tv-genres-bar">
            <button class="${!activeGenre ? 'tv-genre-btn tv-genre-btn-active' : 'tv-genre-btn'}"
                    onclick="${function() { activeGenre = null; visibleCount = PAGE_SIZE; renderApp() }}">All</button>
            ${genres.map(function(g) {
              var active = activeGenre === g
              return html`<button class="${active ? 'tv-genre-btn tv-genre-btn-active' : 'tv-genre-btn'}"
                                  onclick="${function() { activeGenre = active ? null : g; visibleCount = PAGE_SIZE; renderApp() }}">${g}</button>`
            })}
          </div>

          <div class="tv-body">
            <div class="tv-results">
              ${filtered.length} series${activeGenre ? ' in ' + activeGenre : ''}${searchQuery ? ' matching \u201C' + searchQuery + '\u201D' : ''}
            </div>

            ${filtered.length > 0 ? html`
              <div class="tv-grid">
                ${keyed(visible, function(s) { return s['@id'] }, function(s) { return renderCard(s) })}
              </div>
              ${hasMore ? html`
                <div class="tv-load-more">
                  <button onclick="${function() { visibleCount += PAGE_SIZE; renderApp() }}">
                    Load more (${filtered.length - visibleCount} remaining)
                  </button>
                </div>
              ` : null}
            ` : html`
              <div class="tv-empty">
                <div class="tv-empty-icon">\uD83D\uDCFA</div>
                <div class="tv-empty-text">No series found</div>
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
