# LOSOS — Linked Object Shell / Operating System

> A 6KB reactive framework for building apps on linked data. No build step. No dependencies. No VDOM.

## What It Is

LOSOS renders **panes** — small ES modules that display and edit JSON-LD data. Data lives at URLs. Changes auto-save via HTTP PUT. Live updates arrive via WebSocket. Authentication is handled by xlogin (Solid + Nostr).

```
User clicks checkbox
  → store.set(issue, 'status', 'COMPLETED')
  → debounced PUT to pod
  → WebSocket notifies other clients
  → they reload and re-render
```

## Stack

| Layer | File | Size (gzip) | Purpose |
|-------|------|:-----------:|---------|
| LION | `packages/lion/index.js` | 1.5KB | Load JSON-LD, index by `@id`, fuzzy prop lookup |
| Store | `lib/store.js` | 1.9KB | Reactive mutations, dirty tracking, debounced PUT, WebSocket live updates |
| HTML | `lib/html.js` | 2.5KB | Tagged templates → surgical DOM, keyed lists, refs |
| **Total** | | **5.9KB** | |

Plus xlogin (~10KB) for auth and the LOSOS shell (~5KB) for pane loading + tab bar.

## How To Build An App

### 1. Create the data file (`my-data.jsonld`)

```json
{
  "@context": {
    "ical": "http://www.w3.org/2002/12/cal/ical#",
    "wf": "http://www.w3.org/2005/01/wf/flow#",
    "dct": "http://purl.org/dc/terms/",
    "title": "dct:title",
    "summary": "ical:summary",
    "status": "ical:status",
    "created": "dct:created",
    "issue": "wf:issue",
    "Tracker": "wf:Tracker",
    "Vtodo": "ical:Vtodo"
  },
  "@id": "#this",
  "@type": "Tracker",
  "title": "My Tasks",
  "initialState": "NEEDS-ACTION",
  "issue": [
    {
      "@id": "#Iss1",
      "@type": "Vtodo",
      "summary": "Build something",
      "status": "NEEDS-ACTION",
      "created": "2026-03-16T00:00:00Z"
    }
  ]
}
```

**Key rules:**
- `@context` maps short keys to full URIs — write `summary` not `ical:summary`
- `@type` can use context aliases too — `Tracker` not `wf:Tracker`
- No `@graph` — keep a single root node
- Use iCalendar vocabulary for tasks (industry standard)
- LION expands CURIEs (`ical:summary` → full URI) but not term aliases — both work because `store.prop()` does substring matching

