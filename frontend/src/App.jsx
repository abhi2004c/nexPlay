import { useEffect, useState } from 'react'
import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { api } from './api'
import { useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'
import HeaderSearch from './components/HeaderSearch.jsx'
import TitlePage from './pages/TitlePage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Watchlist from './pages/Watchlist.jsx'
import Profile from './pages/Profile.jsx'
import Friends from './pages/Friends.jsx'
import Messages from './pages/Messages.jsx'
import Avatar from './components/Avatar.jsx'
import { ForgotPassword, ResetPassword } from './pages/ResetPages.jsx'

// number of unread chat messages, refreshed while the tab is open
function useUnread(user) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!user) { setN(0); return }
    const load = () => { if (!document.hidden) api('/messages/unread/').then((d) => setN(d.unread)).catch(() => {}) }
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [user])
  return n
}

export default function App() {
  const { user, logout } = useAuth()
  const unread = useUnread(user)
  return (
    <>
      <header className="bar">
        <Link to="/" className="logo">Nex<span>Play</span></Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/games">Games</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
          {user && <NavLink to="/friends">Friends</NavLink>}
        </nav>
        <HeaderSearch />
        <div className="grow" />
        {user ? (
          <>
            <NavLink to="/messages" className="msglink" aria-label={`Messages${unread ? `, ${unread} unread` : ''}`}>
              Messages{unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
            </NavLink>
            <Link to={`/u/${user.username}`} className="me" title="Your profile" aria-label={`Your profile (${user.username})`}>
              <Avatar name={user.username} url={user.avatar_url} />
            </Link>
            <button className="ghost" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link className="btn" to="/login">Log in</Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Browse key="movie" type="movie" />} />
          <Route path="/games" element={<Browse key="game" type="game" />} />
          <Route path="/search" element={<Browse key="all" type="" />} />
          <Route path="/title/:slug" element={<TitlePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset/:uid/:token" element={<ResetPassword />} />
          <Route path="/u/:username" element={<Profile />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:username" element={<Messages />} />
        </Routes>
      </main>
      <footer className="foot muted">
        Movie data from <a href="https://www.themoviedb.org">TMDB</a> (not endorsed or certified by TMDB) ·
        Game data from <a href="https://rawg.io">RAWG</a>
      </footer>
    </>
  )
}
