import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
import Browse from './pages/Browse.jsx'
import TitlePage from './pages/TitlePage.jsx'
import AuthPage from './pages/AuthPage.jsx'
import Watchlist from './pages/Watchlist.jsx'

export default function App() {
  const { user, logout } = useAuth()
  return (
    <>
      <header className="bar">
        <Link to="/" className="logo">Nex<span>Play</span></Link>
        <nav>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/movies">Movies</NavLink>
          <NavLink to="/games">Games</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
        </nav>
        <div className="grow" />
        {user ? (
          <>
            <span className="avatar" title={user.username} aria-label={`Signed in as ${user.username}`}>{user.username[0].toUpperCase()}</span>
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
          <Route path="/title/:slug" element={<TitlePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </main>
      <footer className="foot muted">
        Movie data from <a href="https://www.themoviedb.org">TMDB</a> (not endorsed or certified by TMDB) ·
        Game data from <a href="https://rawg.io">RAWG</a>
      </footer>
    </>
  )
}
