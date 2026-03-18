import { html, render } from '../../../losos/html.js'

export default {
  label: 'Note',
  icon: '\uD83D\uDCDD',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Note')
  },

  render(subject, lionStore, container, rawData) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var text = node['text'] || node['http://schema.org/text'] || ''
    var author = node['author'] || node['http://schema.org/author'] || ''

    render(container, html`
      <div style="background: #fef9c3; border-radius: 10px; padding: 16px 18px; font-family: -apple-system, sans-serif; border: 1px solid #fde68a;">
        <div style="font-size: 14px; color: #713f12; line-height: 1.5;">${text}</div>
        ${author ? html`<div style="font-size: 12px; color: #a16207; margin-top: 10px; font-weight: 500;">\u2014 ${author}</div>` : null}
      </div>
    `)
  }
}
