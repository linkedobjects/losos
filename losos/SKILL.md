# LOSOS — LLM Skill Guide

> A 6KB reactive framework for building apps on linked data. No build step. No dependencies.
> Full docs at https://losos.org/docs/

## Quick Start — Single File App

```html
<!DOCTYPE html>
<html>
<head><title>My App</title></head>
<body>

<script type="application/ld+json">
{
  "@context": { "title": "http://purl.org/dc/terms/title",
                "item": "http://schema.org/hasPart",
                "name": "http://schema.org/name" },
  "@id": "#this",
  "@type": "List",
  "title": "My List",
  "item": [
    { "@id": "#1", "name": "First item" },
    { "@id": "#2", "name": "Second item" }
  ]
}
</script>

<div id="app"></div>

<script type="module">
import { createStore } from 'https://losos.org/losos/store.js'
import { html, render, keyed } from 'https://losos.org/losos/html.js'

var data = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)
var store = createStore(data, { debounce: 500 })
// Changes are in-memory only. To auto-save via PUT, add: url: 'data.jsonld'
var root = store.get('#this')

function renderApp() {
  var items = store.propAll(root, 'item')
  render(document.getElementById('app'), html`
    <h1>${data.title}</h1>
    <input placeholder="Add..." onkeydown="${function(e) {
      if (e.key !== 'Enter' || !e.target.value.trim()) return
      store.push(root, 'item', { '@id': '#' + Date.now(), 'name': e.target.value.trim() })
      e.target.value = ''
    }}" />
    ${keyed(items, function(i) { return i['@id'] }, function(i) {
      return html`<div>${i.name} <button onclick="${function() {
        store.remove(root, 'item', function(x) { return x === i })
      }}">x</button></div>`
    })}
  `)
}

store.onChange(renderApp)
renderApp()
</script>
</body>
</html>
```

Serve with `npx serve .` or `python3 -m http.server`. No install needed.

> **Note:** The Quick Start above imports directly from losos.org (no shell). For full apps with panes and tabs, you also need `lion/index.js` (the shell depends on it). See File Structure below.

## File Structure (Full App)

```
my-app/
  losos/             ← framework (copy from losos.org/losos/)
    html.js          ← templates, DOM patching, keyed lists, refs
    store.js         ← reactive store, auto-save, WebSocket sync
    shell.js         ← pane loader, tab bar, boot options
    registry.js      ← @type → pane URL mappings
  lion/              ← JSON-LD store (copy from losos.org/lion/)
    index.js
  panes/             ← your app code
    my-pane.js
    source-pane.js
  data.jsonld        ← your data
  index.html
```

## Shell (index.html)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My App</title>
</head>
<body>
  <script type="application/ld+json" src="data.jsonld"></script>
  <script type="module" data-pane src="panes/my-pane.js"></script>
  <script type="module" data-pane src="panes/source-pane.js"></script>
  <div id="losos"></div>
  <script type="module" src="losos/shell.js"></script>
</body>
</html>
```

Shell auto-boots when `#losos` exists. For custom options:

```js
import { boot } from './losos/shell.js'
boot('#app', { maxWidth: '100%', accentColor: '#e63946' })
```

Shell provides:
- Built-in tab persistence (namespaced by pathname, no MutationObserver needed)
- Error feedback via `console.warn('[losos] ...')` on all failures
- Raw JSON-LD passed as 4th argument to `pane.render()`

## Pane API

```js
import { createStore } from '../losos/store.js'
import { html, render, onUnmount, keyed, ref } from '../losos/html.js'

export default {
  label: 'My Pane',
  icon: '📋',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('MyType')
  },

  render(subject, lionStore, container, rawData) {
    // rawData = parsed JSON-LD from shell (4th arg, eliminates textContent race)
    var data = rawData
    var store = createStore(data, {
      url: 'https://pod.example/data.jsonld',  // PUT target (optional)
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')

    function renderApp() {
      var items = store.propAll(root, 'item')
      render(container, html`
        <h1>${data['title']}</h1>
        ${keyed(items, function(i) { return i['@id'] }, function(i) {
          return html`<div>${i['name']}</div>`
        })}
      `)
    }

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
```

Key rules:
- **Use `rawData` (4th arg)** — don't parse `dataEl.textContent` (race condition)
- **Append to `container`** — don't return elements
- **Tabs handled by shell** — panes don't build tab bars
- **`store.set()` triggers `onChange` synchronously** — don't call `renderApp()` after mutations

## Store Methods

