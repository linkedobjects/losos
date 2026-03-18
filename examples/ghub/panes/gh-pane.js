import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Repository',
  icon: '\uD83D\uDCE6',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('GH')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var dataEl = document.querySelector('script[type="application/ld+json"]')
    var data = window.__ghData
    if (!data) { try { data = JSON.parse(dataEl.textContent) } catch (e) { return } }

    var src = dataEl.getAttribute('src')
    var dataUrl = src ? new URL(src, window.location.href).href : ''
    var store = createStore(data, {
      url: dataUrl,
      authFetch: (window.xlogin && window.xlogin.authFetch) || fetch,
      debounce: 800
    })
    var root = store.get('#this')

    var activeRepoId = null
    var activeTab = 'code'
    var starred = {}
    var loadingFiles = false

    function getActiveRepo() {
      if (!activeRepoId) {
        var repos = store.propAll(root, 'repo')
        return repos[0] || null
      }
      return store.get(activeRepoId)
    }

    // ========== HELPERS ==========
    function formatNum(n) {
      n = parseInt(n) || 0
      if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
      return String(n)
    }

    function formatDate(ts) {
      if (!ts) return ''
      var d = new Date(ts)
      var now = new Date()
      var diff = Math.floor((now - d) / 86400000)
      if (diff === 0) return 'today'
      if (diff === 1) return 'yesterday'
      if (diff < 7) return diff + ' days ago'
      if (diff < 30) return Math.floor(diff / 7) + ' weeks ago'
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function parseTags(s) {
      if (!s) return []
      return s.split(',').map(function(t) { return t.trim() }).filter(Boolean)
    }

    // ========== GITHUB API ==========
    function fetchRepoDetails(repo) {
      var fullName = repo['fullName']
      if (!fullName) {
        loadingFiles = false
        renderApp()
        return
      }
      if (store.propAll(repo, 'file').length > 0) {
        loadingFiles = false
        renderApp()
        return
      }
      loadingFiles = true
      renderApp()

      var branch = repo['defaultBranch'] || 'main'
      var contentsUrl = 'https://api.github.com/repos/' + fullName + '/contents?ref=' + branch
      var readmeUrl = 'https://api.github.com/repos/' + fullName + '/readme?ref=' + branch

      Promise.all([
        fetch(contentsUrl).then(function(r) { return r.json() }).catch(function() { return [] }),
        fetch(readmeUrl, { headers: { 'Accept': 'application/vnd.github.raw' } })
          .then(function(r) { return r.ok ? r.text() : '' }).catch(function() { return '' })
      ]).then(function(results) {
        var contents = results[0]
        var readmeContent = results[1]

        if (Array.isArray(contents)) {
          var files = contents.map(function(f, idx) {
            return {
              '@id': '#f-' + (f.sha ? f.sha.slice(0, 8) : String(idx)),
              '@type': 'File',
              'fileName': f.name || '',
              'fileType': f.type === 'dir' ? 'dir' : 'file',
              'fileSize': f.size ? (f.size > 1024 ? (f.size / 1024).toFixed(1) + ' KB' : f.size + ' B') : ''
            }
          })
          store.set(repo, 'file', files)
        }

        if (readmeContent) {
          // Sanitize: strip anything that could break the DOM
          var safe = readmeContent.replace(/<[^>]*>/g, '')
          store.set(repo, 'readmeText', safe)
        }

        loadingFiles = false
        renderApp()
      }).catch(function(err) {
        console.warn('Failed to fetch repo details:', err)
        loadingFiles = false
        renderApp()
      })
    }

    // ========== ACTIONS ==========
    function selectRepo(r) {
      activeRepoId = r['@id']
      activeTab = 'code'
      fetchRepoDetails(r)
    }

    function toggleStar(r) {
      var id = r['@id']
      var s = parseInt(r['stars']) || 0
      if (starred[id]) { store.set(r, 'stars', s - 1); starred[id] = false }
      else { store.set(r, 'stars', s + 1); starred[id] = true }
      renderApp()
    }

    // ========== RENDER ==========
    function renderApp() {
      var repos = store.propAll(root, 'repo')
      var repo = getActiveRepo()
      var files = repo ? store.propAll(repo, 'file').filter(function(f) { return f['fileType'] }) : []
      var topics = repo ? parseTags(repo['topics']) : []

      files.sort(function(a, b) {
        if (a['fileType'] === 'dir' && b['fileType'] !== 'dir') return -1
        if (a['fileType'] !== 'dir' && b['fileType'] === 'dir') return 1
        return (a['fileName'] || '').localeCompare(b['fileName'] || '')
      })

      render(container, html`
        <style>
          .gh-layout { background: #ffffff; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Noto Sans, Helvetica, Arial, sans-serif; color: #1f2328; }

          .gh-nav { background: #ffffff; padding: 0 24px; height: 62px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #d0d7de; }
          .gh-logo { font-size: 24px; cursor: pointer; }
          .gh-nav-search { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 5px 12px; font: 400 14px/1 inherit; color: #1f2328; width: 280px; outline: none; }
          .gh-nav-search:focus { border-color: #0969da; background: #fff; }
          .gh-nav-search::placeholder { color: #656d76; }
          .gh-nav-links { display: flex; gap: 16px; margin-left: 8px; }
          .gh-nav-link { color: #1f2328; font-size: 14px; font-weight: 500; cursor: pointer; background: none; border: none; font-family: inherit; }
          .gh-nav-link:hover { color: #656d76; }
          .gh-nav-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
          .gh-nav-icon { background: none; border: none; color: #1f2328; font-size: 18px; cursor: pointer; }
          .gh-nav-avatar { width: 32px; height: 32px; border-radius: 50%; background: #1f883d; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; color: #fff; cursor: pointer; }

          .gh-body { max-width: 1280px; margin: 0 auto; padding: 24px 32px; }

          .gh-repo-header { margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #d0d7de; }
          .gh-repo-path { font-size: 20px; color: #1f2328; margin-bottom: 8px; }
          .gh-repo-path a { color: #0969da; text-decoration: none; cursor: pointer; }
          .gh-repo-path a:hover { text-decoration: underline; }
          .gh-repo-desc { font-size: 16px; color: #656d76; margin-bottom: 10px; line-height: 1.5; }
          .gh-topics { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
          .gh-topic { background: #ddf4ff; color: #0969da; font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 12px; cursor: pointer; }
          .gh-topic:hover { background: #b6e3ff; }
          .gh-repo-actions { display: flex; gap: 8px; }
          .gh-btn { display: flex; align-items: center; gap: 6px; background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 5px 12px; font: 500 13px/1 inherit; color: #24292f; cursor: pointer; }
          .gh-btn:hover { background: #eaeef2; }
          .gh-btn-count { background: #eaeef2; border-radius: 10px; padding: 0 8px; font-size: 12px; font-weight: 600; margin-left: 4px; }
          .gh-btn-primary { background: #1f883d; border-color: #1f883d; color: #fff; }
          .gh-btn-primary:hover { background: #1a7f37; }

          .gh-tabs { display: flex; gap: 0; border-bottom: 1px solid #d0d7de; margin-bottom: 16px; }
          .gh-tab { padding: 8px 16px; font-size: 14px; font-weight: 500; color: #656d76; cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.15s; background: none; border-top: none; border-left: none; border-right: none; font-family: inherit; }
          .gh-tab:hover { color: #1f2328; }
          .gh-tab-active { color: #1f2328; border-bottom-color: #fd8c73; }

          .gh-branch-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
          .gh-branch-btn { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 6px; padding: 5px 12px; font: 500 13px/1 inherit; color: #24292f; cursor: pointer; display: flex; align-items: center; gap: 6px; }
          .gh-file-table { width: 100%; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; margin-bottom: 24px; }
          .gh-file-header { background: #f6f8fa; padding: 8px 16px; display: flex; align-items: center; gap: 8px; font-size: 14px; color: #656d76; border-bottom: 1px solid #d0d7de; }
          .gh-file-header-name { font-weight: 600; color: #1f2328; }
          .gh-file-row { display: flex; align-items: center; padding: 8px 16px; border-bottom: 1px solid #eaeef2; font-size: 14px; transition: background 0.1s; cursor: pointer; }
          .gh-file-row:last-child { border-bottom: none; }
          .gh-file-row:hover { background: #f6f8fa; }
          .gh-file-icon { width: 20px; color: #656d76; flex-shrink: 0; text-align: center; font-size: 14px; }
          .gh-file-name { flex: 1; color: #0969da; margin-left: 8px; }
          .gh-file-msg { color: #656d76; flex: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .gh-file-time { color: #656d76; flex-shrink: 0; min-width: 80px; text-align: right; }
          .gh-file-size { color: #656d76; flex-shrink: 0; min-width: 60px; text-align: right; font-size: 12px; }

          .gh-readme { border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
          .gh-readme-header { background: #f6f8fa; padding: 10px 16px; font-size: 14px; font-weight: 600; color: #1f2328; border-bottom: 1px solid #d0d7de; display: flex; align-items: center; gap: 8px; }
          .gh-readme-body { padding: 24px 32px; font-size: 16px; line-height: 1.6; color: #1f2328; white-space: pre-wrap; font-family: -apple-system, sans-serif; }

          .gh-main-grid { display: flex; gap: 32px; }
          .gh-main-col { flex: 1; min-width: 0; }
          .gh-sidebar-col { width: 296px; flex-shrink: 0; }
          @media (max-width: 900px) { .gh-sidebar-col { display: none; } }
          .gh-sidebar-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #d0d7de; }
          .gh-sidebar-title { font-size: 14px; font-weight: 600; color: #1f2328; margin-bottom: 8px; }
          .gh-sidebar-text { font-size: 13px; color: #656d76; }
          .gh-sidebar-stat { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #656d76; margin-bottom: 4px; }

          .gh-repo-list-item { border: 1px solid #d0d7de; border-radius: 6px; padding: 16px; margin-bottom: 12px; cursor: pointer; transition: border-color 0.15s; }
          .gh-repo-list-item:hover { border-color: #0969da; }
          .gh-repo-list-name { font-size: 20px; font-weight: 600; color: #0969da; margin-bottom: 4px; }
          .gh-repo-list-desc { font-size: 14px; color: #656d76; margin-bottom: 8px; line-height: 1.5; }
          .gh-repo-list-meta { display: flex; gap: 16px; font-size: 12px; color: #656d76; align-items: center; flex-wrap: wrap; }
          .gh-lang-dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }

          .gh-loading-files { padding: 40px; text-align: center; color: #656d76; font-size: 14px; }
        </style>

        <div class="gh-layout">
          <nav class="gh-nav">
            <div class="gh-logo" onclick="${function() { activeRepoId = null; renderApp() }}">\uD83D\uDC19</div>
            <input class="gh-nav-search" type="text" placeholder="Type / to search" />
            <div class="gh-nav-links">
              <button class="gh-nav-link">Pull requests</button>
              <button class="gh-nav-link">Issues</button>
              <button class="gh-nav-link">Marketplace</button>
              <button class="gh-nav-link">Explore</button>
            </div>
            <div class="gh-nav-right">
              <button class="gh-nav-icon">\uD83D\uDD14</button>
              <button class="gh-nav-icon">+</button>
              <div class="gh-nav-avatar">${(data['ownerAvatar'] || 'GH').slice(0, 2)}</div>
            </div>
          </nav>

          <div class="gh-body">
            ${repo ? renderRepoPage(repo, files, topics) : renderRepoList(repos)}
          </div>
        </div>
      `)
    }

    function renderRepoList(repos) {
      return html`
        <div>
          <h2 style="font-size: 24px; font-weight: 400; color: #1f2328; margin-bottom: 16px;">
            <span style="font-weight: 600;">${data['owner']}</span>
            <span style="color: #656d76;"> / repositories</span>
          </h2>
          ${repos.map(function(r) {
            return html`
              <div class="gh-repo-list-item" onclick="${function() { selectRepo(r) }}">
                <div class="gh-repo-list-name">${r['repoName']}</div>
                <div class="gh-repo-list-desc">${r['description']}</div>
                <div class="gh-repo-list-meta">
                  ${r['language'] ? html`<span><span class="gh-lang-dot" style="${'background: ' + (r['langColor'] || '#656d76')}"></span> ${r['language']}</span>` : null}
                  <span>\u2B50 ${formatNum(r['stars'])}</span>
                  <span>\uD83C\uDF74 ${formatNum(r['forks'])}</span>
                  ${r['license'] ? html`<span>${r['license']}</span>` : null}
                  <span>Updated ${formatDate(r['updated'])}</span>
                </div>
              </div>
            `
          })}
        </div>
      `
    }

    function renderRepoPage(repo, files, topics) {
      var isStarred = starred[repo['@id']]
      return html`
        <div>
          <div class="gh-repo-header">
            <div class="gh-repo-path">
              <a onclick="${function() { activeRepoId = null; renderApp() }}">${data['owner']}</a>
              <span> / </span>
              <a style="font-weight: 600;">${repo['repoName']}</a>
              <span style="font-size: 12px; color: #656d76; margin-left: 8px; border: 1px solid #d0d7de; border-radius: 12px; padding: 1px 8px; font-weight: 500;">Public</span>
            </div>
            <div class="gh-repo-desc">${repo['description']}</div>
            ${topics.length > 0 ? html`
              <div class="gh-topics">
                ${topics.map(function(t) { return html`<span class="gh-topic">${t}</span>` })}
              </div>
            ` : null}
            <div class="gh-repo-actions">
              <button class="gh-btn" onclick="${function() { toggleStar(repo) }}">
                ${isStarred ? '\u2B50' : '\u2606'} ${isStarred ? 'Starred' : 'Star'}
                <span class="gh-btn-count">${formatNum(repo['stars'])}</span>
              </button>
              <button class="gh-btn">\uD83C\uDF74 Fork <span class="gh-btn-count">${formatNum(repo['forks'])}</span></button>
              <button class="gh-btn">\uD83D\uDC41 Watch</button>
            </div>
          </div>

          <div class="gh-tabs">
            ${[
              { id: 'code', label: '\uD83D\uDCBB Code' },
              { id: 'issues', label: '\u26A0 Issues ' + (repo['issues'] || 0) },
              { id: 'prs', label: '\uD83D\uDD00 Pull requests' },
              { id: 'actions', label: '\u25B6 Actions' },
              { id: 'settings', label: '\u2699 Settings' }
            ].map(function(t) {
              return html`<button class="${'gh-tab' + (activeTab === t.id ? ' gh-tab-active' : '')}"
                                  onclick="${function() { activeTab = t.id; renderApp() }}">${t.label}</button>`
            })}
          </div>

          <div class="gh-main-grid">
            <div class="gh-main-col">
              <div class="gh-branch-bar">
                <button class="gh-branch-btn">\uD83C\uDF3F ${repo['defaultBranch'] || 'main'} \u25BE</button>
                <span style="font-size: 13px; color: #656d76;">Go to file</span>
                <button class="gh-btn-primary gh-btn" style="margin-left: auto;">\u21A7 Code \u25BE</button>
              </div>

              ${loadingFiles ? html`<div class="gh-loading-files">Loading file tree...</div>` : null}

              ${!loadingFiles && files.length > 0 ? html`
                <div class="gh-file-table">
                  <div class="gh-file-header">
                    <span class="gh-file-header-name">${files[0] ? (files[0]['commitAuthor'] || data['owner']) : data['owner']}</span>
                    <span>${files[0] ? (files[0]['commitMsg'] || '') : ''}</span>
                  </div>
                  ${files.map(function(f) {
                    var isDir = f['fileType'] === 'dir'
                    return html`
                      <div class="gh-file-row">
                        <span class="gh-file-icon">${isDir ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
                        <span class="gh-file-name">${f['fileName']}</span>
                        <span class="gh-file-msg">${f['commitMsg'] || ''}</span>
                        ${f['fileSize'] ? html`<span class="gh-file-size">${f['fileSize']}</span>` : null}
                        ${f['commitTime'] ? html`<span class="gh-file-time">${formatDate(f['commitTime'])}</span>` : null}
                      </div>
                    `
                  })}
                </div>
              ` : null}

              ${repo['readmeText'] ? html`
                <div class="gh-readme">
                  <div class="gh-readme-header">\uD83D\uDCD6 README.md</div>
                  <div class="gh-readme-body">${repo['readmeText']}</div>
                </div>
              ` : null}
            </div>

            <aside class="gh-sidebar-col">
              <div class="gh-sidebar-section">
                <div class="gh-sidebar-title">About</div>
                <div class="gh-sidebar-text" style="margin-bottom: 8px; line-height: 1.5;">${repo['description']}</div>
                ${repo['homepage'] ? html`<div style="margin-bottom: 8px;"><a href="${repo['homepage']}" target="_blank" rel="noopener" style="color: #0969da; text-decoration: none; font-size: 13px;">${repo['homepage']}</a></div>` : null}
                ${topics.length > 0 ? html`<div class="gh-topics" style="margin-bottom: 8px;">${topics.map(function(t) { return html`<span class="gh-topic">${t}</span>` })}</div>` : null}
                <div class="gh-sidebar-stat">\u2B50 <strong>${formatNum(repo['stars'])}</strong> stars</div>
                <div class="gh-sidebar-stat">\uD83D\uDC41 watching</div>
                <div class="gh-sidebar-stat">\uD83C\uDF74 <strong>${formatNum(repo['forks'])}</strong> forks</div>
              </div>
              ${repo['language'] ? html`
                <div class="gh-sidebar-section">
                  <div class="gh-sidebar-title">Languages</div>
                  <div style="height: 8px; border-radius: 4px; background: ${repo['langColor'] || '#656d76'}; margin-bottom: 8px;"></div>
                  <div class="gh-sidebar-stat"><span class="gh-lang-dot" style="${'background: ' + (repo['langColor'] || '#656d76')}"></span> ${repo['language']} 100%</div>
                </div>
              ` : null}
              ${repo['license'] ? html`
                <div class="gh-sidebar-section">
                  <div class="gh-sidebar-title">License</div>
                  <div class="gh-sidebar-text">${repo['license']}</div>
                </div>
              ` : null}
            </aside>
          </div>
        </div>
      `
    }

    // ========== INIT ==========
    // Fetch details for the first repo on load
    var firstRepo = getActiveRepo()
    if (firstRepo) fetchRepoDetails(firstRepo)

    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
