import { useEffect, useRef, useState } from 'react'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

// "Continue with Google" using Google Identity Services. Renders nothing unless VITE_GOOGLE_CLIENT_ID is set.
export default function GoogleButton({ onCredential, onError }) {
  const box = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!CLIENT_ID) return
    const start = () => {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => onCredential(r.credential),
      })
      window.google.accounts.id.renderButton(box.current, {
        theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', width: box.current.offsetWidth || 320,
      })
      setReady(true)
    }
    if (window.google?.accounts?.id) { start(); return }
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = start
    s.onerror = () => onError?.('Could not load Google sign-in.')
    document.head.appendChild(s)
  }, [onCredential, onError])

  if (!CLIENT_ID) return null
  return <div className="google-slot" ref={box} aria-busy={!ready} />
}
