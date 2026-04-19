import { test } from 'node:test'
import assert from 'node:assert'
import { createStore } from './losos/store.js'
import { Store } from './lion/index.js'
import { Namespace } from './losos/losos.js'

// ========== store.js ==========

test('createStore without options', () => {
  var store = createStore({ '@id': '#this', '@type': 'Test', 'title': 'Hello' })
  assert.ok(store)
  assert.equal(store.get('#this')['title'], 'Hello')
})

test('createStore with empty options', () => {
  var store = createStore({ '@id': '#this' }, {})
  assert.ok(store)
})

test('store.set triggers onChange', () => {
  var data = { '@id': '#this', 'name': 'old' }
  var store = createStore(data)
  var called = false
  store.onChange(function() { called = true })
  store.set(store.get('#this'), 'name', 'new')
  assert.equal(called, true)
  assert.equal(store.get('#this')['name'], 'new')
})

test('store.set does not trigger if value unchanged', () => {
  var data = { '@id': '#this', 'name': 'same' }
  var store = createStore(data)
  var count = 0
  store.onChange(function() { count++ })
  store.set(store.get('#this'), 'name', 'same')
  assert.equal(count, 0)
})

test('store.push appends to array', () => {
  var data = { '@id': '#this', 'items': [{ '@id': '#a' }] }
  var store = createStore(data)
  store.push(store.get('#this'), 'items', { '@id': '#b' })
  assert.equal(store.propAll(store.get('#this'), 'items').length, 2)
})

test('store.remove filters array', () => {
  var data = { '@id': '#this', 'items': [{ '@id': '#a' }, { '@id': '#b' }] }
  var store = createStore(data)
  store.remove(store.get('#this'), 'items', function(i) { return i['@id'] === '#a' })
  assert.equal(store.propAll(store.get('#this'), 'items').length, 1)
  assert.equal(store.propAll(store.get('#this'), 'items')[0]['@id'], '#b')
})

test('store.propAll returns array for single value', () => {
  var data = { '@id': '#this', 'name': 'solo' }
  var store = createStore(data)
  var result = store.propAll(store.get('#this'), 'name')
  assert.ok(Array.isArray(result))
  assert.equal(result[0], 'solo')
})

test('store.propAll returns empty array for missing key', () => {
  var store = createStore({ '@id': '#this' })
  assert.deepEqual(store.propAll(store.get('#this'), 'nope'), [])
})

test('store.type returns @type', () => {
  var store = createStore({ '@id': '#this', '@type': 'Tracker' })
  assert.equal(store.type(store.get('#this')), 'Tracker')
})

test('store.unset removes property', () => {
  var data = { '@id': '#this', 'temp': 'gone' }
  var store = createStore(data)
  store.unset(store.get('#this'), 'temp')
  assert.equal(store.prop(store.get('#this'), 'temp'), null)
})

test('store.reorder moves items', () => {
  var data = { '@id': '#this', 'items': [{ '@id': '#a' }, { '@id': '#b' }, { '@id': '#c' }] }
  var store = createStore(data)
  store.reorder(store.get('#this'), 'items', 0, 2)
  var items = store.propAll(store.get('#this'), 'items')
  assert.equal(items[0]['@id'], '#b')
  assert.equal(items[2]['@id'], '#a')
})

// ========== lion/index.js ==========

test('LION get by @id', () => {
  var s = new Store()
  s.load({ '@id': '#this', '@type': 'Test', 'name': 'hello' })
  assert.ok(s.get('#this'))
  assert.equal(s.get('#this')['@id'], '#this')
})

test('LION get with fragment fallback', () => {
  var s = new Store()
  s.load({ '@id': '#this', 'name': 'hello' })
  var node = s.get('https://example.com/data.jsonld#this')
  assert.ok(node)
  assert.equal(node['@id'], '#this')
})

test('LION get returns null for missing', () => {
  var s = new Store()
  s.load({ '@id': '#this' })
  assert.equal(s.get('#nope'), null)
  assert.equal(s.get(null), null)
})

test('LION type expansion with prefixed types', () => {
  var s = new Store()
  s.load({ '@context': { 'schema': 'https://schema.org/' }, '@id': '#this', '@type': 'schema:Person' })
  var node = s.get('#this')
  assert.equal(node['@type'], 'https://schema.org/Person')
})

