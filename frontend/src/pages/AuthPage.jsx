import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Egg, Lock, Phone, User, MapPin, ShieldCheck, ArrowRight, Sparkles, Building2, Store } from 'lucide-react';

export function AuthPage() {
  const { login, register } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('user'); // 'user' or 'owner'
  const [isRegistering, setIsRegistering] = useState(false); // only for user
  const [loading, setLoading] = useState(false);

  // Form states
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const demoAccounts = [
    { role: 'owner', name: 'Rajesh Sharma', phone: '9999999999', pass: 'owner123', label: '👑 Owner / Admin', desc: 'Manage prices, today orders, credit & analytics' },
    { role: 'user', name: 'Sri Krishna Bakery', phone: '9876543211', pass: 'user123', label: '🍞 Sri Krishna Bakery', desc: 'Has active order & credit balance' },
    { role: 'user', name: 'Anand Supermarket', phone: '9876543212', pass: 'user123', label: '🛒 Anand Supermarket', desc: 'Bulk buyer with outstanding credit' },
    { role: 'user', name: 'Hotel Annapurna', phone: '9876543213', pass: 'user123', label: '🏨 Hotel Annapurna', desc: 'Daily delivery customer' },
    { role: 'user', name: 'Ramesh Dhabha', phone: '9876543214', pass: 'user123', label: '🍲 Ramesh Dhabha', desc: 'Highway restaurant customer' }
  ];

  const handleDemoClick = async (demo) => {
    setLoading(true);
    try {
      await login(demo.phone, demo.pass, demo.role);
      addToast(`Logged in as ${demo.name} (${demo.role === 'owner' ? 'Owner' : 'Customer'})`, 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (activeTab === 'user' && isRegistering) {
        // Customer registration
        if (!name || !identifier || !password) {
          throw new Error('Please fill in Name, Phone, and Password');
        }
        await register({
          name,
          phone: identifier,
          address,
          password
        });
        addToast('Registration successful! Welcome to EggTrade.', 'success');
      } else {
        // Login
        if (!identifier || !password) {
          throw new Error('Please enter your phone number and password');
        }
        await login(identifier, password, activeTab);
        addToast(`Welcome back! Logged in as ${activeTab === 'owner' ? 'Owner' : 'Customer'}`, 'success');
      }
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* App Logo */}
        <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 items-center justify-center shadow-lg shadow-amber-500/25 text-white mb-4">
          <Egg className="w-9 h-9 stroke-[2.2]" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          EggTrade Hub
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Wholesale Egg Trading & Daily Distribution System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        {/* 1-Click Quick Demo Login Box */}
        <div className="mb-6 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2.5 text-xs font-bold uppercase tracking-wider text-amber-900">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Quick 1-Click Demo Evaluation Logins
          </div>
          <p className="text-xs text-amber-800/80 mb-3">
            Click any seeded role below to test the full-stack flow instantly without manual entry:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {demoAccounts.map((d) => (
              <button
                key={d.phone}
                onClick={() => handleDemoClick(d)}
                disabled={loading}
                className="flex items-start text-left gap-2 p-2.5 rounded-xl bg-white hover:bg-amber-100/60 border border-amber-200 text-slate-800 transition shadow-xs group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-900 group-hover:text-amber-800 truncate">
                    {d.label}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{d.desc}</div>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-0.5 transition shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white py-7 px-6 sm:px-8 shadow-sm border border-slate-200 rounded-2xl">
          {/* Tab Selection */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('user');
                setIsRegistering(false);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition ${
                activeTab === 'user'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-4 h-4 text-amber-600" />
              Customer Portal
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('owner');
                setIsRegistering(false);
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 text-xs sm:text-sm font-semibold rounded-lg transition ${
                activeTab === 'owner'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4 text-amber-600" />
              Owner / Admin
            </button>
          </div>

          {/* Form Title & Subtitle */}
          <div className="mb-5">
            <h3 className="text-lg font-bold text-slate-900">
              {activeTab === 'owner'
                ? 'Wholesale Owner Access'
                : isRegistering
                ? 'Create New Customer Account'
                : 'Customer / Store Login'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeTab === 'owner'
                ? 'Fixed administrator access for daily pricing, order dispatch, and credit ledger.'
                : isRegistering
                ? 'Register your store or bakery to place bulk egg orders with daily prices.'
                : 'Sign in with your registered phone number to track orders and balances.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* If Registering as User, show Name and Address */}
            {activeTab === 'user' && isRegistering && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store / Customer Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Balaji Sweets & Bakery"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Address
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Shop No, Street, Landmark"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Phone / Identifier */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {activeTab === 'owner' ? 'Phone Number or Email *' : 'Phone Number *'}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder={activeTab === 'owner' ? '9999999999 or owner@eggtrade.com' : '10-digit mobile number'}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 rounded-xl text-white font-semibold text-sm bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 shadow-md shadow-amber-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Processing...</span>
              ) : activeTab === 'user' && isRegistering ? (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <span>Sign In as {activeTab === 'owner' ? 'Owner' : 'Customer'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Toggle between Login and Registration for Customer role */}
          {activeTab === 'user' && (
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              {isRegistering ? (
                <p className="text-xs text-slate-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="font-bold text-amber-700 hover:text-amber-800 underline ml-1"
                  >
                    Log In
                  </button>
                </p>
              ) : (
                <p className="text-xs text-slate-600">
                  New egg buyer / commercial customer?{' '}
                  <button
                    type="button"
                    onClick={() => setIsRegistering(true)}
                    className="font-bold text-amber-700 hover:text-amber-800 underline ml-1"
                  >
                    Register here
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Notice for Owner role */}
          {activeTab === 'owner' && (
            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                Admin credentials are fixed and pre-seeded for security.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
