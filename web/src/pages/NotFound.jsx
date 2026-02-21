import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <section className="pending">
      <div className="pending-card">
        <h2>Page not found</h2>
        <p>The URL you entered does not exist in this app.</p>
        <div className="hero-actions">
          <Link to="/" className="cta">
            Go home
          </Link>
          <Link to="/fantasy" className="ghost">
            Open fantasy
          </Link>
        </div>
      </div>
    </section>
  )
}

export default NotFound
