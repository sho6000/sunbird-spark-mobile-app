import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonIcon,
  IonToast,
} from '@ionic/react';
import { eyeOutline, eyeOffOutline, chevronBackOutline } from 'ionicons/icons';
import { ASSETS } from '../constants/assets';
import { useNetwork } from '../providers/NetworkProvider';
import { useAuth } from '../contexts/AuthContext';
import { authWebviewService } from '../services/AuthWebviewService';
import './SignInPage.css';
import useImpression from '../hooks/useImpression';
import { useTranslation } from 'react-i18next';

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

/** Map API/Google errors to i18n keys */
const getLoginErrorKey = (err: unknown): string => {
  if (err instanceof Error) {
    if (err.message === 'USER_ACCOUNT_DELETED') {
      return 'signInPage.accountDeleted';
    }

    const code = (err as any).code as string | undefined;
    const msg = err.message.toLowerCase();

    // Backend error codes from /mobile/keycloak/login
    if (code === 'INVALID_CREDENTIALS' || msg.includes('invalid_grant'))
      return 'signInPage.invalidCredentials';
    if (code === 'USER_ACCOUNT_BLOCKED' || (msg.includes('account') && msg.includes('blocked')))
      return 'signInPage.accountBlocked';
    if (code === 'LOGIN_FAILED')
      return 'signInPage.loginFailed';

    // Network errors
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch') || msg.includes('unable to connect'))
      return 'signInPage.unableToConnect';
  }
  return 'signInPage.somethingWentWrong';
};

const isGoogleCancelError = (err: unknown): boolean => {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes('12501') || msg.includes('cancel');
  }
  if (typeof err === 'object' && err !== null && 'code' in err) {
    return (err as { code: number }).code === 12501;
  }
  return false;
};

