import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

var REGION_COLORS = {
  'Africa': '#f59e0b', 'Americas': '#10b981', 'Asia': '#ef4444',
  'Europe': '#3b82f6', 'Oceania': '#8b5cf6', 'Antarctic': '#6b7280'
}

export default {
  label: 'Countries',
  icon: '\uD83C\uDF0D',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Atlas')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__countriesData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { url: '', debounce: 800 })
    var root = store.get('#this')

    var searchQuery = ''
    var activeRegion = null
    var sortBy = 'population'
    var selected = null

    // ========== HELPERS ==========
    function formatPop(n) {
      n = parseInt(n) || 0
      if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
      if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
      if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
      return String(n)
    }

    function formatArea(n) {
      n = parseInt(n) || 0
      if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M km\u00B2'
      if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K km\u00B2'
      return n + ' km\u00B2'
    }

    function allRegions() {
      var countries = store.propAll(root, 'country')
      var regions = {}
      countries.forEach(function(c) { if (c['region']) regions[c['region']] = true })
      return Object.keys(regions).sort()
    }

    function filterCountries() {
      var all = store.propAll(root, 'country')
      var result = all

      if (activeRegion) {
        result = result.filter(function(c) { return c['region'] === activeRegion })
      }
      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        result = result.filter(function(c) {
          return (c['name'] || '').toLowerCase().indexOf(q) !== -1 ||
                 (c['official'] || '').toLowerCase().indexOf(q) !== -1 ||
                 (c['capital'] || '').toLowerCase().indexOf(q) !== -1 ||
                 (c['cca3'] || '').toLowerCase() === q
        })
      }
      if (sortBy === 'name') {
        result.sort(function(a, b) { return (a['name'] || '').localeCompare(b['name'] || '') })
      } else if (sortBy === 'area') {
        result.sort(function(a, b) { return (parseInt(b['area']) || 0) - (parseInt(a['area']) || 0) })
      } else {
        result.sort(function(a, b) { return (parseInt(b['population']) || 0) - (parseInt(a['population']) || 0) })
      }
      return result
    }

    // ========== STAT BAR (for population rank) ==========
    function popBar(pop, maxPop) {
      var pct = maxPop > 0 ? Math.max(1, Math.round(pop / maxPop * 100)) : 0
      return html`<div style="height: 4px; background: #f0f0f0; border-radius: 2px; margin-top: 6px;">
        <div style="${'height: 100%; border-radius: 2px; background: #3b82f6; width: ' + pct + '%;'}"></div>
      </div>`
    }

    // ========== RENDER CARD ==========
    function renderCard(c, maxPop) {
      var regionColor = REGION_COLORS[c['region']] || '#999'
      return html`
        <div class="cx-card" onclick="${function() { selected = c; renderApp() }}">
          <div class="cx-card-flag">
            <img src="${c['flag']}" alt="${c['name']}" loading="lazy" />
          </div>
          <div class="cx-card-body">
            <div class="cx-card-name">${c['flagEmoji']} ${c['name']}</div>
            <div class="cx-card-meta">
              <span class="cx-region-dot" style="${'background: ' + regionColor}"></span>
              ${c['region']}${c['subregion'] ? ' \u00B7 ' + c['subregion'] : ''}
            </div>
            <div class="cx-card-stats">
              <span>\uD83D\uDC65 ${formatPop(c['population'])}</span>
              ${c['capital'] ? html`<span>\uD83C\uDFDB ${c['capital']}</span>` : null}
            </div>
            ${popBar(parseInt(c['population']) || 0, maxPop)}
          </div>
        </div>
      `
    }

    // ========== RENDER DETAIL ==========
    function renderDetail(c) {
      if (!c) return null
      var regionColor = REGION_COLORS[c['region']] || '#999'

      return html`
        <div class="cx-modal-overlay" onclick="${function(e) { if (e.target === e.currentTarget) { selected = null; renderApp() } }}">
          <div class="cx-modal">
            <div class="cx-modal-flag">
              <img src="${c['flag']}" alt="${c['name']}" />
              <button class="cx-modal-close" onclick="${function() { selected = null; renderApp() }}">\u2715</button>
            </div>
            <div class="cx-modal-body">
              <div class="cx-modal-header">
                <h2 class="cx-modal-name">${c['flagEmoji']} ${c['name']}</h2>
                <div class="cx-modal-official">${c['official']}</div>
                <div class="cx-modal-region">
                  <span class="cx-region-pill" style="${'background: ' + regionColor}">${c['region']}</span>
                  ${c['subregion'] ? html`<span class="cx-modal-subregion">${c['subregion']}</span>` : null}
                </div>
              </div>

              <div class="cx-modal-grid">
                <div class="cx-detail-item">
                  <div class="cx-detail-label">Population</div>
                  <div class="cx-detail-value">${(parseInt(c['population']) || 0).toLocaleString()}</div>
                </div>
                <div class="cx-detail-item">
                  <div class="cx-detail-label">Area</div>
                  <div class="cx-detail-value">${formatArea(c['area'])}</div>
                </div>
                <div class="cx-detail-item">
                  <div class="cx-detail-label">Capital</div>
                  <div class="cx-detail-value">${c['capital'] || 'N/A'}</div>
                </div>
                <div class="cx-detail-item">
                  <div class="cx-detail-label">Country Code</div>
                  <div class="cx-detail-value">${c['cca3']}</div>
                </div>
              </div>

              ${c['languages'] ? html`
                <div class="cx-detail-section">
                  <div class="cx-detail-label">Languages</div>
                  <div class="cx-detail-text">${c['languages']}</div>
                </div>
              ` : null}
              ${c['currencies'] ? html`
                <div class="cx-detail-section">
                  <div class="cx-detail-label">Currencies</div>
                  <div class="cx-detail-text">${c['currencies']}</div>
                </div>
              ` : null}
              ${c['timezones'] ? html`
                <div class="cx-detail-section">
                  <div class="cx-detail-label">Timezones</div>
                  <div class="cx-detail-text">${c['timezones']}</div>
                </div>
              ` : null}
              ${c['borders'] ? html`
                <div class="cx-detail-section">
                  <div class="cx-detail-label">Borders</div>
                  <div class="cx-detail-text">${c['borders']}</div>
                </div>
              ` : null}
              ${c['tld'] ? html`
                <div class="cx-detail-section">
                  <div class="cx-detail-label">Top-Level Domain</div>
                  <div class="cx-detail-text">${c['tld']}</div>
                </div>
              ` : null}

              <div class="cx-detail-badges">
                ${c['independent'] === true ? html`<span class="cx-badge cx-badge-green">Independent</span>` : null}
                ${c['unMember'] === true ? html`<span class="cx-badge cx-badge-blue">UN Member</span>` : null}
              </div>
            </div>
          </div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========
    function renderApp() {
      var filtered = filterCountries()
      var regions = allRegions()
      var total = store.propAll(root, 'country').length
      var maxPop = 1500000000

      render(container, html`
        <style>
          .cx-layout { background: #fafafa; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

          .cx-header {
            background: #fff;
            border-bottom: 1px solid #e5e5e5;
            padding: 20px 24px 16px;
            position: sticky; top: 0; z-index: 50;
          }
          .cx-header-inner { max-width: 1200px; margin: 0 auto; }
          .cx-header-top {
            display: flex; align-items: center; gap: 12px; margin-bottom: 14px;
          }
          .cx-logo { font-size: 24px; font-weight: 700; color: #111; display: flex; align-items: center; gap: 8px; }
          .cx-logo-globe { font-size: 28px; }
          .cx-count { font-size: 13px; color: #999; margin-left: auto; }

          .cx-controls { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
          .cx-search {
            flex: 1; min-width: 200px;
            background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 10px;
            padding: 9px 14px; font: 400 14px/1 inherit; color: #111; outline: none;
          }
          .cx-search:focus { border-color: #3b82f6; background: #fff; }
          .cx-search::placeholder { color: #aaa; }
          .cx-sort-btn {
            background: #f5f5f5; border: 1px solid #e5e5e5; border-radius: 8px;
            padding: 7px 14px; font: 500 13px/1 inherit; color: #555;
            cursor: pointer; transition: all 0.15s;
          }
          .cx-sort-btn:hover { background: #eee; }
          .cx-sort-active { background: #3b82f6; color: #fff; border-color: #3b82f6; }

          .cx-regions {
            max-width: 1200px; margin: 12px auto 0;
            display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px;
          }
          .cx-region-btn {
            padding: 5px 14px; border-radius: 16px; border: 1px solid #e5e5e5;
            font: 500 13px/1 inherit; cursor: pointer; transition: all 0.15s;
            background: #fff; color: #555;
          }
          .cx-region-btn:hover { border-color: #ccc; }
          .cx-region-btn-active { color: #fff; border-color: transparent; }

          .cx-body { max-width: 1200px; margin: 0 auto; padding: 16px 24px 60px; }
          .cx-results { font-size: 13px; color: #999; margin-bottom: 14px; }

          .cx-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 12px;
          }

          /* Card */
          .cx-card {
            background: #fff; border-radius: 12px; overflow: hidden;
            cursor: pointer; transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s;
            border: 1px solid #eee;
          }
          .cx-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          }
          .cx-card-flag {
            height: 140px; overflow: hidden; background: #f5f5f5;
            display: flex; align-items: center; justify-content: center;
          }
          .cx-card-flag img { width: 100%; height: 100%; object-fit: cover; }
          .cx-card-body { padding: 14px 16px; }
          .cx-card-name { font-size: 16px; font-weight: 600; color: #111; margin-bottom: 4px; }
          .cx-card-meta {
            font-size: 13px; color: #888; margin-bottom: 6px;
            display: flex; align-items: center; gap: 6px;
          }
          .cx-region-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
          .cx-card-stats {
            display: flex; gap: 14px; font-size: 13px; color: #666;
          }

          /* Modal */
          .cx-modal-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .cx-modal {
            background: #fff; border-radius: 20px;
            width: 480px; max-width: 100%; max-height: 90vh;
            overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.2);
          }
          .cx-modal-flag {
            position: relative; height: 200px; overflow: hidden;
            border-radius: 20px 20px 0 0;
          }
          .cx-modal-flag img { width: 100%; height: 100%; object-fit: cover; }
          .cx-modal-close {
            position: absolute; top: 12px; right: 12px;
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(0,0,0,0.4); border: none; color: #fff;
            font-size: 14px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            backdrop-filter: blur(4px);
          }
          .cx-modal-close:hover { background: rgba(0,0,0,0.6); }
          .cx-modal-body { padding: 24px; }
          .cx-modal-header { margin-bottom: 20px; }
          .cx-modal-name { font-size: 26px; font-weight: 700; color: #111; margin-bottom: 4px; }
          .cx-modal-official { font-size: 14px; color: #888; margin-bottom: 10px; }
          .cx-modal-region { display: flex; align-items: center; gap: 8px; }
          .cx-region-pill { color: #fff; font-size: 12px; font-weight: 600; padding: 3px 12px; border-radius: 12px; }
          .cx-modal-subregion { font-size: 13px; color: #888; }

          .cx-modal-grid {
            display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
            margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #f0f0f0;
          }
          .cx-detail-item { }
          .cx-detail-label { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
          .cx-detail-value { font-size: 16px; font-weight: 600; color: #111; }
          .cx-detail-section { margin-bottom: 14px; }
          .cx-detail-text { font-size: 14px; color: #555; line-height: 1.5; }

          .cx-detail-badges { display: flex; gap: 6px; margin-top: 16px; }
          .cx-badge { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 10px; }
          .cx-badge-green { background: #dcfce7; color: #166534; }
          .cx-badge-blue { background: #dbeafe; color: #1e40af; }

          .cx-empty { text-align: center; padding: 60px 20px; color: #ccc; }
          .cx-empty-icon { font-size: 48px; margin-bottom: 12px; }
        </style>

        <div class="cx-layout">
          <div class="cx-header">
            <div class="cx-header-inner">
              <div class="cx-header-top">
                <div class="cx-logo"><span class="cx-logo-globe">\uD83C\uDF0D</span> Countries</div>
                <div class="cx-count">${filtered.length} of ${total}</div>
              </div>
              <div class="cx-controls">
                <input class="cx-search" type="text" placeholder="Search countries, capitals, codes..."
                       value="${searchQuery}"
                       oninput="${function(e) { searchQuery = e.target.value; renderApp() }}" />
                ${[
                  { id: 'population', label: 'Population' },
                  { id: 'name', label: 'A-Z' },
                  { id: 'area', label: 'Area' }
                ].map(function(s) {
                  return html`<button class="${'cx-sort-btn' + (sortBy === s.id ? ' cx-sort-active' : '')}"
                                      onclick="${function() { sortBy = s.id; renderApp() }}">${s.label}</button>`
                })}
              </div>
            </div>
          </div>

          <div class="cx-regions">
            <button class="${'cx-region-btn' + (!activeRegion ? ' cx-region-btn-active' : '')}"
                    style="${!activeRegion ? 'background: #111; color: #fff; border-color: #111;' : ''}"
                    onclick="${function() { activeRegion = null; renderApp() }}">All</button>
            ${regions.map(function(r) {
              var active = activeRegion === r
              var color = REGION_COLORS[r] || '#999'
              return html`<button class="${'cx-region-btn' + (active ? ' cx-region-btn-active' : '')}"
                                  style="${active ? 'background: ' + color + '; color: #fff;' : ''}"
                                  onclick="${function() { activeRegion = active ? null : r; renderApp() }}">${r}</button>`
            })}
          </div>

          <div class="cx-body">
            <div class="cx-results">${filtered.length} countr${filtered.length === 1 ? 'y' : 'ies'}${activeRegion ? ' in ' + activeRegion : ''}${searchQuery ? ' matching "' + searchQuery + '"' : ''}</div>

            ${filtered.length > 0 ? html`
              <div class="cx-grid">
                ${keyed(filtered, function(c) { return c['@id'] }, function(c) { return renderCard(c, maxPop) })}
              </div>
            ` : html`
              <div class="cx-empty">
                <div class="cx-empty-icon">\uD83C\uDF0D</div>
                <div>No countries found</div>
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