| Method | Description |
|--------|-------------|
| `store.get(id)` | Get node by `@id` |
| `store.prop(node, key)` | Read property (fuzzy key match) |
| `store.propAll(node, key)` | Read array property (always returns array) |
| `store.type(node)` | Get `@type` |
| `store.set(node, key, value)` | Write → dirty → onChange → auto-save |
| `store.unset(node, key)` | Delete property |
| `store.push(node, key, value)` | Array append |
| `store.remove(node, key, fn)` | Array filter by predicate |
| `store.reorder(node, key, from, to)` | Array move |
| `store.save()` | Force immediate PUT |
| `store.reload()` | Re-fetch from URL, notify listeners |
| `store.onChange(fn)` | Subscribe (returns unsubscribe function) |
| `store.toJSON()` | Serialize to JSON-LD string |
| `store.data` | The raw JSON-LD root |

## Template API

| Function | Description |
|----------|-------------|
| `html`\`...\`` | Tagged template literal → template object |
| `render(container, template)` | First call builds DOM, subsequent calls patch only changed values |
| `keyed(items, keyFn, templateFn)` | Efficient list rendering — skips unchanged items |
| `ref()` | Grab DOM element after render: `var r = ref(); html`\`<input ref="${r}" />\``; r.el.focus()` |
| `onUnmount(container, fn)` | Cleanup on tab switch (unsubscribe, pause audio, etc.) |
| `innerHTML` attribute | `html`\`<div innerHTML="${htmlString}"></div>\`` — XSS risk with untrusted content |

**⚠️ CRITICAL RULE: Every `${}` in an opening tag must be the ENTIRE attribute value.**

No mixing static text with `${}` inside any attribute. The whole value must be one expression.

```js
// ❌ BAD — mixed string + interpolation in attribute
html`<div class="card ${active ? 'active' : ''}">`
html`<div style="background: ${color}">`
html`<div style="--color: ${color}">`
html`<input ${checked ? 'checked' : ''} onchange="${fn}">`

// ✅ GOOD — entire attribute value is one ${}
html`<div class="${active ? 'card active' : 'card'}">`
html`<div style="${'background:' + color}">`
html`<div style="${'--color:' + color}">`
html`<input checked="${checked}" onchange="${fn}">`
```

Breaking this rule corrupts attribute parsing silently. The browser may throw "parameter 2 is not of type 'Object'" — that means you have a mixed interpolation somewhere.

**Refs:** `ref().el` is `null` until `render()` runs. Use optional chaining: `myRef.el?.focus()`

## Nested Panes (resolvePane)

Render panes inside panes — data-driven composition:

```js
import { resolvePane } from '../losos/shell.js'

// Inside a parent pane:
var childNode = lionStore.get('#person1')
var div = document.createElement('div')
container.appendChild(div)
await resolvePane(childNode, lionStore, div, rawData)
```

Checks three sources in order:
1. **Local panes** — `canHandle` match from `<script data-pane>` tags
2. **`ui:view` on node** — data declares its own view URL
3. **Registry** — `@type` → pane URL mapping from `losos/registry.js`

Extend the registry:
```js
import { registry } from './losos/shell.js'
registry['schema:Person'] = './panes/person-pane.js'
```

## Data Format (JSON-LD)

```json
{
  "@context": {
    "dct": "http://purl.org/dc/terms/",
    "schema": "http://schema.org/",
    "title": "dct:title",
    "item": "schema:hasPart",
    "name": "schema:name"
  },
  "@id": "#this",
  "@type": "MyType",
  "title": "My App",
  "item": [
    { "@id": "#1", "@type": "Item", "name": "First" }
  ]
}
```

Rules:
- Every node has `@id` — a global, dereferenceable URI
- **Root node must use `@id: "#this"`** — the shell's `findSubject()` looks for `#this` first. Other `@id` values on the root will cause "No data found"
- `@type` determines which pane renders it
- `@context` maps short keys to standard URIs
- No `@graph` — single root node
- `ui:view` on a node declares its pane URL
- **Type expansion**: LION expands prefixed types (`schema:Person` → `http://schema.org/Person`) but NOT context aliases (`Person` stays as `Person` if mapped via `"Person": "schema:Person"`). In `canHandle`, check for the short name used in the data, not the expanded URI
- **`createStore(data)` works without options** — no need to pass `{}` for read-only usage

## API-Driven Apps

For apps that fetch from external APIs, bootstrap data before loading the shell:

