import { useEffect, useState } from 'react'
import { api } from '../api'
import SteamIcon from './SteamIcon.jsx'

export default function SteamReviews({ slug }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    setD(null)
    api(`/titles/${slug}/steam-reviews/`).then(setD).catch(() => setD({ available: false }))
  }, [slug])

  if (d && !d.available) return null

  return (
    <section className="panel steampanel">
      <h2><SteamIcon size={22} /> Steam reviews</h2>
      <p className="muted small">
        These reviews are written by players on Steam, not NexPlay members, and are not included in NexPlay ratings.
      </p>

      {!d && <p className="muted">Loading Steam reviews…</p>}

      {d?.error && <p className="muted">Steam reviews are unavailable right now. <a href={d.steam_url} target="_blank" rel="noreferrer">View them on Steam</a>.</p>}

      {d?.summary && d.summary.total > 0 && (
        <div className="stats">
          <div>
            <span className="muted">Overall</span>
            <strong>{d.summary.label || '—'}</strong>
          </div>
          <div>
            <span className="muted">Positive</span>
            <strong>{d.summary.percent_positive}%</strong>
          </div>
          <div>
            <span className="muted">Reviews</span>
            <strong>{d.summary.total.toLocaleString()}</strong>
          </div>
        </div>
      )}
      {d?.summary?.total > 0 && (
        <div className="sentbar" title={`${d.summary.positive.toLocaleString()} positive, ${d.summary.negative.toLocaleString()} negative`}>
          <span className="positive" style={{ flex: d.summary.positive }} />
          <span className="negative" style={{ flex: d.summary.negative }} />
        </div>
      )}

      {d?.reviews?.map((r, i) => (
        <div className="review" key={i}>
          <div className="steamhead">
            <SteamIcon size={16} />
            <strong className={r.recommended ? 'pos' : 'neg'}>{r.recommended ? 'Recommended' : 'Not recommended'}</strong>
            <span className="muted">· Steam user · {r.hours} hrs on record{r.helpful ? ` · ${r.helpful.toLocaleString()} found helpful` : ''}</span>
          </div>
          <p>{r.text}</p>
        </div>
      ))}

      {d && !d.error && (
        <a className="steamlink" href={d.steam_url} target="_blank" rel="noreferrer">
          <SteamIcon size={16} /> Read all reviews on Steam
        </a>
      )}
    </section>
  )
}
