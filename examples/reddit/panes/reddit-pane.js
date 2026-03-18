import { createStore } from '../../../losos/store.js'
import { html, render, onUnmount, keyed } from '../../../losos/html.js'

export default {
  label: 'Reddit',
  icon: '\uD83E\uDD16',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    var type = store.type(node)
    return type && type.includes('RedditFeed')
  },

  render(subject, lionStore, container) {
    var node = lionStore.get(subject.value)
    if (!node) return

    var data = window.__redditData
    if (!data) {
      var dataEl = document.querySelector('script[type="application/ld+json"]')
      try { data = JSON.parse(dataEl.textContent) } catch (e) { return }
    }

    var store = createStore(data, { url: '', debounce: 800 })
    var root = store.get('#this')

    var expandedPost = null
    var currentSub = data['subreddit'] || 'popular'
    var loadingSub = false
    var sortBy = 'hot'

    // ========== HELPERS ==========
    function formatTime(ts) {
      if (!ts) return ''
      var d = new Date(ts)
      var now = new Date()
      var diff = Math.floor((now - d) / 1000)
      if (diff < 60) return 'just now'
      if (diff < 3600) return Math.floor(diff / 60) + ' minutes ago'
      if (diff < 86400) return Math.floor(diff / 3600) + ' hours ago'
      if (diff < 2592000) return Math.floor(diff / 86400) + ' days ago'
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function formatScore(n) {
      n = parseInt(n) || 0
      if (n >= 100000) return (n / 1000).toFixed(0) + 'k'
      if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
      if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
      return String(n)
    }

    function fixUrl(u) {
      if (!u) return ''
      return u.replace(/&amp;/g, '&')
    }

    // ========== SUBREDDIT NAVIGATION ==========
    function loadSubreddit(sub) {
      sub = sub.replace(/^\/?(r\/)?/, '')
      if (!sub) return
      loadingSub = true
      currentSub = sub
      renderApp()

      // JSONP fetch
      var cbName = '__rdCb' + Date.now()
      window[cbName] = function(listing) {
        delete window[cbName]
        var children = listing.data && listing.data.children || []
        var posts = children.map(function(c) {
          var d = c.data
          var prev = ''
          if (d.preview && d.preview.images && d.preview.images[0]) {
            var src = d.preview.images[0].source
            if (src) prev = fixUrl(src.url)
          }
          var thumb = d.thumbnail
          if (thumb === 'self' || thumb === 'default' || thumb === 'nsfw' || thumb === 'spoiler' || !thumb) thumb = ''
          else thumb = fixUrl(thumb)
          return {
            '@id': '#' + d.id,
            '@type': 'Post',
            'postTitle': d.title || '',
            'author': d.author || '',
            'score': d.score || 0,
            'ups': d.ups || 0,
            'numComments': d.num_comments || 0,
            'created': d.created_utc ? d.created_utc * 1000 : 0,
            'selftext': (d.selftext || '').slice(0, 500),
            'thumbnail': thumb,
            'preview': prev,
            'permalink': d.permalink || '',
            'domain': d.domain || '',
            'postSub': d.subreddit_name_prefixed || '',
            'flair': d.link_flair_text || '',
            'stickied': d.stickied || false,
            'isVideo': d.is_video || false,
            'isSelf': d.is_self || false
          }
        })
        store.set(root, 'post', posts)
        store.set(root, 'subreddit', sub)
        data['subreddit'] = sub
        loadingSub = false
        expandedPost = null
        renderApp()
      }

      var s = document.createElement('script')
      s.src = 'https://www.reddit.com/r/' + encodeURIComponent(sub) + '/' + sortBy + '.json?limit=25&raw_json=1&jsonp=' + cbName
      s.onerror = function() { loadingSub = false; renderApp() }
      document.head.appendChild(s)
    }

    // ========== RENDER POST ==========
    function renderPost(post) {
      var expanded = expandedPost === post['@id']
      var hasPreview = post['preview'] && post['preview'].indexOf('http') === 0
      var hasSelftext = post['selftext'] && post['selftext'].length > 0
      var hasThumb = post['thumbnail'] && post['thumbnail'].indexOf('http') === 0

      return html`
        <div class="rd-post">
          <div class="rd-vote-col">
            <button class="rd-vote-btn rd-vote-up">\u25B2</button>
            <span class="rd-score">${formatScore(post['score'])}</span>
            <button class="rd-vote-btn rd-vote-down">\u25BC</button>
          </div>
          <div class="rd-post-body">
            ${hasThumb && !hasPreview ? html`
              <img class="rd-thumb" src="${post['thumbnail']}" alt="" loading="lazy" />
            ` : null}
            <div class="rd-post-content">
              <div class="rd-post-meta">
                <a class="rd-sub-link" onclick="${function(e) { e.stopPropagation(); loadSubreddit(post['postSub'].replace('r/', '')) }}">${post['postSub']}</a>
                <span class="rd-dot">\u00B7</span>
                <span>Posted by u/${post['author']}</span>
                <span class="rd-dot">\u00B7</span>
                <span>${formatTime(post['created'])}</span>
              </div>
              <h3 class="rd-post-title" onclick="${function() { expandedPost = expanded ? null : post['@id']; renderApp() }}">
                ${post['flair'] ? html`<span class="rd-flair">${post['flair']}</span>` : null}
                ${post['postTitle']}
              </h3>

              ${hasPreview ? html`
                <div class="rd-preview-wrap">
                  <img class="rd-preview-img" src="${post['preview']}" alt="" loading="lazy" />
                </div>
              ` : null}

              ${expanded && hasSelftext ? html`
                <div class="rd-selftext">${post['selftext']}</div>
              ` : null}

              ${!expanded && !hasPreview && hasSelftext ? html`
                <button class="rd-expand-btn" onclick="${function() { expandedPost = post['@id']; renderApp() }}">
                  \uD83D\uDCDD Read more
                </button>
              ` : null}

              <div class="rd-post-actions">
                <button class="rd-action-btn">\uD83D\uDCAC ${formatScore(post['numComments'])} Comments</button>
                <button class="rd-action-btn">\u21A9 Share</button>
                <button class="rd-action-btn">\uD83D\uDCBE Save</button>
                ${post['domain'] && !post['isSelf'] ? html`<span class="rd-domain">${post['domain']}</span>` : null}
              </div>
            </div>
          </div>
        </div>
      `
    }

    // ========== MAIN RENDER ==========
    function renderApp() {
      var posts = store.propAll(root, 'post')

      render(container, html`
        <style>
          .rd-layout { background: #dae0e6; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Noto Sans, sans-serif; }

          /* Nav */
          .rd-nav {
            background: #fff; height: 48px;
            display: flex; align-items: center; gap: 12px;
            padding: 0 20px; border-bottom: 1px solid #edeff1;
            position: sticky; top: 0; z-index: 50;
          }
          .rd-logo { font-size: 22px; cursor: pointer; display: flex; align-items: center; gap: 6px; }
          .rd-logo-text { font-size: 18px; font-weight: 700; color: #1c1c1c; }
          .rd-nav-search {
            flex: 1; max-width: 500px;
            background: #f6f7f8; border: 1px solid #edeff1; border-radius: 20px;
            padding: 7px 16px; font: 400 14px/1 inherit; color: #1c1c1c; outline: none;
          }
          .rd-nav-search:focus { border-color: #0079d3; background: #fff; }
          .rd-nav-search::placeholder { color: #878a8c; }
          .rd-nav-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
          .rd-nav-btn {
            background: #0079d3; color: #fff; border: none; border-radius: 20px;
            padding: 6px 16px; font: 700 13px/1 inherit; cursor: pointer;
          }
          .rd-nav-btn-outline {
            background: none; color: #0079d3; border: 1px solid #0079d3; border-radius: 20px;
            padding: 5px 16px; font: 700 13px/1 inherit; cursor: pointer;
          }

          /* Body */
          .rd-body { max-width: 740px; margin: 0 auto; padding: 20px 0; }

          /* Sub header */
          .rd-sub-header {
            background: #fff; border-radius: 4px; padding: 12px 16px;
            margin-bottom: 12px; display: flex; align-items: center; gap: 12px;
          }
          .rd-sub-icon { width: 40px; height: 40px; border-radius: 50%; background: #ff4500; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff; font-weight: 700; }
          .rd-sub-name { font-size: 18px; font-weight: 700; color: #1c1c1c; }
          .rd-sub-prefix { font-size: 13px; color: #878a8c; }

          /* Sort bar */
          .rd-sort-bar {
            background: #fff; border-radius: 4px; padding: 8px 12px;
            margin-bottom: 12px; display: flex; gap: 4px;
          }
          .rd-sort-btn {
            background: none; border: none; border-radius: 20px;
            padding: 6px 14px; font: 600 13px/1 inherit; color: #878a8c;
            cursor: pointer; transition: all 0.15s;
          }
          .rd-sort-btn:hover { background: #f6f7f8; }
          .rd-sort-active { background: #f6f7f8; color: #1c1c1c; }

          /* Post */
          .rd-post {
            background: #fff; border: 1px solid #ccc; border-radius: 4px;
            margin-bottom: 10px; display: flex;
            transition: border-color 0.15s;
          }
          .rd-post:hover { border-color: #898989; }

          /* Vote column */
          .rd-vote-col {
            width: 40px; background: #f8f9fa; border-radius: 4px 0 0 4px;
            display: flex; flex-direction: column; align-items: center;
            padding: 8px 4px; gap: 2px; flex-shrink: 0;
          }
          .rd-vote-btn {
            background: none; border: none; color: #878a8c; font-size: 14px;
            cursor: pointer; padding: 2px; border-radius: 2px; line-height: 1;
          }
          .rd-vote-btn:hover { color: #ff4500; }
          .rd-vote-down:hover { color: #7193ff; }
          .rd-score { font-size: 12px; font-weight: 700; color: #1c1c1c; }

          /* Post body */
          .rd-post-body { flex: 1; padding: 8px; min-width: 0; display: flex; gap: 10px; }
          .rd-thumb { width: 70px; height: 70px; border-radius: 4px; object-fit: cover; flex-shrink: 0; background: #f6f7f8; }
          .rd-post-content { flex: 1; min-width: 0; }
          .rd-post-meta { font-size: 12px; color: #878a8c; margin-bottom: 4px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
          .rd-sub-link { font-weight: 700; color: #1c1c1c; cursor: pointer; text-decoration: none; }
          .rd-sub-link:hover { text-decoration: underline; }
          .rd-dot { }
          .rd-post-title {
            font-size: 18px; font-weight: 500; color: #222; line-height: 1.35;
            margin-bottom: 6px; cursor: pointer;
          }
          .rd-post-title:hover { color: #0079d3; }
          .rd-flair {
            background: #edeff1; color: #1c1c1c; font-size: 12px; font-weight: 500;
            padding: 2px 8px; border-radius: 12px; margin-right: 6px;
            vertical-align: middle;
          }

          /* Preview */
          .rd-preview-wrap { margin: 8px 0; border-radius: 4px; overflow: hidden; max-height: 500px; }
          .rd-preview-img { width: 100%; display: block; object-fit: contain; max-height: 500px; }
          .rd-selftext {
            background: #f6f7f8; border-radius: 4px; padding: 10px 12px;
            font-size: 14px; line-height: 1.5; color: #1c1c1c;
            margin: 6px 0; white-space: pre-wrap; max-height: 300px; overflow-y: auto;
          }
          .rd-expand-btn {
            background: none; border: none; font: 500 12px/1 inherit;
            color: #0079d3; cursor: pointer; padding: 4px 0; margin-bottom: 4px;
          }
          .rd-expand-btn:hover { text-decoration: underline; }

          /* Actions */
          .rd-post-actions { display: flex; gap: 4px; flex-wrap: wrap; }
          .rd-action-btn {
            background: none; border: none; font: 700 12px/1 inherit;
            color: #878a8c; cursor: pointer; padding: 4px 6px;
            border-radius: 2px; transition: background 0.15s;
          }
          .rd-action-btn:hover { background: #f6f7f8; }
          .rd-domain { font-size: 12px; color: #0079d3; margin-left: 4px; }

          .rd-loading { text-align: center; padding: 40px; color: #878a8c; font-size: 14px; }

          @media (max-width: 600px) {
            .rd-body { padding: 8px; }
            .rd-post-title { font-size: 15px; }
            .rd-thumb { width: 56px; height: 56px; }
          }
        </style>

        <div class="rd-layout">
          <nav class="rd-nav">
            <div class="rd-logo" onclick="${function() { loadSubreddit('popular') }}">
              <span>\uD83E\uDD16</span>
              <span class="rd-logo-text">reddit</span>
            </div>
            <input class="rd-nav-search" type="text" placeholder="Search subreddit... (e.g. programming, funny, askreddit)"
                   onkeydown="${function(e) { if (e.key === 'Enter' && e.target.value.trim()) { loadSubreddit(e.target.value.trim()); e.target.value = '' } }}" />
            <div class="rd-nav-right">
              <button class="rd-nav-btn-outline">Log In</button>
              <button class="rd-nav-btn">Sign Up</button>
            </div>
          </nav>

          <div class="rd-body">
            <div class="rd-sub-header">
              <div class="rd-sub-icon">${currentSub.charAt(0).toUpperCase()}</div>
              <div>
                <div class="rd-sub-name">${currentSub}</div>
                <div class="rd-sub-prefix">r/${currentSub}</div>
              </div>
            </div>

            <div class="rd-sort-bar">
              ${['hot', 'new', 'top', 'rising'].map(function(s) {
                return html`<button class="${'rd-sort-btn' + (sortBy === s ? ' rd-sort-active' : '')}"
                                    onclick="${function() { sortBy = s; loadSubreddit(currentSub) }}">
                  ${s === 'hot' ? '\uD83D\uDD25' : s === 'new' ? '\u2728' : s === 'top' ? '\uD83D\uDCC8' : '\uD83D\uDE80'} ${s.charAt(0).toUpperCase() + s.slice(1)}
                </button>`
              })}
            </div>

            ${loadingSub ? html`<div class="rd-loading">Loading r/${currentSub}...</div>` : null}

            ${!loadingSub ? keyed(posts, function(p) { return p['@id'] }, function(p) { return renderPost(p) }) : null}

            ${!loadingSub && posts.length === 0 ? html`
              <div class="rd-loading">No posts found in r/${currentSub}</div>
            ` : null}
          </div>
        </div>
      `)
    }

    // ========== INIT ==========
    var unsub = store.onChange(renderApp)
    setTimeout(renderApp, 0)
    onUnmount(container, unsub)
  }
}
