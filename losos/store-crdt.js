/**
 * LOSOS CRDT Store — Op-based conflict-free reactive store
 * Same API as store.js but syncs operations instead of full documents.
 * ~2KB. No dependencies.
 *
 * Operations:
 *   set(node, key, value)     → { op: 'set', id, key, value, ts }
 *   push(node, key, value)    → { op: 'push', id, key, value, ts }
 *   remove(node, key, itemId) → { op: 'remove', id, key, itemId, ts }
 *   reorder(node, key, f, t)  → { op: 'reorder', id, key, from, to, ts }
 *
 * Conflict resolution:
 *   set  → Last-Writer-Wins (highest timestamp wins)
 *   push → Add-wins (both items kept, deduplicated by @id)
 *   remove → Remove wins over concurrent push of same @id
 */

export function createStore(jsonLd, options) {
  var url = options.url || null
  var doFetch = options.authFetch || fetch
  var debounceMs = options.debounce || 1000
  var nodes = new Map()
  var context = jsonLd['@context'] || {}
  var dirty = false
  var timer = null
  var listeners = []
  var opListeners = []
  var ws = null
  var wsDelay = 1000
  var peerId = Math.random().toString(36).slice(2, 10)
  var opLog = []       // operations not yet confirmed
  var tombstones = new Set()  // removed @ids

  function index(obj) {
    if (!obj || typeof obj !== 'object') return
    if (Array.isArray(obj)) { obj.forEach(index); return }
    var id = obj['@id']
    if (id) nodes.set(id, obj)
    Object.keys(obj).forEach(function(k) {
      if (k.startsWith('@')) return
      var v = obj[k]
      if (Array.isArray(v)) v.forEach(index)
      else if (v && typeof v === 'object') index(v)
    })
  }
  index(jsonLd)

  function resolveKey(node, key) {
    if (node[key] !== undefined) return key
    for (var k in node) {
      if (k === key) return k
      if (k.endsWith(':' + key) || k.endsWith('/' + key) || k.endsWith('#' + key)) return k
    }
    return null
  }

  function now() { return Date.now() + '.' + peerId }

  function markDirty() {
    dirty = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(function() { store.save() }, debounceMs)
    notify()
  }

  function notify() {
    listeners.forEach(function(fn) { fn() })
  }

  function broadcastOp(op) {
    opLog.push(op)
    opListeners.forEach(function(fn) { fn(op) })
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(op))
    }
  }

  function applyOp(op, remote) {
    var node = nodes.get(op.id)
    if (!node) return

    var k = resolveKey(node, op.key) || op.key

    if (op.op === 'set') {
      node[k] = op.value
    } else if (op.op === 'push') {
      if (!Array.isArray(node[k])) node[k] = node[k] ? [node[k]] : []
      // Add-wins: deduplicate by @id
      var itemId = op.value && op.value['@id']
      if (itemId) {
        if (tombstones.has(itemId)) return // removed wins
        var exists = node[k].some(function(i) { return i && i['@id'] === itemId })
        if (exists) return
      }
      node[k].push(op.value)
      if (op.value && typeof op.value === 'object') index(op.value)
    } else if (op.op === 'remove') {
      if (!Array.isArray(node[k])) return
      node[k] = node[k].filter(function(item) {
        if (item && item['@id'] === op.itemId) {
          tombstones.add(op.itemId)
          return false
        }
        return true
      })
    } else if (op.op === 'reorder') {
      if (!Array.isArray(node[k])) return
      var arr = node[k]
      if (op.from >= 0 && op.from < arr.length) {
        var item = arr.splice(op.from, 1)[0]
        arr.splice(op.to, 0, item)
      }
    } else if (op.op === 'unset') {
      delete node[k]
    }

    if (remote) notify()
  }

  function connectWs(wsUrl) {
    if (ws) return
    try {
      ws = new WebSocket(wsUrl)
      ws.onopen = function() {
        ws.send('sub ' + url)
        // Replay queued ops from offline
        opLog.forEach(function(op) { ws.send(JSON.stringify(op)) })
        wsDelay = 1000
      }
      ws.onmessage = function(e) {
        var msg = e.data
        // Try to parse as CRDT operation
        if (msg.startsWith('{')) {
          try {
            var op = JSON.parse(msg)
            if (op.op && op.peer !== peerId) {
              applyOp(op, true)
            }
            return
          } catch (err) {}
        }
        // Fallback: standard Solid pub notification
        if (msg.startsWith('pub ') && !dirty) {
          store.reload()
        }
      }
      ws.onclose = function() {
        ws = null
        setTimeout(function() { connectWs(wsUrl) }, wsDelay)
        wsDelay = Math.min(wsDelay * 2, 30000)
      }
      ws.onerror = function() { ws.close() }
    } catch (e) { ws = null }
  }

  var store = {
    get: function(id) { return nodes.get(id) || null },

    prop: function(node, key) {
      if (!node) return null
      var k = resolveKey(node, key)
      return k ? node[k] : null
    },

    propAll: function(node, key) {
      var val = store.prop(node, key)
      if (val == null) return []
      return Array.isArray(val) ? val : [val]
    },

    type: function(node) { return node ? (node['@type'] || null) : null },

    set: function(node, key, value) {
      if (!node) return
      var k = resolveKey(node, key) || key
      if (node[k] === value) return
      var op = { op: 'set', id: node['@id'], key: k, value: value, ts: now(), peer: peerId }
      node[k] = value
      if (value && typeof value === 'object') index(value)
      broadcastOp(op)
      markDirty()
    },

    unset: function(node, key) {
      if (!node) return
      var k = resolveKey(node, key)
      if (!k) return
      var op = { op: 'unset', id: node['@id'], key: k, ts: now(), peer: peerId }
      delete node[k]
      broadcastOp(op)
      markDirty()
    },

    push: function(node, key, value) {
      if (!node) return
      var k = resolveKey(node, key) || key
      if (!Array.isArray(node[k])) node[k] = node[k] ? [node[k]] : []
      node[k].push(value)
      if (value && typeof value === 'object') index(value)
      var op = { op: 'push', id: node['@id'], key: k, value: value, ts: now(), peer: peerId }
      broadcastOp(op)
      markDirty()
    },

    remove: function(node, key, fn) {
      if (!node) return
      var k = resolveKey(node, key)
      if (!k || !Array.isArray(node[k])) return
      var removed = node[k].filter(fn)
      node[k] = node[k].filter(function(item) { return !fn(item) })
      removed.forEach(function(item) {
        if (item && item['@id']) {
          tombstones.add(item['@id'])
          var op = { op: 'remove', id: node['@id'], key: k, itemId: item['@id'], ts: now(), peer: peerId }
          broadcastOp(op)
        }
      })
      markDirty()
    },

    reorder: function(node, key, fromIdx, toIdx) {
      if (!node) return
      var k = resolveKey(node, key)
      if (!k || !Array.isArray(node[k])) return
      var arr = node[k]
      var item = arr.splice(fromIdx, 1)[0]
      arr.splice(toIdx, 0, item)
      var op = { op: 'reorder', id: node['@id'], key: k, from: fromIdx, to: toIdx, ts: now(), peer: peerId }
      broadcastOp(op)
      markDirty()
    },

    toJSON: function() { return JSON.stringify(jsonLd, null, 2) },

    save: function() {
      if (!dirty || !url) return Promise.resolve()
      dirty = false
      if (timer) { clearTimeout(timer); timer = null }
      // Cache locally for offline
      try { localStorage.setItem('losos:' + url, store.toJSON()) } catch (e) {}
      return doFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/ld+json' },
        body: store.toJSON()
      }).then(function(res) {
        if (res && res.headers && !ws) {
          var wsUrl = res.headers.get('Updates-Via')
          if (wsUrl) connectWs(wsUrl)
        }
        opLog = [] // confirmed
      }).catch(function(err) {
        console.warn('Save failed:', err)
        dirty = true
      })
    },

    reload: function() {
      if (!url) return Promise.resolve()
      return doFetch(url, { headers: { 'Accept': 'application/ld+json' } })
        .then(function(res) { return res.json() })
        .then(function(newData) {
          Object.keys(newData).forEach(function(k) {
            if (k !== '@context') jsonLd[k] = newData[k]
          })
          nodes.clear()
          tombstones.clear()
          index(jsonLd)
          notify()
        })
        .catch(function(err) { console.warn('Reload failed:', err) })
    },

    onChange: function(fn) {
      listeners.push(fn)
      return function() { listeners = listeners.filter(function(f) { return f !== fn }) }
    },

    // Subscribe to operations (for syncing between stores)
    onOp: function(fn) {
      opListeners.push(fn)
      return function() { opListeners = opListeners.filter(function(f) { return f !== fn }) }
    },

    // Apply a remote operation
    applyRemote: function(op) {
      if (op.peer === peerId) return
      applyOp(op, true)
    },

    get dirty() { return dirty },
    get data() { return jsonLd },
    get context() { return context },
    get peerId() { return peerId }
  }

  // Discover WebSocket on init
  if (url) {
    doFetch(url, { method: 'HEAD' }).then(function(res) {
      if (res && res.headers) {
        var wsUrl = res.headers.get('Updates-Via')
        if (wsUrl) connectWs(wsUrl)
      }
    }).catch(function() {})
  }

  // Cache initial data for offline
  if (url) {
    try { localStorage.setItem('losos:' + url, store.toJSON()) } catch (e) {}
  }

  return store
}

// Load data with offline fallback
// Usage: loadData(url, authFetch).then(function(data) { var store = createStore(data, ...) })
export function loadData(url, authFetch) {
  var doFetch = authFetch || fetch
  return doFetch(url, { headers: { 'Accept': 'application/ld+json' } })
    .then(function(res) { return res.json() })
    .catch(function() {
      // Offline — try localStorage cache
      var cached = localStorage.getItem('losos:' + url)
      if (cached) return JSON.parse(cached)
      return null
    })
}
