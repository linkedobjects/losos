# Build LOSOS Apps

> LOSOS is a 6KB reactive framework for linked data apps. No build step. No dependencies. No VDOM. Data lives at URLs, auto-saves via PUT, and syncs in real time via WebSocket.

## Quick Start

Three files make an app:

```
my-app/
  index.html          # Shell — loads data + panes
  data.jsonld          # Data — JSON-LD at a URL
  panes/
    my-pane.js         # Pane — renders + edits the data
```

### 1. Data (`data.jsonld`)

```json
{
  "@context": {
    "dct": "http://purl.org/dc/terms/",
    "title": "dct:title",
    "description": "dct:description",
    "created": "dct:created"
  },
  "@id": "#this",
  "@type": "MyApp",
  "title": "My App",
  "created": "2026-03-16T00:00:00Z"
}
```

Rules:
- **Flat context aliases** — write `title` not `dct:title` in data
- **No `@graph`** — single root node with `@id: "#this"`
- **`@type`** can use context aliases — `"MyApp"` with `"MyApp": "schema:SoftwareApplication"` in context
- **Standard vocabularies** — use iCalendar (`ical:`), Dublin Core (`dct:`), Schema.org (`schema:`) where possible
- **Every node gets an `@id`** — use `#` + timestamp for generated IDs: `"@id": "#Item1710252000000"`

