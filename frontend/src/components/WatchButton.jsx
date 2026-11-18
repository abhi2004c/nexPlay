import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

// One-click "add to watchlist". `variant="icon"` is the round + on cards, `variant="full"` a labelled button.
export default function WatchButton({ slug, name, variant = 'icon' }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [state, setState] = useState('idle') // idle | busy | added | error

  async function add(e) {
    e.preventDefault() // the button sits on top of a link: don't open the page
    e.stopPropagation()
    if (!user) return nav('/login')
    if (state === 'busy' || state === 'added') return
    setState('busy')
    try {
      await api('/watchlist/', { method: 'POST', body: { title_slug: slug } })
      setState('added')
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 2500)
    }
  }

  const label = state === 'added' ? 'On your watchlist' : state === 'error' ? 'Try again' : user ? 'Add to watchlist' : 'Log in to add'
  if (variant === 'full') {
    return (
      <button className={state === 'added' ? 'ghost added' : 'ghost'} onClick={add} disabled={state === 'busy'}>
        {state === 'added' ? '✓ On your watchlist' : state === 'error' ? 'Couldn’t add — retry' : '+ Watchlist'}
      </button>
    )
  }
  return (
    <button
      className={`quick ${state === 'added' ? 'added' : ''}`}
      onClick={add}
      disabled={state === 'busy'}
      title={label}
      aria-label={`${label}: ${name}`}
    >
      {state === 'added' ? '✓' : state === 'busy' ? '…' : '+'}
    </button>
  )
}
