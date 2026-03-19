import { html, render } from '../../../losos/html.js'

export default {
  label: 'Source',
  icon: '\uD83D\uDCC4',

  canHandle(subject, store) {
    return store.get(subject.value) != null
  },

  render(subject, store, container) {
    var node = store.get(subject.value)
    if (!node) return
    var raw = JSON.stringify(node, null, 2)

    render(container, html`
      <div style="padding: 48px 40px 80px; max-width: 800px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 8px; color: #111;">JSON-LD Source</h2>
        <p style="font-size: 13px; color: #999; margin: 0 0 20px;">Raw linked data from MusicBrainz API</p>
        <pre style="background: #f8f8fa; padding: 24px; border-radius: 12px; border: 1px solid #e5e5e5; overflow-x: auto; font-family: 'SF Mono', Monaco, Consolas, monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; color: #e11d48;">${raw}</pre>
      </div>
    `)
  }
}
