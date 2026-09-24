import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { X, Calendar, TrendingUp, History, Check, DollarSign } from 'lucide-react';

export function PriceModal({ isOpen, onClose, onPriceUpdated }) {
  const { addToast } = useToast();
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('set'); // 'set' or 'history'
  const [targetDate, setTargetDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentAndHistory();
    }
  }, [isOpen]);

  const fetchCurrentAndHistory = async () => {
    try {
      const [todayRes, historyRes] = await Promise.all([
        fetch('/api/prices/today'),
        fetch('/api/prices/history', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
          }
        })
      ]);

      if (todayRes.ok) {
        const todayData = await todayRes.json();
        if (todayData.price) {
          setPrice(todayData.price.toString());
        }
      }

      if (historyRes.ok) {
        const histData = await historyRes.json();
        setHistory(histData.history || []);
      }
    } catch (err) {
      console.error('Error fetching price info:', err);
    }
  };

  const handleSavePrice = async (e) => {
    e.preventDefault();
    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice <= 0) {
      addToast('Please enter a valid tray price (e.g. 210)', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/prices/today', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        },
        body: JSON.stringify({ price: numPrice, date: targetDate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update price');
      }

      addToast(data.message, 'success');
      if (onPriceUpdated) onPriceUpdated();
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            <h3 className="font-bold text-lg">Daily Egg Tray Price</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-amber-100 hover:text-white hover:bg-amber-600/50 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-4">
          <button
            onClick={() => setActiveTab('set')}
            className={`pb-2 text-sm font-semibold border-b-2 transition ${
              activeTab === 'set'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Set Daily Price
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2 text-sm font-semibold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-amber-500 text-amber-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            Price History Log
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'set' ? (
            <form onSubmit={handleSavePrice} className="space-y-4">
              <p className="text-xs text-slate-600">
                Set or revise the wholesale rate per tray (30 eggs). All orders created on this date will automatically calculate with this rate.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Price per Tray (₹) *
                </label>
                <div className="relative">
                  <span className="text-slate-400 font-bold text-base absolute left-3 top-2.5">₹</span>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    placeholder="e.g. 210.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-lg font-bold text-slate-900 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Quick helper pills */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500">Quick set:</span>
                {[195, 200, 205, 210, 215].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setPrice(val.toString())}
                    className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 transition"
                  >
                    ₹{val}
                  </button>
                ))}
              </div>

              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save & Apply Price
                </button>
              </div>
            </form>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px]">
                    <th className="pb-2 font-semibold">Date</th>
                    <th className="pb-2 font-semibold text-right">Price per Tray</th>
                    <th className="pb-2 font-semibold text-right">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan="3" className="py-4 text-center text-slate-400">
                        No price records found
                      </td>
                    </tr>
                  ) : (
                    history.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-medium text-slate-900">
                          {new Date(h.date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </td>
                        <td className="py-2.5 text-right font-bold text-amber-700">
                          ₹{Number(h.price_per_tray).toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right text-slate-400 text-[11px]">
                          {h.updated_at ? h.updated_at.split(' ')[0] : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
