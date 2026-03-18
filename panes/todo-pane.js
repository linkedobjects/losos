import { createStore } from '../losos/store.js'
import { html, render, onUnmount, keyed } from '../losos/html.js'

var SOLID = 'http://www.w3.org/ns/solid/terms#'
var WF = 'http://www.w3.org/2005/01/wf/flow#'
var ICAL = 'http://www.w3.org/2002/12/cal/ical#'
var MATCH = [WF + 'Tracker', ICAL + 'Vtodo']

export default {
  label: 'Tasks',
  icon: '\u2705',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Tracker')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var data
    try { data = JSON.parse(dataEl.textContent) } catch (e) { return }

    var dataUrl = new URL(dataEl.getAttribute('src'), window.location.href).href
    var store = createStore(data, {
      url: dataUrl,
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')
    var sidebarTrackers = []
    var dragFromIdx = null

    function isDone(issue) {
      var s = issue['status'] || 'NEEDS-ACTION'
      return s === 'COMPLETED' || s === 'CANCELLED'
    }

    // ========== MAIN RENDER ==========
    function renderTodo() {
      var issues = store.propAll(root, 'issue')
      var active = [], completed = []
      issues.forEach(function(issue, idx) {
        (isDone(issue) ? completed : active).push({ issue: issue, idx: idx })
      })
      function byMod(a, b) {
        var ma = a.issue['modified'] || a.issue['created'] || ''
        var mb = b.issue['modified'] || b.issue['created'] || ''
        return mb > ma ? 1 : mb < ma ? -1 : 0
      }
      active.sort(byMod)
      completed.sort(byMod)

      var subtitle = active.length === 0 ? 'All clear.'
        : 'You have ' + active.length + ' task' + (active.length === 1 ? '' : 's') + ' remaining.'
      var filename = dataEl.getAttribute('src')
      var title = data['title'] || 'Tasks'

      render(container, html`
        <style>
          .td-row .td-actions { opacity: 0; transition: opacity 0.2s; }
          .td-row:hover .td-actions { opacity: 1; }
          .td-btn { background: none; border: none; color: #ccc; font-size: 13px; cursor: pointer; padding: 4px 6px; line-height: 1; border-radius: 4px; transition: color 0.15s, background 0.15s; }
          .td-btn-bump:hover { color: #059669; background: #ecfdf5; }
          .td-btn-move:hover { color: #6366f1; background: #eef2ff; }
          .td-btn-del:hover { color: #dc2626; background: #fef2f2; }
          .td-btn-delete-tracker { background: none; border: none; color: #ddd; font: 400 12px/1 inherit; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: color 0.15s, background 0.15s; }
          .td-btn-delete-tracker:hover { color: #dc2626; background: #fef2f2; }
          .td-cb { width: 20px; height: 20px; border-radius: 5px; cursor: pointer; flex-shrink: 0; transition: all 0.15s; padding: 0; }
          .td-cb-open { border: 1.5px solid #d4d4d4; background: transparent; }
          .td-cb-open:hover { border-color: #999; }
          .td-cb-done { border: none; background: #1a1a1a; display: flex; align-items: center; justify-content: center; }
        </style>
        <div style="display: flex; font-family: Inter, -apple-system, sans-serif; width: 100%; min-height: 100%;">
          <nav style="width: 200px; flex-shrink: 0; padding: 48px 0 48px 24px; border-right: 1px solid #f0ede8;">
            <div style="font-size: 15px; font-weight: 600; color: #1a1a1a; margin-bottom: 24px; padding-right: 16px;">${title}</div>
            <div style="font-size: 10px; font-weight: 600; color: #ccc; letter-spacing: 0.1em; margin-bottom: 8px;">TRACKERS</div>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              ${sidebarTrackers.map(function(t) {
                var cur = t.url === dataUrl
                return html`<a href="${'?tracker=' + t.filename}" onclick="${function(e) { e.preventDefault(); switchTracker(t.filename) }}"
                  style="${'display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; text-decoration: none; font-size: 13px; cursor: pointer; color: ' + (cur ? '#1a1a1a' : '#888') + '; font-weight: ' + (cur ? '600' : '400') + '; background: ' + (cur ? '#f0ede8' : 'transparent')}">
                  <span style="${'color: ' + (cur ? '#999' : '#ccc') + '; font-weight: 400;'}">#</span>
                  <span>${t.title}</span>
                </a>`
              })}
            </div>
          </nav>
          <div style="padding: 48px 40px 80px; flex: 1; min-width: 0; max-width: 640px;">
            <h1 contenteditable="true" spellcheck="false"
                onblur="${onTitleBlur}" onkeydown="${onTitleKey}"
                style="font-family: Georgia, serif; font-size: 36px; font-weight: 400; font-style: italic; color: #1a1a1a; margin: 0 0 8px 0; letter-spacing: -0.5px; outline: none; border-bottom: 1px solid transparent; cursor: text;">${title}</h1>
            <a href="${filename}" target="_blank" rel="noopener"
               style="display: block; font-size: 11px; color: #ddd; text-decoration: none; margin-bottom: 4px;">${filename}</a>
            <div style="display: flex; align-items: center; justify-content: space-between; margin: 0 0 48px 0;">
              <p style="font-size: 14px; color: #999; margin: 0;">${subtitle}</p>
              <button class="td-btn-delete-tracker" onclick="${doDeleteTracker}">Delete tracker</button>
            </div>
            <input type="text" placeholder="Add a task\u2026" onkeydown="${onAddKey}"
              style="width: 100%; padding: 0; border: none; border-bottom: 1px solid transparent; font: 400 14px/2.4 inherit; color: #1a1a1a; outline: none; background: transparent; margin-bottom: 32px;" />
            <div style="margin-bottom: 40px;">
              ${keyed(active, function(item) { return item.issue['@id'] }, function(item) { return renderRow(item.issue, item.idx) })}
            </div>
            ${completed.length > 0 ? html`
              <div>
                <div style="font-size: 11px; font-weight: 600; color: #ccc; letter-spacing: 0.1em; text-transform: uppercase; padding: 12px 0 8px; border-top: 1px solid #f0ede8;">COMPLETED</div>
                ${keyed(completed, function(item) { return item.issue['@id'] }, function(item) { return renderRow(item.issue, item.idx) })}
              </div>
            ` : null}
          </div>
        </div>
      `)
    }

    function renderRow(issue, idx) {
      var done = isDone(issue)
      var title = issue['summary'] || 'Untitled'
      var cat = issue['categories']

      return html`
        <div class="td-row" draggable="true" data-idx="${idx}"
             ondragstart="${function(e) { dragFromIdx = idx; e.target.style.opacity = '0.3'; e.dataTransfer.effectAllowed = 'move' }}"
             ondragend="${function(e) { e.target.style.opacity = '1'; dragFromIdx = null }}"
             ondragover="${function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}"
             ondrop="${function(e) { e.preventDefault(); onDrop(idx) }}"
             style="display: flex; align-items: center; gap: 16px; padding: 14px 0; cursor: default;">
          <button class="${'td-cb ' + (done ? 'td-cb-done' : 'td-cb-open')}"
                  onclick="${function() { toggleStatus(issue) }}">${done ? '\u2713' : ''}</button>
          <span onclick="${function() { showDetailModal(issue, idx) }}"
                style="${'font-size: 14px; flex: 1; font-weight: 400; line-height: 1.4; cursor: pointer; color: ' + (done ? '#bbb' : '#1a1a1a') + (done ? '; text-decoration: line-through' : '')}">${title}</span>
          ${cat && !done ? html`<span style="font-size: 11px; color: #888; border: 1px solid #e5e5e5; border-radius: 4px; padding: 2px 10px; white-space: nowrap;">${cat}</span>` : null}
          <div class="td-actions" style="display: flex; gap: 2px; flex-shrink: 0;">
            <button class="td-btn td-btn-bump" title="Bump to top" onclick="${function() { doBump(issue) }}">\u2191</button>
            <button class="td-btn td-btn-move" title="Move to\u2026" onclick="${function() { showMoveModal(issue, idx) }}">\u2192</button>
            <button class="td-btn td-btn-del" title="Remove" onclick="${function() { doDelete(issue) }}">\u2715</button>
          </div>
        </div>
      `
    }

    // ========== ACTIONS ==========
    function toggleStatus(issue) {
      store.set(issue, 'status', isDone(issue) ? 'NEEDS-ACTION' : 'COMPLETED')
      store.set(issue, 'modified', new Date().toISOString())
      renderTodo()
    }

    function onAddKey(e) {
      if (e.key !== 'Enter') return
      var title = e.target.value.trim()
      if (!title) return
      store.push(root, 'issue', {
        '@id': '#Iss' + Date.now(),
        '@type': 'Vtodo',
        'summary': title,
        'status': data['initialState'] || 'NEEDS-ACTION',
        'created': new Date().toISOString(),
        'modified': new Date().toISOString()
      })
      e.target.value = ''
      renderTodo()
    }

    function onTitleBlur(e) {
      var newTitle = e.target.textContent.trim()
      if (newTitle && newTitle !== data['title']) {
        store.set(root, 'title', newTitle)
        data['title'] = newTitle
        renderTodo()
      }
    }

    function onTitleKey(e) {
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
    }

    function doBump(issue) {
      store.remove(root, 'issue', function(i) { return i === issue })
      store.set(issue, 'modified', new Date().toISOString())
      var issues = store.propAll(root, 'issue')
      issues.unshift(issue)
      store.set(root, 'issue', issues)
      renderTodo()
    }

    function doDelete(issue) {
      store.remove(root, 'issue', function(i) { return i === issue })
      renderTodo()
    }

    function onDrop(toIdx) {
      if (dragFromIdx === null || dragFromIdx === toIdx) return
      store.reorder(root, 'issue', dragFromIdx, toIdx)
      dragFromIdx = null
      renderTodo()
    }

    async function doDeleteTracker() {
      if (!confirm('Delete this tracker and all its tasks?')) return
      var doFetch = (window.xlogin && window.xlogin.authFetch) || fetch
      try { await doFetch(dataUrl, { method: 'DELETE' }) } catch (e) {}
      if (window.xlogin && window.xlogin.authFetch && window.xlogin.type === 'solid') {
        try {
          var webId = window.xlogin.id
          var baseUrl = webId.replace(/#.*$/, '')
          var profile = await doFetch(webId, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
          var nodes = Array.isArray(profile) ? profile : [profile]
          var tiUrl = null
          nodes.forEach(function(n) {
            if (!n) return
            Object.keys(n).forEach(function(k) {
              if (k.indexOf('TypeIndex') === -1 && k.indexOf('typeIndex') === -1) return
              var vals = Array.isArray(n[k]) ? n[k] : [n[k]]
              vals.forEach(function(v) { var id = typeof v === 'string' ? v : (v && v['@id']); if (id && !tiUrl) tiUrl = new URL(id, baseUrl).href })
            })
          })
          if (tiUrl) {
            var tiData = await doFetch(tiUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() })
            if (tiData['schema:itemListElement']) {
              tiData['schema:itemListElement'] = tiData['schema:itemListElement'].filter(function(item) {
                var inst = item['solid:instance'] || item[SOLID + 'instance']
                if (!inst) return true
                var instId = typeof inst === 'string' ? inst : inst['@id']
                return instId !== dataUrl + '#this' && instId !== dataUrl
              })
              await doFetch(tiUrl, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(tiData, null, 2) })
            }
          }
        } catch (e) {}
      }
      window.location.href = window.location.pathname
    }

    function switchTracker(filename) {
      history.pushState(null, '', '?tracker=' + filename)
      var newUrl = new URL(filename, window.location.href).href
      var df = (window.xlogin && window.xlogin.authFetch) || fetch
      df(newUrl, { headers: { 'Accept': 'application/ld+json' } })
        .then(function(r) { return r.json() })
        .then(function(newData) {
          store = createStore(newData, { url: newUrl, authFetch: df, debounce: 800 })
          root = store.get('#this')
          data = newData
          dataUrl = newUrl
          renderTodo()
        })
    }

    // ========== MODALS (imperative — ephemeral overlays) ==========
    function showDetailModal(issue, idx) {
      var overlay = document.createElement('div')
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.25); display: flex; align-items: center; justify-content: center; z-index: 10000;'
      overlay.addEventListener('click', function(e) { if (e.target === overlay) close() })

      var m = document.createElement('div')
      m.style.cssText = 'background: #fff; border-radius: 14px; padding: 32px; width: 90%; max-width: 480px; box-shadow: 0 16px 48px rgba(0,0,0,0.12);'
      m.innerHTML = '<input class="dm-title" type="text" value="" placeholder="Task name" style="width:100%;border:none;font:600 20px/1.3 inherit;color:#1a1a1a;outline:none;padding:0;margin-bottom:20px;background:transparent">'
        + '<div style="font-size:10px;font-weight:600;color:#ccc;letter-spacing:0.1em;margin-bottom:6px">DESCRIPTION</div>'
        + '<textarea class="dm-desc" rows="4" placeholder="Add a description\u2026" style="width:100%;border:1px solid #f0ede8;border-radius:8px;padding:10px 12px;font:400 14px/1.5 inherit;color:#1a1a1a;outline:none;resize:vertical;margin-bottom:16px"></textarea>'
        + '<div style="font-size:10px;font-weight:600;color:#ccc;letter-spacing:0.1em;margin-bottom:6px">CATEGORY</div>'
        + '<input class="dm-cat" type="text" value="" placeholder="e.g. Work, Personal" style="width:100%;border:1px solid #f0ede8;border-radius:8px;padding:10px 12px;font:400 14px/1.5 inherit;color:#1a1a1a;outline:none;margin-bottom:16px">'
        + '<div style="font-size:10px;font-weight:600;color:#ccc;letter-spacing:0.1em;margin-bottom:6px">DUE DATE</div>'
        + '<input class="dm-due" type="date" value="" style="width:100%;border:1px solid #f0ede8;border-radius:8px;padding:10px 12px;font:400 14px/1.5 inherit;color:#1a1a1a;outline:none;margin-bottom:24px">'
        + '<div class="dm-meta" style="font-size:11px;color:#ccc;margin-bottom:24px"></div>'
        + '<div style="display:flex;justify-content:flex-end;gap:8px">'
        + '<button class="dm-cancel" style="background:none;border:1px solid #e5e5e5;border-radius:8px;padding:8px 20px;font:400 13px/1 inherit;color:#888;cursor:pointer">Cancel</button>'
        + '<button class="dm-save" style="background:#1a1a1a;color:#fff;border:none;border-radius:8px;padding:8px 20px;font:500 13px/1 inherit;cursor:pointer">Save</button>'
        + '</div>'

      var ti = m.querySelector('.dm-title'); ti.value = issue['summary'] || ''
      var de = m.querySelector('.dm-desc'); de.value = issue['description'] || ''
      var ca = m.querySelector('.dm-cat'); ca.value = issue['categories'] || ''
      var du = m.querySelector('.dm-due'); du.value = (issue['due'] || '').split('T')[0]
      var me = m.querySelector('.dm-meta')
      if (issue['created']) {
        var d = new Date(issue['created'])
        me.textContent = 'Created ' + d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
        if (issue['modified']) me.textContent += ' \u00B7 Modified ' + new Date(issue['modified']).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      }

      m.querySelector('.dm-cancel').addEventListener('click', close)
      m.querySelector('.dm-save').addEventListener('click', function() {
        var t = ti.value.trim(); if (t) store.set(issue, 'summary', t)
        var desc = de.value.trim(); if (desc) store.set(issue, 'description', desc); else store.unset(issue, 'description')
        var cat = ca.value.trim(); if (cat) store.set(issue, 'categories', cat); else store.unset(issue, 'categories')
        var due = du.value; if (due) store.set(issue, 'due', due + 'T00:00:00'); else store.unset(issue, 'due')
        store.set(issue, 'modified', new Date().toISOString())
        renderTodo(); close()
      })

      overlay.appendChild(m)
      document.body.appendChild(overlay)
      ti.focus(); ti.select()

      function close() { overlay.remove(); document.removeEventListener('keydown', esc) }
      function esc(e) { if (e.key === 'Escape') close() }
      document.addEventListener('keydown', esc)
    }

    function showMoveModal(issue, idx) {
      var doFetch = (window.xlogin && window.xlogin.authFetch) || fetch
      var overlay = document.createElement('div')
      overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; z-index: 10000;'
      overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove() })

      var m = document.createElement('div')
      m.style.cssText = 'background: #fff; border-radius: 12px; padding: 8px 0; min-width: 220px; max-width: 320px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);'
      m.innerHTML = '<div style="padding:12px 20px 8px;font-weight:600;font-size:11px;color:#999;text-transform:uppercase;letter-spacing:0.1em">Move to\u2026</div>'

      var targets = sidebarTrackers.filter(function(t) { return t.url !== dataUrl })
      if (targets.length === 0) {
        m.innerHTML += '<div style="padding:12px 20px;font-size:13px;color:#999">No other trackers.</div>'
      } else {
        targets.forEach(function(t) {
          var opt = document.createElement('div')
          opt.textContent = t.title
          opt.style.cssText = 'padding: 10px 20px; cursor: pointer; font-size: 14px; color: #1a1a1a; transition: background 0.1s;'
          opt.addEventListener('mouseenter', function() { opt.style.background = '#f8f7f5' })
          opt.addEventListener('mouseleave', function() { opt.style.background = 'none' })
          opt.addEventListener('click', async function() {
            opt.textContent = 'Moving\u2026'; opt.style.color = '#999'
            try {
              var res = await doFetch(t.url, { headers: { 'Accept': 'application/ld+json' } })
              var td = await res.json()
              var ti = td['issue'] || td['wf:issue'] || []
              var moved = JSON.parse(JSON.stringify(issue))
              moved['@id'] = '#Iss' + Date.now()
              moved['modified'] = new Date().toISOString()
              ti.unshift(moved); td['issue'] = ti
              await doFetch(t.url, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(td, null, 2) })
              store.remove(root, 'issue', function(i) { return i === issue })
              renderTodo(); overlay.remove()
            } catch (err) { opt.textContent = 'Error: ' + err.message; opt.style.color = '#dc2626' }
          })
          m.appendChild(opt)
        })
      }
      overlay.appendChild(m)
      document.body.appendChild(overlay)
    }

    // ========== SIDEBAR DISCOVERY ==========
    function populateSidebar() {
      if (!window.xlogin || !window.xlogin.authFetch || window.xlogin.type !== 'solid') return
      var webId = window.xlogin.id
      var af = window.xlogin.authFetch
      var baseUrl = webId.replace(/#.*$/, '')

      af(webId, { headers: { 'Accept': 'application/ld+json' } })
        .then(function(r) { return r.json() })
        .then(function(profile) {
          var nodes = Array.isArray(profile) ? profile : [profile]
          var tiUrls = []
          nodes.forEach(function(n) {
            if (!n) return
            Object.keys(n).forEach(function(k) {
              if (k.indexOf('TypeIndex') === -1 && k.indexOf('typeIndex') === -1) return
              var vals = Array.isArray(n[k]) ? n[k] : [n[k]]
              vals.forEach(function(v) { var id = typeof v === 'string' ? v : (v && v['@id']); if (id) tiUrls.push(new URL(id, baseUrl).href) })
            })
          })
          return Promise.all(tiUrls.map(function(tiUrl) {
            return af(tiUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() }).then(function(idx) {
              var urls = [], all = []
              function collect(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach(collect); return }; all.push(o); Object.values(o).forEach(function(v) { if (Array.isArray(v)) v.forEach(collect); else if (v && typeof v === 'object' && v['@id']) collect(v) }) }
              collect(idx)
              all.forEach(function(n) {
                var fc = n[SOLID + 'forClass'] || n['solid:forClass']; if (!fc) return
                var cls = Array.isArray(fc) ? fc : [fc]; var cid = cls[0] && (typeof cls[0] === 'string' ? cls[0] : cls[0]['@id'])
                if (MATCH.indexOf(cid) === -1) return
                var inst = n[SOLID + 'instance'] || n['solid:instance']; if (!inst) return
                var insts = Array.isArray(inst) ? inst : [inst]
                insts.forEach(function(v) { var id = typeof v === 'string' ? v : (v && v['@id']); if (id) urls.push(new URL(id, tiUrl).href) })
              })
              return urls
            }).catch(function() { return [] })
          }))
        })
        .then(function(results) {
          var allUrls = [].concat.apply([], results)
          return Promise.all(allUrls.map(function(url) {
            var docUrl = url.replace(/#.*$/, '')
            return af(docUrl, { headers: { 'Accept': 'application/ld+json' } }).then(function(r) { return r.json() }).then(function(td) {
              var title = td['title'] || td['dct:title'] || docUrl.split('/').pop()
              if (Array.isArray(td)) { var tn = td.find(function(n) { return n['http://purl.org/dc/terms/title'] }); if (tn) { var tv = tn['http://purl.org/dc/terms/title']; title = Array.isArray(tv) ? (tv[0] && tv[0]['@value'] || tv[0]) : tv } }
              return { title: title, url: docUrl, filename: docUrl.split('/').pop() }
            }).catch(function() { return null })
          }))
        })
        .then(function(trackers) {
          sidebarTrackers = trackers.filter(Boolean)
          renderTodo()
        })
        .catch(function() {})
    }

    // ========== INIT ==========
    // Re-render when store changes (including WebSocket live updates)
    var unsub = store.onChange(renderTodo)

    // Defer first render to ensure container is in DOM
    setTimeout(function() {
      renderTodo()
      populateSidebar()
    }, 0)
    document.addEventListener('xlogin', populateSidebar)

    onUnmount(container, function() {
      unsub()
    })
  }
}
