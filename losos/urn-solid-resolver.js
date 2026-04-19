/**
 * urn:solid resolver — canonicalise upstream RDF IRIs to their urn:solid form
 *
 * Lets a LOSOS pane registered against a single urn:solid type (e.g.
 * 'urn:solid:Person') match incoming data whose @type is the equivalent
 * upstream IRI (foaf:Person, schema:Person, etc.). The registry at
 * urn-solid.github.io publishes the reverse-lookup table; this module
 * fetches it once and adds aliases to your existing pane registry — so
 * registry lookup stays a plain object access with no shell changes.
 *
 * Standalone module. Pure opt-in. Not imported by the LOSOS shell.
 *
 * Recommended usage (~3 lines in your app):
 *
 *   import { registry } from './losos/shell.js'
 *   import { expandRegistry } from './losos/urn-solid-resolver.js'
 *   await expandRegistry(registry)
 *
 * After that, a pane registered against 'urn:solid:Person' will also match
 * incoming 'http://xmlns.com/foaf/0.1/Person', 'https://schema.org/Person',
 * etc. — because the registry now has those upstream IRIs as aliases for
 * the same pane URL.
 *
 * Spec: https://urn-solid.github.io/spec/
 * Reverse index: https://urn-solid.github.io/reverse-index.json
 */

const REGISTRY_URL = 'https://urn-solid.github.io/reverse-index.json'

let _index = null
let _loading = null

/**
 * Fetch and cache the upstream-IRI → urn:solid lookup table.
 *
 * On success, the index is cached for the rest of the session.
 * On failure (network error, non-OK HTTP status), nothing is cached
 * and the call returns {} — subsequent calls will retry the fetch.
 * This avoids a transient failure (offline boot, captive portal,
 * server hiccup) silently disabling resolution for the whole session.
 */
export async function loadIndex(url) {
  if (_index) return _index
  if (_loading) return _loading
  _loading = fetch(url || REGISTRY_URL)
    .then(async r => {
      if (!r.ok) throw new Error('[urn-solid] reverse index fetch returned ' + r.status)
      return r.json()
    })
    .then(idx => { _index = idx; _loading = null; return idx })
    .catch(err => {
      console.warn('[urn-solid] failed to load reverse index (will retry on next call):', err)
      _loading = null
      return {}
    })
  return _loading
}

const isUrnSolid = s => typeof s === 'string' && s.startsWith('urn:solid:')
const isAbsolute = s => typeof s === 'string' && /^[a-z][a-z0-9+.-]*:/i.test(s)

/**
 * Map an IRI (or bare name) to its urn:solid form when possible.
 * - urn:solid:* → unchanged
 * - absolute IRI in the index → urn:solid:* equivalent
 * - absolute IRI not in the index → unchanged
 * - bare name → urn:solid:<name> (per LION SHOULD default)
 */
export function resolve(iri, index) {
  if (!iri) return iri
  if (isUrnSolid(iri)) return iri
  if (isAbsolute(iri)) return (index && index[iri]) || iri
  return 'urn:solid:' + iri
}

/**
 * Normalise a JSON-LD-shaped node: @type values and predicate keys are
 * mapped to urn:solid form. Returns a new object; input is untouched.
 *
 * Scope: walks plain children and arrays. JSON-LD container keywords
 * `@graph`, `@included`, `@list`, `@set` are recursed into so nested
 * nodes get the same treatment. Other `@`-keys (`@id`, `@context`,
 * `@language`, `@base`, etc.) are passed through untouched — they're
 * either identifiers/literals or framing constructs that shouldn't be
 * canonicalised as predicates.
 */
const _CONTAINER_KEYS = new Set(['@graph', '@included', '@list', '@set'])
export function normalize(obj, index) {
  if (Array.isArray(obj)) return obj.map(o => normalize(o, index))
  if (obj === null || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '@type') {
      out[k] = Array.isArray(v) ? v.map(t => resolve(t, index)) : resolve(v, index)
    } else if (_CONTAINER_KEYS.has(k)) {
      out[k] = normalize(v, index)
    } else if (k.startsWith('@')) {
      out[k] = v
    } else {
      out[resolve(k, index)] = normalize(v, index)
    }
  }
  return out
}

/**
 * Add upstream-IRI aliases to a pane registry, in place.
 *
 * For every entry `registry[urn:solid:X] = paneUrl` you have, after this
 * call the registry will also contain the matching upstream IRI keys
 * (e.g. `registry['http://xmlns.com/foaf/0.1/Person'] = paneUrl`). Means
 * the shell's existing direct-lookup path matches cross-vocab data with
 * no shell changes.
 *
 *   import { registry } from './losos/shell.js'
 *   import { expandRegistry } from './losos/urn-solid-resolver.js'
 *   registry['urn:solid:Person'] = './panes/person-pane.js'
 *   await expandRegistry(registry)
 *
 * Idempotent. Safe to call multiple times.
 */
export async function expandRegistry(registry) {
  const idx = await loadIndex()
  for (const [iri, urn] of Object.entries(idx)) {
    if (registry[urn] && !registry[iri]) registry[iri] = registry[urn]
  }
  return registry
}

/** Reset the cached index (useful in tests). */
export function _reset() {
  _index = null
  _loading = null
}