const SignInPage: React.FC = () => {
  useImpression({ pageid: 'SignInPage', env: 'user' });
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const { isOffline } = useNetwork();
  const { loginWithCredentials, loginWithGoogle } = useAuth();
  const wasOffline = useRef(false);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      setToastMessage(t('signInPage.backOnline'));
    }
  }, [isOffline]);

  useEffect(() => {
    document.title = `${t('pageTitle.signIn')}`;
  }, [t]);

  const isFormValid = email.trim().length > 0 && password.length > 0;

  const handleLogin = async () => {
    if (!isFormValid || loading) return;

    if (isOffline) {
      setToastMessage(t('signInPage.checkInternet'));
      return;
    }

    setError('');
    setLoading(true);
    const trimmedEmail = email.trim();

    try {
      await loginWithCredentials(trimmedEmail, password);
    } catch (err) {
      setError(t(getLoginErrorKey(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (loading) return;

    if (isOffline) {
      setToastMessage(t('signInPage.checkInternet'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await authWebviewService.openForgotPassword();
      // Browser closed — user can now login with new password
    } catch (err) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('cancel')) {
          // User closed browser — no error
        } else if (msg.includes('form') || msg.includes('config')) {
          setError(t('signInPage.unableToOpen'));
        } else {
          setError(t('signInPage.somethingWentWrong'));
        }
      } else {
        setError(t('signInPage.somethingWentWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (loading) return;

    if (isOffline) {
      setToastMessage(t('signInPage.checkInternet'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await authWebviewService.openRegistration();
      // Browser closed — user may or may not have completed registration
      // No toast needed — if they registered, they'll login with new credentials
    } catch (err) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('cancel')) {
          // User closed browser — no error
        } else if (msg.includes('form') || msg.includes('config')) {
          setError(t('signInPage.unableToOpenRegistration'));
        } else {
          setError(t('signInPage.somethingWentWrong'));
        }
      } else {
        setError(t('signInPage.somethingWentWrong'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (loading) return;

    if (isOffline) {
      setToastMessage(t('signInPage.checkInternet'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      await loginWithGoogle();
    } catch (err) {
      if (!isGoogleCancelError(err)) {
        if (err instanceof Error && err.message === 'USER_ACCOUNT_DELETED') {
          setError(t('signInPage.accountDeleted'));
        } else {
          const code = err instanceof Error ? (err as any).code : undefined;
          if (code === 'USER_NAME_NOT_PRESENT') {
            setError(t('signInPage.googleSecurityError'));
          } else if (code === 'USER_ACCOUNT_BLOCKED') {
            setError(t('signInPage.accountBlocked'));
          } else {
            setError(t('signInPage.googleSignInFailed'));
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage className="sign-in-page">
      <IonHeader className="sign-in-header ion-no-border">
        <IonToolbar className="sign-in-toolbar">
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/profile"
              text=""
              icon={chevronBackOutline}
              className="sign-in-back-btn"
            />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen className="sign-in-content">
        <main id="main-content">
        <div className="sign-in-container">
          {/* Sunbird Logo */}
          <img
            src={ASSETS.SUNBIRD_LOGO}
            alt="Sunbird"
            className="sign-in-logo"
          />

          {/* Welcome Heading */}
          <h1 className="sign-in-welcome">{t('signInPage.welcomeTitle')}</h1>

          {/* Subtitle */}
          <p className="sign-in-subtitle">
            {t('signInPage.welcomeSubtitle')}
          </p>

          {/* Error Message */}
          {error && (
            <div id="signin-error" className="sign-in-error" role="alert" aria-live="assertive">{error}</div>
          )}

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="sign-in-google-btn"
          >
            {loading ? (
              <IonSpinner name="crescent" />
            ) : (
              <>
                <GoogleIcon />
                <span>{t('signInPage.signInWithGoogle')}</span>
              </>
            )}
          </button>

          {/* OR Divider */}
          <div className="sign-in-divider">
            <div className="sign-in-divider-line" />
            <span className="sign-in-divider-text">{t('signInPage.or')}</span>
            <div className="sign-in-divider-line" />
          </div>

          {/* Form */}
          <form
            className="sign-in-form"
            aria-label={t('signInPage.login')}
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            {/* Email / Mobile Number */}
            <div className="sign-in-form-group">
              <label className="sign-in-label" htmlFor="sign-in-email">{t('signInPage.emailOrMobile')}</label>
              <input
                id="sign-in-email"
                type="text"
                placeholder={t('signInPage.enterEmailOrMobile')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="sign-in-input"
                aria-invalid={!!error}
                aria-describedby={error ? 'signin-error' : undefined}
              />
            </div>

            {/* Password */}
            <div className="sign-in-form-group">
              <label className="sign-in-label" htmlFor="sign-in-password">{t('signInPage.password')}</label>
              <div className="sign-in-password-wrapper">
                <input
                  id="sign-in-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('signInPage.enterPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="sign-in-input"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'signin-error' : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="sign-in-eye-btn"
                  aria-label={showPassword ? t('signInPage.hidePassword') : t('signInPage.showPassword')}
                >
                  <IonIcon icon={showPassword ? eyeOffOutline : eyeOutline} />
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="sign-in-forgot-row">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={loading}
                className="sign-in-forgot-btn"
              >
                {t('signInPage.forgotPassword')}
              </button>
            </div>

            {/* Login Button */}
            <button
              type="submit"
              disabled={!isFormValid || loading}
              className="sign-in-login-btn"
            >
              {loading ? <IonSpinner name="crescent" /> : t('signInPage.login')}
            </button>

            {/* Register Link */}
            <p className="sign-in-register-text">
              {t('signInPage.newUser')}{' '}
              <button
                type="button"
                onClick={handleRegister}
                disabled={loading}
                className="sign-in-register-link"
              >
                {t('signInPage.createAccount')}
              </button>{' '}
              {t('signInPage.toContinue')}
            </p>
          </form>
        </div>
        </main>
      </IonContent>

      <IonToast
        isOpen={!!toastMessage}
        onDidDismiss={() => setToastMessage('')}
        message={toastMessage}
        duration={3000}
        position="bottom"
      />
    </IonPage>
  );
};

export default SignInPage;
