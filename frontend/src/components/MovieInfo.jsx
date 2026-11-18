import { useState } from 'react'

// Reviews written by TMDB members, each with that member's own rating. Shown under NexPlay's reviews.
export function TmdbReviews({ info }) {
  if (!info?.reviews?.length) return null
  return (
    <section className="panel">
      <h2>Reviews from TMDB members</h2>
      <p className="muted small">
        Written by members of <a href={info.tmdb?.url} target="_blank" rel="noreferrer">The Movie Database</a>, not NexPlay members.
        They are not counted in NexPlay ratings.
      </p>
      {info.reviews.map((r) => (
        <div className="review" key={r.url || r.author + r.date}>
          <span className="srctag tmdb">TMDB</span>
          <strong>{r.author}</strong>{' '}
          {r.rating != null && <span className="score">★ {r.rating}/10</span>}
          {r.date && <span className="muted small"> · {r.date}</span>}
          <p style={{ whiteSpace: 'pre-line' }}>{r.text}</p>
          {r.url && <a className="small" href={r.url} target="_blank" rel="noreferrer">Read the full review on TMDB</a>}
        </div>
      ))}
    </section>
  )
}

// Trailer for a movie page (YouTube, loaded only when played). Ratings live in the page header.
export default function MovieTrailer({ info }) {
  const [playing, setPlaying] = useState(false)
  const trailer = info?.trailer
  if (!trailer) return null

  return (
    <section className="panel">
      <h2>Trailer</h2>
      {playing ? (
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
      )}
    </section>
  )
}