```html
<script id="data" type="application/ld+json"></script>
<script type="module" data-pane src="panes/my-pane.js"></script>
<div id="losos"></div>

<script>
fetch('https://api.example.com/data')
  .then(function(r) { return r.json() })
  .then(function(apiData) {
    var jsonLd = {
      "@context": { ... },
      "@id": "#this",
      "@type": "MyType",
      ...transformApiData(apiData)
    }
    window.__myData = jsonLd
    document.getElementById('data').textContent = JSON.stringify(jsonLd)
    document.getElementById('losos').textContent = ''
    var s = document.createElement('script')
    s.type = 'module'
    s.src = 'losos/shell.js'
    document.body.appendChild(s)
  })
</script>
```

In the pane, read `window.__myData` or `rawData` (4th arg).

## Persistence & Live Sync

```js
var store = createStore(data, {
  url: 'https://pod.example/data.jsonld',
  authFetch: window.xlogin.authFetch,
  debounce: 800
})
```

- `store.set()` → debounced PUT to URL
- Server responds with `Updates-Via: wss://...` header → WebSocket auto-connects
- Other clients get `pub` message → `store.reload()` → `onChange` → re-render
- Reconnects with exponential backoff (1s → 30s max)
- If store is dirty (unsaved local changes), remote updates are ignored

## xlogin Integration

```html
<script src="https://unpkg.com/xlogin" data-guest="<64-char-hex-privkey>"></script>
```

After login:
```js
window.xlogin.type       // "nostr", "solid", or "guest"
window.xlogin.id         // pubkey or webId
window.xlogin.authFetch  // authenticated fetch (NIP-98 or DPoP)
```

Events: `document.addEventListener('xlogin', fn)` / `document.addEventListener('xlogout', fn)`

## High-Frequency Updates

Don't call `renderApp()` in a fast timer. Patch DOM directly:

```js
// BAD — re-renders everything 4x/sec
setInterval(function() { renderApp() }, 250)

// GOOD — patches only what changed
setInterval(function() {
  var el = container.querySelector('.progress-fill')
  if (el) el.style.width = percent + '%'
}, 250)
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Parsing `dataEl.textContent` in pane | Use `rawData` (4th arg to render) |
| Calling `renderApp()` after `store.set()` | `onChange` already fired — renders twice |
| `innerHTML` with user input | XSS risk — sanitize first or use template values |
| `</script>` in JSON-LD data | Corrupts DOM — strip or escape |
| Loading shell from remote CDN | Copy `losos/shell.js` locally |
| MutationObserver for tab persistence | Shell handles this built-in |
| Re-rendering in a fast timer | Use `querySelector` + direct DOM writes |
| Importing from `../lib/` | Use `../losos/` — lib is deprecated |
| Bare interpolation in tag: `<input ${expr}>` | Breaks attr parsing — every `${}` in a tag must be `attr="${value}"` |
| `${cond ? 'checked' : ''}` for boolean attrs | Use `checked="${cond}"` — `false` removes the attribute |
| `class="foo ${expr}"` mixed string + interpolation | Use `class="${expr ? 'foo bar' : 'foo'}"` — the whole attribute value must be one `${}` |
| Root `@id` is not `#this` | Shell expects `#this` — use `"@id": "#this"` on the root node |
| Quick Start store has no url — changes lost on reload | Add `url: 'data.jsonld'` to `createStore` options to enable auto-save via PUT |

## Namespace Helper (mashlib-next compat)

```js
import { Namespace } from '../losos/losos.js'
var SCHEMA = Namespace('https://schema.org/')
var title = store.any(subject, SCHEMA('name'))
```

LION store also supports: `store.match()`, `store.any()`, `store.each()`, `store.holds()` — rdflib compatible. mashlib-next panes run on LOSOS with zero code changes.

## Links

- **Docs:** https://losos.org/docs/
- **Examples:** https://losos.org/examples/ (music, CRM, countries, pokedex, reddit, github, json.rocks browser, dashboard, vcard, react compat)
- **CRM:** https://losos.org/crm/
- **json.rocks Browser:** https://losos.org/examples/jsonrocks/
- **Quick Start:** https://losos.org/docs/quickstart.html
- **API Reference:** https://losos.org/docs/api.html
- **Gotchas:** https://losos.org/docs/gotchas.html
- **Architecture:** https://losos.org/docs/architecture.html
- **Nested Panes:** https://losos.org/docs/nested-panes.html
- **JSON Schema:** https://losos.org/docs/json-schema.html
- **Real-time:** https://losos.org/docs/realtime.html
- **npm:** https://www.npmjs.com/package/@linkedobjects/losos
