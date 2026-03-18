import { html, render } from '../../losos/html.js'
export default {
  label: 'Source', icon: '\u{1F4CB}',
  canHandle(subject, store) { return store.get(subject.value) != null },
  render(subject, store, container) {
    var node = store.get(subject.value); if (!node) return
    var raw = JSON.stringify(node, null, 2)
    render(container, html`
      <div style="padding: 32px; max-width: 700px; margin: 0 auto;">
        <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">Source</h2>
        <pre style="background: #fff; padding: 20px; border-radius: 10px; border: 1px solid #e5e5e5; overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${raw}</pre>
      </div>
    `)
  }
}
