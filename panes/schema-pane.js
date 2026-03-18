/**
 * Schema Pane — auto-generate edit forms from JSON Schema
 * Appears as a tab when data has "$schema" property.
 * AGPL-3.0 — part of LOSOS
 */
import { createStore } from '../losos/store.js'
import { html, render, onUnmount, keyed } from '../losos/html.js'

export default {
  label: 'Edit',
  icon: '\u270F\uFE0F',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    if (!node) return false
    // Check for $schema in the raw node or any common location
    return !!(node['$schema'] || node['http://json-schema.org/schema#'])
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var src = dataEl ? dataEl.getAttribute('src') : null
    var dataUrl = src ? new URL(src, window.location.href).href : ''
    var store = createStore(data, {
      url: dataUrl,
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')

    var schema = null
    var errors = {}
    var loading = true

    // ========== FETCH SCHEMA ==========
    var schemaUrl = data['$schema']
    if (!schemaUrl) { loading = false; renderForm(); return }

    // Resolve relative to data file URL, not page URL
    if (dataUrl && schemaUrl.indexOf('://') === -1) {
      schemaUrl = new URL(schemaUrl, dataUrl).href
    }

    // Resolve $ref pointers (simple $defs only)
    function resolveRefs(obj) {
      var defs = obj['$defs'] || obj['definitions'] || {}
      function walk(node) {
        if (!node || typeof node !== 'object') return node
        if (Array.isArray(node)) return node.map(walk)
        if (node['$ref']) {
          var ref = node['$ref']
          var match = ref.match(/^#\/\$defs\/(.+)$/) || ref.match(/^#\/definitions\/(.+)$/)
          if (match && defs[match[1]]) return walk(JSON.parse(JSON.stringify(defs[match[1]])))
        }
        var result = {}
        for (var k in node) { result[k] = walk(node[k]) }
        return result
      }
      return walk(obj)
    }

    // Resolve relative URL
    try { schemaUrl = new URL(schemaUrl, window.location.href).href } catch (e) {}

    fetch(schemaUrl)
      .then(function(r) { return r.json() })
      .then(function(s) { schema = resolveRefs(s); loading = false; renderForm() })
      .catch(function(err) {
        console.warn('[schema-pane] Failed to load schema:', err)
        loading = false
        renderForm()
      })

    // ========== VALIDATION ==========
    function validate(key, value, prop) {
      if (!prop) return null
      if (prop.type === 'string') {
        if (prop.minLength && (!value || value.length < prop.minLength)) return 'Minimum ' + prop.minLength + ' characters'
        if (prop.maxLength && value && value.length > prop.maxLength) return 'Maximum ' + prop.maxLength + ' characters'
        if (prop.pattern && value && !new RegExp(prop.pattern).test(value)) return 'Invalid format'
      }
      if (prop.type === 'number' || prop.type === 'integer') {
        var n = Number(value)
        if (isNaN(n)) return 'Must be a number'
        if (prop.minimum !== undefined && n < prop.minimum) return 'Minimum ' + prop.minimum
        if (prop.maximum !== undefined && n > prop.maximum) return 'Maximum ' + prop.maximum
      }
      return null
    }

    function validateRequired() {
      if (!schema || !schema.required) return true
      var valid = true
      schema.required.forEach(function(key) {
        var val = root[key] || store.prop(root, key)
        if (val === undefined || val === null || val === '') {
          errors[key] = 'Required'
          valid = false
        }
      })
      return valid
    }

    // ========== FIELD RENDERERS ==========
    function renderField(key, prop, value) {
      var label = prop.title || key
      var desc = prop.description || ''
      var required = schema.required && schema.required.indexOf(key) !== -1
      var error = errors[key]

      // Skip @-prefixed and $-prefixed keys
      if (key.startsWith('@') || key.startsWith('$')) return null

      var input = null

      if (prop.enum) {
        input = html`
          <select class="sf-input" onchange="${function(e) { setField(key, e.target.value, prop) }}">
            <option value="">— select —</option>
            ${prop.enum.map(function(opt) {
              return html`<option value="${opt}" selected="${value === opt}">${opt}</option>`
            })}
          </select>
        `
      } else if (prop.type === 'boolean') {
        input = html`
          <label class="sf-checkbox">
            <input type="checkbox" checked="${value === true || value === 'true'}"
                   onchange="${function(e) { setField(key, e.target.checked, prop) }}" />
            ${label}
          </label>
        `
      } else if (prop.type === 'number' || prop.type === 'integer') {
        input = html`
          <input class="sf-input" type="number"
                 value="${value !== undefined && value !== null ? String(value) : ''}"
                 placeholder="${desc}"
                 step="${prop.type === 'integer' ? '1' : 'any'}"
                 min="${prop.minimum !== undefined ? String(prop.minimum) : ''}"
                 max="${prop.maximum !== undefined ? String(prop.maximum) : ''}"
                 onchange="${function(e) { setField(key, prop.type === 'integer' ? parseInt(e.target.value) : parseFloat(e.target.value), prop) }}" />
        `
      } else if (prop.type === 'string' && prop.maxLength && prop.maxLength > 200) {
        input = html`
          <textarea class="sf-input sf-textarea" placeholder="${desc}"
                    maxlength="${prop.maxLength || ''}"
                    oninput="${function(e) { setField(key, e.target.value, prop) }}">${value || ''}</textarea>
        `
      } else {
        // Default: text input
        input = html`
          <input class="sf-input" type="text"
                 value="${value !== undefined && value !== null ? String(value) : ''}"
                 placeholder="${desc}"
                 maxlength="${prop.maxLength || ''}"
                 oninput="${function(e) { setField(key, e.target.value, prop) }}" />
        `
      }

      if (prop.type === 'boolean') {
        return html`
          <div class="sf-field">
            ${input}
            ${error ? html`<div class="sf-error">${error}</div>` : null}
          </div>
        `
      }

      return html`
        <div class="sf-field">
          <label class="sf-label">${label}${required ? html`<span class="sf-required"> *</span>` : null}</label>
          ${desc && prop.type !== 'boolean' ? html`<div class="sf-desc">${desc}</div>` : null}
          ${input}
          ${error ? html`<div class="sf-error">${error}</div>` : null}
        </div>
      `
    }

    function renderArrayField(key, prop) {
      if (!prop.items || prop.items.type !== 'object' || !prop.items.properties) return null

      var items = store.propAll(root, key)
      var itemProps = prop.items.properties
      var label = prop.title || key

      return html`
        <div class="sf-field">
          <label class="sf-label">${label}</label>
          ${prop.description ? html`<div class="sf-desc">${prop.description}</div>` : null}
          <div class="sf-array">
            ${keyed(items, function(item) { return item['@id'] || JSON.stringify(item) }, function(item) {
              return html`
                <div class="sf-array-item">
                  ${Object.keys(itemProps).map(function(k) {
                    if (k.startsWith('@')) return null
                    var p = itemProps[k]
                    var v = item[k] !== undefined ? item[k] : store.prop(item, k)
                    var lbl = p.title || k
                    return html`
                      <div class="sf-inline-field">
                        <label class="sf-label-sm">${lbl}</label>
                        <input class="sf-input sf-input-sm" type="text" value="${v || ''}"
                               oninput="${function(e) { store.set(item, k, e.target.value) }}" />
                      </div>
                    `
                  })}
                  <button class="sf-remove" onclick="${function() { store.remove(root, key, function(i) { return i === item }) }}">\u2715</button>
                </div>
              `
            })}
            <button class="sf-add" onclick="${function() {
              var newItem = { '@id': '#' + Date.now(), '@type': prop.items.properties['@type'] ? prop.items.properties['@type'].const || 'Item' : 'Item' }
              Object.keys(itemProps).forEach(function(k) { if (!k.startsWith('@') && itemProps[k].default !== undefined) newItem[k] = itemProps[k].default })
              store.push(root, key, newItem)
            }}">+ Add ${label.replace(/s$/, '')}</button>
          </div>
        </div>
      `
    }

    // ========== ACTIONS ==========
    function setField(key, value, prop) {
      var err = validate(key, value, prop)
      if (err) { errors[key] = err } else { delete errors[key] }
      store.set(root, key, value)
    }

    // ========== RENDER ==========
    function renderForm() {
      if (loading) {
        render(container, html`<div class="sf-loading">Loading schema...</div>`)
        return
      }

      if (!schema) {
        render(container, html`<div class="sf-loading">No schema found at ${schemaUrl}</div>`)
        return
      }

      var properties = schema.properties || {}
      var title = schema.title || data['title'] || 'Edit'
      var desc = schema.description || ''

      render(container, html`
        <style>
          .sf-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 24px 80px; }
          .sf-title { font-family: Georgia, serif; font-size: 28px; font-weight: 400; font-style: italic; color: #1a1a1a; margin-bottom: 4px; }
          .sf-subtitle { font-size: 14px; color: #999; margin-bottom: 32px; }
          .sf-field { margin-bottom: 20px; }
          .sf-label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
          .sf-label-sm { font-size: 11px; font-weight: 600; color: #888; margin-bottom: 2px; }
          .sf-required { color: #e63946; }
          .sf-desc { font-size: 12px; color: #999; margin-bottom: 6px; }
          .sf-input { width: 100%; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px; font: 400 14px/1.4 inherit; color: #1a1a1a; outline: none; transition: border-color 0.15s; background: #fff; }
          .sf-input:focus { border-color: #6366f1; }
          .sf-input-sm { padding: 6px 10px; font-size: 13px; }
          .sf-textarea { min-height: 80px; resize: vertical; }
          .sf-checkbox { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #1a1a1a; cursor: pointer; }
          .sf-checkbox input { width: 18px; height: 18px; cursor: pointer; }
          .sf-error { font-size: 12px; color: #e63946; margin-top: 4px; }
          .sf-array { border: 1px solid #f0ede8; border-radius: 8px; padding: 12px; }
          .sf-array-item { display: flex; gap: 8px; align-items: flex-end; padding: 8px 0; border-bottom: 1px solid #f0ede8; flex-wrap: wrap; }
          .sf-array-item:last-of-type { border-bottom: none; }
          .sf-inline-field { flex: 1; min-width: 120px; }
          .sf-remove { background: none; border: none; color: #ccc; cursor: pointer; font-size: 14px; padding: 6px; border-radius: 4px; align-self: flex-end; }
          .sf-remove:hover { color: #e63946; background: #fef2f2; }
          .sf-add { background: none; border: 1px dashed #ddd; border-radius: 6px; padding: 8px 16px; font: 500 13px/1 inherit; color: #888; cursor: pointer; margin-top: 8px; width: 100%; transition: all 0.15s; }
          .sf-add:hover { border-color: #6366f1; color: #6366f1; }
          .sf-divider { border: none; border-top: 1px solid #f0ede8; margin: 24px 0; }
          .sf-loading { padding: 40px; text-align: center; color: #999; font-size: 14px; }
          .sf-schema-link { font-size: 11px; color: #ccc; text-decoration: none; }
          .sf-schema-link:hover { color: #6366f1; }
        </style>

        <div class="sf-wrap">
          <h1 class="sf-title">${title}</h1>
          ${desc ? html`<p class="sf-subtitle">${desc}</p>` : html`<p class="sf-subtitle">Auto-generated from <a class="sf-schema-link" href="${schemaUrl}" target="_blank">${schemaUrl}</a></p>`}

          ${Object.keys(properties).map(function(key) {
            var prop = properties[key]
            if (key.startsWith('@') || key.startsWith('$')) return null

            if (prop.type === 'array' && prop.items && prop.items.type === 'object') {
              return renderArrayField(key, prop)
            }

            var value = root[key] !== undefined ? root[key] : store.prop(root, key)
            return renderField(key, prop, value)
          })}
        </div>
      `)
    }

    // ========== INIT ==========
    var unsub = store.onChange(renderForm)
    onUnmount(container, unsub)
  }
}