test('LION type no expansion for unprefixed', () => {
  var s = new Store()
  s.load({ '@context': { 'Person': 'schema:Person' }, '@id': '#this', '@type': 'Person' })
  var node = s.get('#this')
  assert.equal(node['@type'], 'Person')
})

test('LION statementsMatching returns triples', () => {
  var s = new Store()
  s.load({ '@id': '#this', '@type': 'Test', 'name': 'Ada' })
  var stmts = s.statementsMatching({ value: '#this' })
  assert.ok(stmts.length >= 2)
  assert.ok(stmts.some(function(st) { return st.object.value === 'Ada' }))
})

test('LION statementsMatching filters by predicate', () => {
  var s = new Store()
  s.load({ '@context': { 'schema': 'https://schema.org/' }, '@id': '#this', 'schema:name': 'Ada', 'schema:age': '36' })
  var stmts = s.statementsMatching({ value: '#this' }, { value: 'https://schema.org/name' })
  assert.equal(stmts.length, 1)
  assert.equal(stmts[0].object.value, 'Ada')
})

test('LION any returns first match', () => {
  var s = new Store()
  s.load({ '@id': '#this', 'name': 'Ada' })
  var result = s.any({ value: '#this' }, { value: 'name' })
  assert.ok(result)
  assert.equal(result.value, 'Ada')
})

test('LION each returns all matches', () => {
  var s = new Store()
  s.load({ '@id': '#this', 'tag': ['a', 'b', 'c'] })
  var results = s.each({ value: '#this' }, { value: 'tag' })
  assert.equal(results.length, 3)
})

test('LION match is alias for statementsMatching', () => {
  var s = new Store()
  s.load({ '@id': '#this', 'name': 'test' })
  var a = s.statementsMatching({ value: '#this' })
  var b = s.match({ value: '#this' })
  assert.equal(a.length, b.length)
})

test('LION indexes nested objects', () => {
  var s = new Store()
  s.load({ '@id': '#this', 'child': { '@id': '#child', 'name': 'nested' } })
  var child = s.get('#child')
  assert.ok(child)
})

// ========== Namespace ==========

test('Namespace creates NamedNode', () => {
  var SCHEMA = Namespace('https://schema.org/')
  var node = SCHEMA('name')
  assert.equal(node.value, 'https://schema.org/name')
  assert.equal(node.termType, 'NamedNode')
})

// ========== urn-solid-resolver.js ==========

import { resolve, normalize, loadIndex, expandRegistry, _reset as _resetUrnSolid } from './losos/urn-solid-resolver.js'

const FIXTURE_INDEX = {
  'http://xmlns.com/foaf/0.1/Person': 'urn:solid:Person',
  'https://schema.org/Person': 'urn:solid:Person',
  'http://xmlns.com/foaf/0.1/name': 'urn:solid:name'
}

test('resolve: urn:solid:* passes through unchanged', () => {
  assert.equal(resolve('urn:solid:Person', FIXTURE_INDEX), 'urn:solid:Person')
})

test('resolve: absolute IRI in index → urn:solid form', () => {
  assert.equal(resolve('http://xmlns.com/foaf/0.1/Person', FIXTURE_INDEX), 'urn:solid:Person')
  assert.equal(resolve('https://schema.org/Person', FIXTURE_INDEX), 'urn:solid:Person')
})

test('resolve: absolute IRI not in index → unchanged', () => {
  assert.equal(resolve('http://example.org/Unknown', FIXTURE_INDEX), 'http://example.org/Unknown')
})

test('resolve: bare name → urn:solid:<name> (LION SHOULD default)', () => {
  assert.equal(resolve('Person', FIXTURE_INDEX), 'urn:solid:Person')
  assert.equal(resolve('name', FIXTURE_INDEX), 'urn:solid:name')
})

test('resolve: empty/null pass through', () => {
  assert.equal(resolve('', FIXTURE_INDEX), '')
  assert.equal(resolve(null, FIXTURE_INDEX), null)
  assert.equal(resolve(undefined, FIXTURE_INDEX), undefined)
})

test('normalize: rewrites @type and predicate keys', () => {
  var input = { '@id': 'x', '@type': 'http://xmlns.com/foaf/0.1/Person', 'http://xmlns.com/foaf/0.1/name': 'Alice' }
  var out = normalize(input, FIXTURE_INDEX)
  assert.equal(out['@id'], 'x')
  assert.equal(out['@type'], 'urn:solid:Person')
  assert.equal(out['urn:solid:name'], 'Alice')
  assert.equal(input['@type'], 'http://xmlns.com/foaf/0.1/Person')   // input untouched
})

