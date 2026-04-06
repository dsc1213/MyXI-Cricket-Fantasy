import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { forgotPassword, resetPassword } from '../lib/api.js'

function ForgotPassword() {
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState(['', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [successText, setSuccessText] = useState('')

  const onLoadQuestions = async (event) => {
    event.preventDefault()
    try {
      setErrorText('')
      setSuccessText('')
      setIsLoadingQuestions(true)
      const data = await forgotPassword({ userId: identifier })
      setQuestions(Array.isArray(data?.questions) ? data.questions : [])
      setAnswers(['', '', ''])
      setSuccessText(data?.message || 'Security questions loaded.')
    } catch (error) {
      setQuestions([])
      setErrorText(error.message || 'Failed to load security questions')
    } finally {
      setIsLoadingQuestions(false)
    }
  }

  const onReset = async (event) => {
    event.preventDefault()
    if (newPassword !== confirmPassword) {
      setErrorText('Password mismatch')
      return
    }
    try {
      setErrorText('')
      setSuccessText('')
      setIsResetting(true)
      await resetPassword({ userId: identifier, answers, newPassword })
      setSuccessText('Password updated. Redirecting to login...')
      setTimeout(() => navigate('/login'), 700)
    } catch (error) {
      setErrorText(error.message || 'Failed to reset password')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <section className="auth">
      <div className="auth-panel">
        <h2>Forgot password</h2>
        <p>Enter userId/email, answer your 3 security questions, then set a new password.</p>
        <form className="form" onSubmit={onLoadQuestions}>
          <label>
            User ID or Email
            <input
              type="text"
              placeholder="userId or email"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>
          <button type="submit" className="ghost small" disabled={isLoadingQuestions}>
            {isLoadingQuestions ? 'Loading...' : 'Load security questions'}
          </button>
        </form>

        <form className="form" onSubmit={onReset}>
          {questions.map((question, index) => (
            <label key={question.key || index}>
              {question.prompt || `Security question ${index + 1}`}
              <input
                type="text"
                placeholder={`Answer ${index + 1}`}
                value={answers[index] || ''}
                onChange={(event) =>
                  setAnswers((prev) => prev.map((value, idx) => (idx === index ? event.target.value : value)))
                }
              />
            </label>
          ))}
          <label>
            New password
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm password
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          {!!errorText && <p className="error-text">{errorText}</p>}
          {!!successText && <p className="success-text">{successText}</p>}
          <button
            type="submit"
            className="cta wide"
            disabled={isResetting || questions.length !== 3}
          >
            {isResetting ? 'Updating...' : 'Update password'}
          </button>
        </form>
        <div className="form-footer">
          <span>Back to login</span>
          <Link to="/login" className="link-button">
            Login
          </Link>
        </div>
      </div>
      <div className="auth-aside">
        <h3>Password reset flow</h3>
        <p>
          1) Load questions for userId/email, 2) submit correct answers, 3) set new password.
        </p>
      </div>
    </section>
  )
}

export default ForgotPassword
