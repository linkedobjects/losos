import { createStore } from '../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../losos/html.js'

var AVATAR_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#f97316', '#10b981', '#8b5cf6', '#e11d48', '#14b8a6']

function avatarColor(name) {
  var h = 0
  for (var i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default {
  label: 'Contacts',
  icon: '\uD83D\uDC65',

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
    var searchQuery = ''
    var selectedContact = null

    function renderApp() {
      var contacts = store.propAll(root, 'contact')
      var activities = store.propAll(root, 'activity')
      var deals = store.propAll(root, 'deal')

      var filtered = contacts
      if (searchQuery) {
        var q = searchQuery.toLowerCase()
        filtered = contacts.filter(function(c) {
          return (c['name'] || '').toLowerCase().indexOf(q) !== -1 ||
                 (c['email'] || '').toLowerCase().indexOf(q) !== -1 ||
                 (c['companyRef'] || '').toLowerCase().indexOf(q) !== -1
        })
      }

      render(container, html`
        <style>
          .ct-wrap { font-family: -apple-system, sans-serif; max-width: 900px; margin: 0 auto; padding: 32px 24px; }
          .ct-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
          .ct-title { font-size: 24px; font-weight: 700; color: #1a1a2e; }
          .ct-count { font-size: 14px; color: #888; }
          .ct-search { width: 100%; background: #f8f9fb; border: 1px solid #e5e5e5; border-radius: 10px; padding: 10px 16px; font: 400 15px/1 inherit; outline: none; margin-bottom: 16px; }
          .ct-search:focus { border-color: #6366f1; background: #fff; }
          .ct-search::placeholder { color: #bbb; }

          .ct-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
          .ct-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 12px; padding: 18px; cursor: pointer; transition: all 0.15s; }
          .ct-card:hover { border-color: #6366f1; box-shadow: 0 2px 12px rgba(0,0,0,0.04); transform: translateY(-2px); }
          .ct-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
          .ct-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; color: #fff; flex-shrink: 0; }
          .ct-name { font-size: 16px; font-weight: 600; color: #1a1a2e; }
          .ct-role { font-size: 13px; color: #888; }
          .ct-meta { font-size: 13px; color: #666; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
          .ct-meta-icon { font-size: 14px; }
          .ct-notes { font-size: 12px; color: #aaa; line-height: 1.4; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f5f5f5; }

          .ct-detail { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px; }
          .ct-detail-card { background: #fff; border-radius: 16px; width: 480px; max-width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
          .ct-detail-header { padding: 24px; display: flex; gap: 16px; align-items: center; border-bottom: 1px solid #f0f0f0; }
          .ct-detail-avatar { width: 56px; height: 56px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; color: #fff; flex-shrink: 0; }
          .ct-detail-name { font-size: 22px; font-weight: 700; color: #1a1a2e; }
          .ct-detail-role { font-size: 14px; color: #888; }
          .ct-detail-close { margin-left: auto; background: none; border: none; font-size: 18px; color: #aaa; cursor: pointer; }
          .ct-detail-body { padding: 20px 24px; }
          .ct-detail-field { margin-bottom: 14px; }
          .ct-detail-label { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
          .ct-detail-val { font-size: 15px; color: #1a1a2e; }
          .ct-detail-val a { color: #6366f1; text-decoration: none; }
          .ct-deal-chip { display: inline-block; background: #f0fdf4; color: #166534; font-size: 12px; padding: 3px 10px; border-radius: 10px; margin: 2px 4px 2px 0; font-weight: 500; }
          .ct-deal-chip-lost { background: #fef2f2; color: #991b1b; }
        </style>

        <div class="ct-wrap">
          <div class="ct-header">
            <h1 class="ct-title">Contacts</h1>
            <span class="ct-count">${filtered.length} of ${contacts.length}</span>
          </div>
          <input class="ct-search" type="text" placeholder="Search contacts..." value="${searchQuery}"
                 oninput="${function(e) { searchQuery = e.target.value; renderApp() }}" />
          <div class="ct-grid">
            ${keyed(filtered, function(c) { return c['@id'] }, function(c) {
              return html`
                <div class="ct-card" onclick="${function() { selectedContact = c; renderApp() }}">
                  <div class="ct-card-top">
                    <div class="ct-avatar" style="${'background: ' + avatarColor(c['name'])}">${(c['avatar'] || '??').slice(0, 2)}</div>
                    <div>
                      <div class="ct-name">${c['name']}</div>
                      <div class="ct-role">${c['role']} \u00B7 ${c['companyRef']}</div>
                    </div>
                  </div>
                  <div class="ct-meta"><span class="ct-meta-icon">\u2709\uFE0F</span> ${c['email']}</div>
                  ${c['phone'] ? html`<div class="ct-meta"><span class="ct-meta-icon">\uD83D\uDCDE</span> ${c['phone']}</div>` : null}
                  ${c['notes'] ? html`<div class="ct-notes">${c['notes']}</div>` : null}
                </div>
              `
            })}
          </div>
        </div>

        ${selectedContact ? function() {
          var c = selectedContact
          var contactDeals = deals.filter(function(d) { return d['contactRef'] === c['name'] })
          var contactActivities = activities.filter(function(a) { return a['actContact'] === c['name'] })
          contactActivities.sort(function(a, b) { return (b['actTime'] || '') > (a['actTime'] || '') ? 1 : -1 })
          var actIcons = { call: '\uD83D\uDCDE', email: '\u2709\uFE0F', meeting: '\uD83E\uDD1D', note: '\uD83D\uDCDD' }

          return html`
            <div class="ct-detail" onclick="${function(e) { if (e.target === e.currentTarget) { selectedContact = null; renderApp() } }}">
              <div class="ct-detail-card">
                <div class="ct-detail-header">
                  <div class="ct-detail-avatar" style="${'background: ' + avatarColor(c['name'])}">${(c['avatar'] || '??').slice(0, 2)}</div>
                  <div>
                    <div class="ct-detail-name">${c['name']}</div>
                    <div class="ct-detail-role">${c['role']} \u00B7 ${c['companyRef']}</div>
                  </div>
                  <button class="ct-detail-close" onclick="${function() { selectedContact = null; renderApp() }}">\u2715</button>
                </div>
                <div class="ct-detail-body">
                  <div class="ct-detail-field">
                    <div class="ct-detail-label">Email</div>
                    <div class="ct-detail-val"><a href="${'mailto:' + c['email']}">${c['email']}</a></div>
                  </div>
                  <div class="ct-detail-field">
                    <div class="ct-detail-label">Phone</div>
                    <div class="ct-detail-val">${c['phone']}</div>
                  </div>
                  ${c['notes'] ? html`
                    <div class="ct-detail-field">
                      <div class="ct-detail-label">Notes</div>
                      <div class="ct-detail-val">${c['notes']}</div>
                    </div>
                  ` : null}
                  ${contactDeals.length > 0 ? html`
                    <div class="ct-detail-field">
                      <div class="ct-detail-label">Deals</div>
                      <div>${contactDeals.map(function(d) {
                        return html`<span class="${'ct-deal-chip' + (d['stage'] === 'lost' ? ' ct-deal-chip-lost' : '')}">${d['dealTitle']} \u00B7 $${d['value']}</span>`
                      })}</div>
                    </div>
                  ` : null}
                  ${contactActivities.length > 0 ? html`
                    <div class="ct-detail-field">
                      <div class="ct-detail-label">Recent Activity</div>
                      ${contactActivities.slice(0, 5).map(function(a) {
                        var icon = actIcons[a['actType']] || '\uD83D\uDCDD'
                        var time = a['actTime'] ? new Date(a['actTime']).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
                        return html`<div style="font-size: 13px; color: #444; margin-bottom: 8px; line-height: 1.4;">${icon} <span style="color: #aaa;">${time}</span> \u00B7 ${a['actNote']}</div>`
                      })}
                    </div>
                  ` : null}
                </div>
              </div>
            </div>
          `
        }() : null}
      `)
    }

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
