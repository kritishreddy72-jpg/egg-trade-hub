import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Navbar } from './components/Navbar';
import { AuthPage } from './pages/AuthPage';
import { OwnerDashboard } from './pages/OwnerDashboard';
import { UserDashboard } from './pages/UserDashboard';
import { PriceModal } from './components/PriceModal';
import { Egg } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-lg animate-pulse mb-3">
          <Egg className="w-7 h-7" />
        </div>
        <p className="text-xs font-semibold text-slate-500">Loading EggTrade Hub...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      <Navbar
        onOpenPriceModal={() => setIsPriceModalOpen(true)}
        refreshTrigger={refreshTrigger}
      />

      <main className="flex-1 pb-12">
        {user.role === 'owner' ? (
          <OwnerDashboard onPriceTrigger={() => setRefreshTrigger((prev) => prev + 1)} />
        ) : (
          <UserDashboard />
        )}
      </main>

      {/* Global Footer */}
      <footer className="border-t border-slate-200 bg-white/70 py-4 text-center text-xs text-slate-400">
        EggTrade Wholesale & Distribution Hub • Full-Stack Solution • Logged in as <strong className="text-slate-700">{user.name}</strong> ({user.role})
      </footer>

      {/* Owner Daily Price Quick Modal triggerable from Navbar */}
      {user.role === 'owner' && (
        <PriceModal
          isOpen={isPriceModalOpen}
          onClose={() => setIsPriceModalOpen(false)}
          onPriceUpdated={() => setRefreshTrigger((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
