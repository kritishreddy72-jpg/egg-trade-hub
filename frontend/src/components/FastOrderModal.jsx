import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { X, ShoppingBag, Banknote, CreditCard, User, Layers, Calculator, Sparkles } from 'lucide-react';

export function FastOrderModal({ isOpen, onClose, onOrderPlaced, initialCustomerId = null }) {
  const { addToast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId || '');
  const [trays, setTrays] = useState('25');
  const [notes, setNotes] = useState('');
  const [todayPrice, setTodayPrice] = useState(210);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchInitialData();
      if (initialCustomerId) {
        setSelectedCustomerId(initialCustomerId);
      }
    }
  }, [isOpen, initialCustomerId]);

  const fetchInitialData = async () => {
    try {
      const [priceRes, custRes] = await Promise.all([
        fetch('/api/prices/today'),
        fetch('/api/customers', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
          }
        })
      ]);

      if (priceRes.ok) {
        const pData = await priceRes.json();
        if (pData.price) setTodayPrice(Number(pData.price));
      }

      if (custRes.ok) {
        const cData = await custRes.json();
        setCustomers(cData.customers || []);
        if (!initialCustomerId && cData.customers && cData.customers.length > 0) {
          setSelectedCustomerId(cData.customers[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load customers or price:', err);
    }
  };

  const numTrays = parseInt(trays, 10) || 0;
  const totalAmount = Math.round(numTrays * todayPrice * 100) / 100;
  const selectedCustomer = customers.find((c) => c.id.toString() === selectedCustomerId?.toString());

  const handleSelectPaymentMode = async (paymentMode) => {
    if (!selectedCustomerId) {
      addToast('Please select a customer first', 'error');
      return;
    }
    if (numTrays <= 0) {
      addToast('Please enter a valid number of trays', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/orders/fast-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        },
        body: JSON.stringify({
          user_id: selectedCustomerId,
          trays: numTrays,
          payment_mode: paymentMode,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      addToast(data.message, 'success');
      if (onOrderPlaced) onOrderPlaced(data);
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base">Rapid Order Entry & Payment</h3>
              <p className="text-[11px] text-amber-100">Direct wholesale dispatch counter flow</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-white/20 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* 1. Customer Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Select Customer / Store *</span>
              {selectedCustomer && (
                <span className="text-[11px] text-slate-500">
                  Current Credit: <strong className={selectedCustomer.credit_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}>₹{Number(selectedCustomer.credit_balance || 0).toLocaleString()}</strong>
                </span>
              )}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.phone} (Credit: ₹{Math.round(c.credit_balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Number of Egg Trays */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Number of Egg Trays *
              </label>
              <span className="text-[11px] text-slate-500">1 tray = 30 eggs</span>
            </div>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
              <input
                type="number"
                min="1"
                required
                value={trays}
                onChange={(e) => setTrays(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-xl font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Quick Tray Presets */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] text-slate-400">Presets:</span>
              {[10, 25, 50, 100, 150].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setTrays(count.toString())}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition ${
                    trays === count.toString()
                      ? 'bg-amber-100 border-amber-300 text-amber-900'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  +{count}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Live Price Calculation Banner */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-900 font-medium">
                {numTrays} trays × ₹{todayPrice.toFixed(2)} rate
              </div>
              <div className="text-2xl font-black text-amber-950 mt-0.5">
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="p-2.5 bg-amber-200/60 rounded-xl text-amber-800">
              <Calculator className="w-5 h-5" />
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <input
              type="text"
              placeholder="Order notes / delivery remarks (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          {/* 4. Instant Payment Mode Actions (Core Requirement) */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 text-center">
              Confirm & Select Payment Flow
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Option A: Cash on Delivery */}
              <button
                type="button"
                disabled={loading || numTrays <= 0}
                onClick={() => handleSelectPaymentMode('cash')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 transition shadow-sm hover:shadow active:scale-98 disabled:opacity-50 text-center group"
              >
                <Banknote className="w-6 h-6 text-emerald-600 mb-1 group-hover:scale-110 transition" />
                <span className="font-bold text-sm">Cash on Delivery</span>
                <span className="text-[10px] text-emerald-700 font-medium mt-0.5">
                  Mark Paid (No credit added)
                </span>
              </button>

              {/* Option B: Credit */}
              <button
                type="button"
                disabled={loading || numTrays <= 0}
                onClick={() => handleSelectPaymentMode('credit')}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-amber-500 bg-amber-50/80 hover:bg-amber-100 text-amber-950 transition shadow-sm hover:shadow active:scale-98 disabled:opacity-50 text-center group"
              >
                <CreditCard className="w-6 h-6 text-amber-600 mb-1 group-hover:scale-110 transition" />
                <span className="font-bold text-sm">Credit (Udhar)</span>
                <span className="text-[10px] text-amber-700 font-medium mt-0.5">
                  Adds ₹{Math.round(totalAmount)} to credit
                </span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-2">
              Order is confirmed and recorded immediately upon button click.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
