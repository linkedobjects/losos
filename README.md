# LOSOS

**Your data is a URL.** A 6KB reactive framework for building apps on linked data. Edit a value — it auto-saves via HTTP PUT. Open the same URL on another device — it live-syncs via WebSocket.

No build step. No dependencies. No virtual DOM.

## Quick Start

Create `index.html`, copy the code from the [Quick Start](https://losos.org/docs/quickstart.html), open in browser. That's it.

## Vocabulary

LOSOS data is JSON-LD. When no explicit `@context` is supplied, the recommended default vocabulary is `urn:solid:` — a stable, vocabulary-agnostic surface that maps (via `owl:sameAs`) to the canonical IRIs in FOAF, Schema.org, dcterms, ActivityStreams, and other common vocabularies.

This means panes can register against `urn:solid:` types (e.g. `urn:solid:Person`) and match data regardless of which upstream vocabulary the source app used. Pods are vocab-heterogeneous; `urn:solid` is the indirection layer that lets a single pane handle every variant.

- Registry (~440 terms): https://urn-solid.github.io/
- Namespace specification: https://urn-solid.github.io/spec/
- LION's matching recommendation: https://github.com/linkedobjects/linkedobjects#rdf-compatibility

## Links

- **Website:** https://losos.org
- **Docs:** https://losos.org/docs/
- **Examples:** https://losos.org/examples/
- **LLM Skill:** https://losos.org/SKILL.md

## License

[AGPL-3.0](LICENSE) — Copyright (C) 2026 Melvin Carvalho
