import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthLoading, authError, isLoggedIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/', { replace: true });
    }
  }, [isLoggedIn, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (error) {
      setErrorMessage(error.message || 'Could not sign in.');
    }
  }

  return (
    <div className="accounting-login-page">
      <div className="accounting-login-card">
        <div className="accounting-brand accounting-brand-login">
          <span className="accounting-brand-main">COSA</span>
          <span className="accounting-brand-sub">ACCOUNTING</span>
        </div>

        <p className="accounting-login-copy">
          Sign in to manage income, expenses, GST, and your log book.
        </p>

        <form className="accounting-login-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {errorMessage || authError ? (
            <div className="accounting-error">{errorMessage || authError}</div>
          ) : null}

          <button disabled={isAuthLoading} type="submit">
            {isAuthLoading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
