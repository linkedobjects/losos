export { createStore } from './store.js'
export { html, render, onUnmount, ref, keyed } from './html.js'

/** Namespace helper — compatible with rdflib's Namespace() */
export function Namespace(base) {
  return function(local) { return { termType: 'NamedNode', value: base + local } }
}
