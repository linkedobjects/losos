import { html, render } from '../../../losos/html.js'
import { resolvePane } from '../../../losos/shell.js'
import taskPane from './task-pane.js'

export default {
  label: 'Dashboard',
  icon: '\uD83D\uDCCA',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Dashboard')
  },

  async render(subject, lionStore, container, rawData) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var title = node['title'] || node['http://purl.org/dc/terms/title'] || 'Dashboard'

    render(container, html`
      <style>
        .db-layout { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px; max-width: 960px; margin: 0 auto; }
        .db-title { font-family: Georgia, serif; font-size: 28px; font-weight: 400; font-style: italic; color: #1a1a1a; margin-bottom: 24px; }
        .db-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .db-full { grid-column: 1 / -1; }
        .db-card { background: #f9fafb; border-radius: 12px; overflow: hidden; }
        .db-card-label { font-size: 10px; font-weight: 600; color: #aaa; letter-spacing: 0.1em; text-transform: uppercase; padding: 14px 16px 4px; }
        .db-people { display: flex; flex-direction: column; gap: 8px; padding: 8px 12px 14px; }
        .db-note-slot { padding: 8px 12px 14px; }
        @media (max-width: 640px) { .db-grid { grid-template-columns: 1fr; } }
      </style>
      <div class="db-layout">
        <h1 class="db-title">${title}</h1>
        <div class="db-grid">
          <div class="db-card">
            <div class="db-card-label">Team</div>
            <div class="db-people" id="db-team"></div>
          </div>
          <div class="db-card" id="db-tasks"></div>
          <div class="db-full">
            <div class="db-card">
              <div class="db-card-label">Pinned Note</div>
              <div class="db-note-slot" id="db-note"></div>
            </div>
          </div>
        </div>
      </div>
    `)

    // Nested pane: each Person rendered by resolvePane (finds person-pane via canHandle)
    var people = lionStore.propAll(node, 'person') || []
    var teamEl = container.querySelector('#db-team')
    for (var i = 0; i < people.length; i++) {
      var div = document.createElement('div')
      teamEl.appendChild(div)
      await resolvePane(people[i], lionStore, div, rawData)
    }

    // Nested pane: Tasks — direct import (resolvePane would match dashboard-pane again)
    var tasksEl = container.querySelector('#db-tasks')
    taskPane.render(subject, lionStore, tasksEl, rawData)

    // Nested pane: Note rendered by resolvePane (finds note-pane via canHandle)
    var notes = lionStore.propAll(node, 'note') || []
    if (notes[0]) {
      var noteEl = container.querySelector('#db-note')
      await resolvePane(notes[0], lionStore, noteEl, rawData)
    }
  }
}
