import React, { useState } from 'react';
import { Lock, Mail, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { authService } from '../../services/authService';
import { MoneyUndoMark } from '../brand/MoneyUndoMark';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
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

    if (mode === 'signup' && !name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
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
          setMode('signin');
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
          <h1 className="auth-title">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="auth-subtitle">
            {mode === 'signin'
              ? 'Sign in to manage your budgets and expenses.'
              : 'Create a workspace for any budget and start tracking expenses.'}
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            className={`auth-tab ${mode === 'signin' ? 'active' : ''}`}
            onClick={() => {
              setMode('signin');
              setErrorMessage(null);
            }}
            role="tab"
            aria-selected={mode === 'signin'}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setErrorMessage(null);
            }}
            role="tab"
            aria-selected={mode === 'signup'}
          >
            Create Account
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="auth-error" role="alert">
            <AlertCircle size={18} className="auth-error-icon" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          {mode === 'signup' && (
            <div className="form-field">
              <label htmlFor="auth-name" className="form-label">
                Full Name
              </label>
              <div className="form-input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  id="auth-name"
                  type="text"
                  className="form-input has-prefix-icon"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="auth-email" className="form-label">
              Email Address
            </label>
            <div className="form-input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                id="auth-email"
                type="email"
                className="form-input has-prefix-icon"
                placeholder="name@example.com"
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
              Password
            </label>
            <div className="form-input-wrapper">
              <Lock size={18} className="input-icon" />
              <input
                id="auth-password"
                type="password"
                className="form-input has-prefix-icon"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
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
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>{mode === 'signin' ? 'Sign In to MoneyUndo' : 'Create Account'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Security Footer Note */}
        <div className="auth-footer-note">
          <Lock size={13} />
          <span>Your account and workspace data are protected.</span>
        </div>
      </div>
    </div>
  );
};
