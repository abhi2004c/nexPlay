import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RatingChips from './RatingChips.jsx'
import WatchButton from './WatchButton.jsx'
import { cleanDescription } from '../text.js'

const SLIDE_MS = 7000

// Featured banner: a few titles that rotate on their own (paused on hover/focus, and for users who
// prefer reduced motion). The artwork is also used, blurred, as the banner background.
export default function Hero({ titles }) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = titles.length

  useEffect(() => {
    if (paused || count < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setI((n) => (n + 1) % count), SLIDE_MS)
    return () => clearInterval(id)
  }, [paused, count, i])

  if (count === 0) return null
  const t = titles[i % count]
  const year = t.release_date?.slice(0, 4)

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured titles"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hero-bg" style={{ backgroundImage: `url(${t.poster_url})` }} key={`bg-${t.id}`} />
      <div className="hero-shade" />
      <div className="hero-body" key={t.id}>
        <div className="hero-text">
          <span className="hero-kicker">Featured {t.media_type === 'movie' ? 'movie' : 'game'}</span>
          <h1>{t.name}</h1>
          <p className="muted">
            {year}{t.genres.length > 0 && ` · ${t.genres.slice(0, 3).join(' · ')}`}
          </p>
          <RatingChips t={t} empty={false} />
          <p className="hero-desc">{cleanDescription(t.description, { multiline: false })}</p>
          <div className="actions">
            <Link className="btn" to={`/title/${t.slug}`}>View details</Link>
            <WatchButton slug={t.slug} name={t.name} variant="full" />
          </div>
        </div>
        {t.poster_url && (
          <Link to={`/title/${t.slug}`} className={`hero-art ${t.media_type}`} tabIndex={-1} aria-hidden="true">
            <img src={t.poster_url} alt="" />
          </Link>
        )}
      </div>
      {count > 1 && (
        <div className="hero-dots" role="tablist" aria-label="Choose a featured title">
          {titles.map((x, n) => (
            <button
              key={x.id}
              role="tab"
              aria-selected={n === i % count}
              aria-label={`Show ${x.name}`}
              className={n === i % count ? 'on' : ''}
              onClick={() => setI(n)}
            />
          ))}
        </div>
      )}
    </section>
  )
}
