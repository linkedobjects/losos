import { html, render, onUnmount } from 'https://losos.org/losos/html.js'

export default {
  label: 'Reddit',
  icon: '\uD83E\uDD16',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    if (!node) return false
    var url = node['url'] || ''
    return /reddit\.com\//.test(url) || /old\.reddit\.com\//.test(url)
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData || window.__jrData
    if (!data) return
    var url = data['url'] || ''

    function timeAgo(ts) {
      if (!ts) return ''
      var diff = Math.floor((Date.now() / 1000) - ts)
      if (diff < 60) return 'just now'
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
      if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago'
      return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function formatScore(n) {
      n = parseInt(n) || 0
      if (n >= 10000) return (n / 1000).toFixed(1) + 'k'
      if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
      return String(n)
    }

    function fixUrl(u) {
      if (!u) return ''
      return u.replace(/&amp;/g, '&')
    }

    function searchBar() {
      return html`
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
          <form style="display: flex; gap: 0; max-width: 480px;" action="">
            <input style="flex: 1; padding: 12px 18px; border: 2px solid #eee; border-radius: 24px 0 0 24px; font: 400 15px/1 inherit; outline: none;" type="text" name="uri" placeholder="Try another URL..." />
            <button style="background: #ff4500; color: #fff; border: none; border-radius: 0 24px 24px 0; padding: 12px 24px; font: 600 15px/1 inherit; cursor: pointer;" type="submit">Go</button>
          </form>
        </div>
      `
    }

    var styles = html`<style>
      .rd-wrap { font-family: -apple-system, sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px; }
      .rd-sub-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
      .rd-sub-icon { width: 48px; height: 48px; border-radius: 50%; background: #ff4500; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 700; color: #fff; flex-shrink: 0; }
      .rd-sub-name { font-size: 22px; font-weight: 700; color: #1a1a2e; }
      .rd-sub-prefix { font-size: 13px; color: #888; }
      .rd-sort { display: flex; gap: 4px; margin-bottom: 16px; }
      .rd-sort-btn { background: #f6f7f8; border: none; border-radius: 20px; padding: 6px 14px; font: 600 13px/1 inherit; color: #878a8c; cursor: pointer; text-decoration: none; }
      .rd-sort-btn:hover { background: #eee; }
      .rd-sort-active { background: #eee; color: #1a1a2e; }

      .rd-post { background: #fff; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; display: flex; transition: border-color 0.15s; }
      .rd-post:hover { border-color: #ccc; }
      .rd-vote { width: 40px; background: #fafafa; border-radius: 8px 0 0 8px; display: flex; flex-direction: column; align-items: center; padding: 8px 4px; gap: 2px; flex-shrink: 0; }
      .rd-vote-btn { background: none; border: none; color: #878a8c; font-size: 14px; cursor: pointer; }
      .rd-score { font-size: 12px; font-weight: 700; color: #1a1a2e; }
      .rd-post-body { flex: 1; padding: 10px 12px; min-width: 0; }
      .rd-post-meta { font-size: 12px; color: #878a8c; margin-bottom: 4px; }
      .rd-post-meta a { color: #1a1a2e; font-weight: 600; text-decoration: none; }
      .rd-post-meta a:hover { text-decoration: underline; }
      .rd-post-title { font-size: 17px; font-weight: 500; color: #1a1a2e; line-height: 1.35; margin-bottom: 6px; cursor: pointer; }
      .rd-post-title:hover { color: #0079d3; }
      .rd-preview { border-radius: 6px; overflow: hidden; margin-bottom: 8px; max-height: 500px; }
      .rd-preview img { width: 100%; display: block; object-fit: contain; max-height: 500px; }
      .rd-selftext { background: #f6f7f8; border-radius: 6px; padding: 10px 12px; font-size: 14px; line-height: 1.5; color: #1a1a2e; margin-bottom: 8px; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
      .rd-actions { display: flex; gap: 4px; }
      .rd-action { background: none; border: none; font: 700 12px/1 inherit; color: #878a8c; cursor: pointer; padding: 4px 6px; border-radius: 2px; text-decoration: none; }
      .rd-action:hover { background: #f6f7f8; }
      .rd-domain { font-size: 12px; color: #0079d3; margin-left: 4px; }
      .rd-flair { background: #edeff1; color: #1a1a2e; font-size: 12px; font-weight: 500; padding: 2px 8px; border-radius: 12px; margin-right: 6px; }

      .rd-comment { margin-left: 0; margin-bottom: 12px; }
      .rd-comment-inner { border-left: 2px solid #edeff1; padding-left: 14px; }
      .rd-comment-meta { font-size: 12px; color: #878a8c; margin-bottom: 4px; }
      .rd-comment-author { font-weight: 600; color: #1a1a2e; }
      .rd-comment-body { font-size: 14px; line-height: 1.6; color: #1a1a2e; white-space: pre-wrap; }
      .rd-comment-score { font-size: 12px; color: #878a8c; margin-top: 4px; }
    </style>`

    function loading(msg) {
      render(container, html`${styles}<div class="rd-wrap" style="text-align: center; padding: 60px; color: #888;">${msg}</div>`)
    }

    // Fetch via JSONP (Reddit blocks CORS)
    function fetchReddit(jsonUrl, callback) {
      var cbName = '__rdCb' + Date.now() + Math.random().toString(36).slice(2, 6)
      var called = false
      window[cbName] = function(data) {
        if (called) return
        called = true
        delete window[cbName]
        callback(data)
      }
      var s = document.createElement('script')
      s.src = jsonUrl + (jsonUrl.indexOf('?') > -1 ? '&' : '?') + 'jsonp=' + cbName + '&raw_json=1'
      s.onerror = function() {
        if (called) return
        called = true
        delete window[cbName]
        console.warn('[reddit-pane] JSONP failed for:', jsonUrl)
        callback(null)
      }
      document.head.appendChild(s)
      // Timeout fallback
      setTimeout(function() {
        if (called) return
        called = true
        delete window[cbName]
        console.warn('[reddit-pane] JSONP timeout for:', jsonUrl)
        callback(null)
      }, 10000)
    }

    // ========== DETECT URL PATTERN ==========
    // /r/subreddit/comments/id/slug — single post with comments
    var postMatch = url.match(/reddit\.com\/r\/([\w]+)\/comments\/([\w]+)/)
    // /r/subreddit — subreddit listing
    var subMatch = url.match(/reddit\.com\/r\/([\w]+)\/?$/)
    // reddit.com or reddit.com/ — front page
    var frontMatch = /reddit\.com\/?$/.test(url)

    // ========== SINGLE POST ==========
    if (postMatch) {
      var sub = postMatch[1], postId = postMatch[2]
      loading('Loading post...')
      // Reddit returns [post_listing, comments_listing] for post URLs
      var postUrl = 'https://www.reddit.com/r/' + sub + '/comments/' + postId + '.json'
      fetchReddit(postUrl, function(data) {
        if (!data || !Array.isArray(data) || data.length < 2) {
          render(container, html`${styles}<div class="rd-wrap" style="text-align: center; padding: 60px; color: #c44;">Failed to load post. Reddit may be blocking this request.</div>`)
          return
        }
        var post = data[0].data.children[0].data
        var comments = data[1].data.children.filter(function(c) { return c.kind === 't1' }).map(function(c) { return c.data })

        var preview = ''
        if (post.preview && post.preview.images && post.preview.images[0]) {
          preview = fixUrl(post.preview.images[0].source.url)
        }

        render(container, html`
          ${styles}
          <div class="rd-wrap">
            <div class="rd-post-meta">
              <a href="${'?uri=https://www.reddit.com/r/' + post.subreddit}">r/${post.subreddit}</a>
              \u00B7 Posted by u/${post.author} \u00B7 ${timeAgo(post.created_utc)}
            </div>
            <h1 style="font-size: 22px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px;">
              ${post.link_flair_text ? html`<span class="rd-flair">${post.link_flair_text}</span>` : null}
              ${post.title}
            </h1>
            <div style="margin-bottom: 12px; font-size: 14px; color: #878a8c;">
              \u2B06 ${formatScore(post.score)} \u00B7 ${post.num_comments} comments
            </div>

            ${preview ? html`<div class="rd-preview"><img src="${preview}" alt="" /></div>` : null}
            ${post.selftext ? html`<div class="rd-selftext">${post.selftext.slice(0, 3000)}</div>` : null}

            ${comments.length > 0 ? html`
              <h3 style="font-size: 15px; font-weight: 600; color: #1a1a2e; margin: 24px 0 12px;">\uD83D\uDCAC ${post.num_comments} comments</h3>
              ${comments.slice(0, 25).map(function(c) {
                return html`
                  <div class="rd-comment">
                    <div class="rd-comment-inner">
                      <div class="rd-comment-meta">
                        <span class="rd-comment-author">${c.author}</span> \u00B7 ${timeAgo(c.created_utc)}
                      </div>
                      <div class="rd-comment-body">${(c.body || '').slice(0, 1000)}</div>
                      <div class="rd-comment-score">\u2B06 ${formatScore(c.score)}</div>
                    </div>
                  </div>
                `
              })}
            ` : null}
            ${searchBar()}
          </div>
        `)
      })
      return
    }

    // ========== SUBREDDIT ==========
    if (subMatch || frontMatch) {
      var sub = subMatch ? subMatch[1] : 'popular'
      loading('Loading r/' + sub + '...')
      var listUrl = 'https://www.reddit.com/r/' + sub + '/hot.json?limit=25'
      fetchReddit(listUrl, function(listing) {
        if (!listing || !listing.data) {
          render(container, html`${styles}<div class="rd-wrap" style="text-align: center; padding: 60px; color: #c44;">Failed to load r/${sub}. Reddit may be blocking this request.</div>`)
          return
        }
        var posts = listing.data.children.map(function(c) { return c.data })

        render(container, html`
          ${styles}
          <div class="rd-wrap">
            <div class="rd-sub-header">
              <div class="rd-sub-icon">${sub.charAt(0).toUpperCase()}</div>
              <div>
                <div class="rd-sub-name">${sub}</div>
                <div class="rd-sub-prefix">r/${sub}</div>
              </div>
            </div>

            <div class="rd-sort">
              ${['hot', 'new', 'top'].map(function(s) {
                return html`<a class="rd-sort-btn" href="${'?uri=https://www.reddit.com/r/' + sub}">${s === 'hot' ? '\uD83D\uDD25' : s === 'new' ? '\u2728' : '\uD83D\uDCC8'} ${s.charAt(0).toUpperCase() + s.slice(1)}</a>`
              })}
            </div>

            ${posts.map(function(post) {
              var preview = ''
              if (post.preview && post.preview.images && post.preview.images[0]) {
                preview = fixUrl(post.preview.images[0].source.url)
              }
              var thumb = post.thumbnail
              if (thumb === 'self' || thumb === 'default' || thumb === 'nsfw' || thumb === 'spoiler' || !thumb) thumb = ''
              else thumb = fixUrl(thumb)

              var postUrl = '?uri=https://www.reddit.com' + post.permalink

              return html`
                <div class="rd-post">
                  <div class="rd-vote">
                    <button class="rd-vote-btn">\u25B2</button>
                    <span class="rd-score">${formatScore(post.score)}</span>
                    <button class="rd-vote-btn">\u25BC</button>
                  </div>
                  <div class="rd-post-body">
                    <div class="rd-post-meta">
                      <a href="${'?uri=https://www.reddit.com/r/' + post.subreddit}">r/${post.subreddit}</a>
                      \u00B7 u/${post.author} \u00B7 ${timeAgo(post.created_utc)}
                    </div>
                    <a class="rd-post-title" href="${postUrl}" style="text-decoration: none; display: block;">
                      ${post.link_flair_text ? html`<span class="rd-flair">${post.link_flair_text}</span>` : null}
                      ${post.title}
                    </a>
                    ${preview ? html`<div class="rd-preview"><img src="${preview}" alt="" loading="lazy" /></div>` : null}
                    ${post.selftext && !preview ? html`<div class="rd-selftext">${post.selftext.slice(0, 300)}</div>` : null}
                    <div class="rd-actions">
                      <a class="rd-action" href="${postUrl}">\uD83D\uDCAC ${formatScore(post.num_comments)} Comments</a>
                      ${post.domain && !post.is_self ? html`<span class="rd-domain">${post.domain}</span>` : null}
                    </div>
                  </div>
                </div>
              `
            })}
            ${searchBar()}
          </div>
        `)
      })
      return
    }

    // Fallback
    render(container, html`<div style="padding: 40px; color: #888;">Reddit URL not recognized</div>`)
  }
}
