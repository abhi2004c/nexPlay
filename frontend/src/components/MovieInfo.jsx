import Gallery from './Gallery.jsx'

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

// Trailers, teasers and stills for a movie page (YouTube videos load only when played). Ratings live in the header.
export default function MovieTrailer({ info }) {
  if (!info) return null
  // older cached answers only have the single `trailer`
  const videos = info.videos?.length ? info.videos : info.trailer ? [info.trailer] : []
  const images = info.images || []
  if (videos.length === 0 && images.length === 0) return null
  const tmdb = info.tmdb?.url
  return (
    <Gallery
      key={tmdb}
      title={images.length > 0 ? 'Trailers & stills' : 'Trailer'}
      videos={videos}
      images={images}
      imageLabel="Stills"
      credit={tmdb ? <> · videos from YouTube, images from <a href={tmdb} target="_blank" rel="noreferrer">TMDB</a></> : null}
    />
  )
}
