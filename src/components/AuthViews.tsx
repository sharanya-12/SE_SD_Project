import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  User,
  Car,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { AuthUser } from '../types/parking';
import { GARAGE_IMAGES } from '../data/parkingData';

interface UserLoginPageProps {
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onSwitchToAdmin: () => void;
}

export const UserLoginPage: React.FC<UserLoginPageProps> = ({
  onAuthSuccess,
  onSwitchToAdmin,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [defaultPlate, setDefaultPlate] = useState('');
  const [defaultVehicle, setDefaultVehicle] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fillDemoDriver = () => {
    setMode('login');
    setEmail('driver@curbgrid.app');
    setPassword('DriverPass2026!');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload =
        mode === 'register'
          ? { name, email, password, defaultPlate, defaultVehicle }
          : { email, password, portalRole: 'user' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Unable to sign in. Please verify your credentials.');
        setLoading(false);
        return;
      }

      onAuthSuccess(data.user, data.token);
    } catch {
      setError('Network error connecting to CurbGrid authentication service.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm grid grid-cols-1 md:grid-cols-12 items-stretch">
        {/* Left Visual Column */}
        <div className="relative md:col-span-5 bg-slate-900 text-white min-h-[240px] flex flex-col justify-between p-7 overflow-hidden">
          <img
            src={GARAGE_IMAGES.evCharging}
            alt="CurbGrid underground EV parking bay"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-900/60 to-slate-900/50" />

          <div className="relative z-10">
            <span className="text-xs font-semibold text-blue-300">
              Driver Account Portal
            </span>
            <h1 className="font-display text-2xl font-bold mt-2 leading-tight text-balance">
              Park faster with saved plates and instant QR passes.
            </h1>
          </div>

          <div className="relative z-10 space-y-2 text-xs text-slate-200 pt-6">
            <p>· Sync upcoming reservations across sessions</p>
            <p>· Auto-fill vehicle plate &amp; model at checkout</p>
            <p>· One-click stay extensions &amp; free cancellation</p>
          </div>
        </div>

        {/* Right Form Column */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-100">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Driver Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <button
                type="button"
                onClick={fillDemoDriver}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer"
              >
                Use Demo Driver
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label htmlFor="user-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <div className="flex items-center h-10 px-3 bg-white border border-slate-200 rounded-lg focus-within:border-blue-600">
                      <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" aria-hidden="true" />
                      <input
                        id="user-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Alex Rivera"
                        className="w-full text-sm text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="user-plate" className="block text-xs font-semibold text-slate-700 mb-1">
                        License Plate (Optional)
                      </label>
                      <div className="flex items-center h-10 px-3 bg-white border border-slate-200 rounded-lg focus-within:border-blue-600">
                        <Car className="w-4 h-4 text-slate-400 mr-2 shrink-0" aria-hidden="true" />
                        <input
                          id="user-plate"
                          type="text"
                          value={defaultPlate}
                          onChange={(e) => setDefaultPlate(e.target.value)}
                          placeholder="TS 03 AB 1234"
                          className="w-full text-sm font-mono uppercase text-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="user-vehicle" className="block text-xs font-semibold text-slate-700 mb-1">
                        Vehicle Model (Optional)
                      </label>
                      <input
                        id="user-vehicle"
                        type="text"
                        value={defaultVehicle}
                        onChange={(e) => setDefaultVehicle(e.target.value)}
                        placeholder="Hyundai Creta / Nexon EV"
                        className="w-full h-10 px-3 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label htmlFor="user-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address
                </label>
                <div className="flex items-center h-10 px-3 bg-white border border-slate-200 rounded-lg focus-within:border-blue-600">
                  <Mail className="w-4 h-4 text-slate-400 mr-2 shrink-0" aria-hidden="true" />
                  <input
                    id="user-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full text-sm text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="user-password" className="block text-xs font-semibold text-slate-700 mb-1">
                  Password
                </label>
                <div className="flex items-center h-10 px-3 bg-white border border-slate-200 rounded-lg focus-within:border-blue-600">
                  <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" aria-hidden="true" />
                  <input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password (min. 6 characters)"
                    className="w-full text-sm text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="text-slate-400 hover:text-slate-700 cursor-pointer ml-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : mode === 'register'
                    ? 'Create Driver Account'
                    : 'Sign In as Driver'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>Sign in or create an account to search &amp; reserve spots</span>
            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="text-slate-700 hover:text-blue-600 font-semibold cursor-pointer"
            >
              Facility Admin Login →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminLoginPageProps {
  onAuthSuccess: (user: AuthUser, token: string) => void;
  onSwitchToUser: () => void;
}

export const AdminLoginPage: React.FC<AdminLoginPageProps> = ({
  onAuthSuccess,
  onSwitchToUser,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fillDemoAdmin = () => {
    setEmail('admin@curbgrid.app');
    setPassword('AdminOps2026!');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          portalRole: 'admin',
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid administrator credentials.');
        setLoading(false);
        return;
      }

      onAuthSuccess(data.user, data.token);
    } catch {
      setError('Network error connecting to CurbGrid operations server.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-7 sm:p-8 shadow-2xl">
        <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-400">
              <Shield className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Facility Operations Portal</span>
            </div>
            <h1 className="font-display text-2xl font-bold text-white mt-1.5">
              Administrator Sign In
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manage garage rates, bay availability, and live driver reservations.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Operator Email
            </label>
            <div className="flex items-center h-10 px-3 bg-slate-950 border border-slate-700 rounded-lg focus-within:border-blue-500">
              <Mail className="w-4 h-4 text-slate-500 mr-2 shrink-0" aria-hidden="true" />
              <input
                id="admin-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@example.com"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Password
            </label>
            <div className="flex items-center h-10 px-3 bg-slate-950 border border-slate-700 rounded-lg focus-within:border-blue-500">
              <KeyRound className="w-4 h-4 text-slate-500 mr-2 shrink-0" aria-hidden="true" />
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter operator password"
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="text-slate-500 hover:text-slate-300 cursor-pointer ml-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs font-medium text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{loading ? 'Verifying Credentials...' : 'Sign In to Admin Console'}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={fillDemoAdmin}
            className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 cursor-pointer"
          >
            Use Demo Admin Credentials
          </button>
          <button
            type="button"
            onClick={onSwitchToUser}
            className="text-slate-400 hover:text-white font-medium cursor-pointer"
          >
            ← Driver Login
          </button>
        </div>
      </div>
    </div>
  );
};
