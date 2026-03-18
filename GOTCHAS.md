# LOSOS Gotchas

Things we learned building 14 apps. Read this before you hit the same walls.

## 1. Don't re-render for high-frequency updates

**Problem:** You have a timer, audio progress bar, or animation that updates 4+ times per second. Calling `renderApp()` each time rebuilds the entire DOM — images flicker, network requests spike.

**Fix:** Patch only the elements that change using `querySelector`:

```js
// BAD — re-renders 50 track rows to update one progress bar
setInterval(function() {
  progress = audio.currentTime / audio.duration
  renderApp()  // rebuilds everything
}, 250)

// GOOD — patches 2 elements directly
setInterval(function() {
  var fill = container.querySelector('.progress-fill')
  var time = container.querySelector('.time-elapsed')
  if (fill) fill.style.width = (audio.currentTime / audio.duration * 100) + '%'
  if (time) time.textContent = formatTime(audio.currentTime)
}, 250)
```

Use `renderApp()` for user actions (clicks, form submits). Use direct DOM writes for continuous updates.


## 2. Use the rawData argument

**Problem:** Panes that parse `dataEl.textContent` can hit a race condition where the shell hasn't written the data yet, causing a blank page with no error.

**Fix:** The shell passes parsed JSON-LD as the 4th argument to `render`:

```js
// OLD — race condition
render(subject, store, container) {
  var data
  try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
}

// NEW — reliable
render(subject, store, container, rawData) {
  var data = rawData
  if (!data) {
    try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
  }
}
```


## 3. innerHTML works in templates

You can render HTML strings into elements:

```js
html`<div innerHTML="${markdownHtml}"></div>`
```

This sets the `innerHTML` property (not the attribute). Useful for rendered markdown, rich text from APIs, etc.

**Security warning:** This is an XSS risk. Never use with user-generated content unless you sanitize it first. LOSOS templates are safe by default — values go through `textContent` and `setAttribute`, which don't parse HTML. The `innerHTML` attribute is the one exception. If in doubt, don't use it.

```js
// SAFE — all template values are text-only, no HTML parsing
html`<div>${userInput}</div>`

// DANGEROUS — userInput is parsed as HTML, can execute scripts
html`<div innerHTML="${userInput}"></div>`

// SAFE — sanitize first
var clean = userInput.replace(/<[^>]*>/g, '')
html`<div innerHTML="${clean}"></div>`
```


## 4. No `</script>` in JSON-LD data

**Problem:** If your JSON-LD contains the literal string `</script>` (e.g., a README with code examples), and the shell writes it to a `<script>` element's textContent, the browser's HTML parser sees it as a closing tag and corrupts the DOM.

**Fix:** Don't store raw HTML containing script tags in JSON-LD data. Strip or escape it:

```js
var safe = content.replace(/<\/script>/gi, '<\\/script>')
```


## 5. store.set() triggers onChange synchronously

When you call `store.set()`, it immediately calls all `onChange` listeners (which typically call `renderApp()`). Don't call `renderApp()` after `store.set()` — it already ran:

```js
// BAD — renders twice
store.set(node, 'title', 'New')
renderApp()

// GOOD — renders once (onChange fires automatically)
store.set(node, 'title', 'New')
```

Exception: multiple `store.set()` calls in sequence each trigger a render. If you're setting 5 properties at once, call `renderApp()` manually after the last one, or batch them before the listener is attached.


## 6. The shell uses local imports

Use the shell as a local file, not from a CDN:

```html
<!-- Local — fast, no external dependency -->
<script type="module" src="losos/shell.js"></script>

<!-- With boot options -->
<script type="module">
import { boot } from './losos/shell.js'
boot('#app', { maxWidth: '100%', accentColor: '#e63946' })
</script>
```

The shell provides built-in tab persistence (namespaced by pathname). No MutationObserver needed.


## 7. Pane file structure

```
my-app/
  losos/           ← framework (copy these files)
    html.js
    store.js
    shell.js
  lion/            ← JSON-LD store (used by shell)
    index.js
  panes/           ← your app code
    my-pane.js
    source-pane.js
  data.jsonld      ← your data
  index.html       ← shell + pane script tags
```

Panes import from `../losos/html.js` and `../losos/store.js` (one level up from `panes/`).


## 8. API apps: bootstrap before shell

For apps that fetch data from an API, load the shell after the data is ready:

```html
<script id="data" type="application/ld+json"></script>
<script type="module" data-pane src="panes/my-pane.js"></script>
<div id="losos"></div>

<script>
fetch('https://api.example.com/data')
  .then(r => r.json())
  .then(data => {
    var jsonLd = transformToJsonLd(data)
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

Then in your pane, read from the global:
```js
var data = window.__myData || rawData
```
