import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentUser, login, signup } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) navigate('/dashboard');
  }, [currentUser, navigate]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignup) {
        await signup(email, password);
      } else {
        await login(email, password);
      }
    } catch (authError) {
      setError(authError.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md glass-panel p-8">
        <h1 className="text-3xl font-bold text-primary-500">Smart CCTV</h1>
        <p className="mt-2 text-sm text-gray-400">
          {isSignup ? 'Create your surveillance admin account.' : 'Sign in to access remote monitoring.'}
        </p>

        {error ? (
          <div className="mt-5 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">{error}</div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            className="w-full rounded-lg border border-dark-700 bg-dark-900/40 px-4 py-3 text-sm outline-none focus:border-primary-500"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="w-full rounded-lg border border-dark-700 bg-dark-900/40 px-4 py-3 text-sm outline-none focus:border-primary-500"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={6}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary-600 py-3 font-semibold transition hover:bg-primary-500 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Login'}
          </button>
        </form>

        <button
          type="button"
          className="mt-5 text-sm text-primary-400 hover:text-primary-300"
          onClick={() => setIsSignup((previous) => !previous)}
        >
          {isSignup ? 'Already have an account? Login' : 'New here? Create account'}
        </button>
      </div>
    </div>
  );
}