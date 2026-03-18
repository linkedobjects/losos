import { html, render } from '../losos/html.js'

var SOLID = 'http://www.w3.org/ns/solid/terms#'
var WF = 'http://www.w3.org/2005/01/wf/flow#'
var ICAL = 'http://www.w3.org/2002/12/cal/ical#'
var MATCH = [WF + 'Tracker', ICAL + 'Vtodo']
var DCT_TITLE = 'http://purl.org/dc/terms/title'

export default {
  label: 'Pod',
  icon: '\u{1F4E6}',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Tracker')
  },

  render(subject, store, container) {
    // State
    var subtitle = 'Log in with Solid to discover your trackers.'
    var indexUrls = []
    var trackers = []  // { title, url, activeCount }
    var needsRegister = false
    var currentDataUrl = ''
    var typeIndexUrls = []
    var webId = null
    var authFetch = null
    var newStatus = ''
    var newStatusColor = '#999'

    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var dataSrc = dataEl && dataEl.getAttribute('src')
    if (dataSrc) currentDataUrl = new URL(dataSrc, window.location.href).href

    function renderPod() {
      render(container, html`
        <div style="padding: 48px 40px 80px; font-family: Inter, -apple-system, sans-serif; width: 100%; max-width: 640px; margin: 0 auto;">
          <h1 style="font-family: Georgia, serif; font-size: 36px; font-weight: 400; font-style: italic; color: #1a1a1a; margin: 0 0 8px 0;">Pod</h1>
          <p style="font-size: 14px; color: #999; margin: 0 0 32px 0;">${subtitle}</p>

          <div style="margin-bottom: 32px;">
            ${indexUrls.map(function(url) {
              return html`<a href="${url}" target="_blank" rel="noopener"
                style="display: block; font-size: 12px; color: #ccc; text-decoration: none; margin-bottom: 2px; word-break: break-all;">${url}</a>`
            })}
          </div>

          <div>
            ${trackers.map(function(t) {
              return html`<a href="${'?tracker=' + t.url.split('/').pop()}"
                style="display: flex; align-items: center; gap: 12px; padding: 14px 0; text-decoration: none; color: #1a1a1a; border-bottom: 1px solid #f0ede8;">
                <span style="color: #ccc; font-size: 16px;">#</span>
                <span style="font-size: 14px; font-weight: 500; flex: 1;">${t.title}</span>
                <span style="font-size: 12px; color: #999;">${t.activeCount} active</span>
                <span style="color: #ccc; font-size: 14px;">\u2192</span>
              </a>`
            })}
          </div>

          ${needsRegister ? html`
            <div style="padding: 24px 0 0; border-top: 1px solid #f0ede8; margin-top: 16px;">
              <div style="font-size: 12px; color: #999; margin-bottom: 4px;">This tracker is not registered.</div>
              <div style="font-size: 12px; color: #ccc; margin-bottom: 12px; word-break: break-all;">${currentDataUrl}</div>
              <button onclick="${doRegister}"
                style="background: #1a1a1a; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; font: 500 13px/1 inherit; cursor: pointer;">Register in pod</button>
            </div>
          ` : null}

          ${typeIndexUrls.length > 0 ? html`
            <div style="padding: 24px 0 0; border-top: 1px solid #f0ede8; margin-top: 24px;">
              <div style="font-size: 11px; font-weight: 600; color: #ccc; letter-spacing: 0.1em; margin-bottom: 12px;">NEW TRACKER</div>
              <div style="display: flex; gap: 8px;">
                <input type="text" placeholder="Tracker name\u2026"
                  style="flex: 1; padding: 10px 14px; border: 1.5px solid #e5e5e5; border-radius: 6px; font: 400 14px/1.4 inherit; color: #1a1a1a; outline: none; background: #fff;"
                  onkeydown="${function(e) { if (e.key === 'Enter') doCreate(e.target) }}" />
                <button onclick="${function(e) { doCreate(e.target.previousElementSibling) }}"
                  style="background: #1a1a1a; color: #fff; border: none; border-radius: 6px; padding: 10px 20px; font: 500 13px/1 inherit; cursor: pointer; white-space: nowrap;">Create</button>
              </div>
              <div style="font-size: 12px; margin-top: 8px; color: ${newStatusColor};">${newStatus}</div>
            </div>
          ` : null}
        </div>
      `)
    }

    // --- Actions ---
    async function doRegister() {
      if (!authFetch || !typeIndexUrls.length) return
      try {
        var tiUrl = typeIndexUrls[0]
        var tiData = await authFetch(tiUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
        var newReg = {
          '@id': '#reg-' + Date.now(),
          '@type': 'solid:TypeRegistration',
          'solid:forClass': { '@id': WF + 'Tracker' },
          'solid:instance': { '@id': currentDataUrl + '#this' }
        }
        if (tiData['schema:itemListElement']) tiData['schema:itemListElement'].push(newReg)
        else if (Array.isArray(tiData)) tiData.push(newReg)
        await authFetch(tiUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/ld+json' },
          body: JSON.stringify(tiData, null, 2)
        })
        needsRegister = false
        discover()
      } catch (err) {
        newStatus = err.message
        newStatusColor = '#dc2626'
        renderPod()
      }
    }

    async function doCreate(input) {
      var name = input.value.trim()
      if (!name || !authFetch) return
      var slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      var appBase = window.location.href.replace(/[^\/]*$/, '').replace(/\?.*$/, '')
      var dataUrl = appBase + slug + '-data.jsonld'

      newStatus = 'Creating\u2026'
      newStatusColor = '#999'
      renderPod()

      try {
        var checkRes = await authFetch(dataUrl, { method: 'HEAD' }).catch(function() { return { ok: false } })
        if (checkRes.ok) {
          newStatus = slug + '-data.jsonld already exists.'
          newStatusColor = '#d97706'
          renderPod()
          return
        }

        await authFetch(dataUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/ld+json' },
          body: JSON.stringify({
            '@context': {
              'ical': 'http://www.w3.org/2002/12/cal/ical#',
              'wf': 'http://www.w3.org/2005/01/wf/flow#',
              'dct': 'http://purl.org/dc/terms/',
              'summary': 'ical:summary', 'description': 'ical:description',
              'status': 'ical:status', 'categories': 'ical:categories',
              'created': 'dct:created', 'modified': 'ical:lastModified',
              'title': 'dct:title', 'initialState': 'wf:initialState',
              'issue': 'wf:issue', 'Tracker': 'wf:Tracker', 'Vtodo': 'ical:Vtodo'
            },
            '@id': '#this', '@type': 'Tracker', 'title': name,
            'created': new Date().toISOString(), 'initialState': 'NEEDS-ACTION', 'issue': []
          }, null, 2)
        })

        // Register in type index
        var tiUrl = typeIndexUrls[0]
        var tiData = await authFetch(tiUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
        var reg = { '@id': '#reg-' + slug, '@type': 'solid:TypeRegistration', 'solid:forClass': { '@id': WF + 'Tracker' }, 'solid:instance': { '@id': dataUrl + '#this' } }
        if (tiData['schema:itemListElement']) tiData['schema:itemListElement'].push(reg)
        else if (Array.isArray(tiData)) tiData.push(reg)
        await authFetch(tiUrl, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(tiData, null, 2) })

        input.value = ''
        newStatus = ''
        setTimeout(discover, 300)
      } catch (err) {
        newStatus = err.message
        newStatusColor = '#dc2626'
        renderPod()
      }
    }

    // --- Discovery ---
    async function discover() {
      if (!webId || !authFetch) return
      var baseUrl = webId.replace(/#.*$/, '')
      subtitle = 'Discovering\u2026'
      trackers = []
      renderPod()

      try {
        var profile = await authFetch(webId, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
        var nodes = Array.isArray(profile) ? profile : [profile]
        typeIndexUrls = []
        nodes.forEach(function(n) {
          if (!n || typeof n !== 'object') return
          Object.keys(n).forEach(function(k) {
            if (k.indexOf('TypeIndex') === -1 && k.indexOf('typeIndex') === -1) return
            var vals = Array.isArray(n[k]) ? n[k] : [n[k]]
            vals.forEach(function(v) {
              var id = typeof v === 'string' ? v : (v && v['@id'])
              if (id) typeIndexUrls.push(new URL(id, baseUrl).href)
            })
          })
        })

        if (!typeIndexUrls.length) { subtitle = 'No type index found.'; renderPod(); return }
        indexUrls = typeIndexUrls

        // Find tracker URLs
        var trackerUrls = []
        for (var i = 0; i < typeIndexUrls.length; i++) {
          try {
            var idx = await authFetch(typeIndexUrls[i], { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
            var all = []
            function collect(o) {
              if (!o || typeof o !== 'object') return
              if (Array.isArray(o)) { o.forEach(collect); return }
              all.push(o)
              Object.values(o).forEach(function(v) { if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object' && v['@id']) collect(v) })
            }
            collect(idx)
            all.forEach(function(n) {
              var fc = n[SOLID + 'forClass'] || n['solid:forClass']
              if (!fc) return
              var cls = Array.isArray(fc) ? fc : [fc]
              var cid = cls[0] && (typeof cls[0] === 'string' ? cls[0] : cls[0]['@id'])
              if (MATCH.indexOf(cid) === -1) return
              var inst = n[SOLID + 'instance'] || n['solid:instance']
              if (!inst) return
              var insts = Array.isArray(inst) ? inst : [inst]
              insts.forEach(function(v) {
                var id = typeof v === 'string' ? v : (v && v['@id'])
                if (id) trackerUrls.push(new URL(id, typeIndexUrls[i]).href)
              })
            })
          } catch (e) {}
        }

        // Fetch each tracker
        trackers = []
        var totalActive = 0
        for (var t = 0; t < trackerUrls.length; t++) {
          try {
            var docUrl = trackerUrls[t].replace(/#.*$/, '')
            var data = await authFetch(docUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
            var title = data['title'] || data['dct:title'] || data[DCT_TITLE] || docUrl.split('/').pop()
            if (Array.isArray(data)) {
              var tn = data.find(function(n) { return n[DCT_TITLE] })
              if (tn) { var tv = tn[DCT_TITLE]; title = Array.isArray(tv) ? (tv[0] && tv[0]['@value'] || tv[0]) : tv }
            }
            var issues = Array.isArray(data) ? data.filter(function(n) { var ts = n['@type'] || []; return (Array.isArray(ts) ? ts : [ts]).some(function(x) { return x.indexOf('Vtodo') !== -1 }) }) : (data['issue'] || data['wf:issue'] || [])
            var active = issues.filter(function(i) { var s = i['status'] || i['ical:status'] || i[ICAL + 'status'] || ''; if (typeof s === 'object') s = s['@value'] || ''; return s !== 'COMPLETED' && s !== 'CANCELLED' }).length
            totalActive += active
            trackers.push({ title: title, url: docUrl, activeCount: active })
          } catch (e) {}
        }

        subtitle = totalActive + ' active task' + (totalActive === 1 ? '' : 's') + ' across ' + trackerUrls.length + ' tracker' + (trackerUrls.length === 1 ? '' : 's') + '.'
        if (!trackerUrls.length) subtitle = 'No trackers registered.'

        needsRegister = currentDataUrl && !trackerUrls.some(function(u) {
          return u === currentDataUrl || u === currentDataUrl + '#this' || u.replace(/#.*$/, '') === currentDataUrl
        })

        renderPod()
      } catch (err) {
        subtitle = 'Error: ' + err.message
        renderPod()
      }
    }

    // Init — always render first, then discover
    if (window.xlogin && window.xlogin.id && window.xlogin.type === 'solid') {
      webId = window.xlogin.id
      authFetch = window.xlogin.authFetch
      subtitle = 'Discovering\u2026'
    }
    renderPod()

    if (webId) {
      discover()
    } else {
      document.addEventListener('xlogin', function(e) {
        if (e.detail.type === 'solid') {
          webId = e.detail.id
          authFetch = window.xlogin.authFetch
          discover()
        }
      })
    }
  }
}
