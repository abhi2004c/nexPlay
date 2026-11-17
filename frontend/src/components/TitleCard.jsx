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
        <div className="muted">
          {t.media_type === 'movie' ? 'Movie' : 'Game'} · {year} · ★ {t.rating_count ? t.avg_rating : '–'}
        </div>
      </div>
    </Link>
  )
}
