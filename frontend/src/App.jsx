import { Link, NavLink, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Home from './pages/Home.jsx'
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
          <NavLink to="/" end>Browse</NavLink>
          <NavLink to="/watchlist">Watchlist</NavLink>
        </nav>
        <div className="grow" />
        {user ? (
          <>
            <span className="muted">Hi, {user.username}</span>
            <button className="ghost" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link className="btn" to="/login">Log in</Link>
        )}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/title/:slug" element={<TitlePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/watchlist" element={<Watchlist />} />
        </Routes>
      </main>
    </>
  )
}
