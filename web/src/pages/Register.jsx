function Register() {
  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Create your account</h2>
        <p>Register once. Master admin approval is required.</p>
        <form className="form">
          <label>
            Full name
            <input type="text" placeholder="Rahul Sharma" />
          </label>
          <label>
            Game name
            <input type="text" placeholder="RahulXI" />
          </label>
          <label>
            Email
            <input type="email" placeholder="you@example.com" />
          </label>
          <label>
            Password
            <input type="password" placeholder="Create a password" />
          </label>
          <button type="button" className="cta wide">
            Submit for approval
          </button>
        </form>
        <div className="form-footer">
          <span>Already registered?</span>
          <button type="button" className="link-button">
            Login
          </button>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Why approval?</h3>
        <p>
          This keeps the league private and prevents random signups. Once
          approved, you can join tournaments and select your playing XI.
        </p>
        <div className="pill-grid">
          <span>Friends-only</span>
          <span>Auto swaps</span>
          <span>Manual score check</span>
        </div>
      </div>
    </section>
  )
}

export default Register
