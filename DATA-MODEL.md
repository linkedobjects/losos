# Tracker & Issue Data Model

> Based on the [W3C Workflow ontology](http://www.w3.org/2005/01/wf/flow#) (`wf:`), designed by Tim Berners-Lee for SolidOS issue tracking. Adapted for JSON-LD with LOSOS panes and the LION store.

## Ontology

The `wf:` vocabulary models issue tracking as a finite state machine over RDF types.

```
wf:Task  ──  owl:disjointUnionOf  ──▶  ( wf:Open , wf:Closed )
                                              │
                                    rdfs:subClassOf
                                              │
                                  ┌───────────┼───────────┐
                                  ▼           ▼           ▼
                             #Someday    #InProgress   #Released  ...
```

Key insight: **state is encoded as `rdf:type`**, not as a property. An issue doesn't have `status: "in_progress"` — it *is* an `#InProgress`. Changing state means changing the node's type.

## Namespaces

| Prefix | URI | Use |
|--------|-----|-----|
| `wf:` | `http://www.w3.org/2005/01/wf/flow#` | Tracker, Task, states |
| `dc:` | `http://purl.org/dc/elements/1.1/` | `title`, `created` |
| `dct:` | `http://purl.org/dc/terms/` | `title`, `created` |
| `ui:` | `http://www.w3.org/ns/ui#` | `backgroundColor` |
| `foaf:` | `http://xmlns.com/foaf/0.1/` | `maker` (message author) |
| `sioc:` | `http://rdfs.org/sioc/ns#` | `content` (message body) |

## Tracker

The root node. Defines what states and categories are valid and where issues live.

```json
{
  "@id": "#this",
  "@type": "wf:Tracker",
  "dct:title": "Mission Control",
  "wf:description": "A description of this tracker.",
  "dc:created": "2026-03-10T08:00:00Z",
  "wf:initialState": "#Someday",
  "wf:issue": [ ... ]
}
```

| Predicate | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `@type` | `"wf:Tracker"` | yes | |
| `dct:title` | string | yes | Tracker name |
| `wf:description` | string | no | Long description |
| `dc:created` | ISO 8601 datetime | no | Creation date |
| `wf:initialState` | state `@id` | yes | Default state for new issues |
| `wf:issue` | array of issues | yes | All issues in this tracker |

### SolidOS differences

In the original SolidOS model, the tracker does not contain issues. Instead:

- Issues live in a separate file (`state.ttl`), pointed to by `wf:stateStore`
- Issues point back to the tracker via `wf:tracker`
- State and category classes are defined as OWL `disjointUnionOf` in `index.ttl`

We collapse this into a single JSON-LD file with issues nested under `wf:issue`. The `wf:issue` property is not in the original vocabulary — it is the `owl:inverseOf` `wf:tracker` (which the ontology defines but doesn't name).

## Issue

A unit of work. Typed with `wf:Task` plus a state and optionally a category.

```json
{
  "@id": "#Iss1710252000000",
  "@type": ["wf:Task", "#InProgress", "#OSCore"],
  "dc:title": "Build the thing",
  "dct:created": "2026-03-12T16:00:00Z",
  "wf:description": "Details about what to build.",
  "wf:assignee": { "@id": "https://alice.example/profile#me" },
  "wf:attachment": { "@id": "https://github.com/org/repo/issues/42" },
  "wf:message": [
    {
      "@id": "#Msg1710252100000",
      "dct:created": "2026-03-12T16:01:40Z",
      "sioc:content": "Started working on this.",
      "foaf:maker": { "@id": "https://alice.example/profile#me" }
    }
  ]
}
```

| Predicate | Type | Required | Description |
|-----------|------|:--------:|-------------|
| `@type` | array | yes | `["wf:Task", "#State"]` minimum, optionally `"#Category"` |
| `dc:title` | string | yes | Issue title |
| `dct:created` | ISO 8601 datetime | yes | Creation timestamp |
| `wf:description` | string | no | Detailed description |
| `wf:assignee` | person `@id` | no | Who is responsible |
| `wf:attachment` | URI or array | no | Related links, screenshots, files |
| `wf:message` | array of messages | no | Discussion thread |
| `wf:dependent` | issue `@id` or array | no | Issues this depends on |

### Issue ID convention

`#Iss` + timestamp in milliseconds: `#Iss1710252000000`

This ensures uniqueness and provides a creation-order sort key without parsing dates.

## Type System

Each issue carries up to three types in its `@type` array:

```
["wf:Task", "#State", "#Category"]
   ▲            ▲          ▲
   │            │          └── optional: what kind of work
   │            └───────────── required: current workflow state
   └────────────────────────── base type (explicit for non-reasoning stores)
```

### Why `wf:Task` is explicit

In RDF, `wf:Task` is implied through the subclass chain:

```
#InProgress  rdfs:subClassOf  wf:Open  rdfs:subClassOf  wf:Task
```

But the LION store doesn't do RDFS inference. Adding `wf:Task` explicitly means any pane can find all tasks with:

```js
store.find(n => store.type(n)?.includes('Task'))
```

### States

States are `rdfs:subClassOf wf:Open`. All are "open" — the SolidOS tracker has no closed states.

| `@type` value | Label | `ui:backgroundColor` | Shipped? |
|---------------|-------|:---------------------:|:--------:|
| `#Research` | Research | `#ffffff` | no |
| `#Someday` | Someday pile | `#e3e3e3` | no |
| `#ToBeDone` | To Be Done | `#e0ffeb` | no |
| `#NextSession` | This month | `#91fdb9` | no |
| `#InProgress` | In progress | `#f9ee71` | no |
| `#Works` | Code runs | `#dcdbff` | yes |
| `#Released` | Released | `#e2a7fb` | yes |

**Cycle order** (click to advance): `#ToBeDone` → `#InProgress` → `#Works` → `#Released`

Changing state means replacing the state entry in `@type` while preserving `wf:Task` and the category.

### Categories

Optional classification. Also encoded as `@type`.

| `@type` value | Label |
|---------------|-------|
| `#OSCore` | Operating system core |
| `#ClientExtended` | Extended client functionality |
| `#DeveloperTools` | Developer tools |
| `#Vertical` | Apps and Verticals |

Categories are defined per-tracker. The SolidOS tracker uses `wf:issueCategory` to point to a class whose subclasses are the valid categories.

## Messages

Discussion thread entries attached to an issue via `wf:message`.

```json
{
  "@id": "#Msg1710252100000",
  "dct:created": "2026-03-12T16:01:40Z",
  "sioc:content": "The message body text.",
  "foaf:maker": { "@id": "https://alice.example/profile#me" }
}
```

| Predicate | Type | Description |
|-----------|------|-------------|
| `dct:created` | ISO 8601 datetime | When posted |
| `sioc:content` | string | Message body |
| `foaf:maker` | person `@id` | Author |

No nesting, no reactions, no threading. Flat list per issue.

## Saving

PUT the entire JSON-LD document back to the `.jsonld` file:

```js
const doFetch = (window.xlogin && window.xlogin.authFetch) || fetch
await doFetch(dataUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/ld+json' },
  body: JSON.stringify(data, null, 2)
})
```

Mutations happen in-memory on the parsed JSON. The entire document is saved on every change — there is no PATCH or partial update.

## Minimal Valid Document

The smallest complete tracker:

```json
{
  "@context": {
    "dc": "http://purl.org/dc/elements/1.1/",
    "dct": "http://purl.org/dc/terms/",
    "wf": "http://www.w3.org/2005/01/wf/flow#"
  },
  "@id": "#this",
  "@type": "wf:Tracker",
  "dct:title": "My Tasks",
  "wf:initialState": "#ToBeDone",
  "wf:issue": []
}
```

## LION Store Access Patterns

```js
// Get the tracker
const tracker = store.get('#this')

// Read title (fuzzy match against expanded URI)
store.prop(tracker, 'title')     // matches dct:title

// Get all issues
store.propAll(tracker, 'issue')  // matches wf:issue

// Find all tasks across the store
store.find(n => store.type(n)?.includes('Task'))

// Check state of an issue
const type = store.type(issue)   // "wf:Task #InProgress #OSCore"
type.includes('InProgress')      // true
```

Note: LION expands CURIEs using `@context`, so `dc:title` becomes `http://purl.org/dc/elements/1.1/title` in the store. The `prop()` method does substring matching, so `prop(node, 'title')` works regardless.
