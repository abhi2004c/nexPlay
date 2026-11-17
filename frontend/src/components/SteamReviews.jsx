import { useEffect, useState } from 'react'
import { api } from '../api'
import SteamIcon from './SteamIcon.jsx'

const monthName = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })

const tone = (p) => (p == null ? 'neutral' : p >= 70 ? 'positive' : p >= 40 ? 'neutral' : 'negative')

export default function SteamReviews({ slug }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    setD(null)
    api(`/titles/${slug}/steam-reviews/`).then(setD).catch(() => setD({ available: false }))
  }, [slug])

  if (d && !d.available) return null

  const s = d?.summary
  const has = s && s.total > 0

  return (
    <section className="panel steampanel">
      <h2><SteamIcon size={22} /> Steam reviews</h2>
      <p className="muted small">
        Review totals from players on Steam, not NexPlay members. They are not included in NexPlay ratings.
      </p>

      {!d && <p className="muted">Loading Steam reviews…</p>}
      {d?.error && <p className="muted">Steam review totals are unavailable right now.</p>}
      {d && !d.error && !has && <p className="muted">No Steam reviews yet.</p>}

      {has && (
        <>
          <div className="stats">
            {s.label && <div><span className="muted">Overall</span><strong className={tone(s.percent_positive)}>{s.label}</strong></div>}
            <div><span className="muted">Positive</span><strong>{s.percent_positive}%</strong></div>
            <div><span className="muted">Reviews</span><strong>{s.total.toLocaleString()}</strong></div>
            {d.recent?.percent_positive != null && (
              <div>
                <span className="muted">Last 30 days</span>
                <strong>{d.recent.percent_positive}% positive</strong>
                <span className="muted">{d.recent.total.toLocaleString()} reviews</span>
              </div>
            )}
          </div>

          <div className="sentbar" title={`${s.positive.toLocaleString()} positive, ${s.negative.toLocaleString()} negative`}>
            <span className="positive" style={{ flex: s.positive }} />
            <span className="negative" style={{ flex: s.negative }} />
          </div>

          {d.monthly?.length > 1 && (
            <>
              <p className="muted small">Share of positive reviews by month</p>
              <div className="months">
                {d.monthly.map((m) => (
                  <div key={m.month} className="mcol" title={`${monthName(m.month)}: ${m.percent_positive ?? '–'}% positive of ${m.total.toLocaleString()}`}>
                    <div className="mbar"><span className={tone(m.percent_positive)} style={{ height: `${m.percent_positive ?? 0}%` }} /></div>
                    <small className="muted">{monthName(m.month)}</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {d && (
        <a className="steamlink" href={d.steam_url} target="_blank" rel="noreferrer">
          <SteamIcon size={16} /> Read the reviews on Steam
        </a>
      )}
    </section>
  )
}
