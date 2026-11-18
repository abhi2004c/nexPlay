import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

// Search box in the top bar. Its scope follows the page you are on:
//   /movies -> searches movies   /games -> searches games   anywhere else -> searches everything (/search)
// The query lives in the URL (?q=...), so results can be shared and the back button works.
const SCOPES = {
  '/movies': { path: '/movies', placeholder: 'Search movies…' },
  '/games': { path: '/games', placeholder: 'Search games…' },
}
const ALL = { path: '/search', placeholder: 'Search movies & games…' }

export default function HeaderSearch() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const scope = SCOPES[pathname] ?? ALL
  const urlQuery = pathname === scope.path ? params.get('q') || '' : ''

  const [text, setText] = useState(urlQuery)
  const lastPushed = useRef(urlQuery)

  // keep the box in step with the URL when the user navigates (nav links clear it), but never
  // overwrite what is being typed
  useEffect(() => {
    if (urlQuery !== lastPushed.current) {
      lastPushed.current = urlQuery
      setText(urlQuery)
    }
  }, [urlQuery, pathname])

  const go = (value) => {
    const q = value.trim()
    if (q === urlQuery) return
    lastPushed.current = q
    if (!q && scope === ALL) navigate('/', { replace: true }) // cleared the all-titles search: back home
    else navigate(q ? `${scope.path}?q=${encodeURIComponent(q)}` : scope.path, { replace: pathname === scope.path })
  }

  // search while typing, after a short pause
  useEffect(() => {
    if (text.trim() === urlQuery) return
    const id = setTimeout(() => go(text), 300)
    return () => clearTimeout(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return (
    <form className="hsearch" role="search" onSubmit={(e) => { e.preventDefault(); go(text) }}>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={scope.placeholder}
        aria-label={scope.placeholder.replace('…', '')}
      />
    </form>
  )
}