### 2. Create the HTML shell (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My App</title>
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { font-family: Inter, system-ui, sans-serif; background: #faf9f7; }
    #losos { max-width: 780px; margin: 48px auto; padding: 0 20px; }
    button.pane-tab { color: #64748b !important; font-weight: 500 !important; }
    button.pane-tab[aria-selected="true"] { color: #6366f1 !important; font-weight: 600 !important; }
  </style>
</head>
<body>

<script id="data" type="application/ld+json" src="my-data.jsonld"></script>

<script type="module" data-pane src="panes/my-pane.js"></script>
<script type="module" data-pane src="panes/source-pane.js"></script>
<script src="https://unpkg.com/xlogin" data-guest="<64-char-hex-key>"></script>

<div id="losos"></div>
<script type="module" src="https://linkedobjects.github.io/losos/packages/shell/index.js"></script>
</body>
</html>
```

**How it works:**
1. Shell scans for `<script data-pane>` tags and loads each pane module
2. Shell fetches `<script type="application/ld+json" src="...">` into a LION store
3. Shell finds the primary subject (`#this`), builds a tab bar, renders the first matching pane
4. xlogin adds a login button. After login, `window.xlogin.authFetch` provides authenticated HTTP

### 3. Create a pane (`panes/my-pane.js`)

```js
import { createStore } from '../lib/store.js'
import { html, render, onUnmount } from '../lib/html.js'

export default {
  label: 'Tasks',
  icon: '✅',

  // Should this pane render for this data type?
  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Tracker')
  },

  // Render the pane into the container
  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    // Parse raw data and create reactive store
    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var data = JSON.parse(dataEl.textContent)
    var dataUrl = new URL(dataEl.getAttribute('src'), location.href).href

    var store = createStore(data, {
      url: dataUrl,
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')

    // Render function — called on every change
    function renderApp() {
      var issues = store.propAll(root, 'issue')
      render(container, html`
        <div style="padding: 48px 40px;">
          <h1>${data['title']}</h1>
          <input type="text" placeholder="Add a task..."
                 onkeydown="${function(e) {
                   if (e.key !== 'Enter') return
                   store.push(root, 'issue', {
                     '@id': '#Iss' + Date.now(),
                     '@type': 'Vtodo',
                     'summary': e.target.value,
                     'status': 'NEEDS-ACTION',
                     'created': new Date().toISOString()
                   })
                   e.target.value = ''
                 }}" />
          ${issues.map(function(issue) {
            return html`
              <div>
                <button onclick="${function() {
                  var done = issue['status'] === 'COMPLETED'
                  store.set(issue, 'status', done ? 'NEEDS-ACTION' : 'COMPLETED')
                }}">${issue['status'] === 'COMPLETED' ? '✓' : '○'}</button>
                <span>${issue['summary']}</span>
              </div>
            `
          })}
        </div>
      `)
    }

    // Subscribe to store changes (including WebSocket live updates)
    var unsub = store.onChange(renderApp)

    // Initial render (deferred to let shell finish)
    setTimeout(renderApp, 0)

    // Cleanup on tab switch
    onUnmount(container, unsub)
  }
}
```

That's a complete, working, reactive, auto-saving, live-updating pane in ~50 lines.

## Core APIs

### `createStore(jsonLd, options)`

Creates a reactive store from a JSON-LD object.

```js
var store = createStore(data, {
  url: 'https://pod.example/data.jsonld',    // PUT target
  authFetch: window.xlogin.authFetch,         // authenticated fetch
  debounce: 800                               // ms before auto-save
})
```

| Method | Does |
|--------|------|
| `store.get(id)` | Get node by `@id` |
| `store.prop(node, key)` | Read property (fuzzy key match) |
| `store.propAll(node, key)` | Read array property |
| `store.type(node)` | Get `@type` |
| `store.set(node, key, value)` | Write → dirty → auto-save |
| `store.unset(node, key)` | Delete property → auto-save |
| `store.push(node, key, value)` | Array append → auto-save |
| `store.remove(node, key, fn)` | Array filter → auto-save |
| `store.reorder(node, key, from, to)` | Array move → auto-save |
| `store.save()` | Force immediate PUT |
| `store.reload()` | Re-fetch from URL, notify listeners |
| `store.onChange(fn)` | Subscribe to changes (returns unsubscribe fn) |
| `store.toJSON()` | Serialize to JSON-LD string |

Every `set/push/remove/reorder` call:
1. Mutates the data in memory
2. Marks dirty
3. Schedules a debounced PUT (batches rapid changes)
4. Notifies all `onChange` listeners

### WebSocket Live Updates

The store automatically discovers WebSocket support:

```
createStore() → HEAD request → finds Updates-Via header → connects WebSocket
                                                           → subscribes to URL
                                                           → on pub message → reload() → notify()
```

If the server doesn't support WebSocket (no `Updates-Via` header), nothing happens. The app works without live updates — manual refresh still works.

Reconnects with exponential backoff (1s → 2s → 4s → ... → 30s max).

### `html` Tagged Templates

```js
import { html, render, onUnmount } from './lib/html.js'

// Render a template into a container
render(container, html`
  <h1>${title}</h1>
  <ul>${items.map(i => html`<li>${i.name}</li>`)}</ul>
`)

// Call render again — only changed values update in the DOM
// Same template shape? Patches the ${} holes. Different shape? Rebuilds.
```

**Supported value types in `${}`:**
- Strings, numbers → text content
- `null`, `false` → renders nothing
- Arrays → renders each item
- Nested `html``...`` ` → nested template
- Functions in `on*` attributes → event handlers

**Event handlers:**
```js
html`<button onclick="${function(e) { ... }}">Click</button>`
html`<input onkeydown="${handler}" />`
```

**Conditional rendering:**
```js
html`${condition ? html`<div>Yes</div>` : null}`
```

**`onUnmount(container, fn)`** — calls `fn` when the container is removed from the DOM (tab switch cleanup).

### Keyed Lists

For efficient list rendering, use `keyed()` instead of `.map()`. It diffs by key — reuses DOM for existing items, creates DOM for new items, removes DOM for deleted items.

```js
import { keyed } from '../lib/html.js'

render(container, html`
  ${keyed(issues,
    function(i) { return i['@id'] },                          // key function
    function(i) { return html`<div>${i['summary']}</div>` }   // template function
  )}
`)
```

Without `keyed()`, `.map()` rebuilds every row on every render. With `keyed()`, only changed rows update. Use `@id` as the key — it's unique per item by design.

### Refs

LOSOS has two kinds of refs:

**Data refs** — every JSON-LD node has an `@id` URI. This is a global, persistent, dereferenceable ref that works across apps and pods:
```js
store.get('#Iss1710252000000')                    // local node
store.get('https://pod.example/data.jsonld#this')  // any node anywhere
```

**DOM refs** — for grabbing a rendered element (focus, scroll, measurement):
```js
import { ref } from '../lib/html.js'

var inputRef = ref()
render(container, html`<input ref="${inputRef}" placeholder="Type here..." />`)
// After render:
inputRef.el.focus()
```

The `@id` ref is the architecture. The DOM `ref()` is a convenience for the rare cases where you need direct element access.

## Pane API

Every pane is an ES module with a default export:

```js
export default {
  label: 'My Pane',           // Tab label
  icon: '📋',                 // Tab icon
  canHandle(subject, store) { // Should this pane show for this data?
    return store.type(store.get(subject.value))?.includes('MyType')
  },
  render(subject, store, container) {  // Fill the container
    // subject.value = the @id of the primary node
    // store = LION store (read-only, for canHandle)
    // container = DOM element to render into
  }
}
```

**Rules:**
- Append to `container` — don't return elements
- Tabs are handled by the shell — panes don't build tab bars
- Use `document.createElement()` or `html``...`` ` — avoid `innerHTML` (XSS)
- All styling via `<style>` or `style` attribute — no external stylesheets

## Data Format

Use flat JSON-LD with `@context` aliases for clean property names.

**Do:**
```json
{
  "@context": { "title": "dct:title", "summary": "ical:summary" },
  "@type": "Tracker",
  "title": "My Tasks",
  "issue": [{ "summary": "Build it", "status": "NEEDS-ACTION" }]
}
```

**Don't:**
```json
{
  "@graph": [{ "@id": "#this", "dct:title": "My Tasks" }]
}
```

No `@graph`. No prefixed property keys. The `@context` does the RDF mapping — the data reads like plain JSON.

## Authentication

xlogin handles Solid OIDC and Nostr login:

```html
<!-- With guest login (shared Nostr key) -->
<script src="https://unpkg.com/xlogin" data-guest="<64-char-hex-privkey>"></script>
```

After login:
```js
window.xlogin.type       // "nostr", "solid", or "guest"
window.xlogin.id         // WebID or pubkey
window.xlogin.authFetch  // authenticated fetch function
```

The store uses `authFetch` for all HTTP requests automatically.

## Solid Pod Integration

### Type Index Discovery

```
WebID profile → solid:publicTypeIndex → forClass wf:Tracker → instance URL
```

All via `Accept: application/ld+json` — no Turtle parsing needed.

### Registering Data in Type Index

Use read-modify-write (GET + PUT) on the type index:

```js
var tiData = await authFetch(typeIndexUrl, { headers: { 'Accept': 'application/ld+json' } }).then(r => r.json())
tiData['schema:itemListElement'].push({
  '@id': '#reg-myapp',
  '@type': 'solid:TypeRegistration',
  'solid:forClass': { '@id': 'http://www.w3.org/2005/01/wf/flow#Tracker' },
  'solid:instance': { '@id': dataUrl + '#this' }
})
await authFetch(typeIndexUrl, { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: JSON.stringify(tiData, null, 2) })
```

## File Structure

```
index.html              # Shell (JSON-LD script + pane scripts + xlogin)
my-data.jsonld          # Data (separate file, linked via src)
lib/
  store.js              # Reactive store with auto-save + WebSocket
  html.js               # Tagged template DOM engine
panes/
  my-pane.js            # Your app pane
  source-pane.js        # Raw JSON-LD viewer (useful for debugging)
  pod-pane.js           # Solid pod browser (optional)
```

## Summary

```
To build a LOSOS app:
1. Create a .jsonld data file with @context aliases
2. Create an index.html that loads the shell + xlogin + your panes
3. Create panes that import lib/store.js and lib/html.js
4. Use store.set/push/remove — data auto-saves and live-syncs
5. Use html`` templates — DOM auto-patches on re-render
6. Deploy to any static host or Solid pod
```

6KB of framework. The rest is your app.
