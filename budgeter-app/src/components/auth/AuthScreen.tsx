import React, { useState } from 'react';
import {
  Lock,
  Mail,
  User,
  AlertCircle,
  Loader2,
  ArrowRight,
  HardDrive,
  Cloud,
  CheckCircle2,
  Zap,
  Shield,
  WifiOff,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { MoneyUndoMark } from '../brand/MoneyUndoMark';

interface AuthScreenProps {
  onAuthSuccess: () => void;
  onSelectOfflineMode: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthSuccess,
  onSelectOfflineMode,
}) => {
  const [platformMode, setPlatformMode] = useState<'cloud' | 'offline'>('cloud');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    if (authMode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);

    try {
      if (authMode === 'signin') {
        await authService.signIn(cleanEmail, password);
        onAuthSuccess();
      } else {
        const { session } = await authService.signUp(cleanEmail, password, name.trim());
        if (session) {
          onAuthSuccess();
        } else {
          setErrorMessage(
            'Your account is ready. If email confirmation is required, check your inbox to verify your email before signing in.'
          );
          setAuthMode('signin');
        }
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setErrorMessage(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-container">
        {/* Brand Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <MoneyUndoMark size={40} />
            <span className="brand-name">MoneyUndo</span>
          </div>
          <h1 className="auth-title">How would you like to use MoneyUndo?</h1>
          <p className="auth-subtitle">
            Choose between Cloud account with family sync, or 100% Offline mode on this device.
          </p>
        </div>

        {/* Platform Mode Selector (Cloud vs Offline) */}
        <div className="divert-mode-selector">
          <button
            type="button"
            className={`divert-mode-card ${platformMode === 'cloud' ? 'selected' : ''}`}
            onClick={() => {
              setPlatformMode('cloud');
              setErrorMessage(null);
            }}
          >
            <div className="divert-card-top">
              <div className="divert-card-icon purple">
                <Cloud size={18} />
              </div>
              <span className="storage-pill cloud">Synced</span>
            </div>
            <div className="divert-card-title">Cloud Account</div>
            <p className="divert-card-desc">
              Multi-user workspaces, family member sharing, and sync across all devices.
            </p>
          </button>

          <button
            type="button"
            className={`divert-mode-card ${platformMode === 'offline' ? 'selected' : ''}`}
            onClick={() => {
              setPlatformMode('offline');
              setErrorMessage(null);
            }}
          >
            <div className="divert-card-top">
              <div className="divert-card-icon green">
                <HardDrive size={18} />
              </div>
              <span className="storage-pill local">Single User</span>
            </div>
            <div className="divert-card-title">Offline Mode</div>
            <p className="divert-card-desc">
              100% on this device. Zero server calls, private, no account or internet needed.
            </p>
          </button>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: CLOUD ACCOUNT (Sign In / Register)                         */}
        {/* ------------------------------------------------------------------ */}
        {platformMode === 'cloud' && (
          <div className="cloud-auth-panel">
            {/* Mode Toggle Tabs */}
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                className={`auth-tab ${authMode === 'signin' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signin');
                  setErrorMessage(null);
                }}
                role="tab"
                aria-selected={authMode === 'signin'}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`}
                onClick={() => {
                  setAuthMode('signup');
                  setErrorMessage(null);
                }}
                role="tab"
                aria-selected={authMode === 'signup'}
              >
                Create Account
              </button>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="auth-error" role="alert">
                <AlertCircle size={16} />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {authMode === 'signup' && (
                <div className="form-field">
                  <label htmlFor="auth-name" className="form-label">
                    Full Name <span className="required-star">*</span>
                  </label>
                  <div className="form-input-wrapper">
                    <User size={16} className="input-icon" />
                    <input
                      id="auth-name"
                      type="text"
                      className="form-input has-prefix-icon"
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLoading}
                      required
                      autoComplete="name"
                    />
                  </div>
                </div>
              )}

              <div className="form-field">
                <label htmlFor="auth-email" className="form-label">
                  Email Address <span className="required-star">*</span>
                </label>
                <div className="form-input-wrapper">
                  <Mail size={16} className="input-icon" />
                  <input
                    id="auth-email"
                    type="email"
                    className="form-input has-prefix-icon"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="auth-password" className="form-label">
                  Password <span className="required-star">*</span>
                </label>
                <div className="form-input-wrapper">
                  <Lock size={16} className="input-icon" />
                  <input
                    id="auth-password"
                    type="password"
                    className="form-input has-prefix-icon"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary auth-submit-btn"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Connecting to Cloud...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === 'signin' ? 'Sign In to Cloud' : 'Create Cloud Account'}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 2: OFFLINE MODE (Single User, Local Device)                   */}
        {/* ------------------------------------------------------------------ */}
        {platformMode === 'offline' && (
          <div className="offline-divert-panel">
            <div className="offline-feature-list">
              <div className="offline-feature-item">
                <CheckCircle2 size={18} className="feature-icon green" />
                <div>
                  <strong>100% Stored on Device</strong>
                  <p>All budgets, categories, and transactions stay entirely in local storage.</p>
                </div>
              </div>

              <div className="offline-feature-item">
                <Shield size={18} className="feature-icon green" />
                <div>
                  <strong>Complete Privacy</strong>
                  <p>Zero cloud storage, no tracking, and no external server connections.</p>
                </div>
              </div>

              <div className="offline-feature-item">
                <WifiOff size={18} className="feature-icon green" />
                <div>
                  <strong>Works Fully Offline</strong>
                  <p>Open and manage your finances anytime, even in airplane mode or without internet.</p>
                </div>
              </div>

              <div className="offline-feature-item">
                <Zap size={18} className="feature-icon green" />
                <div>
                  <strong>Instant & Single-User</strong>
                  <p>Fastest possible performance with zero latency. Strictly single-user personal ledger.</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary auth-submit-btn offline-launch-btn"
              onClick={onSelectOfflineMode}
            >
              <HardDrive size={18} />
              <span>Continue in Offline Mode</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* Security Footer Note */}
        <div className="auth-footer-note">
          <Lock size={13} />
          <span>
            {platformMode === 'cloud'
              ? 'Cloud accounts are secured with Row Level Security & JWT encryption.'
              : 'Offline data is stored safely in your browser’s isolated local storage.'}
          </span>
        </div>
      </div>
    </div>
  );
};
