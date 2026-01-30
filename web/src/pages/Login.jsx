function Login() {
  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Welcome back</h2>
        <p>Login to manage your teams and tournaments.</p>
        <form className="form">
          <label>
            Email
            <input type="email" placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" placeholder="********" />
          </label>
          <button type="button" className="cta wide">
            Sign in
          </button>
        </form>
        <div className="form-footer">
          <span>Waiting for approval?</span>
          <button type="button" className="link-button">
            Check status
          </button>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Welcome back</h3>
        <p>
          Sign in to manage your teams, join tournaments, and view live score
          updates.
        </p>
      </div>
    </section>
  )
}

export default Login
