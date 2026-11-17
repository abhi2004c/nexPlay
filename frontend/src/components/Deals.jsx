import { useEffect, useState } from 'react'
import { api } from '../api'

const usd = (n) => (n === 0 ? 'Free' : `$${n.toFixed(2)}`)
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

export default function Deals({ slug }) {
  const [d, setD] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setD(null)
    setFailed(false)
    api(`/titles/${slug}/deals/`).then(setD).catch(() => setFailed(true))
  }, [slug])

  if (failed) return null
  if (!d) return <section className="panel"><h2>Where to buy</h2><p className="muted">Checking prices…</p></section>
  if (!d.available) return null

  if (d.free) {
    return (
      <section className="panel">
        <h2>Where to play</h2>
        <div className="stats">
          <div><span className="muted">Price</span><strong className="freebadge">Free to play</strong></div>
          {d.current_players != null && (
            <div>
              <span className="muted">Playing now (Steam)</span>
              <strong>{d.current_players.toLocaleString()}</strong>
            </div>
          )}
        </div>
        {d.links.length > 0 ? (
          <p className="actions">
            {d.links.map((l) => (
              <a key={l.url} className="btn" href={l.url} target="_blank" rel="noreferrer">Get it on {l.name}</a>
            ))}
          </p>
        ) : (
          <p className="muted">No download links on file.</p>
        )}
        <p className="muted small">Some free-to-play games include optional in-game purchases.</p>
      </section>
    )
  }

  const best = d.current_lowest
  const atLow = d.lowest_ever && best != null && best <= d.lowest_ever.price

  return (
    <section className="panel">
      <h2>Where to buy</h2>

      <div className="stats">
        {best != null && (
          <div><span className="muted">Best price now</span><strong>{usd(best)}</strong></div>
        )}
        {d.lowest_ever && (
          <div>
            <span className="muted">Lowest ever</span>
            <strong>{usd(d.lowest_ever.price)}</strong>
            <span className="muted">{fmtDate(d.lowest_ever.date)}</span>
            {atLow && <span className="tag">At its lowest now</span>}
          </div>
        )}
        {d.current_players != null && (
          <div>
            <span className="muted">Playing now (Steam)</span>
            <strong>{d.current_players.toLocaleString()}</strong>
          </div>
        )}
      </div>

      {d.deals.length > 0 ? (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Store</th><th>Price</th><th>Discount</th><th /></tr></thead>
            <tbody>
              {d.deals.map((x) => (
                <tr key={x.url}>
                  <td>{x.store}</td>
                  <td><strong>{usd(x.price)}</strong>{x.savings > 0 && <s className="muted"> {usd(x.retail_price)}</s>}</td>
                  <td>{x.savings > 0 ? `-${x.savings}%` : ''}</td>
                  <td><a className="btn" href={x.url} target="_blank" rel="noreferrer">Buy</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">{d.error || 'No PC store listings found for this game.'}</p>
      )}
      <p className="muted small">PC store prices in USD via <a href="https://www.cheapshark.com">CheapShark</a>; updated hourly. Console prices aren't covered.</p>
    </section>
  )
}
