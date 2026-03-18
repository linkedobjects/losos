import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Tasks',
  icon: '\u2705',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('Dashboard')
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData
    if (!data) return
    var store = createStore(data, { debounce: 800 })
    var root = store.get('#this')

    function renderTasks() {
      var tasks = store.propAll(root, 'task')
      var done = tasks.filter(function(t) { return t['done'] === true || t['done'] === 'true' })
      var todo = tasks.filter(function(t) { return !(t['done'] === true || t['done'] === 'true') })

      render(container, html`
        <div style="font-family: -apple-system, sans-serif; padding: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <h3 style="font-size: 16px; font-weight: 600; color: #1a1a1a; margin: 0;">Tasks</h3>
            <span style="font-size: 12px; color: #888; background: #f5f5f5; padding: 2px 8px; border-radius: 10px;">${done.length}/${tasks.length}</span>
          </div>
          ${keyed(todo, function(t) { return t['@id'] }, function(t) {
            return html`
              <div style="display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f5;">
                <button onclick="${function() { store.set(t, 'done', true) }}"
                  style="width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid #d4d4d4; background: none; cursor: pointer; flex-shrink: 0;"></button>
                <div style="flex: 1; min-width: 0;">
                  <div style="font-size: 14px; color: #1a1a1a;">${t['taskTitle']}</div>
                  <div style="font-size: 12px; color: #aaa;">${t['assignee']}</div>
                </div>
              </div>
            `
          })}
          ${done.length > 0 ? html`
            <div style="font-size: 11px; font-weight: 600; color: #ccc; letter-spacing: 0.1em; margin-top: 12px; padding-top: 8px;">DONE</div>
            ${keyed(done, function(t) { return t['@id'] }, function(t) {
              return html`
                <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0;">
                  <button onclick="${function() { store.set(t, 'done', false) }}"
                    style="width: 20px; height: 20px; border-radius: 5px; border: none; background: #1a1a1a; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                    <span style="color: #fff; font-size: 12px;">\u2713</span>
                  </button>
                  <span style="font-size: 14px; color: #bbb; text-decoration: line-through;">${t['taskTitle']}</span>
                </div>
              `
            })}
          ` : null}
        </div>
      `)
    }

    var unsub = store.onChange(renderTasks)
    setTimeout(renderTasks, 0)
    onUnmount(container, unsub)
  }
}