### 2. Shell (`index.html`)

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
    button.pane-tab { color: #64748b !important; }
    button.pane-tab[aria-selected="true"] { color: #6366f1 !important; font-weight: 600 !important; }
  </style>
</head>
<body>

<script type="application/ld+json" src="data.jsonld"></script>
<script type="module" data-pane src="panes/my-pane.js"></script>
<script src="https://unpkg.com/xlogin"></script>

<div id="losos"></div>
<script type="module" src="https://linkedobjects.github.io/losos/packages/shell/index.js"></script>
</body>
</html>
```

### 3. Pane (`panes/my-pane.js`)

```js
import { createStore } from '../lib/store.js'
import { html, render, onUnmount, keyed } from '../lib/html.js'

export default {
  label: 'My App',
  icon: '📋',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('MyApp')
  },

  render(subject, lionStore, container) {
    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var data = JSON.parse(dataEl.textContent)
    var dataUrl = new URL(dataEl.getAttribute('src'), location.href).href

    var store = createStore(data, {
      url: dataUrl,
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')

    function renderApp() {
      render(container, html`
        <div style="padding: 48px 40px;">
          <h1>${data['title']}</h1>
          <!-- your app here -->
        </div>
      `)
    }

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
```

## Framework APIs

### Store (`lib/store.js`)

```js
import { createStore } from '../lib/store.js'

var store = createStore(data, {
  url: 'https://pod.example/data.jsonld',    // PUT target
  authFetch: window.xlogin.authFetch,         // authenticated fetch
  debounce: 800                               // ms before auto-save
})
```

| Method | Does |
|--------|------|
| `store.get(id)` | Node by `@id` |
| `store.prop(node, key)` | Read property (fuzzy match) |
| `store.propAll(node, key)` | Read as array |
| `store.type(node)` | Get `@type` |
| `store.set(node, key, value)` | Write → auto-save |
| `store.unset(node, key)` | Delete property → auto-save |
| `store.push(node, key, value)` | Append to array → auto-save |
| `store.remove(node, key, fn)` | Filter array → auto-save |
| `store.reorder(node, key, from, to)` | Move in array → auto-save |
| `store.save()` | Force immediate PUT |
| `store.reload()` | Re-fetch from URL |
| `store.onChange(fn)` | Subscribe (returns unsubscribe fn) |
| `store.toJSON()` | Serialize to JSON-LD string |

Every `set/push/remove/reorder`:
1. Mutates data in memory
2. Marks dirty
3. Schedules debounced PUT
4. Notifies all `onChange` listeners
5. On first save, discovers WebSocket via `Updates-Via` header and subscribes

### HTML Templates (`lib/html.js`)

```js
import { html, render, onUnmount, ref, keyed } from '../lib/html.js'
```

**Basic rendering:**
```js
render(container, html`<h1>${title}</h1>`)
// Call again — only the ${} holes patch, rest of DOM untouched
```

**Event handlers:**
```js
html`<button onclick="${function(e) { ... }}">Click</button>`
```

**Conditional:**
```js
html`${condition ? html`<div>Yes</div>` : null}`
```

**Lists (unkeyed):**
```js
html`${items.map(function(i) { return html`<div>${i.name}</div>` })}`
```

**Lists (keyed — efficient, reuses DOM):**
```js
html`${keyed(items,
  function(i) { return i['@id'] },
  function(i) { return html`<div>${i.name}</div>` }
)}`
```

**Refs (grab DOM element after render):**
```js
var inputRef = ref()
render(container, html`<input ref="${inputRef}" />`)
inputRef.el.focus()
```

**Lifecycle:**
```js
onUnmount(container, function() {
  // cleanup — runs when container is removed from DOM (tab switch)
})
```

## Component Model

A component is a function that returns `html`. A pane is an object with `canHandle` + `render`.

```js
// Component — used by a parent
function TaskRow(issue, store) {
  var done = issue['status'] === 'COMPLETED'
  return html`
    <div style="display: flex; gap: 12px; padding: 8px 0;">
      <button onclick="${function() {
        store.set(issue, 'status', done ? 'NEEDS-ACTION' : 'COMPLETED')
      }}">${done ? '✓' : '○'}</button>
      <span>${issue['summary']}</span>
    </div>
  `
}

// Use it
render(container, html`
  <h1>Tasks</h1>
  ${keyed(issues, function(i) { return i['@id'] }, function(i) {
    return TaskRow(i, store)
  })}
`)
```

```js
// Pane — registered with the shell via <script data-pane>
export default {
  label: 'Tasks',
  icon: '✅',
  canHandle(subject, store) {
    return store.type(store.get(subject.value))?.includes('Tracker')
  },
  render(subject, store, container) {
    // uses components internally
  }
}
```

A component can be promoted to a pane by adding `canHandle` + `label` + `icon`. A pane uses components internally. One pattern, two uses.

## Styling

All styling via `<style>` tags or inline `style` attributes. No external stylesheets. No CSS-in-JS.

```js
render(container, html`
  <style>
    .my-row { display: flex; gap: 12px; padding: 8px 0; }
    .my-row:hover .my-actions { opacity: 1; }
    .my-actions { opacity: 0; transition: opacity 0.2s; }
  </style>
  <div class="my-row">
    <span>${item.name}</span>
    <div class="my-actions">
      <button onclick="${onDelete}">×</button>
    </div>
  </div>
`)
```

The shell tab bar needs `!important` overrides:
```css
button.pane-tab { color: #64748b !important; }
button.pane-tab[aria-selected="true"] { color: #6366f1 !important; }
```

## Data Patterns

### Todo / Task Tracker

Use iCalendar `Vtodo` vocabulary:

```json
{
  "@context": {
    "ical": "http://www.w3.org/2002/12/cal/ical#",
    "wf": "http://www.w3.org/2005/01/wf/flow#",
    "dct": "http://purl.org/dc/terms/",
    "summary": "ical:summary",
    "description": "ical:description",
    "status": "ical:status",
    "categories": "ical:categories",
    "due": "ical:due",
    "priority": "ical:priority",
    "created": "dct:created",
    "modified": "ical:lastModified",
    "title": "dct:title",
    "initialState": "wf:initialState",
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
      "@id": "#Iss1710252000000",
      "@type": "Vtodo",
      "summary": "Build something",
      "status": "NEEDS-ACTION",
      "created": "2026-03-16T00:00:00Z"
    }
  ]
}
```

Status values (RFC 5545): `NEEDS-ACTION`, `IN-PROCESS`, `COMPLETED`, `CANCELLED`

### Generic List

```json
{
  "@context": {
    "schema": "https://schema.org/",
    "name": "schema:name",
    "item": "schema:itemListElement",
    "ItemList": "schema:ItemList"
  },
  "@id": "#this",
  "@type": "ItemList",
  "name": "My List",
  "item": []
}
```

### Custom Type

```json
{
  "@context": {
    "schema": "https://schema.org/",
    "name": "schema:name",
    "text": "schema:text",
    "created": "schema:dateCreated",
    "Note": "schema:TextDigitalDocument"
  },
  "@id": "#this",
  "@type": "Note",
  "name": "My Note",
  "text": "Hello world",
  "created": "2026-03-16T00:00:00Z"
}
```

## Authentication

xlogin handles Solid OIDC + Nostr + guest login:

```html
<!-- Basic -->
<script src="https://unpkg.com/xlogin"></script>

<!-- With guest login (shared Nostr key) -->
<script src="https://unpkg.com/xlogin" data-guest="<64-char-hex-privkey>"></script>
```

After login:
```js
window.xlogin.type       // "nostr", "solid", or "guest"
window.xlogin.id         // WebID or pubkey
window.xlogin.authFetch  // authenticated fetch — pass to createStore
```

Listen for login:
```js
document.addEventListener('xlogin', function(e) {
  console.log(e.detail.type, e.detail.id)
})
```

## CRDT Store (Optional)

For multiplayer / offline apps, swap `store.js` for `store-crdt.js`:

```js
import { createStore } from '../lib/store-crdt.js'
// Same API — but operations sync between clients
// and data is cached in localStorage for offline
```

Extra methods:
- `store.onOp(fn)` — subscribe to operations
- `store.applyRemote(op)` — apply operation from another peer
- `store.peerId` — unique ID for this client

```js
// Wire two stores together
aliceStore.onOp(function(op) { bobStore.applyRemote(op) })
bobStore.onOp(function(op) { aliceStore.applyRemote(op) })
```

## Solid Pod Integration

### Type Index Discovery

After Solid login, discover user's data:

```js
var webId = window.xlogin.id
var profile = await authFetch(webId, {
  headers: { 'Accept': 'application/ld+json' }
}).then(r => r.json())
// Find solid:publicTypeIndex → fetch → find solid:forClass → solid:instance
```

### Register Data in Type Index

Read-modify-write (not PATCH):

```js
var tiData = await authFetch(typeIndexUrl, {
  headers: { 'Accept': 'application/ld+json' }
}).then(r => r.json())

tiData['schema:itemListElement'].push({
  '@id': '#reg-myapp',
  '@type': 'solid:TypeRegistration',
  'solid:forClass': { '@id': 'http://www.w3.org/2005/01/wf/flow#Tracker' },
  'solid:instance': { '@id': dataUrl + '#this' }
})

await authFetch(typeIndexUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(tiData, null, 2)
})
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `@graph` | Keep flat — single root node, nest data as properties |
| Prefixed property keys in data | Use context aliases — `summary` not `ical:summary` |
| `innerHTML` in templates | Use `html` tagged templates or `document.createElement` |
| Saving on every change | Let the store debounce — just call `store.set()` |
| Manual `fetch` for save | Pass `authFetch` to `createStore` — it handles PUT |
| Full re-render without keyed | Use `keyed()` for lists to reuse DOM nodes |
| Forgetting `onUnmount` | Always clean up `onChange` subscriptions |
| `setTimeout(render, 0)` missing | First render must be deferred to let shell attach container |
| Calling `renderAll()` after store mutation | Use `store.onChange(renderAll)` — it auto-triggers on `set/push/remove` |

## Stack Sizes

| File | Raw | Gzipped |
|------|----:|--------:|
| LION (shell) | 4.0 KB | 1.5 KB |
| lib/store.js | 6.0 KB | 1.9 KB |
| lib/html.js | 7.5 KB | 2.5 KB |
| **Total** | **17.5 KB** | **5.9 KB** |
| store-crdt.js (optional) | 9.5 KB | 2.9 KB |

## Example Apps

- **Todo tracker** — [melvin.me/public/todo/](https://melvin.me/public/todo/) — full app with sidebar, multiple trackers, detail modal, pod integration
- **Landing page** — [melvin.me/public/todo/losos/](https://melvin.me/public/todo/losos/) — live interactive demo with CRDT multiplayer
