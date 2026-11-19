// The small rating badges shown on cards and in the featured banner.
export default function RatingChips({ t, empty = true }) {
  const steamPct = t.external_rating != null ? Math.round(t.external_rating * 10) : null
  const none = t.imdb_rating == null && t.external_rating == null && t.metacritic == null && t.rating_count === 0
  return (
    <div className="chips">
      {t.media_type === 'movie' && t.imdb_rating != null && (
        <span className="chip imdb" title={`IMDb rating from ${t.imdb_votes.toLocaleString()} votes`}>IMDb {t.imdb_rating.toFixed(1)}</span>
      )}
      {t.media_type === 'movie' && t.external_rating != null && (
        <span className="chip tmdb" title={`TMDB rating from ${t.external_votes.toLocaleString()} votes`}>TMDB {t.external_rating.toFixed(1)}</span>
      )}
      {t.media_type === 'game' && steamPct != null && (
        <span className="chip steam" title={`${steamPct}% of ${t.external_votes.toLocaleString()} Steam reviews are positive (all languages)`}>
          Steam {steamPct}%
        </span>
      )}
      {t.media_type === 'game' && t.metacritic != null && (
        <span className="chip mc" title="Metacritic score">MC {t.metacritic}</span>
      )}
      {t.rating_count > 0 && <span className="chip nex" title="NexPlay members">★ {t.avg_rating}</span>}
      {empty && none && <span className="muted small">No ratings yet</span>}
    </div>
  )
}
