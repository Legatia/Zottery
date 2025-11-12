import { Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import PurchasePage from './pages/PurchasePage'
import ClaimPageEnhanced from './pages/ClaimPageEnhanced'
import DrawsPage from './pages/DrawsPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <Link to="/" className="logo">
            <h1>🎫 Zottery</h1>
            <p className="tagline">Anonymous Lottery • Powered by Zcash</p>
          </Link>
          <nav className="nav">
            <Link to="/" className="nav-link">Home</Link>
            <Link to="/purchase" className="nav-link">Buy Tickets</Link>
            <Link to="/claim" className="nav-link">Claim Prize</Link>
            <Link to="/draws" className="nav-link">Past Draws</Link>
          </nav>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/purchase" element={<PurchasePage />} />
          <Route path="/claim" element={<ClaimPageEnhanced />} />
          <Route path="/draws" element={<DrawsPage />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>Zottery - Privacy-Preserving Lottery System</p>
        <p className="footer-note">
          All prize claims are anonymous using zero-knowledge proofs.
          Your ticket information is stored locally - keep it safe!
        </p>
      </footer>
    </div>
  )
}

export default App
