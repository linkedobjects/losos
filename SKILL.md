# Panes — Self-Editing JSON-LD Documents

> A single HTML file that renders linked data using LOSOS panes, lets you edit it, and saves back with Nostr or Solid authentication via xlogin.

## Quick Start

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Task Pane</title>
  <link rel="icon" href="data:,">
  <style>
    * { margin: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; }
    button.pane-tab { color: #1e293b !important; }
    button.pane-tab[aria-selected="true"] { color: #7c3aed !important; }
  </style>
</head>
<body>

<script id="data" type="application/ld+json" src="task-data.jsonld"></script>

<script type="module" data-pane src="panes/task-pane.js"></script>
<script type="module" data-pane src="panes/source-pane.js"></script>
<script src="https://unpkg.com/xlogin"></script>

<div id="losos"></div>
<script type="module" src="https://linkedobjects.github.io/losos/packages/shell/index.js"></script>
</body>
</html>
```

## How It Works

1. **LOSOS shell** scans for `<script data-pane>` tags and loads each pane module
2. **LOSOS shell** fetches `<script type="application/ld+json" src="...">` into a LION store
3. Shell finds the primary subject (`#this` or first typed node), builds a **tab bar**, and renders the first matching pane
4. **xlogin** adds a login button (bottom-right). After login, `window.xlogin.authFetch()` provides authenticated HTTP requests
5. The **Save** action PUTs updated data back to the `.jsonld` file via `xlogin.authFetch`

## Architecture

| Component | Purpose | Source |
|-----------|---------|--------|
| LOSOS shell | Pane loader + tab chrome (~5KB) | `packages/shell/index.js` |
| LION store | Minimal JSON-LD store (~3KB, replaces rdflib) | `packages/lion/index.js` |
| xlogin | Universal login (Nostr + Solid) | `https://unpkg.com/xlogin` |

## Data Format

Data lives in a separate `.jsonld` file, linked via `src` attribute. Uses the W3C Workflow (`wf:`) vocabulary, compatible with SolidOS issue trackers.

**Important:** Never use `@graph`. Keep documents flat with a single root node (`#this`).

```json
{
  "@context": {
    "dc": "http://purl.org/dc/elements/1.1/",
    "dct": "http://purl.org/dc/terms/",
    "wf": "http://www.w3.org/2005/01/wf/flow#",
    "ui": "http://www.w3.org/ns/ui#",
    "foaf": "http://xmlns.com/foaf/0.1/",
    "sioc": "http://rdfs.org/sioc/ns#"
  },
  "@id": "#this",
  "@type": "wf:Tracker",
  "dct:title": "My Tasks",
  "wf:description": "What needs to be done.",
  "dc:created": "2026-03-10T08:00:00Z",
  "wf:initialState": "#Someday",
  "wf:issue": [
    {
      "@id": "#Iss1710252000000",
      "@type": ["wf:Task", "#InProgress", "#OSCore"],
      "dc:title": "Build the thing",
      "dct:created": "2026-03-12T16:00:00Z",
      "wf:description": "Details about what to build."
    }
  ]
}
```

### Tracker Predicates

| Predicate | Value | Purpose |
|-----------|-------|---------|
| `@type` | `wf:Tracker` | Root type |
| `dct:title` | string | Tracker name |
| `wf:description` | string | Long description |
| `dc:created` | ISO datetime | Creation date |
| `wf:initialState` | state `@id` | Default state for new issues |
| `wf:issue` | array of issues | All issues in this tracker |

### Issue Predicates

| Predicate | Value | Purpose |
|-----------|-------|---------|
| `@type` | `["wf:Task", "#State", "#Category"]` | `wf:Task` + state + category (Task is explicit for non-reasoning stores) |
| `dc:title` | string | Issue title |
| `dct:created` | ISO datetime | Creation timestamp |
| `wf:description` | string | Details |
| `wf:attachment` | URI(s) | Links to related resources |
| `wf:message` | message node(s) | Discussion thread |

### States (from SolidOS `wf:Tracker`)

State is encoded as an `@type` entry on the issue, not a property.

| `@type` value | Label | Background color |
|---------------|-------|:----------------:|
| `#Research` | Research | `#ffffff` |
| `#Someday` | Someday pile | `#e3e3e3` |
| `#ToBeDone` | To Be Done | `#e0ffeb` |
| `#NextSession` | To be done this month | `#91fdb9` |
| `#InProgress` | In progress | `#f9ee71` |
| `#Works` | Code runs | `#dcdbff` |
| `#Released` | Released | `#e2a7fb` |

### Categories

Also encoded as `@type` entries alongside the state.

| `@type` value | Label |
|---------------|-------|
| `#OSCore` | Operating system core |
| `#ClientExtended` | Extended client functionality |
| `#DeveloperTools` | Developer tools |
| `#Vertical` | Apps and Verticals |

## Pane API

Panes export a default object with `label`, `icon`, `canHandle`, and `render`:

```js
export default {
  label: 'Task',
  icon: '\u2705',

  canHandle(subject, store) {
    const node = store.get(subject.value)
    const type = store.type(node)
    return type && type.includes('Tracker')
  },

  render(subject, store, container) {
    const node = store.get(subject.value)
    const title = store.prop(node, 'title')

    const el = document.createElement('div')
    el.textContent = title
    container.appendChild(el)
  }
}
```

Key points:
- **No `$rdf`** — use the LION store API instead
- **`render(subject, store, container)`** — three args, not `render(subject, context)`
- **Append to `container`** — don't return an element
- **Tabs are handled by the shell** — panes don't build their own tab bar
- **`canHandle(subject, store)`** — return `true` if this pane can render the given `@type`. Check via `store.type(node)`. Panes that return `false` are excluded from the tab bar

### Adding a Pane

Add a `<script type="module" data-pane src="...">` tag to the HTML. The shell discovers and loads all `data-pane` scripts automatically:

```html
<script type="module" data-pane src="panes/my-pane.js"></script>
```

Each pane is an ES module with a default export. The shell calls `canHandle` to decide whether to show a tab, and `render` when the tab is selected.

### Persisting the Active Tab

The shell always renders the first matching pane on load. To remember the user's last tab across refreshes, observe the shell's tab buttons (`button.pane-tab`) and persist via `localStorage`:

```html
<script>
(function persistTab() {
  var KEY = 'losos-active-tab'
  var root = document.getElementById('losos')
  var restored = false

  new MutationObserver(function() {
    var tabs = root.querySelectorAll('button.pane-tab')
    if (!tabs.length) return

    if (!restored) {
      restored = true
      var saved = localStorage.getItem(KEY)
      if (saved) {
        tabs.forEach(function(t) {
          if (t.textContent.trim() === saved) t.click()
        })
      }
    }

    tabs.forEach(function(t) {
      if (!t._persistBound) {
        t._persistBound = true
        t.addEventListener('click', function() {
          localStorage.setItem(KEY, t.textContent.trim())
        })
      }
    })
  }).observe(root, { childList: true, subtree: true })
})()
</script>
```

Tab text format is `icon + ' ' + label` (e.g. `"✅ Tasks"`). Place this script after the shell `<script>` tag.

### LION Store Methods

| Method | Returns | Use for |
|--------|---------|---------|
| `store.get(id)` | `object \| null` | Get a node by `@id` |
| `store.prop(node, key)` | `any` | Get a property (fuzzy key match) |
| `store.propAll(node, key)` | `array` | Get all values for a property |
| `store.type(node)` | `string \| null` | Get the `@type` of a node |
| `store.find(fn)` | `array` | Find nodes matching a predicate |
| `store.statementsMatching(s, p, o)` | `array` | rdflib compatibility layer |

### Pane Rules

- **All styling via `<style>` or `style.cssText`** — no external stylesheets
- **Use `document.createElement()` only** — no `innerHTML` (security). Exception: updating `innerHTML` of stats elements with `<strong>` tags is acceptable
- **Append to `container`** — the shell manages the pane's lifecycle
- **Full-width layout** — panes should use the full container width, not constrain to a narrow max-width
- **Card-style items** — list items should have generous padding (18px+), rounded corners (12px), and subtle borders
- **Date stamps** — show `schema:dateCreated` formatted as "Mar 13, 2026 · 06:03 AM" under item names
- **Stats line** — show total/active/done counts above the progress bar
- **Text-style filters** — use underlined text tabs (not pill buttons) with green active state
- Panes are ES modules loaded via `<script type="module" data-pane src="...">`

## xlogin Integration

xlogin replaces nip7.js and adds Solid support. Add `data-guest` with a 64-char hex Nostr private key to enable a shared guest account:

```html
<script src="https://unpkg.com/xlogin" data-guest="<64-char-hex-privkey>"></script>
```

| Attribute | Value | Purpose |
|-----------|-------|---------|
| `data-guest` | 64-char hex key | Adds a "Guest" login option using a shared Nostr keypair |
| `data-idp` | Solid provider URL | Sets default Solid identity provider |

After login:

```js
// Unified API
window.xlogin.type       // "nostr" or "solid"
window.xlogin.id         // pubkey (nostr) or webId (solid)
window.xlogin.authFetch  // authenticated fetch (NIP-98 or DPoP)

// Events
document.addEventListener('xlogin', (e) => {
  console.log(e.detail.type, e.detail.id)
})
document.addEventListener('xlogout', () => { /* logged out */ })

// Standard protocol globals still available
window.nostr  // NIP-07 (getPublicKey, signEvent)
window.solid  // Solid session
```

### localStorage (Jumble-compatible)

xlogin persists Nostr sessions using the same keys as Jumble:

| Key | Shape | Description |
|-----|-------|-------------|
| `accounts` | `Account[]` | All known accounts |
| `currentAccount` | `Account \| null` | Active account |

```js
var account = JSON.parse(localStorage.getItem("currentAccount"))
if (account) {
  console.log(account.pubkey)      // hex pubkey
  console.log(account.signerType)  // "nip-07" or "key"
}
```

## Saving Data

With losos, data lives in a separate `.jsonld` file — save the data, not the page. Saving the full HTML via `outerHTML` bakes the rendered DOM into the file, causing losos to double-render on reload.

```js
const dataEl = document.querySelector('script[type="application/ld+json"]')
const data = JSON.parse(dataEl.textContent)
const json = JSON.stringify(data, null, 2)

// PUT just the data back to the .jsonld file
const dataUrl = new URL(dataEl.getAttribute('src'), window.location.href).href
const opts = { method: 'PUT', headers: { 'Content-Type': 'application/ld+json' }, body: json }
if (window.xlogin?.authFetch) {
  await window.xlogin.authFetch(dataUrl, opts)
} else {
  await fetch(dataUrl, opts)
}
```

Key points:
- **Save the `.jsonld` file, not the HTML page** — avoids double-rendering
- Resolve the `src` attribute to get the data URL
- Content-Type is `application/ld+json`
- Use `window.xlogin.authFetch` for authenticated saves

## JSON Schema + Shapes

Losos uses a layered validation approach — JSON Schema for the common case, RDF shapes when you need graph-level constraints.

### JSON Schema (90% case)

Add `"$schema"` to your JSON-LD data to enable form generation and validation:

```json
{
  "@context": { "schema": "https://schema.org/" },
  "@id": "#this",
  "$schema": "todo-schema.json",
  "@type": "schema:ItemList",
  "schema:name": "My Todos"
}
```

The Form pane reads the schema and auto-generates inputs, selects, checkboxes, and array editors. Validates on save using `required`, `enum`, `minLength`, `maxLength`, `minimum`, `maximum`, `pattern`.

If no `$schema` is present, the Form pane auto-generates a form by inferring types from the current data.

### Shapes (10% case)

For graph-level constraints (cross-node references, cardinality, class membership), SHACL/ShEx can validate the expanded RDF form. This is optional and complementary — not a replacement for JSON Schema.

### How they layer

| Layer | Validates | Tooling |
|-------|-----------|---------|
| JSON Schema | Compact JSON structure (fields, types, constraints) | Form pane, ajv, OpenAPI |
| SHACL/ShEx | Expanded RDF graph (links, cardinality, class) | Shapes pane, rdf-validate-shacl |
| `@context` | Bridges both — JSON Schema validates compact form, shapes validate expanded form | |

Don't force developers to pick one. JSON Schema gets them in the door. Shapes are there when they need graph validation.

## File Structure

```
index.html              # Page shell (JSON-LD + scripts)
todo-data.jsonld        # Data (separate file, linked via src)
panes/
  todo-pane.js          # Todo list renderer (loaded via data-pane)
  schema-pane.js        # JSON Schema form builder + validator
  properties-pane.js    # Edit document metadata
  outline-pane.js       # Property/value table (like SolidOS outliner)
  source-pane.js        # Raw JSON-LD viewer with link to data URI
```

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| Using `$rdf.Namespace()` | Use LION store: `store.prop(node, 'name')` |
| Returning an element from `render()` | Append to `container` instead |
| Building tabs inside a pane | Shell handles tabs — just export `label` and `icon` |
| Using `innerHTML` in pane | Use `document.createElement()` + `textContent` |
| Saving via `outerHTML` | PUT just the `.jsonld` data file — saving the full page bakes rendered DOM and causes double-render |
| Inline JSON-LD for large data | Use `<script type="application/ld+json" src="data.jsonld">` |
| Using `nip98Auth()` directly | Use `window.xlogin.authFetch()` instead |
| SVG `<img>` shows broken image | Data-URI SVGs need `xmlns="http://www.w3.org/2000/svg"` |
