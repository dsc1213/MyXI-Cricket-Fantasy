import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { register } from '../lib/api.js'

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    gameName: '',
    phone: '',
    location: '',
    email: '',
    password: '',
    securityAnswer1: '',
    securityAnswer2: '',
    securityAnswer3: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const onSubmit = async (event) => {
    event.preventDefault()
    try {
      setIsSubmitting(true)
      setErrorText('')
      setSuccessText('')
      await register({
        ...form,
        securityAnswers: [form.securityAnswer1, form.securityAnswer2, form.securityAnswer3],
      })
      setSuccessText('Account submitted. Wait for admin approval.')
      setTimeout(() => navigate('/pending'), 700)
    } catch (error) {
      setErrorText(error.message || 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Create your account</h2>
        <p>Register once. Master admin approval is required.</p>
        <form className="form" onSubmit={onSubmit}>
          <label>
            Full name
            <input
              type="text"
              placeholder="Rahul Sharma"
              value={form.name}
              onChange={(event) => update('name', event.target.value)}
            />
          </label>
          <label>
            Game name
            <input
              type="text"
              placeholder="RahulXI"
              value={form.gameName}
              onChange={(event) => update('gameName', event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </label>
          <label>
            Phone
            <input
              type="tel"
              placeholder="+1 555 0100"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
          </label>
          <label>
            Location
            <input
              type="text"
              placeholder="Hyderabad, India"
              value={form.location}
              onChange={(event) => update('location', event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              placeholder="Create a password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
            />
          </label>
          <label>
            Security Question 1: What was your first school name?
            <input
              type="text"
              placeholder="Answer 1"
              value={form.securityAnswer1}
              onChange={(event) => update('securityAnswer1', event.target.value)}
            />
          </label>
          <label>
            Security Question 2: Who is your favorite cricketer?
            <input
              type="text"
              placeholder="Answer 2"
              value={form.securityAnswer2}
              onChange={(event) => update('securityAnswer2', event.target.value)}
            />
          </label>
          <label>
            Security Question 3: What city were you born in?
            <input
              type="text"
              placeholder="Answer 3"
              value={form.securityAnswer3}
              onChange={(event) => update('securityAnswer3', event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          {!!successText && <p className="success-text">{successText}</p>}
          <button type="submit" className="cta wide" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting...' : 'Submit for approval'}
          </button>
        </form>
        <div className="form-footer">
          <span>Already registered?</span>
          <Link to="/login" className="link-button">
            Login
          </Link>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Why approval?</h3>
        <p>
          This keeps the league private and prevents random signups. Once approved, you
          can join tournaments and select your playing XI.
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
