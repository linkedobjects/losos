import { html, render } from '../../../losos/html.js'

var STATUS_COLORS = { online: '#22c55e', away: '#f59e0b', offline: '#94a3b8' }
var AVATAR_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#f97316', '#10b981', '#8b5cf6']

function avatarColor(name) {
  var h = 0
  for (var i = 0; i < (name || '').length; i++) h = ((h << 5) - h) + name.charCodeAt(i)
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

export default {
  label: 'Person',
  icon: '\uD83D\uDC64',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Person')
  },

  render(subject, lionStore, container, rawData) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var name = node['name'] || node['http://schema.org/name'] || '?'
    var role = node['role'] || node['http://schema.org/jobTitle'] || ''
    var status = node['status'] || node['http://schema.org/description'] || 'offline'
    var avatar = (node['avatar'] || name).slice(0, 2).toUpperCase()
    var statusColor = STATUS_COLORS[status] || STATUS_COLORS.offline

    render(container, html`
      <div style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #fff; border-radius: 10px; border: 1px solid #f0f0f0;">
        <div style="${'width: 40px; height: 40px; border-radius: 50%; background: ' + avatarColor(name) + '; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; flex-shrink: 0; position: relative;'}">
          ${avatar}
          <div style="${'position: absolute; bottom: -1px; right: -1px; width: 12px; height: 12px; border-radius: 50%; background: ' + statusColor + '; border: 2px solid #fff;'}"></div>
        </div>
        <div>
          <div style="font-size: 15px; font-weight: 600; color: #1a1a1a;">${name}</div>
          <div style="font-size: 13px; color: #888;">${role}</div>
        </div>
      </div>
    `)
  }
}
