import { useEffect, useState } from 'react'
import { api } from '../api'
import TitleCard from '../components/TitleCard.jsx'

export default function Home() {
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('-release_date')
  const [titles, setTitles] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const q = new URLSearchParams({ ordering })
    if (type) q.set('media_type', type)
    if (search) q.set('search', search)
    const id = setTimeout(() => {
      api(`/titles/?${q}`)
        .then((d) => { setTitles(d.results); setError('') })
        .catch((e) => setError(e.message))
    }, 250)
    return () => clearTimeout(id)
  }, [type, search, ordering])

  return (
    <>
      <div className="filters">
        {[['', 'All'], ['movie', 'Movies'], ['game', 'Games']].map(([v, l]) => (
          <button key={v} className={type === v ? 'btn' : 'ghost'} onClick={() => setType(v)}>{l}</button>
        ))}
        <input placeholder="Search titles…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={ordering} onChange={(e) => setOrdering(e.target.value)}>
          <option value="-release_date">Newest</option>
          <option value="-avg_rating">Top rated</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      {error && <p className="error">Could not reach the API: {error}</p>}
      <div className="grid">{titles.map((t) => <TitleCard key={t.id} t={t} />)}</div>
      {!error && titles.length === 0 && <p className="muted">Nothing found.</p>}
    </>
  )
}
