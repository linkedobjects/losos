import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount } from '../../../losos/html.js'

export default {
  label: 'Profile',
  icon: '\uD83D\uDC64',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && (type.includes('Individual') || type.includes('Contact') || type.includes('Person'))
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { debounce: 800 })
    var root = store.get('#this')

    function renderApp() {
      var name = root['name'] || ''
      var givenName = root['givenName'] || ''
      var familyName = root['familyName'] || ''
      var photo = root['photo'] || ''
      var jobTitle = root['jobTitle'] || ''
      var org = root['organization'] || ''
      var emails = store.propAll(root, 'email')
      var phones = store.propAll(root, 'phone')
      var address = root['address'] || ''
      var url = root['url'] || ''
      var birthday = root['birthday'] || ''
      var notes = root['notes'] || ''

      render(container, html`
        <style>
          .vc-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 100%; margin: 0; padding: 0; }
          .vc-card { background: #fff; overflow: hidden; }
          .vc-hero { position: relative; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 48px 32px 36px; text-align: center; }
          .vc-photo { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 4px solid rgba(255,255,255,0.3); margin-bottom: 16px; }
          .vc-no-photo { width: 120px; height: 120px; border-radius: 50%; background: rgba(255,255,255,0.15); margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 40px; font-weight: 600; color: rgba(255,255,255,0.7); }
          .vc-name { font-size: 28px; font-weight: 700; color: #fff; margin-bottom: 4px; }
          .vc-title { font-size: 15px; color: rgba(255,255,255,0.8); }
          .vc-org { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; }

          .vc-body { padding: 24px 40px; max-width: 640px; margin: 0 auto; }
          .vc-section { margin-bottom: 20px; }
          .vc-section-title { font-size: 11px; font-weight: 600; color: #aaa; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 8px; }
          .vc-item { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
          .vc-item:last-child { border-bottom: none; }
          .vc-item-icon { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
          .vc-item-content { flex: 1; min-width: 0; }
          .vc-item-label { font-size: 11px; color: #aaa; }
          .vc-item-value { font-size: 15px; color: #1a1a2e; }
          .vc-item-value a { color: #667eea; text-decoration: none; }
          .vc-item-value a:hover { text-decoration: underline; }
          .vc-type-badge { font-size: 10px; color: #888; background: #f0f0f0; padding: 1px 6px; border-radius: 8px; margin-left: 6px; }

          .vc-notes { font-size: 14px; color: #555; line-height: 1.6; background: #fafafa; padding: 14px 18px; border-radius: 10px; }
        </style>

        <div class="vc-wrap">
          <div class="vc-card">
            <div class="vc-hero">
              ${photo ? html`<img class="vc-photo" src="${photo}" alt="${name}" onerror="this.style.display='none'" />` : html`<div class="vc-no-photo">${(givenName || name || '?').charAt(0)}</div>`}
              <div class="vc-name">${name}</div>
              ${jobTitle ? html`<div class="vc-title">${jobTitle}</div>` : null}
              ${org ? html`<div class="vc-org">${org}</div>` : null}
            </div>

            <div class="vc-body">
              ${emails.length > 0 ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Email</div>
                  ${emails.map(function(e) {
                    return html`
                      <div class="vc-item">
                        <span class="vc-item-icon">✉️</span>
                        <div class="vc-item-content">
                          <div class="vc-item-value"><a href="${'mailto:' + e['value']}">${e['value']}</a><span class="vc-type-badge">${e['type'] || ''}</span></div>
                        </div>
                      </div>
                    `
                  })}
                </div>
              ` : null}

              ${phones.length > 0 ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Phone</div>
                  ${phones.map(function(p) {
                    return html`
                      <div class="vc-item">
                        <span class="vc-item-icon">📞</span>
                        <div class="vc-item-content">
                          <div class="vc-item-value">${p['value']}<span class="vc-type-badge">${p['type'] || ''}</span></div>
                        </div>
                      </div>
                    `
                  })}
                </div>
              ` : null}

              ${address ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Address</div>
                  <div class="vc-item">
                    <span class="vc-item-icon">📍</span>
                    <div class="vc-item-content"><div class="vc-item-value">${address}</div></div>
                  </div>
                </div>
              ` : null}

              ${url ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Website</div>
                  <div class="vc-item">
                    <span class="vc-item-icon">🔗</span>
                    <div class="vc-item-content"><div class="vc-item-value"><a href="${url}" target="_blank">${url}</a></div></div>
                  </div>
                </div>
              ` : null}

              ${birthday ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Birthday</div>
                  <div class="vc-item">
                    <span class="vc-item-icon">🎂</span>
                    <div class="vc-item-content"><div class="vc-item-value">${new Date(birthday).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
                  </div>
                </div>
              ` : null}

              ${notes ? html`
                <div class="vc-section">
                  <div class="vc-section-title">Notes</div>
                  <div class="vc-notes">${notes}</div>
                </div>
              ` : null}
            </div>
          </div>
        </div>
      `)
    }

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
