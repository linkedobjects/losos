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
