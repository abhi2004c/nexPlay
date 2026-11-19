import { useEffect, useState } from 'react'
import { api } from '../api'
import Gallery from './Gallery.jsx'

// A game's trailers and screenshots, as listed on its Steam store page.
export default function Media({ slug }) {
  const [m, setM] = useState(null)
  useEffect(() => {
    setM(null)
    api(`/titles/${slug}/media/`).then(setM).catch(() => setM({ trailers: [], screenshots: [] }))
  }, [slug])
  if (!m) return null
  return (
    <Gallery
      key={slug}
      title="Trailers & screenshots"
      videos={m.trailers}
      images={m.screenshots}
      steamUrl={m.steam_url}
      credit={m.source === 'steam' && m.steam_url
        ? <> · from the game’s <a href={m.steam_url} target="_blank" rel="noreferrer">Steam store page</a></> : null}
    />
  )
}
