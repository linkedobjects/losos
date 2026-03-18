import { createStore } from '../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../losos/html.js'

var STAGES = [
  { id: 'discovery', label: 'Discovery', color: '#8b5cf6' },
  { id: 'qualification', label: 'Qualification', color: '#3b82f6' },
  { id: 'proposal', label: 'Proposal', color: '#f59e0b' },
  { id: 'negotiation', label: 'Negotiation', color: '#f97316' },
  { id: 'won', label: 'Won', color: '#10b981' },
  { id: 'lost', label: 'Lost', color: '#94a3b8' }
]

var AVATAR_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#e11d48', '#14b8a6']

function avatarColor(name) {
  var h = 0
  for (var i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function formatCurrency(n) {
  n = parseInt(n) || 0
  if (n >= 1000) return '$' + (n / 1000).toFixed(0) + 'k'
  return '$' + n
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default {
  label: 'Pipeline',
  icon: '\uD83D\uDCCA',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('CRM')
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { debounce: 800 })
    var root = store.get('#this')
    var selectedDeal = null

    function renderApp() {
      var deals = store.propAll(root, 'deal')
      var contacts = store.propAll(root, 'contact')
      var activities = store.propAll(root, 'activity')

      // Group deals by stage
      var pipeline = {}
      STAGES.forEach(function(s) { pipeline[s.id] = [] })
      deals.forEach(function(d) {
        var stage = d['stage'] || 'discovery'
        if (pipeline[stage]) pipeline[stage].push(d)
      })

      // Stats
      var totalValue = deals.reduce(function(sum, d) { return sum + (parseInt(d['value']) || 0) }, 0)
      var wonValue = pipeline['won'].reduce(function(sum, d) { return sum + (parseInt(d['value']) || 0) }, 0)
      var activeDeals = deals.filter(function(d) { return d['stage'] !== 'won' && d['stage'] !== 'lost' }).length

      render(container, html`
        <style>
          .crm-pipe { font-family: -apple-system, sans-serif; padding: 24px; background: #f8f9fb; min-height: 100vh; }
          .crm-header { max-width: 1400px; margin: 0 auto 20px; }
          .crm-title { font-size: 24px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
          .crm-subtitle { font-size: 14px; color: #888; }

          .crm-stats { display: flex; gap: 12px; margin-bottom: 24px; max-width: 1400px; margin-left: auto; margin-right: auto; }
          .crm-stat { background: #fff; border-radius: 10px; padding: 16px 20px; flex: 1; border: 1px solid #f0f0f0; }
          .crm-stat-value { font-size: 24px; font-weight: 700; color: #1a1a2e; }
          .crm-stat-label { font-size: 12px; color: #888; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.05em; }

          .crm-board { display: flex; gap: 14px; overflow-x: auto; max-width: 1400px; margin: 0 auto; padding-bottom: 20px; }
          .crm-col { min-width: 240px; flex: 1; }
          .crm-col-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; margin-bottom: 10px; border-radius: 8px; }
          .crm-col-title { font-size: 13px; font-weight: 600; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }
          .crm-col-count { font-size: 12px; color: rgba(255,255,255,0.7); }
          .crm-col-value { font-size: 11px; color: rgba(255,255,255,0.6); }

          .crm-deal { background: #fff; border-radius: 10px; padding: 14px; margin-bottom: 8px; border: 1px solid #f0f0f0; cursor: pointer; transition: all 0.15s; }
          .crm-deal:hover { border-color: #6366f1; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transform: translateY(-1px); }
          .crm-deal-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; }
          .crm-deal-company { font-size: 12px; color: #888; margin-bottom: 8px; }
          .crm-deal-footer { display: flex; align-items: center; justify-content: space-between; }
          .crm-deal-value { font-size: 15px; font-weight: 700; color: #1a1a2e; }
          .crm-deal-date { font-size: 11px; color: #aaa; }
          .crm-deal-contact { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
          .crm-deal-avatar { width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #fff; flex-shrink: 0; }
          .crm-deal-contact-name { font-size: 12px; color: #666; }

          /* Deal detail modal */
          .crm-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
          .crm-modal { background: #fff; border-radius: 16px; width: 500px; max-width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
          .crm-modal-header { padding: 24px 24px 16px; border-bottom: 1px solid #f0f0f0; }
          .crm-modal-close { float: right; background: none; border: none; font-size: 18px; color: #aaa; cursor: pointer; padding: 4px; }
          .crm-modal-close:hover { color: #333; }
          .crm-modal-title { font-size: 20px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
          .crm-modal-company { font-size: 14px; color: #888; }
          .crm-modal-body { padding: 20px 24px; }
          .crm-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .crm-modal-field { }
          .crm-modal-label { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
          .crm-modal-val { font-size: 15px; color: #1a1a2e; font-weight: 500; }
          .crm-stage-select { padding: 6px 10px; border: 1px solid #e0e0e0; border-radius: 6px; font: 400 14px/1 inherit; color: #1a1a2e; outline: none; cursor: pointer; }

          .crm-timeline-title { font-size: 13px; font-weight: 600; color: #1a1a2e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
          .crm-timeline-item { display: flex; gap: 10px; margin-bottom: 12px; }
          .crm-timeline-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0; }
          .crm-timeline-content { flex: 1; }
          .crm-timeline-meta { font-size: 11px; color: #aaa; margin-bottom: 2px; }
          .crm-timeline-note { font-size: 13px; color: #444; line-height: 1.5; }
        </style>

        <div class="crm-pipe">
          <div class="crm-header">
            <h1 class="crm-title">${data['title'] || 'CRM'}</h1>
            <div class="crm-subtitle">${deals.length} deals \u00B7 ${contacts.length} contacts</div>
          </div>

          <div class="crm-stats">
            <div class="crm-stat">
              <div class="crm-stat-value">${formatCurrency(totalValue)}</div>
              <div class="crm-stat-label">Total Pipeline</div>
            </div>
            <div class="crm-stat">
              <div class="crm-stat-value">${formatCurrency(wonValue)}</div>
              <div class="crm-stat-label">Won Revenue</div>
            </div>
            <div class="crm-stat">
              <div class="crm-stat-value">${activeDeals}</div>
              <div class="crm-stat-label">Active Deals</div>
            </div>
            <div class="crm-stat">
              <div class="crm-stat-value">${activities.length}</div>
              <div class="crm-stat-label">Activities</div>
            </div>
          </div>

          <div class="crm-board">
            ${STAGES.map(function(stage) {
              var stageDeals = pipeline[stage.id] || []
              var stageValue = stageDeals.reduce(function(s, d) { return s + (parseInt(d['value']) || 0) }, 0)
              return html`
                <div class="crm-col">
                  <div class="crm-col-header" style="${'background: ' + stage.color}">
                    <div>
                      <div class="crm-col-title">${stage.label}</div>
                      <div class="crm-col-value">${formatCurrency(stageValue)}</div>
                    </div>
                    <span class="crm-col-count">${stageDeals.length}</span>
                  </div>
                  ${keyed(stageDeals, function(d) { return d['@id'] }, function(d) {
                    return html`
                      <div class="crm-deal" onclick="${function() { selectedDeal = d; renderApp() }}">
                        <div class="crm-deal-title">${d['dealTitle']}</div>
                        <div class="crm-deal-company">${d['companyDealRef']}</div>
                        <div class="crm-deal-footer">
                          <span class="crm-deal-value">${formatCurrency(d['value'])}</span>
                          <span class="crm-deal-date">${formatDate(d['closeDate'])}</span>
                        </div>
                        <div class="crm-deal-contact">
                          <div class="crm-deal-avatar" style="${'background: ' + avatarColor(d['contactRef'])}">${(d['contactRef'] || '??').split(' ').map(function(w) { return w[0] }).join('').slice(0, 2)}</div>
                          <span class="crm-deal-contact-name">${d['contactRef']}</span>
                        </div>
                      </div>
                    `
                  })}
                </div>
              `
            })}
          </div>
        </div>

        ${selectedDeal ? renderDealModal(selectedDeal, activities, store) : null}
      `)
    }

    function renderDealModal(deal, activities, store) {
      var dealActivities = activities.filter(function(a) { return a['actContact'] === deal['contactRef'] })
      dealActivities.sort(function(a, b) { return (b['actTime'] || '') > (a['actTime'] || '') ? 1 : -1 })

      var actTypeColors = { call: '#3b82f6', email: '#10b981', meeting: '#f59e0b', note: '#8b5cf6' }
      var actTypeIcons = { call: '\uD83D\uDCDE', email: '\u2709\uFE0F', meeting: '\uD83E\uDD1D', note: '\uD83D\uDCDD' }

      return html`
        <div class="crm-modal-overlay" onclick="${function(e) { if (e.target === e.currentTarget) { selectedDeal = null; renderApp() } }}">
          <div class="crm-modal">
            <div class="crm-modal-header">
              <button class="crm-modal-close" onclick="${function() { selectedDeal = null; renderApp() }}">\u2715</button>
              <div class="crm-modal-title">${deal['dealTitle']}</div>
              <div class="crm-modal-company">${deal['companyDealRef']}</div>
            </div>
            <div class="crm-modal-body">
              <div class="crm-modal-grid">
                <div class="crm-modal-field">
                  <div class="crm-modal-label">Value</div>
                  <div class="crm-modal-val" style="color: #10b981;">${formatCurrency(deal['value'])}</div>
                </div>
                <div class="crm-modal-field">
                  <div class="crm-modal-label">Close Date</div>
                  <div class="crm-modal-val">${formatDate(deal['closeDate'])}</div>
                </div>
                <div class="crm-modal-field">
                  <div class="crm-modal-label">Contact</div>
                  <div class="crm-modal-val">${deal['contactRef']}</div>
                </div>
                <div class="crm-modal-field">
                  <div class="crm-modal-label">Stage</div>
                  <select class="crm-stage-select" onchange="${function(e) { store.set(deal, 'stage', e.target.value); renderApp() }}">
                    ${STAGES.map(function(s) {
                      return html`<option value="${s.id}" selected="${deal['stage'] === s.id}">${s.label}</option>`
                    })}
                  </select>
                </div>
              </div>

              ${dealActivities.length > 0 ? html`
                <div class="crm-timeline-title">Activity Timeline</div>
                ${dealActivities.map(function(a) {
                  var type = a['actType'] || 'note'
                  var icon = actTypeIcons[type] || '\uD83D\uDCDD'
                  var color = actTypeColors[type] || '#8b5cf6'
                  var time = a['actTime'] ? new Date(a['actTime']).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                  return html`
                    <div class="crm-timeline-item">
                      <div class="crm-timeline-dot" style="${'background: ' + color}"></div>
                      <div class="crm-timeline-content">
                        <div class="crm-timeline-meta">${icon} ${type} \u00B7 ${time}</div>
                        <div class="crm-timeline-note">${a['actNote']}</div>
                      </div>
                    </div>
                  `
                })}
              ` : null}
            </div>
          </div>
        </div>
      `
    }

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
