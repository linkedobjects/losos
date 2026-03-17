import { html, render } from '../lib/html.js'

export default {
  label: 'Source',
  icon: '\u{1F4CB}',

  canHandle(subject, store) {
    const node = store.get(subject.value)
    return node != null
  },

  render(subject, store, container) {
    const node = store.get(subject.value)
    if (!node) return

    const dataEl = document.querySelector('script[type="application/ld+json"]')
    const src = dataEl && dataEl.getAttribute('src')
    const dataUrl = src ? new URL(src, window.location.href).href : ''
    const raw = JSON.stringify(node, null, 2)
    const bytes = new Blob([raw]).size

    render(container, html`
      <div style="padding: 48px 40px 80px; font-family: Inter, -apple-system, sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
          <h2 style="font-family: Georgia, serif; font-size: 36px; font-weight: 400; font-style: italic; color: #1a1a1a; margin: 0;">Source</h2>
          <a href="${dataUrl}" target="_blank" rel="noopener"
             style="font-size: 12px; color: #999; text-decoration: none; font-family: monospace;">${src}</a>
        </div>
        <pre style="background: #1a1a1a; color: #e0e0e0; padding: 24px; border-radius: 10px; overflow-x: auto; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">${raw}</pre>
        <div style="margin-top: 8px; font-size: 11px; color: #ccc; text-align: right;">${bytes.toLocaleString()} bytes · ${raw.split('\n').length} lines</div>
      </div>
    `)
  }
}
