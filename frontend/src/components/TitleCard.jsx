import { Link } from 'react-router-dom'
import RatingChips from './RatingChips.jsx'
import WatchButton from './WatchButton.jsx'

export default function TitleCard({ t }) {
  const year = t.release_date?.slice(0, 4)
  return (
    <div className="card">
      <Link to={`/title/${t.slug}`} className="cardlink">
        <div className={`poster ${t.media_type}`}>
          {t.poster_url ? <img src={t.poster_url} alt="" loading="lazy" /> : <span>{t.name[0]}</span>}
          <div className="overlay" aria-hidden="true">
            <p className="ov-desc">{t.description || 'No description yet.'}</p>
            <div className="ov-tags">{t.genres.slice(0, 3).map((g) => <span key={g}>{g}</span>)}</div>
          </div>
        </div>
        <div className="info">
          <strong>{t.name}</strong>
          <div className="muted">{t.media_type === 'movie' ? 'Movie' : 'Game'} · {year}</div>
          <RatingChips t={t} />
        </div>
      </Link>
      <WatchButton slug={t.slug} name={t.name} />
    </div>
  )
}
