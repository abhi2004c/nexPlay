import { Link } from 'react-router-dom'
import RatingChips from './RatingChips.jsx'
import WatchButton from './WatchButton.jsx'
import { cleanDescription } from '../text.js'

// The one score shown on the poster: TMDB for movies, Steam % (else Metacritic) for games, else NexPlay.
function mainBadge(t) {
  if (t.media_type === 'movie' && t.external_rating != null) {
    return { value: t.external_rating.toFixed(1), label: 'TMDB', tone: t.external_rating >= 7.5 ? 'good' : t.external_rating >= 6 ? 'mid' : 'low' }
  }
  if (t.media_type === 'game' && t.external_rating != null) {
    const p = Math.round(t.external_rating * 10)
    return { value: `${p}%`, label: 'Steam', tone: p >= 80 ? 'good' : p >= 60 ? 'mid' : 'low' }
  }
  if (t.metacritic != null) return { value: t.metacritic, label: 'MC', tone: t.metacritic >= 75 ? 'good' : t.metacritic >= 50 ? 'mid' : 'low' }
  if (t.rating_count > 0) return { value: t.avg_rating, label: 'NexPlay', tone: 'good' }
  return null
}

export default function TitleCard({ t }) {
  const year = t.release_date?.slice(0, 4)
  const badge = mainBadge(t)
  return (
    <div className="card">
      <Link to={`/title/${t.slug}`} className="cardlink">
        <div className={`poster ${t.media_type}`}>
          {t.poster_url ? <img src={t.poster_url} alt="" loading="lazy" /> : <span>{t.name[0]}</span>}
          {badge && (
            <span className={`pbadge ${badge.tone}`} title={`${badge.label} ${badge.value}`}>
              <b>{badge.value}</b><small>{badge.label}</small>
            </span>
          )}
          <div className="overlay" aria-hidden="true">
            <p className="ov-desc">{cleanDescription(t.description, { multiline: false }) || 'No description yet.'}</p>
            <div className="ov-tags">{t.genres.slice(0, 3).map((g) => <span key={g}>{g}</span>)}</div>
            <RatingChips t={t} empty={false} />
          </div>
        </div>
        <div className="info">
          <strong>{t.name}</strong>
          <div className="muted meta">
            {t.media_type === 'movie' ? 'Movie' : 'Game'}{year ? ` · ${year}` : ''}{t.genres[0] ? ` · ${t.genres[0]}` : ''}
          </div>
        </div>
      </Link>
      <WatchButton slug={t.slug} name={t.name} />
    </div>
  )
}
