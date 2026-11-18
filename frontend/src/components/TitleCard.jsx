import { Link } from 'react-router-dom'

export default function TitleCard({ t }) {
  const year = t.release_date?.slice(0, 4)
  return (
    <Link to={`/title/${t.slug}`} className="card">
      <div className={`poster ${t.media_type}`}>
        {t.poster_url ? <img src={t.poster_url} alt="" /> : <span>{t.name[0]}</span>}
      </div>
      <div className="info">
        <strong>{t.name}</strong>
        <div className="muted">{t.media_type === 'movie' ? 'Movie' : 'Game'} · {year}</div>
        <div className="chips">
          {t.media_type === 'movie' && t.external_rating != null && (
            <span className="chip tmdb" title={`TMDB rating from ${t.external_votes.toLocaleString()} votes`}>TMDB {t.external_rating.toFixed(1)}</span>
          )}
          {t.media_type === 'game' && t.metacritic != null && (
            <span className="chip mc" title="Metacritic score">MC {t.metacritic}</span>
          )}
          {t.media_type === 'game' && t.metacritic == null && t.external_rating != null && (
            <span className="chip rawg" title={`RAWG rating from ${t.external_votes.toLocaleString()} votes`}>RAWG {t.external_rating.toFixed(1)}</span>
          )}
          {t.rating_count > 0 && <span className="chip nex" title="NexPlay members">★ {t.avg_rating}</span>}
          {t.external_rating == null && t.metacritic == null && t.rating_count === 0 && <span className="muted small">No ratings yet</span>}
        </div>
      </div>
    </Link>
  )
}
