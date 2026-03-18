import { html, render, onUnmount } from 'https://losos.org/losos/html.js'

export default {
  label: 'Preview',
  icon: '\uD83D\uDC19',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    if (!node) return false
    var url = node['url'] || ''
    return /github\.com\/[\w.-]+/.test(url)
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData || window.__jrData
    if (!data) return
    var url = data['url'] || ''

    var LANG_COLORS = {
      'JavaScript': '#f1e05a', 'TypeScript': '#3178c6', 'Python': '#3572A5',
      'Java': '#b07219', 'Go': '#00ADD8', 'Rust': '#dea584', 'C': '#555555',
      'C++': '#f34b7d', 'Ruby': '#701516', 'HTML': '#e34c26', 'CSS': '#563d7c',
      'Shell': '#89e051', 'PHP': '#4F5D95', 'Swift': '#F05138', 'Kotlin': '#A97BFF',
      'Dart': '#00B4AB', 'Lua': '#000080', 'Vue': '#41b883', 'Svelte': '#ff3e00'
    }

    function timeAgo(dateStr) {
      if (!dateStr) return ''
      var diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000)
      if (diff === 0) return 'today'
      if (diff === 1) return 'yesterday'
      if (diff < 30) return diff + ' days ago'
      return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }

    function renderLabel(lb) {
      var bg = '#' + (lb.color || 'ededed')
      var r = parseInt(bg.slice(1,3),16), g = parseInt(bg.slice(3,5),16), b = parseInt(bg.slice(5,7),16)
      var tc = (r*0.299 + g*0.587 + b*0.114) > 150 ? '#333' : '#fff'
      return html`<span style="${'display:inline-block;font-size:11px;padding:1px 8px;border-radius:12px;font-weight:500;background:#' + lb.color + ';color:' + tc}">${lb.name}</span>`
    }

    function searchBar() {
      return html`
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
          <form style="display: flex; gap: 0; max-width: 480px;" action="">
            <input style="flex: 1; padding: 12px 18px; border: 2px solid #eee; border-radius: 24px 0 0 24px; font: 400 15px/1 inherit; outline: none;" type="text" name="uri" placeholder="Try another URL..." />
            <button style="background: #667eea; color: #fff; border: none; border-radius: 0 24px 24px 0; padding: 12px 24px; font: 600 15px/1 inherit; cursor: pointer;" type="submit">Go</button>
          </form>
        </div>
      `
    }

    // ========== DETECT URL PATTERN ==========
    var issuesListMatch = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/?$/)
    var issueMatch = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\/?$/)
    var prsListMatch = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pulls?\/?$/)
    var prMatch = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/pull\/(\d+)\/?$/)
    var repoMatch = url.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/?$/)
    var orgMatch = url.match(/github\.com\/([\w.-]+)\/?$/)

    var SKIP_ORGS = ['features','about','enterprise','login','settings','orgs','marketplace','explore','topics','trending','collections','events','sponsors','customer-stories']

    // ========== STYLES ==========
    var listStyles = html`<style>
      .gh-wrap { font-family: -apple-system, sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px; }
      .gh-path { font-size: 16px; color: #888; margin-bottom: 20px; }
      .gh-path a { color: #667eea; text-decoration: none; }
      .gh-path a:hover { text-decoration: underline; }
      .gh-count { font-size: 14px; color: #888; margin-bottom: 16px; }
      .gh-list { background: #fff; border: 1px solid #eee; border-radius: 12px; overflow: hidden; }
      .gh-item { display: flex; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #f5f5f5; cursor: pointer; transition: background 0.1s; text-decoration: none; color: inherit; }
      .gh-item:last-child { border-bottom: none; }
      .gh-item:hover { background: #fafafa; }
      .gh-item-icon { font-size: 18px; flex-shrink: 0; margin-top: 2px; }
      .gh-item-title { font-size: 15px; font-weight: 600; color: #1a1a2e; line-height: 1.4; margin-bottom: 4px; }
      .gh-item-meta { font-size: 12px; color: #888; }
      .gh-item-labels { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
      .gh-item-comments { font-size: 12px; color: #aaa; margin-left: auto; flex-shrink: 0; display: flex; align-items: center; gap: 4px; }

      .gh-detail-title { font-size: 26px; font-weight: 600; color: #1a1a2e; line-height: 1.3; margin-bottom: 4px; }
      .gh-detail-number { color: #888; font-weight: 400; }
      .gh-detail-meta { font-size: 14px; color: #888; margin-bottom: 8px; }
      .gh-state { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 16px; font-size: 13px; font-weight: 500; }
      .gh-state-open { background: #dafbe1; color: #1a7f37; }
      .gh-state-closed { background: #f0e0ff; color: #8250df; }
      .gh-labels { display: flex; gap: 4px; flex-wrap: wrap; margin: 12px 0; }
      .gh-body { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 20px 24px; margin: 20px 0; font-size: 15px; line-height: 1.8; color: #444; white-space: pre-wrap; }
      .gh-comments-title { font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 24px 0 12px; }
      .gh-comment { background: #fff; border: 1px solid #eee; border-radius: 12px; margin-bottom: 12px; overflow: hidden; }
      .gh-comment-header { background: #fafafa; padding: 10px 16px; font-size: 13px; color: #888; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 8px; }
      .gh-comment-avatar { width: 24px; height: 24px; border-radius: 50%; }
      .gh-comment-author { font-weight: 600; color: #1a1a2e; }
      .gh-comment-body { padding: 16px 20px; font-size: 14px; line-height: 1.7; color: #444; white-space: pre-wrap; }

      .gh-org-header { display: flex; align-items: center; gap: 20px; margin-bottom: 32px; }
      .gh-org-avatar { width: 80px; height: 80px; border-radius: 16px; }
      .gh-org-name { font-size: 28px; font-weight: 700; color: #1a1a2e; }
      .gh-org-desc { font-size: 15px; color: #666; margin-top: 4px; }
      .gh-repos { display: flex; flex-direction: column; gap: 12px; }
      .gh-repo-card { background: #fff; border: 1px solid #eee; border-radius: 12px; padding: 18px 22px; text-decoration: none; color: inherit; transition: all 0.15s; cursor: pointer; }
      .gh-repo-card:hover { border-color: #667eea; box-shadow: 0 4px 16px rgba(0,0,0,0.04); transform: translateY(-2px); }
      .gh-repo-name { font-size: 18px; font-weight: 600; color: #667eea; margin-bottom: 4px; }
      .gh-repo-desc { font-size: 14px; color: #666; margin-bottom: 10px; line-height: 1.5; }
      .gh-repo-meta { display: flex; gap: 16px; font-size: 13px; color: #888; flex-wrap: wrap; }
      .gh-repo-lang { display: flex; align-items: center; gap: 4px; }
      .gh-lang-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

      .gh-file-table { background: #fff; border: 1px solid #eee; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
      .gh-file-row { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f5f5f5; font-size: 14px; }
      .gh-file-row:last-child { border-bottom: none; }
      .gh-file-row:hover { background: #fafafa; }
      .gh-file-icon { width: 20px; color: #888; flex-shrink: 0; }
      .gh-file-name { color: #667eea; margin-left: 8px; flex: 1; }
      .gh-file-size { color: #ccc; font-size: 12px; }
      .gh-readme { background: #fff; border: 1px solid #eee; border-radius: 12px; overflow: hidden; }
      .gh-readme-header { background: #fafafa; padding: 12px 18px; font-size: 14px; font-weight: 600; color: #1a1a2e; border-bottom: 1px solid #eee; }
      .gh-readme-body { padding: 24px; font-size: 15px; line-height: 1.8; color: #444; white-space: pre-wrap; }
      .gh-stats { display: flex; gap: 10px; margin-bottom: 24px; flex-wrap: wrap; }
      .gh-stat { background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 8px 16px; font-size: 14px; color: #555; display: flex; align-items: center; gap: 6px; text-decoration: none; }
      .gh-stat:hover { background: #fafafa; }
    </style>`

    function loading(msg) {
      render(container, html`${listStyles}<div class="gh-wrap" style="text-align: center; padding: 60px; color: #888;">${msg}</div>`)
    }

    // ========== ISSUES LIST ==========
    if (issuesListMatch) {
      var o = issuesListMatch[1], r = issuesListMatch[2]
      loading('Loading issues...')
      fetch('https://api.github.com/repos/' + o + '/' + r + '/issues?state=open&per_page=30')
        .then(function(res) { return res.json() })
        .then(function(issues) {
          if (!Array.isArray(issues)) return
          render(container, html`
            ${listStyles}
            <div class="gh-wrap">
              <div class="gh-path"><a href="${'?uri=https://github.com/' + o}">${o}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r}">${r}</a> / <strong>Issues</strong></div>
              <div class="gh-count">${issues.length} open issues</div>
              <div class="gh-list">
                ${issues.map(function(iss) {
                  return html`<a class="gh-item" href="${'?uri=https://github.com/' + o + '/' + r + '/issues/' + iss.number}">
                    <span class="gh-item-icon" style="color: #1a7f37;">\u25CB</span>
                    <div style="flex: 1; min-width: 0;">
                      <div class="gh-item-title">${iss.title}</div>
                      <div class="gh-item-meta">#${iss.number} opened ${timeAgo(iss.created_at)} by ${iss.user ? iss.user.login : '?'}</div>
                      ${iss.labels && iss.labels.length ? html`<div class="gh-item-labels">${iss.labels.map(renderLabel)}</div>` : null}
                    </div>
                    ${iss.comments > 0 ? html`<span class="gh-item-comments">\uD83D\uDCAC ${iss.comments}</span>` : null}
                  </a>`
                })}
              </div>
              ${searchBar()}
            </div>
          `)
        })
      return
    }

    // ========== SINGLE ISSUE ==========
    if (issueMatch) {
      var o = issueMatch[1], r = issueMatch[2], n = issueMatch[3]
      loading('Loading issue #' + n + '...')
      Promise.all([
        fetch('https://api.github.com/repos/' + o + '/' + r + '/issues/' + n).then(function(res) { return res.json() }),
        fetch('https://api.github.com/repos/' + o + '/' + r + '/issues/' + n + '/comments?per_page=30').then(function(res) { return res.json() }).catch(function() { return [] })
      ]).then(function(results) {
        var iss = results[0], comments = Array.isArray(results[1]) ? results[1] : []
        if (!iss || !iss.title) return
        render(container, html`
          ${listStyles}
          <div class="gh-wrap">
            <div class="gh-path"><a href="${'?uri=https://github.com/' + o}">${o}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r}">${r}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r + '/issues'}">Issues</a></div>
            <h1 class="gh-detail-title">${iss.title} <span class="gh-detail-number">#${iss.number}</span></h1>
            <div class="gh-detail-meta">
              <span class="${'gh-state ' + (iss.state === 'open' ? 'gh-state-open' : 'gh-state-closed')}">${iss.state === 'open' ? '\u25CB Open' : '\u25C9 Closed'}</span>
              \u00A0 ${iss.user ? iss.user.login : '?'} opened ${timeAgo(iss.created_at)} \u00B7 ${iss.comments || 0} comments
            </div>
            ${iss.labels && iss.labels.length ? html`<div class="gh-labels">${iss.labels.map(renderLabel)}</div>` : null}
            ${iss.body ? html`<div class="gh-body">${iss.body.replace(/<[^>]*>/g, '').slice(0, 3000)}</div>` : null}
            ${comments.length > 0 ? html`
              <div class="gh-comments-title">\uD83D\uDCAC ${comments.length} comments</div>
              ${comments.map(function(c) {
                return html`<div class="gh-comment">
                  <div class="gh-comment-header">
                    ${c.user ? html`<img class="gh-comment-avatar" src="${c.user.avatar_url}" alt="" />` : null}
                    <span class="gh-comment-author">${c.user ? c.user.login : '?'}</span>
                    <span>commented ${timeAgo(c.created_at)}</span>
                  </div>
                  <div class="gh-comment-body">${(c.body || '').replace(/<[^>]*>/g, '').slice(0, 2000)}</div>
                </div>`
              })}
            ` : null}
            ${searchBar()}
          </div>
        `)
      })
      return
    }

    // ========== PRS LIST ==========
    if (prsListMatch) {
      var o = prsListMatch[1], r = prsListMatch[2]
      loading('Loading pull requests...')
      fetch('https://api.github.com/repos/' + o + '/' + r + '/pulls?state=open&per_page=30')
        .then(function(res) { return res.json() })
        .then(function(prs) {
          if (!Array.isArray(prs)) return
          render(container, html`
            ${listStyles}
            <div class="gh-wrap">
              <div class="gh-path"><a href="${'?uri=https://github.com/' + o}">${o}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r}">${r}</a> / <strong>Pull Requests</strong></div>
              <div class="gh-count">${prs.length} open pull requests</div>
              <div class="gh-list">
                ${prs.map(function(pr) {
                  return html`<a class="gh-item" href="${'?uri=https://github.com/' + o + '/' + r + '/pull/' + pr.number}">
                    <span class="gh-item-icon" style="color: #1a7f37;">\uD83D\uDD00</span>
                    <div style="flex: 1; min-width: 0;">
                      <div class="gh-item-title">${pr.title}</div>
                      <div class="gh-item-meta">#${pr.number} opened ${timeAgo(pr.created_at)} by ${pr.user ? pr.user.login : '?'} \u00B7 ${pr.head ? pr.head.ref : ''} \u2192 ${pr.base ? pr.base.ref : ''}</div>
                      ${pr.labels && pr.labels.length ? html`<div class="gh-item-labels">${pr.labels.map(renderLabel)}</div>` : null}
                    </div>
                  </a>`
                })}
              </div>
              ${prs.length === 0 ? html`<div style="padding: 40px; text-align: center; color: #aaa;">No open pull requests</div>` : null}
              ${searchBar()}
            </div>
          `)
        })
      return
    }

    // ========== SINGLE PR ==========
    if (prMatch) {
      var o = prMatch[1], r = prMatch[2], n = prMatch[3]
      loading('Loading PR #' + n + '...')
      Promise.all([
        fetch('https://api.github.com/repos/' + o + '/' + r + '/pulls/' + n).then(function(res) { return res.json() }),
        fetch('https://api.github.com/repos/' + o + '/' + r + '/pulls/' + n + '/comments?per_page=20').then(function(res) { return res.json() }).catch(function() { return [] })
      ]).then(function(results) {
        var pr = results[0], comments = Array.isArray(results[1]) ? results[1] : []
        if (!pr || !pr.title) return
        render(container, html`
          ${listStyles}
          <div class="gh-wrap">
            <div class="gh-path"><a href="${'?uri=https://github.com/' + o}">${o}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r}">${r}</a> / <a href="${'?uri=https://github.com/' + o + '/' + r + '/pulls'}">Pull Requests</a></div>
            <h1 class="gh-detail-title">${pr.title} <span class="gh-detail-number">#${pr.number}</span></h1>
            <div class="gh-detail-meta">
              <span class="${'gh-state ' + (pr.state === 'open' ? 'gh-state-open' : 'gh-state-closed')}">${pr.state === 'open' ? '\uD83D\uDD00 Open' : '\u2714 Merged'}</span>
              \u00A0 ${pr.user ? pr.user.login : '?'} wants to merge <strong>${pr.head ? pr.head.ref : '?'}</strong> \u2192 <strong>${pr.base ? pr.base.ref : '?'}</strong> \u00B7 ${timeAgo(pr.created_at)}
            </div>
            <div style="display: flex; gap: 10px; margin: 16px 0; flex-wrap: wrap;">
              <div style="background: #dafbe1; color: #1a7f37; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 500;">+${pr.additions || 0}</div>
              <div style="background: #ffe0e0; color: #d1242f; padding: 4px 12px; border-radius: 8px; font-size: 13px; font-weight: 500;">-${pr.deletions || 0}</div>
              <div style="background: #f0f0f0; color: #555; padding: 4px 12px; border-radius: 8px; font-size: 13px;">${pr.changed_files || 0} files</div>
              <div style="background: #f0f0f0; color: #555; padding: 4px 12px; border-radius: 8px; font-size: 13px;">${pr.commits || 0} commits</div>
            </div>
            ${pr.labels && pr.labels.length ? html`<div class="gh-labels">${pr.labels.map(renderLabel)}</div>` : null}
            ${pr.body ? html`<div class="gh-body">${pr.body.replace(/<[^>]*>/g, '').slice(0, 3000)}</div>` : null}
            ${comments.length > 0 ? html`
              <div class="gh-comments-title">\uD83D\uDCAC ${comments.length} review comments</div>
              ${comments.map(function(c) {
                return html`<div class="gh-comment">
                  <div class="gh-comment-header">
                    ${c.user ? html`<img class="gh-comment-avatar" src="${c.user.avatar_url}" alt="" />` : null}
                    <span class="gh-comment-author">${c.user ? c.user.login : '?'}</span>
                    <span>commented ${timeAgo(c.created_at)}</span>
                    ${c.path ? html`<span style="margin-left: auto; font-family: monospace; font-size: 12px; color: #aaa;">${c.path}</span>` : null}
                  </div>
                  <div class="gh-comment-body">${(c.body || '').replace(/<[^>]*>/g, '').slice(0, 2000)}</div>
                </div>`
              })}
            ` : null}
            ${searchBar()}
          </div>
        `)
      })
      return
    }

    // ========== REPO ==========
    if (repoMatch) {
      var o = repoMatch[1], r = repoMatch[2]
      loading('Loading ' + o + '/' + r + '...')
      Promise.all([
        fetch('https://api.github.com/repos/' + o + '/' + r).then(function(res) { return res.json() }),
        fetch('https://api.github.com/repos/' + o + '/' + r + '/contents').then(function(res) { return res.json() }).catch(function() { return [] }),
        fetch('https://api.github.com/repos/' + o + '/' + r + '/readme', { headers: { 'Accept': 'application/vnd.github.raw' } }).then(function(res) { return res.ok ? res.text() : '' }).catch(function() { return '' })
      ]).then(function(results) {
        var repo = results[0], contents = Array.isArray(results[1]) ? results[1] : [], readme = results[2]
        if (!repo || !repo.full_name) return
        var langColor = LANG_COLORS[repo.language] || '#888'
        contents.sort(function(a, b) {
          if (a.type === 'dir' && b.type !== 'dir') return -1
          if (a.type !== 'dir' && b.type === 'dir') return 1
          return a.name.localeCompare(b.name)
        })
        var safeReadme = readme ? readme.replace(/<[^>]*>/g, '') : ''

        render(container, html`
          ${listStyles}
          <div class="gh-wrap">
            <div class="gh-path" style="font-size: 20px;"><a href="${'?uri=https://github.com/' + repo.owner.login}">${repo.owner.login}</a> / <strong>${repo.name}</strong></div>
            ${repo.description ? html`<div style="font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 12px;">${repo.description}</div>` : null}
            ${repo.homepage ? html`<div style="margin-bottom: 12px;"><a href="${repo.homepage}" target="_blank" style="color: #667eea; font-size: 14px;">${repo.homepage}</a></div>` : null}
            ${repo.topics && repo.topics.length ? html`<div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">${repo.topics.map(function(t) { return html`<span style="padding: 4px 12px; background: #f4f4f8; border-radius: 20px; font-size: 13px; color: #555;">${t}</span>` })}</div>` : null}
            <div class="gh-stats">
              ${repo.language ? html`<div class="gh-stat"><span class="gh-lang-dot" style="${'background:' + langColor}"></span> ${repo.language}</div>` : null}
              <div class="gh-stat">\u2B50 ${repo.stargazers_count}</div>
              <div class="gh-stat">\uD83C\uDF74 ${repo.forks_count}</div>
              <a class="gh-stat" href="${'?uri=' + encodeURIComponent(repo.html_url + '/issues')}" style="color: #667eea; cursor: pointer;">\u26A0 issues \u2192</a>
              <a class="gh-stat" href="${'?uri=' + encodeURIComponent(repo.html_url + '/pulls')}" style="color: #667eea; cursor: pointer;">\uD83D\uDD00 PRs \u2192</a>
              ${repo.license ? html`<div class="gh-stat">${repo.license.spdx_id}</div>` : null}
            </div>
            ${contents.length > 0 ? html`
              <div class="gh-file-table">
                ${contents.map(function(f) {
                  return html`<div class="gh-file-row">
                    <span class="gh-file-icon">${f.type === 'dir' ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}</span>
                    <span class="gh-file-name">${f.name}</span>
                    ${f.size ? html`<span class="gh-file-size">${f.size > 1024 ? (f.size / 1024).toFixed(1) + ' KB' : f.size + ' B'}</span>` : null}
                  </div>`
                })}
              </div>
            ` : null}
            ${safeReadme ? html`
              <div class="gh-readme">
                <div class="gh-readme-header">\uD83D\uDCD6 README.md</div>
                <div class="gh-readme-body">${safeReadme.slice(0, 3000)}</div>
              </div>
            ` : null}
            ${searchBar()}
          </div>
        `)
      })
      return
    }

    // ========== ORG ==========
    if (orgMatch && SKIP_ORGS.indexOf(orgMatch[1]) === -1) {
      var o = orgMatch[1]
      loading('Loading ' + o + '...')
      fetch('https://api.github.com/users/' + o + '/repos?sort=updated&per_page=30')
        .then(function(res) { return res.json() })
        .then(function(repos) {
          if (!Array.isArray(repos)) return
          render(container, html`
            ${listStyles}
            <div class="gh-wrap">
              <div class="gh-org-header">
                ${data['image'] ? html`<img class="gh-org-avatar" src="${data['image']}" alt="${o}" />` : null}
                <div>
                  <div class="gh-org-name">${o}</div>
                  ${data['description'] ? html`<div class="gh-org-desc">${data['description']}</div>` : null}
                </div>
              </div>
              <div class="gh-count">${repos.length} repositories</div>
              <div class="gh-repos">
                ${repos.map(function(r) {
                  var lc = LANG_COLORS[r.language] || '#888'
                  return html`<a class="gh-repo-card" href="${'?uri=' + encodeURIComponent(r.html_url)}">
                    <div class="gh-repo-name">${r.name}</div>
                    ${r.description ? html`<div class="gh-repo-desc">${r.description}</div>` : null}
                    <div class="gh-repo-meta">
                      ${r.language ? html`<span class="gh-repo-lang"><span class="gh-lang-dot" style="${'background:' + lc}"></span> ${r.language}</span>` : null}
                      <span>\u2B50 ${r.stargazers_count}</span>
                      <span>\uD83C\uDF74 ${r.forks_count}</span>
                      ${r.license ? html`<span>${r.license.spdx_id}</span>` : null}
                    </div>
                  </a>`
                })}
              </div>
              ${searchBar()}
            </div>
          `)
        })
      return
    }

    // Fallback — shouldn't reach here if canHandle is correct
    render(container, html`<div style="padding: 40px; color: #888;">GitHub URL not recognized</div>`)
  }
}
