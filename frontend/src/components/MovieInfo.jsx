import { useEffect, useState } from 'react'
import { api } from '../api'

function Trailer({ trailer }) {
  const [playing, setPlaying] = useState(false)
  if (!trailer) return null
  return playing ? (
    <div className="trailer yt">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
        title={trailer.name}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  ) : (
    <button className="trailer thumb" onClick={() => setPlaying(true)} aria-label={`Play ${trailer.name}`}>
      <img src={`https://i.ytimg.com/vi/${trailer.key}/hqdefault.jpg`} alt="" />
      <span className="play">▶</span>
      <em>{trailer.name}</em>
    </button>
  )
}

function Rating({ label, value, sub, href, cls }) {
  const body = (
    <>
      <span className={`ratelabel ${cls || ''}`}>{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted small">{sub}</span>}
    </>
  )
  return href ? (
    <a className="rating" href={href} target="_blank" rel="noreferrer">{body}</a>
  ) : (
    <div className="rating">{body}</div>
  )
}

export default function MovieInfo({ slug, nexplay }) {
  const [d, setD] = useState(null)

  useEffect(() => {
    setD(null)
    api(`/titles/${slug}/movie-info/`).then(setD).catch(() => setD({ available: false }))
  }, [slug])

  if (d && !d.available) return null

  const imdb = d?.imdb
  const hasRatings = imdb || d?.tmdb?.score || nexplay.count > 0

  return (
    <>
      <section className="panel">
        <h2>Trailer &amp; ratings</h2>
        {!d && <p className="muted">Loading…</p>}
        {d?.error && <p className="muted">Trailer and external ratings are unavailable right now.</p>}

        {d && hasRatings && (
          <div className="ratings">
            {imdb?.score != null && (
              <Rating label="IMDb" cls="imdb" value={`${imdb.score}/10`} sub={imdb.votes ? `${imdb.votes} votes` : ''} href={imdb.url} />
            )}
            {d.tmdb?.score != null && (
              <Rating label="TMDB" cls="tmdb" value={`${d.tmdb.score}/10`} sub={`${d.tmdb.votes.toLocaleString()} votes`} href={d.tmdb.url} />
            )}
            {imdb?.rotten_tomatoes && <Rating label="Rotten Tomatoes" cls="rt" value={imdb.rotten_tomatoes} />}
            {imdb?.metacritic && <Rating label="Metacritic" cls="mc" value={imdb.metacritic} />}
            {nexplay.count > 0 && (
              <Rating label="NexPlay" cls="nex" value={`${nexplay.avg}/10`} sub={`${nexplay.count} review${nexplay.count === 1 ? '' : 's'}`} />
            )}
          </div>
        )}
        {d && !imdb && d.imdb_url && (
          <p className="muted small">
            <a href={d.imdb_url} target="_blank" rel="noreferrer">See the IMDb rating on IMDb</a>
          </p>
        )}

        {d?.trailer && <Trailer trailer={d.trailer} />}
        {d && !d.trailer && !d.error && <p className="muted">No trailer available.</p>}
      </section>

      {d?.reviews?.length > 0 && (
        <section className="panel">
          <h2>Reviews from TMDB</h2>
          <p className="muted small">Written by members of The Movie Database, not NexPlay. They are not counted in NexPlay ratings.</p>
          {d.reviews.map((r) => (
            <div className="review" key={r.url || r.author + r.date}>
              <strong>{r.author}</strong>{' '}
              {r.rating != null && <span className="score">★ {r.rating}</span>}
              {r.date && <span className="muted small"> · {r.date}</span>}
              <p style={{ whiteSpace: 'pre-line' }}>{r.text}</p>
              {r.url && <a className="small" href={r.url} target="_blank" rel="noreferrer">Read the full review on TMDB</a>}
            </div>
          ))}
          {d.imdb_reviews_url && (
            <p><a className="steamlink" href={d.imdb_reviews_url} target="_blank" rel="noreferrer">Read the reviews on IMDb</a></p>
          )}
        </section>
      )}
    </>
  )
}
