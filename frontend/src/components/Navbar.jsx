import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import { Egg, LogOut, Users, RefreshCw, Sparkles, ChevronDown } from 'lucide-react';

export function Navbar({ onOpenPriceModal, refreshTrigger }) {
  const { user, logout, login } = useAuth();
  const { addToast } = useToast();
  const [todayPrice, setTodayPrice] = useState(null);
  const [demoMenuOpen, setDemoMenuOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const fetchTodayPrice = async () => {
    try {
      const res = await fetch('/api/prices/today');
      if (res.ok) {
        const data = await res.json();
        setTodayPrice(data);
      }
    } catch (err) {
      console.error('Failed to load today price', err);
    }
  };

  useEffect(() => {
    fetchTodayPrice();
  }, [refreshTrigger]);

  const demoAccounts = [
    { role: 'owner', name: 'Rajesh Sharma (Owner)', identifier: '9999999999', pass: 'owner123', label: '👑 Owner / Admin' },
    { role: 'user', name: 'Sri Krishna Bakery', identifier: '9876543211', pass: 'user123', label: '🍞 Sri Krishna Bakery' },
    { role: 'user', name: 'Anand Supermarket', identifier: '9876543212', pass: 'user123', label: '🛒 Anand Supermarket' },
    { role: 'user', name: 'Hotel Annapurna', identifier: '9876543213', pass: 'user123', label: '🏨 Hotel Annapurna' },
    { role: 'user', name: 'Ramesh Dhabha', identifier: '9876543214', pass: 'user123', label: '🍲 Ramesh Dhabha' }
  ];

  const handleQuickSwitch = async (acc) => {
    setIsSwitching(true);
    setDemoMenuOpen(false);
    try {
      await login(acc.identifier, acc.pass, acc.role);
      addToast(`Switched to ${acc.name}`, 'info');
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center shadow-md shadow-amber-500/20 text-white">
              <Egg className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-amber-900 to-amber-700 bg-clip-text text-transparent">
                EggTrade
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                Wholesale Hub
              </span>
            </div>
          </div>

          {/* Center Info: Today's Egg Tray Price */}
          <div className="flex items-center gap-3">
            {todayPrice && (
              <div
                onClick={() => user?.role === 'owner' && onOpenPriceModal && onOpenPriceModal()}
                title={user?.role === 'owner' ? 'Click to update today price' : "Today's Tray Rate"}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-medium transition ${
                  user?.role === 'owner'
                    ? 'cursor-pointer hover:bg-amber-50 border-amber-200 bg-amber-50/50 text-amber-900'
                    : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-slate-500">Today's Rate:</span>
                <span className="font-bold text-amber-700">
                  {todayPrice.price ? `₹${Number(todayPrice.price).toFixed(2)}` : 'Not Set'}
                </span>
                <span className="text-[11px] text-slate-400">/ tray</span>
                {user?.role === 'owner' && (
                  <span className="hidden md:inline-block text-[10px] font-semibold uppercase bg-amber-200/70 text-amber-900 px-1.5 py-0.5 rounded">
                    Edit
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Quick Switcher, User Role Badge & Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Demo Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setDemoMenuOpen(!demoMenuOpen)}
                disabled={isSwitching}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs sm:text-sm font-medium transition"
              >
                <Users className="w-4 h-4 text-amber-600" />
                <span className="hidden md:inline">Switch Role</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {demoMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setDemoMenuOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-30 animate-in fade-in zoom-in-95">
                    <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-100 mb-1">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      1-Click Demo Switcher
                    </div>
                    {demoAccounts.map((acc) => (
                      <button
                        key={acc.identifier}
                        onClick={() => handleQuickSwitch(acc)}
                        className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-50 transition ${
                          user?.phone === acc.identifier ? 'bg-amber-50/70 font-semibold text-amber-900' : 'text-slate-700'
                        }`}
                      >
                        <div className="truncate">
                          <div>{acc.label}</div>
                          <div className="text-[10px] text-slate-400">{acc.identifier}</div>
                        </div>
                        {user?.phone === acc.identifier && (
                          <span className="text-[10px] bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Current user name/role */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-900 leading-tight">
                {user?.name}
              </span>
              <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.2 rounded ${
                user?.role === 'owner' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {user?.role === 'owner' ? 'Owner / Admin' : 'Customer'}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              title="Log Out"
              className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