test('normalize: handles @type arrays', () => {
  var out = normalize({ '@type': ['http://xmlns.com/foaf/0.1/Person', 'https://schema.org/Person'] }, FIXTURE_INDEX)
  assert.deepEqual(out['@type'], ['urn:solid:Person', 'urn:solid:Person'])
})

test('normalize: recurses into @graph', () => {
  var input = { '@graph': [{ '@type': 'http://xmlns.com/foaf/0.1/Person', '@id': 'a' }] }
  var out = normalize(input, FIXTURE_INDEX)
  assert.equal(out['@graph'][0]['@type'], 'urn:solid:Person')
})

test('normalize: recurses into @included and @list', () => {
  var out1 = normalize({ '@included': [{ '@type': 'http://xmlns.com/foaf/0.1/Person' }] }, FIXTURE_INDEX)
  assert.equal(out1['@included'][0]['@type'], 'urn:solid:Person')
  var out2 = normalize({ '@list': [{ '@type': 'http://xmlns.com/foaf/0.1/Person' }] }, FIXTURE_INDEX)
  assert.equal(out2['@list'][0]['@type'], 'urn:solid:Person')
})

test('normalize: passes through @id and @context', () => {
  var out = normalize({ '@id': 'x', '@context': { 'foaf': 'http://xmlns.com/foaf/0.1/' } }, FIXTURE_INDEX)
  assert.equal(out['@id'], 'x')
  assert.deepEqual(out['@context'], { 'foaf': 'http://xmlns.com/foaf/0.1/' })
})

test('loadIndex: caches result on success', async () => {
  _resetUrnSolid()
  var calls = 0
  globalThis.fetch = async () => { calls++; return { ok: true, json: async () => FIXTURE_INDEX } }
  var idx1 = await loadIndex()
  var idx2 = await loadIndex()
  assert.equal(calls, 1)
  assert.deepEqual(idx1, FIXTURE_INDEX)
  assert.equal(idx1, idx2)        // same reference
})

test('loadIndex: does NOT cache on non-OK HTTP — retries on next call', async () => {
  _resetUrnSolid()
  var calls = 0
  globalThis.fetch = async () => { calls++; return { ok: false, status: 503, json: async () => ({}) } }
  var idx1 = await loadIndex()
  assert.deepEqual(idx1, {})
  var idx2 = await loadIndex()
  assert.equal(calls, 2)          // retried — failure not cached
})

test('loadIndex: does NOT cache on network error — retries on next call', async () => {
  _resetUrnSolid()
  var calls = 0
  globalThis.fetch = async () => { calls++; throw new Error('offline') }
  await loadIndex()
  await loadIndex()
  assert.equal(calls, 2)
})

test('expandRegistry: aliases upstream IRIs to existing urn:solid pane URLs', async () => {
  _resetUrnSolid()
  globalThis.fetch = async () => ({ ok: true, json: async () => FIXTURE_INDEX })
  var reg = { 'urn:solid:Person': './panes/person.js' }
  await expandRegistry(reg)
  assert.equal(reg['http://xmlns.com/foaf/0.1/Person'], './panes/person.js')
  assert.equal(reg['https://schema.org/Person'], './panes/person.js')
})

test('expandRegistry: skips aliases when no urn:solid pane is registered', async () => {
  _resetUrnSolid()
  globalThis.fetch = async () => ({ ok: true, json: async () => FIXTURE_INDEX })
  var reg = {}
  await expandRegistry(reg)
  assert.equal(reg['http://xmlns.com/foaf/0.1/Person'], undefined)
})

test('expandRegistry: does not overwrite existing upstream-IRI registrations', async () => {
  _resetUrnSolid()
  globalThis.fetch = async () => ({ ok: true, json: async () => FIXTURE_INDEX })
  var reg = {
    'urn:solid:Person': './panes/urn-person.js',
    'http://xmlns.com/foaf/0.1/Person': './panes/foaf-person.js'    // pre-existing, should win
  }
  await expandRegistry(reg)
  assert.equal(reg['http://xmlns.com/foaf/0.1/Person'], './panes/foaf-person.js')
})
