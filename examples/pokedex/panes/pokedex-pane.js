import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

var TYPE_COLORS = {
  normal: '#a8a77a', fire: '#ee8130', water: '#6390f0', electric: '#f7d02c',
  grass: '#7ac74c', ice: '#96d9d6', fighting: '#c22e28', poison: '#a33ea1',
  ground: '#e2bf65', flying: '#a98ff3', psychic: '#f95587', bug: '#a6b91a',
  rock: '#b6a136', ghost: '#735797', dragon: '#6f35fc', dark: '#705746',
  steel: '#b7b7ce', fairy: '#d685ad'
}

export default {
  label: 'Pokedex',
  icon: '\uD83D\uDC7E',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Pokedex')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__pokedexData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { url: '', debounce: 800 })
    var root = store.get('#this')

    var searchQuery = ''
    var activeType = null
    var selectedPokemon = null
    var sortBy = 'id'

    // ========== HELPERS ==========
    function getTypes(p) {
      return (p['types'] || '').split(',').map(function(t) { return t.trim() }).filter(Boolean)
    }

    function typeColor(t) { return TYPE_COLORS[t] || '#999' }

    function allTypes() {
      var pokemon = store.propAll(root, 'pokemon')
      var types = {}
      pokemon.forEach(function(p) {
        getTypes(p).forEach(function(t) { types[t] = (types[t] || 0) + 1 })
      })
      return Object.keys(types).sort()
    }

    function statTotal(p) {
      return (parseInt(p['hp'])||0) + (parseInt(p['attack'])||0) + (parseInt(p['defense'])||0) +
             (parseInt(p['spAtk'])||0) + (parseInt(p['spDef'])||0) + (parseInt(p['speed'])||0)
    }

    function filterPokemon() {
      var all = store.propAll(root, 'pokemon')
      var result = all

      if (activeType) {
        result = result.filter(function(p) {
          return getTypes(p).indexOf(activeType) !== -1
        })
      }

      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        result = result.filter(function(p) {
          return (p['name'] || '').toLowerCase().indexOf(q) !== -1 ||
                 String(p['pid']) === q
        })
      }

      if (sortBy === 'name') {
        result.sort(function(a, b) { return (a['name'] || '').localeCompare(b['name'] || '') })
      } else if (sortBy === 'stats') {
        result.sort(function(a, b) { return statTotal(b) - statTotal(a) })
      }

      return result
    }

    function padId(id) {
      var s = String(id)
      while (s.length < 3) s = '0' + s
      return '#' + s
    }

    // ========== ACTIONS ==========
    function openDetail(p) { selectedPokemon = p; renderApp() }
    function closeDetail() { selectedPokemon = null; renderApp() }

    // ========== STAT BAR ==========
    function statBar(label, value, max, color) {
      var pct = Math.min(100, Math.round(value / max * 100))
      return html`
        <div class="pdx-stat-row">
          <span class="pdx-stat-label">${label}</span>
          <span class="pdx-stat-val">${value}</span>
          <div class="pdx-stat-track">
            <div class="pdx-stat-fill" style="${'width: ' + pct + '%; background: ' + color}"></div>
          </div>
        </div>
      `
    }

    // ========== RENDER CARD ==========
    function renderCard(p) {
      var types = getTypes(p)
      var mainColor = typeColor(types[0]) || '#999'

      return html`
        <div class="pdx-card" onclick="${function() { openDetail(p) }}"
             style="${'border-top: 3px solid ' + mainColor}">
          <div class="pdx-card-id" style="${'color: ' + mainColor}">${padId(p['pid'])}</div>
          <div class="pdx-card-img-wrap">
            <img class="pdx-card-img" src="${p['sprite']}" alt="${p['name']}" loading="lazy" />
          </div>
          <div class="pdx-card-name">${p['name']}</div>
          <div class="pdx-card-types">
            ${types.map(function(t) {
              return html`<span class="pdx-type-pill" style="${'background: ' + typeColor(t)}">${t}</span>`
            })}
          </div>
        </div>
      `
    }

    // ========== RENDER DETAIL ==========
    function renderDetail(p) {
      if (!p) return null
      var types = getTypes(p)
      var mainColor = typeColor(types[0]) || '#999'
      var total = statTotal(p)

      return html`
        <div class="pdx-modal-overlay" onclick="${function(e) { if (e.target === e.currentTarget) closeDetail() }}">
          <div class="pdx-modal">
            <div class="pdx-modal-top" style="${'background: ' + mainColor}">
              <button class="pdx-modal-close" onclick="${closeDetail}">\u2715</button>
              <div class="pdx-modal-id">${padId(p['pid'])}</div>
              <img class="pdx-modal-img" src="${p['sprite']}" alt="${p['name']}" />
              <h2 class="pdx-modal-name">${p['name']}</h2>
              <div class="pdx-modal-types">
                ${types.map(function(t) {
                  return html`<span class="pdx-type-pill pdx-type-pill-lg" style="${'background: rgba(255,255,255,0.25); color: #fff'}">${t}</span>`
                })}
              </div>
            </div>
            <div class="pdx-modal-body">
              <div class="pdx-modal-measures">
                <div class="pdx-measure">
                  <div class="pdx-measure-val">${(parseInt(p['height']) / 10).toFixed(1)} m</div>
                  <div class="pdx-measure-label">Height</div>
                </div>
                <div class="pdx-measure-divider"></div>
                <div class="pdx-measure">
                  <div class="pdx-measure-val">${(parseInt(p['weight']) / 10).toFixed(1)} kg</div>
                  <div class="pdx-measure-label">Weight</div>
                </div>
                <div class="pdx-measure-divider"></div>
                <div class="pdx-measure">
                  <div class="pdx-measure-val">${total}</div>
                  <div class="pdx-measure-label">Base Total</div>
                </div>
              </div>

              <div class="pdx-section-title" style="${'color: ' + mainColor}">Base Stats</div>
              ${statBar('HP', p['hp'], 255, mainColor)}
              ${statBar('ATK', p['attack'], 190, mainColor)}
              ${statBar('DEF', p['defense'], 230, mainColor)}
              ${statBar('SpA', p['spAtk'], 194, mainColor)}
              ${statBar('SpD', p['spDef'], 230, mainColor)}
              ${statBar('SPD', p['speed'], 180, mainColor)}

              <div class="pdx-section-title" style="${'color: ' + mainColor}">Abilities</div>
              <div class="pdx-abilities">${p['abilities']}</div>

              ${p['cry'] ? html`
                <div class="pdx-section-title" style="${'color: ' + mainColor}">Cry</div>
                <audio controls src="${p['cry']}" style="width: 100%; height: 36px; margin-bottom: 8px;"></audio>
              ` : null}
            </div>
          </div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========
    function renderApp() {
      var filtered = filterPokemon()
      var types = allTypes()
      var total = store.propAll(root, 'pokemon').length

      render(container, html`
        <style>
          .pdx-layout { background: #f5f5f5; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

          .pdx-header {
            background: #e63946;
            padding: 24px 24px 20px;
            color: #fff;
            position: sticky; top: 0; z-index: 50;
            box-shadow: 0 2px 12px rgba(230,57,70,0.3);
          }
          .pdx-header-top {
            max-width: 1200px; margin: 0 auto;
            display: flex; align-items: center; gap: 16px; margin-bottom: 16px;
          }
          .pdx-logo { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; }
          .pdx-logo-icon { font-size: 32px; }
          .pdx-count { font-size: 14px; opacity: 0.7; margin-left: auto; }
          .pdx-search-bar {
            max-width: 1200px; margin: 0 auto;
            display: flex; gap: 8px; align-items: center;
          }
          .pdx-search {
            flex: 1; background: rgba(255,255,255,0.2);
            border: none; border-radius: 12px; padding: 10px 16px;
            font: 400 15px/1 inherit; color: #fff; outline: none;
          }
          .pdx-search::placeholder { color: rgba(255,255,255,0.6); }
          .pdx-search:focus { background: rgba(255,255,255,0.3); }
          .pdx-sort-btn {
            background: rgba(255,255,255,0.2); border: none; border-radius: 10px;
            padding: 8px 14px; font: 500 13px/1 inherit; color: #fff;
            cursor: pointer; white-space: nowrap;
          }
          .pdx-sort-btn:hover { background: rgba(255,255,255,0.3); }
          .pdx-sort-active { background: rgba(255,255,255,0.35); }

          /* Type filter chips */
          .pdx-types-bar {
            max-width: 1200px; margin: 16px auto 0;
            display: flex; gap: 6px; flex-wrap: wrap; padding: 0 24px;
          }
          .pdx-type-filter {
            padding: 5px 12px; border-radius: 16px; border: none;
            font: 500 12px/1 inherit; cursor: pointer;
            transition: all 0.15s; color: #fff; opacity: 0.8;
          }
          .pdx-type-filter:hover { opacity: 1; transform: scale(1.05); }
          .pdx-type-filter-active { opacity: 1; box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(0,0,0,0.1); }
          .pdx-type-filter-all {
            background: #666; color: #fff; padding: 5px 12px; border-radius: 16px;
            border: none; font: 500 12px/1 inherit; cursor: pointer;
          }

          /* Grid */
          .pdx-body { max-width: 1200px; margin: 0 auto; padding: 20px 24px 60px; }
          .pdx-results { font-size: 14px; color: #888; margin-bottom: 16px; }
          .pdx-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
            gap: 14px;
          }

          /* Card */
          .pdx-card {
            background: #fff; border-radius: 16px;
            padding: 16px; cursor: pointer;
            transition: transform 0.25s cubic-bezier(0.16,1,0.3,1), box-shadow 0.25s;
            text-align: center; position: relative;
          }
          .pdx-card:hover {
            transform: translateY(-6px) scale(1.03);
            box-shadow: 0 12px 32px rgba(0,0,0,0.1);
          }
          .pdx-card-id {
            font-size: 12px; font-weight: 700; opacity: 0.5;
            position: absolute; top: 12px; right: 14px;
          }
          .pdx-card-img-wrap {
            width: 120px; height: 120px; margin: 0 auto 8px;
            display: flex; align-items: center; justify-content: center;
          }
          .pdx-card-img { width: 100%; height: 100%; object-fit: contain; image-rendering: auto; }
          .pdx-card-name { font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 8px; }
          .pdx-card-types { display: flex; gap: 4px; justify-content: center; }

          /* Type pill */
          .pdx-type-pill {
            font-size: 11px; font-weight: 600; color: #fff;
            padding: 2px 10px; border-radius: 10px; text-transform: capitalize;
          }
          .pdx-type-pill-lg { font-size: 13px; padding: 4px 16px; border-radius: 14px; }

          /* Modal */
          .pdx-modal-overlay {
            position: fixed; inset: 0; z-index: 1000;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
          }
          .pdx-modal {
            background: #fff; border-radius: 24px;
            width: 400px; max-width: 100%; max-height: 90vh;
            overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.2);
          }
          .pdx-modal-top {
            padding: 24px 24px 32px;
            text-align: center; position: relative;
            border-radius: 24px 24px 0 0;
          }
          .pdx-modal-close {
            position: absolute; top: 12px; right: 12px;
            width: 32px; height: 32px; border-radius: 50%;
            background: rgba(0,0,0,0.2); border: none; color: #fff;
            font-size: 14px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
          }
          .pdx-modal-close:hover { background: rgba(0,0,0,0.3); }
          .pdx-modal-id { font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.5); margin-bottom: 8px; }
          .pdx-modal-img { width: 180px; height: 180px; object-fit: contain; margin-bottom: 12px; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15)); }
          .pdx-modal-name { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 8px; }
          .pdx-modal-types { display: flex; gap: 6px; justify-content: center; }

          .pdx-modal-body { padding: 24px; }
          .pdx-modal-measures {
            display: flex; justify-content: space-around; align-items: center;
            margin-bottom: 24px;
          }
          .pdx-measure { text-align: center; }
          .pdx-measure-val { font-size: 18px; font-weight: 700; color: #1a1a2e; }
          .pdx-measure-label { font-size: 12px; color: #999; margin-top: 2px; }
          .pdx-measure-divider { width: 1px; height: 40px; background: #eee; }

          .pdx-section-title {
            font-size: 14px; font-weight: 700; margin-bottom: 12px;
            text-transform: uppercase; letter-spacing: 0.05em;
          }

          /* Stats */
          .pdx-stat-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
          .pdx-stat-label { width: 32px; font-size: 12px; font-weight: 600; color: #999; text-align: right; }
          .pdx-stat-val { width: 28px; font-size: 13px; font-weight: 700; color: #1a1a2e; text-align: right; }
          .pdx-stat-track { flex: 1; height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
          .pdx-stat-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }

          .pdx-abilities { font-size: 15px; color: #555; margin-bottom: 20px; line-height: 1.5; }

          .pdx-empty {
            text-align: center; padding: 60px 20px; color: #ccc;
          }
          .pdx-empty-icon { font-size: 48px; margin-bottom: 12px; }
        </style>

        <div class="pdx-layout">
          <div class="pdx-header">
            <div class="pdx-header-top">
              <div class="pdx-logo"><span class="pdx-logo-icon">\uD83D\uDC7E</span> Pokedex</div>
              <div class="pdx-count">${filtered.length} / ${total}</div>
            </div>
            <div class="pdx-search-bar">
              <input class="pdx-search" type="text" placeholder="Search by name or number..."
                     value="${searchQuery}"
                     oninput="${function(e) { searchQuery = e.target.value; renderApp() }}" />
              ${['id', 'name', 'stats'].map(function(s) {
                return html`<button class="${'pdx-sort-btn' + (sortBy === s ? ' pdx-sort-active' : '')}"
                                    onclick="${function() { sortBy = s; renderApp() }}">${s === 'id' ? '#ID' : s === 'name' ? 'A-Z' : 'Stats'}</button>`
              })}
            </div>
          </div>

          <div class="pdx-types-bar">
            <button class="pdx-type-filter-all" onclick="${function() { activeType = null; renderApp() }}"
                    style="${!activeType ? 'box-shadow: 0 0 0 2px #333;' : ''}">All</button>
            ${types.map(function(t) {
              return html`<button class="${'pdx-type-filter' + (activeType === t ? ' pdx-type-filter-active' : '')}"
                                  style="${'background: ' + typeColor(t)}"
                                  onclick="${function() { activeType = activeType === t ? null : t; renderApp() }}">${t}</button>`
            })}
          </div>

          <div class="pdx-body">
            <div class="pdx-results">${filtered.length} Pokemon${activeType ? ' \u00B7 ' + activeType : ''}${searchQuery ? ' \u00B7 "' + searchQuery + '"' : ''}</div>

            ${filtered.length > 0 ? html`
              <div class="pdx-grid">
                ${keyed(filtered, function(p) { return p['@id'] }, function(p) { return renderCard(p) })}
              </div>
            ` : html`
              <div class="pdx-empty">
                <div class="pdx-empty-icon">\uD83D\uDD0D</div>
                <div>No Pokemon found</div>
              </div>
            `}
          </div>
        </div>

        ${selectedPokemon ? renderDetail(selectedPokemon) : null}
      `)
    }

    // ========== INIT ==========
    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
