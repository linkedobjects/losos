/**
 * urn:solid resolver — canonicalise upstream RDF IRIs to their urn:solid form
 *
 * Lets a LOSOS pane registered against a single urn:solid type (e.g.
 * 'urn:solid:Person') match incoming data whose @type is the equivalent
 * upstream IRI (foaf:Person, schema:Person, etc.). The registry at
 * urn-solid.github.io publishes the reverse-lookup table; this module
 * fetches it once and uses it to normalise types/predicates at read time.
 *
 * Optional. Apps that don't import this module behave exactly as before.
 *
 * Spec: https://urn-solid.github.io/spec/
 * Reverse index: https://urn-solid.github.io/reverse-index.json
 */

const REGISTRY_URL = 'https://urn-solid.github.io/reverse-index.json'

let _index = null
let _loading = null

/** Fetch and cache the upstream-IRI → urn:solid lookup table. */
export async function loadIndex(url) {
  if (_index) return _index
  if (_loading) return _loading
  _loading = fetch(url || REGISTRY_URL)
    .then(r => r.ok ? r.json() : {})
    .then(idx => { _index = idx; _loading = null; return idx })
    .catch(err => {
      console.warn('[urn-solid] failed to load reverse index:', err)
      _index = {}
      _loading = null
      return _index
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
 * Normalise an entire JSON-LD-shaped object: @type values and predicate
 * keys are mapped to urn:solid form. Returns a new object; input untouched.
 */
export function normalize(obj, index) {
  if (Array.isArray(obj)) return obj.map(o => normalize(o, index))
  if (obj === null || typeof obj !== 'object') return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k === '@type') {
      out[k] = Array.isArray(v) ? v.map(t => resolve(t, index)) : resolve(v, index)
    } else if (k.startsWith('@')) {
      out[k] = v
    } else {
      out[resolve(k, index)] = normalize(v, index)
    }
  }
  return out
}

/** Reset the cached index (useful in tests). */
export function _reset() {
  _index = null
  _loading = null
}
