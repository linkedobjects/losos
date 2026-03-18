import { html, render, onUnmount } from 'https://losos.org/losos/html.js'

var API = 'https://mempool.space/api'

export default {
  label: 'Bitcoin',
  icon: '\u20BF',

  canHandle(subject, store) {
    var node = store.get(subject.value)
    if (!node) return false
    var url = node['url'] || ''
    return /mempool\.space/.test(url) || /blockchain\.info/.test(url)
  },

  render(subject, lionStore, container, rawData) {
    var data = rawData || window.__jrData
    if (!data) return
    var url = data['url'] || ''

    function formatBtc(sats) {
      if (sats === undefined || sats === null) return '0'
      return (sats / 100000000).toFixed(8) + ' BTC'
    }

    function formatSats(n) {
      return (n || 0).toLocaleString() + ' sats'
    }

    function formatNumber(n) {
      return (n || 0).toLocaleString()
    }

    function formatSize(bytes) {
      if (bytes > 1048576) return (bytes / 1048576).toFixed(2) + ' MB'
      if (bytes > 1024) return (bytes / 1024).toFixed(1) + ' KB'
      return bytes + ' B'
    }

    function timeAgo(ts) {
      if (!ts) return ''
      var diff = Math.floor(Date.now() / 1000 - ts)
      if (diff < 60) return 'just now'
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago'
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago'
      return Math.floor(diff / 86400) + 'd ago'
    }

    function truncHash(h) {
      if (!h) return ''
      return h.slice(0, 8) + '\u2026' + h.slice(-8)
    }

    function searchBar() {
      return html`
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #1a1a2e;">
          <form style="display: flex; gap: 0; max-width: 480px;" action="">
            <input style="flex: 1; padding: 12px 18px; border: 2px solid #2a2a3e; border-radius: 24px 0 0 24px; font: 400 15px/1 inherit; outline: none; background: #12121f; color: #e0e0e0;" type="text" name="uri" placeholder="Block, tx, or address..." />
            <button style="background: #f7931a; color: #fff; border: none; border-radius: 0 24px 24px 0; padding: 12px 24px; font: 600 15px/1 inherit; cursor: pointer;" type="submit">Go</button>
          </form>
        </div>
      `
    }

    var styles = html`<style>
      .bp-wrap { font-family: -apple-system, sans-serif; max-width: 860px; margin: 0 auto; padding: 32px 20px; color: #e0e0e0; }
      .bp-title { font-size: 22px; font-weight: 700; color: #fff; margin-bottom: 4px; }
      .bp-subtitle { font-size: 14px; color: #666; margin-bottom: 24px; }
      .bp-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 10px; margin-bottom: 24px; }
      .bp-stat { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 10px; padding: 14px 16px; }
      .bp-stat-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
      .bp-stat-value { font-size: 18px; font-weight: 700; color: #f7931a; }
      .bp-stat-value-sm { font-size: 15px; font-weight: 600; color: #e0e0e0; }

      .bp-card { background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
      .bp-card-header { padding: 14px 18px; font-size: 14px; font-weight: 600; color: #fff; border-bottom: 1px solid #2a2a3e; display: flex; align-items: center; gap: 8px; }
      .bp-card-body { padding: 16px 18px; }

      .bp-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #1e1e30; font-size: 14px; }
      .bp-row:last-child { border-bottom: none; }
      .bp-row-label { color: #666; }
      .bp-row-value { color: #e0e0e0; font-family: 'SF Mono', Monaco, monospace; font-size: 13px; }
      .bp-row-value a { color: #f7931a; text-decoration: none; }
      .bp-row-value a:hover { text-decoration: underline; }

      .bp-block { display: flex; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #1e1e30; cursor: pointer; transition: background 0.1s; text-decoration: none; color: inherit; }
      .bp-block:hover { background: #1e1e30; }
      .bp-block:last-child { border-bottom: none; }
      .bp-block-height { font-weight: 700; color: #f7931a; min-width: 70px; }
      .bp-block-info { flex: 1; min-width: 0; }
      .bp-block-txs { font-size: 12px; color: #666; }
      .bp-block-time { font-size: 12px; color: #555; flex-shrink: 0; }
      .bp-block-size { font-size: 12px; color: #555; flex-shrink: 0; min-width: 60px; text-align: right; }

      .bp-tx { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #1e1e30; font-size: 13px; align-items: center; }
      .bp-tx:last-child { border-bottom: none; }
      .bp-tx-hash { font-family: monospace; color: #f7931a; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; }
      .bp-tx-hash:hover { text-decoration: underline; }
      .bp-tx-amount { color: #10b981; font-weight: 600; flex-shrink: 0; }
      .bp-tx-fee { color: #666; font-size: 12px; flex-shrink: 0; }

      .bp-io { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: start; }
      .bp-io-col { }
      .bp-io-arrow { color: #666; font-size: 20px; padding-top: 8px; }
      .bp-io-item { background: #12121f; border-radius: 6px; padding: 8px 10px; margin-bottom: 6px; font-size: 12px; font-family: monospace; }
      .bp-io-addr { color: #f7931a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: none; display: block; }
      .bp-io-addr:hover { text-decoration: underline; }
      .bp-io-amount { color: #10b981; font-weight: 600; margin-top: 2px; }

      .bp-loading { text-align: center; padding: 60px; color: #666; }
    </style>`

    function loading(msg) {
      render(container, html`${styles}<div style="background: #0e0e1a; min-height: 100vh;"><div class="bp-wrap"><div class="bp-loading">${msg}</div></div></div>`)
    }

    // ========== DETECT URL PATTERN ==========
    var txMatch = url.match(/\/tx\/([a-f0-9]{64})/)
    var blockHashMatch = url.match(/\/block\/([a-f0-9]{64})/)
    var blockHeightMatch = url.match(/\/block\/(\d+)$/)
    var addressMatch = url.match(/\/address\/([a-zA-Z0-9]+)/)
    var frontPage = /mempool\.space\/?$/.test(url)

    // ========== TRANSACTION ==========
    if (txMatch) {
      var txid = txMatch[1]
      loading('Loading transaction...')
      fetch(API + '/tx/' + txid).then(function(r) { return r.json() }).then(function(tx) {
        var totalOut = (tx.vout || []).reduce(function(s, o) { return s + (o.value || 0) }, 0)
        render(container, html`
          ${styles}
          <div style="background: #0e0e1a; min-height: 100vh;">
            <div class="bp-wrap">
              <div class="bp-title">Transaction</div>
              <div class="bp-subtitle" style="font-family: monospace; word-break: break-all;">${tx.txid}</div>

              <div class="bp-stats">
                <div class="bp-stat"><div class="bp-stat-label">Status</div><div class="bp-stat-value-sm">${tx.status && tx.status.confirmed ? '\u2705 Confirmed' : '\u23F3 Pending'}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Block</div><div class="bp-stat-value-sm"><a href="${'?uri=https://mempool.space/block/' + (tx.status && tx.status.block_height || '')}" style="color: #f7931a; text-decoration: none;">${tx.status && tx.status.block_height || 'Unconfirmed'}</a></div></div>
                <div class="bp-stat"><div class="bp-stat-label">Fee</div><div class="bp-stat-value-sm">${formatSats(tx.fee)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Size</div><div class="bp-stat-value-sm">${formatSize(tx.size || 0)} / ${formatSize(tx.weight || 0)} WU</div></div>
              </div>

              <div class="bp-card">
                <div class="bp-card-header">\u2194\uFE0F Inputs & Outputs</div>
                <div class="bp-card-body">
                  <div class="bp-io">
                    <div class="bp-io-col">
                      ${(tx.vin || []).slice(0, 10).map(function(inp) {
                        var addr = inp.prevout ? inp.prevout.scriptpubkey_address : (inp.is_coinbase ? 'Coinbase' : '?')
                        var val = inp.prevout ? inp.prevout.value : 0
                        return html`<div class="bp-io-item">
                          <a class="bp-io-addr" href="${addr !== 'Coinbase' ? '?uri=https://mempool.space/address/' + addr : '#'}">${addr}</a>
                          <div class="bp-io-amount">${formatBtc(val)}</div>
                        </div>`
                      })}
                    </div>
                    <div class="bp-io-arrow">\u2192</div>
                    <div class="bp-io-col">
                      ${(tx.vout || []).slice(0, 10).map(function(out) {
                        var addr = out.scriptpubkey_address || 'OP_RETURN'
                        return html`<div class="bp-io-item">
                          <a class="bp-io-addr" href="${addr !== 'OP_RETURN' ? '?uri=https://mempool.space/address/' + addr : '#'}">${addr}</a>
                          <div class="bp-io-amount">${formatBtc(out.value)}</div>
                        </div>`
                      })}
                    </div>
                  </div>
                </div>
              </div>
              ${searchBar()}
            </div>
          </div>
        `)
      })
      return
    }

    // ========== ADDRESS ==========
    if (addressMatch) {
      var addr = addressMatch[1]
      loading('Loading address...')
      Promise.all([
        fetch(API + '/address/' + addr).then(function(r) { return r.json() }),
        fetch(API + '/address/' + addr + '/txs').then(function(r) { return r.json() }).catch(function() { return [] })
      ]).then(function(results) {
        var info = results[0], txs = Array.isArray(results[1]) ? results[1] : []
        var funded = info.chain_stats.funded_txo_sum || 0
        var spent = info.chain_stats.spent_txo_sum || 0
        var balance = funded - spent

        render(container, html`
          ${styles}
          <div style="background: #0e0e1a; min-height: 100vh;">
            <div class="bp-wrap">
              <div class="bp-title">Address</div>
              <div class="bp-subtitle" style="font-family: monospace; word-break: break-all;">${addr}</div>

              <div class="bp-stats">
                <div class="bp-stat"><div class="bp-stat-label">Balance</div><div class="bp-stat-value">${formatBtc(balance)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Received</div><div class="bp-stat-value-sm">${formatBtc(funded)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Spent</div><div class="bp-stat-value-sm">${formatBtc(spent)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Transactions</div><div class="bp-stat-value-sm">${formatNumber(info.chain_stats.tx_count)}</div></div>
              </div>

              ${txs.length > 0 ? html`
                <div class="bp-card">
                  <div class="bp-card-header">\uD83D\uDCCB Recent Transactions</div>
                  ${txs.slice(0, 15).map(function(tx) {
                    var totalOut = (tx.vout || []).reduce(function(s, o) { return s + (o.value || 0) }, 0)
                    return html`<a class="bp-tx" href="${'?uri=https://mempool.space/tx/' + tx.txid}">
                      <span class="bp-tx-hash">${truncHash(tx.txid)}</span>
                      <span class="bp-tx-amount">${formatBtc(totalOut)}</span>
                      <span class="bp-tx-fee">${formatSats(tx.fee)} fee</span>
                    </a>`
                  })}
                </div>
              ` : null}
              ${searchBar()}
            </div>
          </div>
        `)
      })
      return
    }

    // ========== BLOCK ==========
    if (blockHashMatch || blockHeightMatch) {
      var blockId = blockHashMatch ? blockHashMatch[1] : blockHeightMatch[1]
      loading('Loading block...')

      // If height, first resolve to hash
      var blockPromise = /^\d+$/.test(blockId)
        ? fetch(API + '/block-height/' + blockId).then(function(r) { return r.text() }).then(function(hash) { return fetch(API + '/block/' + hash).then(function(r) { return r.json() }) })
        : fetch(API + '/block/' + blockId).then(function(r) { return r.json() })

      blockPromise.then(function(block) {
        return fetch(API + '/block/' + block.id + '/txs/0').then(function(r) { return r.json() }).then(function(txs) {
          return { block: block, txs: Array.isArray(txs) ? txs : [] }
        })
      }).then(function(result) {
        var block = result.block, txs = result.txs

        render(container, html`
          ${styles}
          <div style="background: #0e0e1a; min-height: 100vh;">
            <div class="bp-wrap">
              <div class="bp-title">Block ${formatNumber(block.height)}</div>
              <div class="bp-subtitle" style="font-family: monospace; word-break: break-all;">${block.id}</div>

              <div class="bp-stats">
                <div class="bp-stat"><div class="bp-stat-label">Timestamp</div><div class="bp-stat-value-sm">${new Date(block.timestamp * 1000).toLocaleString()}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Transactions</div><div class="bp-stat-value">${formatNumber(block.tx_count)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Size</div><div class="bp-stat-value-sm">${formatSize(block.size)}</div></div>
                <div class="bp-stat"><div class="bp-stat-label">Weight</div><div class="bp-stat-value-sm">${formatNumber(block.weight)} WU</div></div>
              </div>

              <div class="bp-card">
                <div class="bp-card-header">\uD83D\uDCCB Transactions (first ${txs.length})</div>
                ${txs.slice(0, 20).map(function(tx) {
                  var totalOut = (tx.vout || []).reduce(function(s, o) { return s + (o.value || 0) }, 0)
                  return html`<a class="bp-tx" href="${'?uri=https://mempool.space/tx/' + tx.txid}">
                    <span class="bp-tx-hash">${truncHash(tx.txid)}</span>
                    <span class="bp-tx-amount">${formatBtc(totalOut)}</span>
                    <span class="bp-tx-fee">${tx.fee ? formatSats(tx.fee) : 'coinbase'}</span>
                  </a>`
                })}
              </div>

              <div style="display: flex; gap: 10px; margin-top: 16px;">
                ${block.height > 0 ? html`<a href="${'?uri=https://mempool.space/block/' + (block.height - 1)}" style="padding: 8px 16px; background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 8px; color: #f7931a; text-decoration: none; font-size: 14px;">\u2190 Block ${formatNumber(block.height - 1)}</a>` : null}
                <a href="${'?uri=https://mempool.space/block/' + (block.height + 1)}" style="padding: 8px 16px; background: #1a1a2e; border: 1px solid #2a2a3e; border-radius: 8px; color: #f7931a; text-decoration: none; font-size: 14px;">Block ${formatNumber(block.height + 1)} \u2192</a>
              </div>
              ${searchBar()}
            </div>
          </div>
        `)
      })
      return
    }

    // ========== FRONT PAGE / DASHBOARD ==========
    loading('Loading Bitcoin dashboard...')
    Promise.all([
      fetch(API + '/v1/fees/recommended').then(function(r) { return r.json() }),
      fetch(API + '/v1/prices').then(function(r) { return r.json() }),
      fetch(API + '/blocks/tip/height').then(function(r) { return r.text() }),
      fetch(API + '/v1/blocks').then(function(r) { return r.json() }).catch(function() { return [] })
    ]).then(function(results) {
      var fees = results[0]
      var prices = results[1]
      var tipHeight = results[2]
      var recentBlocks = Array.isArray(results[3]) ? results[3] : []

      render(container, html`
        ${styles}
        <div style="background: #0e0e1a; min-height: 100vh;">
          <div class="bp-wrap">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
              <span style="font-size: 32px;">\u20BF</span>
              <div>
                <div class="bp-title">Bitcoin</div>
                <div class="bp-subtitle">mempool.space explorer</div>
              </div>
            </div>

            <div class="bp-stats">
              <div class="bp-stat"><div class="bp-stat-label">Price (USD)</div><div class="bp-stat-value">$${formatNumber(prices.USD)}</div></div>
              <div class="bp-stat"><div class="bp-stat-label">Block Height</div><div class="bp-stat-value"><a href="${'?uri=https://mempool.space/block/' + tipHeight}" style="color: #f7931a; text-decoration: none;">${formatNumber(parseInt(tipHeight))}</a></div></div>
              <div class="bp-stat"><div class="bp-stat-label">Fast Fee</div><div class="bp-stat-value-sm">${fees.fastestFee} sat/vB</div></div>
              <div class="bp-stat"><div class="bp-stat-label">Economy Fee</div><div class="bp-stat-value-sm">${fees.economyFee} sat/vB</div></div>
              <div class="bp-stat"><div class="bp-stat-label">EUR</div><div class="bp-stat-value-sm">\u20AC${formatNumber(prices.EUR)}</div></div>
              <div class="bp-stat"><div class="bp-stat-label">GBP</div><div class="bp-stat-value-sm">\u00A3${formatNumber(prices.GBP)}</div></div>
            </div>

            <div class="bp-card">
              <div class="bp-card-header">\u26CF Recent Blocks</div>
              ${recentBlocks.slice(0, 15).map(function(b) {
                return html`<a class="bp-block" href="${'?uri=https://mempool.space/block/' + b.id}">
                  <span class="bp-block-height">${formatNumber(b.height)}</span>
                  <div class="bp-block-info">
                    <div class="bp-block-txs">${formatNumber(b.tx_count)} transactions</div>
                  </div>
                  <span class="bp-block-size">${formatSize(b.size)}</span>
                  <span class="bp-block-time">${timeAgo(b.timestamp)}</span>
                </a>`
              })}
            </div>
            ${searchBar()}
          </div>
        </div>
      `)
    })
  }
}
