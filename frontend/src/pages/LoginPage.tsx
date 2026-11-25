import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login, saveSession, getRememberedEmail, saveRememberedEmail } from '../lib/api';
import '../styles/auth.css';

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState(getRememberedEmail());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(
    Boolean(getRememberedEmail())
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const submittedEmail = String(formData.get('email') || '').trim();
    const submittedPassword = String(formData.get('password') || '');

    try {
      const { token, doctor } = await login(submittedEmail, submittedPassword);

      saveRememberedEmail(submittedEmail, remember);
      saveSession(token, doctor, remember);

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="login-eyebrow">Güvenli erişim</p>

        <h1 id="login-title" className="login-title">
          Hesabınıza giriş yapın
        </h1>

        <p className="login-subtitle">
          Mamografi analiz paneline erişmek için doktor hesabınızla devam edin.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">E-posta adresi</label>

            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="dr.aylin@mammovisionai.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="login-password">Şifre</label>

            <div className="input-with-icon">
              <input
                id="login-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" width="20" height="20"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                    <path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 4.5 9.5 7-.4 1-1.1 2-2 2.9" />
                    <path d="M6.2 6.2C3.8 7.7 2.1 10 1.5 12c1 2.5 4.5 7 10.5 7 1.1 0 2.1-.2 3-.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20"
                    fill="none" stroke="currentColor" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="login-options">
            <label className="checkbox" htmlFor="login-remember">
              <input
                id="login-remember"
                type="checkbox"
                checked={remember}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRemember(checked);

                  if (!checked) {
                    saveRememberedEmail('', false);
                  }
                }}
              />
              Beni hatırla
            </label>

            <Link id="login-forgot" className="link" to="/forgot-password">
              Şifremi unuttum
            </Link>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" aria-label="Giriş yapılıyor" />
            ) : (
              <>
                Giriş yap <ChevronIcon />
              </>
            )}
          </button>

          <div style={{ marginTop: 6, fontSize: 13, textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Henüz doktor hesabınız yok mu?{' '}
            <Link to="/register" className="link">
              Kayıt olun
            </Link>
          </div>
        </form>

        <p className="login-disclaimer">
          Bu platform tanı koymaz; sağlık profesyonellerine klinik karar desteği sağlar.
        </p>
      </section>
    </main>
  );
}