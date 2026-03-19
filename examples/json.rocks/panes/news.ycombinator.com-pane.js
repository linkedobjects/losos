import { html, render, onUnmount } from 'https://losos.org/losos/html.js'

var HN_API = 'https://hacker-news.firebaseio.com/v0'

export default {
  label: 'HN',
  icon: '\uD83D\uDFE7',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    if (!node) return false
    var url = node['url'] || ''
    return /news\.ycombinator\.com/.test(url) || /hacker-news/.test(url)
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData || window.__jrData
    if (!data) return
    var url = data['url'] || ''

    function timeAgo(ts) {
      if (!ts) return ''
      var diff = Math.floor(Date.now() / 1000 - ts)
      if (diff < 60) return 'just now'
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
      if (diff < 2592000) return Math.floor(diff / 86400) + 'd ago'
      return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    }

    function hostname(u) {
      try { return new URL(u).hostname.replace('www.', '') } catch(e) { return '' }
    }

    function fetchItem(id) {
      return fetch(HN_API + '/item/' + id + '.json').then(function(r) { return r.json() })
    }

    function searchBar() {
      return html`
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #eee;">
          <form style="display: flex; gap: 0; max-width: 480px;" action="">
            <input style="flex: 1; padding: 12px 18px; border: 2px solid #eee; border-radius: 24px 0 0 24px; font: 400 15px/1 inherit; outline: none;" type="text" name="uri" placeholder="Try another URL..." />
            <button style="background: #ff6600; color: #fff; border: none; border-radius: 0 24px 24px 0; padding: 12px 24px; font: 600 15px/1 inherit; cursor: pointer;" type="submit">Go</button>
          </form>
        </div>
      `
    }

    var styles = html`<style>
      .hn-wrap { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px 40px; }
      .hn-header { background: linear-gradient(135deg, #ff6600, #e85d04); padding: 14px 20px; display: flex; align-items: center; gap: 14px; border-radius: 12px; margin-bottom: 20px; box-shadow: 0 2px 12px rgba(255,102,0,0.2); }
      .hn-logo { font-weight: 800; font-size: 18px; color: #fff; text-decoration: none; background: rgba(255,255,255,0.2); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 6px; }
      .hn-nav { font-size: 14px; color: rgba(255,255,255,0.9); font-weight: 500; }
      .hn-nav a { color: rgba(255,255,255,0.8); text-decoration: none; margin: 0 6px; transition: color 0.15s; }
      .hn-nav a:hover { color: #fff; }

      .hn-stories { display: flex; flex-direction: column; gap: 8px; }
      .hn-story { display: flex; gap: 14px; padding: 14px 18px; background: #fff; border-radius: 10px; border: 1px solid #f0f0f0; transition: all 0.15s; }
      .hn-story:hover { border-color: #ff6600; box-shadow: 0 2px 8px rgba(0,0,0,0.04); transform: translateY(-1px); }
      .hn-rank { color: #ff6600; font-weight: 700; font-size: 15px; min-width: 28px; text-align: center; padding-top: 2px; }
      .hn-story-body { flex: 1; min-width: 0; }
      .hn-story-title { font-size: 15px; font-weight: 500; line-height: 1.4; }
      .hn-story-title a { color: #1a1a2e; text-decoration: none; }
      .hn-story-title a:hover { color: #ff6600; }
      .hn-story-domain { font-size: 12px; color: #aaa; margin-left: 6px; }
      .hn-story-domain a { color: #aaa; text-decoration: none; }
      .hn-story-domain a:hover { color: #ff6600; }
      .hn-story-meta { font-size: 12px; color: #999; margin-top: 6px; display: flex; gap: 6px; align-items: center; }
      .hn-story-meta a { color: #999; text-decoration: none; }
      .hn-story-meta a:hover { color: #ff6600; }
      .hn-score-pill { background: #fff5f0; color: #ff6600; font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 10px; }
      .hn-vote { color: #ccc; cursor: pointer; font-size: 14px; padding-top: 2px; }

      .hn-item-wrap { background: #fff; border-radius: 12px; border: 1px solid #f0f0f0; padding: 24px; }
      .hn-item-title { font-size: 20px; font-weight: 600; color: #1a1a2e; margin-bottom: 6px; line-height: 1.3; }
      .hn-item-title a { color: #1a1a2e; text-decoration: none; }
      .hn-item-title a:hover { color: #ff6600; }
      .hn-item-meta { font-size: 13px; color: #999; margin-bottom: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .hn-item-meta a { color: #999; text-decoration: none; }
      .hn-item-meta a:hover { color: #ff6600; }
      .hn-item-text { font-size: 15px; color: #444; line-height: 1.7; margin-bottom: 20px; white-space: pre-wrap; background: #fafafa; padding: 16px 20px; border-radius: 8px; }

      .hn-comments-title { font-size: 14px; font-weight: 600; color: #1a1a2e; margin: 24px 0 14px; padding-bottom: 8px; border-bottom: 1px solid #f0f0f0; }
      .hn-comment { margin-bottom: 14px; }
      .hn-comment-indent { border-left: 2px solid #f0f0f0; padding-left: 16px; margin-left: 0; }
      .hn-comment-meta { font-size: 12px; color: #999; margin-bottom: 6px; }
      .hn-comment-meta a { color: #ff6600; text-decoration: none; font-weight: 500; }
      .hn-comment-body { font-size: 14px; color: #333; line-height: 1.6; white-space: pre-wrap; }
      .hn-comment-toggle { font-size: 10px; color: #828282; cursor: pointer; background: none; border: none; font-family: inherit; }
    </style>`

    // ========== DETECT URL PATTERN ==========
    var itemMatch = url.match(/item\?id=(\d+)/) || url.match(/news\.ycombinator\.com\/(\d+)/)
    var frontPage = /news\.ycombinator\.com\/?$/.test(url) || /news\.ycombinator\.com\/(news|newest|best|ask|show)/.test(url)

    // ========== SINGLE ITEM (story + comments) ==========
    if (itemMatch) {
      var itemId = itemMatch[1]
      render(container, html`${styles}<div class="hn-wrap" style="text-align: center; padding: 60px; color: #828282;">Loading item ${itemId}...</div>`)

      fetchItem(itemId).then(function(item) {
        if (!item) return
        // Fetch top-level comments
        var kidIds = (item.kids || []).slice(0, 30)
        return Promise.all(kidIds.map(fetchItem)).then(function(comments) {
          comments = comments.filter(Boolean).filter(function(c) { return !c.deleted && !c.dead })
          renderItem(item, comments)
        })
      })
      return
    }

    // ========== FRONT PAGE ==========
    if (frontPage || true) { // fallback: always show front page for HN URLs
      render(container, html`${styles}<div class="hn-wrap" style="text-align: center; padding: 60px; color: #828282;">Loading Hacker News...</div>`)

      fetch(HN_API + '/topstories.json')
        .then(function(r) { return r.json() })
        .then(function(ids) {
          return Promise.all(ids.slice(0, 30).map(fetchItem))
        })
        .then(function(stories) {
          stories = stories.filter(Boolean)
          renderFrontPage(stories)
        })
        .catch(function() {
          render(container, html`${styles}<div class="hn-wrap" style="text-align: center; padding: 60px; color: #c44;">Failed to load Hacker News.</div>`)
        })
      return
    }

    function renderFrontPage(stories) {
      render(container, html`
        ${styles}
        <div class="hn-wrap">
          <div class="hn-header">
            <a class="hn-logo" href="?uri=https://news.ycombinator.com">Y</a>
            <span class="hn-nav">
              <strong>Hacker News</strong>
              <a href="?uri=https://news.ycombinator.com/newest">new</a> |
              <a href="?uri=https://news.ycombinator.com/best">best</a> |
              <a href="?uri=https://news.ycombinator.com/ask">ask</a> |
              <a href="?uri=https://news.ycombinator.com/show">show</a>
            </span>
          </div>
          <div class="hn-stories">
            ${stories.map(function(s, i) {
              var domain = s.url ? hostname(s.url) : ''
              var itemUrl = '?uri=https://news.ycombinator.com/item%3Fid=' + s.id
              return html`
                <div class="hn-story">
                  <span class="hn-rank">${i + 1}.</span>
                  <span class="hn-vote">\u25B2</span>
                  <div class="hn-story-body">
                    <div class="hn-story-title">
                      <a href="${s.url || itemUrl}">${s.title}</a>
                      ${domain ? html`<span class="hn-story-domain">(<a href="${'?uri=https://' + domain}">${domain}</a>)</span>` : null}
                    </div>
                    <div class="hn-story-meta">
                      <span class="hn-score-pill">\u2B06 ${s.score}</span>
                      <a href="${'?uri=https://news.ycombinator.com/user?id=' + s.by}">${s.by}</a>
                      \u00B7 ${timeAgo(s.time)}
                      \u00B7 <a href="${itemUrl}">\uD83D\uDCAC ${s.descendants || 0}</a>
                    </div>
                  </div>
                </div>
              `
            })}
          </div>
          ${searchBar()}
        </div>
      `)
    }

    function renderItem(item, comments) {
      var domain = item.url ? hostname(item.url) : ''

      render(container, html`
        ${styles}
        <div class="hn-wrap">
          <div class="hn-header">
            <a class="hn-logo" href="?uri=https://news.ycombinator.com">Y</a>
            <span class="hn-nav"><strong>Hacker News</strong></span>
          </div>
          <div class="hn-item-wrap">
            <div class="hn-item-title">
              <a href="${item.url || '#'}">${item.title}</a>
              ${domain ? html`<span class="hn-story-domain">(<a href="${'?uri=https://' + domain}">${domain}</a>)</span>` : null}
            </div>
            <div class="hn-item-meta">
              <span class="hn-score-pill">\u2B06 ${item.score}</span>
              <a href="${'?uri=https://news.ycombinator.com/user?id=' + item.by}">${item.by}</a>
              \u00B7 ${timeAgo(item.time)}
              \u00B7 \uD83D\uDCAC ${item.descendants || 0} comments
            </div>
            ${item.text ? html`<div class="hn-item-text">${item.text.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')}</div>` : null}

            ${comments.length > 0 ? html`
              <div class="hn-comments-title">${comments.length} top-level comments</div>
              ${comments.map(function(c) {
                var body = (c.text || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
                return html`
                  <div class="hn-comment">
                    <div class="hn-comment-indent">
                      <div class="hn-comment-meta">
                        <a href="${'?uri=https://news.ycombinator.com/user?id=' + c.by}">${c.by}</a> ${timeAgo(c.time)}
                      </div>
                      <div class="hn-comment-body">${body.slice(0, 1500)}</div>
                    </div>
                  </div>
                `
              })}
            ` : null}
          </div>
          ${searchBar()}
        </div>
      `)
    }
  }
}
