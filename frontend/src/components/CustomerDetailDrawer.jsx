import React, { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { 
  X, Phone, MapPin, CreditCard, Clock, CheckCircle2, AlertTriangle, 
  Plus, DollarSign, History, ArrowDownRight, ArrowUpRight, ShoppingBag 
} from 'lucide-react';

export function CustomerDetailDrawer({ customerId, onClose, onRefreshRequired, onQuickOrderForCustomer }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'ledger', 'settle'
  
  // Settle credit state
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (customerId) {
      fetchCustomerDetail();
    }
  }, [customerId]);

  const fetchCustomerDetail = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
        if (json.creditBalance > 0) {
          setSettleAmount(json.creditBalance.toString());
        }
      } else {
        addToast('Failed to load customer profile', 'error');
      }
    } catch (err) {
      console.error('Error fetching customer details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSettleSubmit = async (e) => {
    e.preventDefault();
    const num = parseFloat(settleAmount);
    if (isNaN(num) || num <= 0) {
      addToast('Please enter a valid payment amount', 'error');
      return;
    }

    setSettling(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/settle-credit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        },
        body: JSON.stringify({
          amount: num,
          notes: settleNotes
        })
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to settle credit');
      }

      addToast(result.message, 'success');
      setActiveTab('orders');
      setSettleNotes('');
      fetchCustomerDetail();
      if (onRefreshRequired) onRefreshRequired();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSettling(false);
    }
  };

  if (!customerId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 backdrop-blur-xs flex justify-end animate-in fade-in">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col transform transition ease-in-out duration-300">
        {/* Drawer Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <div className="text-xs uppercase font-bold tracking-wider text-amber-400">
              Customer Account Details
            </div>
            <h2 className="text-lg font-bold">{data?.customer?.name || 'Loading Customer...'}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-slate-400">
            Loading profile and orders...
          </div>
        ) : !data ? (
          <div className="p-8 text-center text-slate-500">Customer not found.</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Contact & Info Card */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <a href={`tel:${data.customer.phone}`} className="font-semibold hover:text-amber-600">
                    {data.customer.phone}
                  </a>
                </div>
                {data.customer.address && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{data.customer.address}</span>
                  </div>
                )}
              </div>

              {/* Action: Quick Order for this customer */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onQuickOrderForCustomer) onQuickOrderForCustomer(data.customer.id);
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
              >
                <Plus className="w-3.5 h-3.5" />
                New Order for Customer
              </button>
            </div>

            {/* Outstanding Credit Balance Card */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              data.creditBalance > 0
                ? 'bg-gradient-to-r from-rose-50 to-orange-50 border-rose-200 text-rose-950'
                : 'bg-emerald-50 border-emerald-200 text-emerald-950'
            }`}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Outstanding Credit Balance (Udhar)
                </span>
                <div className="text-2xl font-black mt-0.5">
                  ₹{Number(data.creditBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-xs mt-1">
                  {data.unpaidCreditOrders.length} unpaid credit order(s) pending
                </div>
              </div>

              {data.creditBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('settle')}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <DollarSign className="w-4 h-4" />
                  Receive Payment
                </button>
              )}
            </div>

            {/* Navigation Tabs within Drawer */}
            <div className="flex border-b border-slate-200 gap-4">
              <button
                onClick={() => setActiveTab('orders')}
                className={`pb-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition ${
                  activeTab === 'orders'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Order History ({data.orderHistory.length})
              </button>
              <button
                onClick={() => setActiveTab('ledger')}
                className={`pb-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition ${
                  activeTab === 'ledger'
                    ? 'border-amber-600 text-amber-900'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                Credit Ledger ({data.ledgerHistory.length})
              </button>
              {data.creditBalance > 0 && (
                <button
                  onClick={() => setActiveTab('settle')}
                  className={`pb-2.5 text-xs font-bold uppercase tracking-wide border-b-2 transition ${
                    activeTab === 'settle'
                      ? 'border-emerald-600 text-emerald-800'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Receive Payment
                </button>
              )}
            </div>

            {/* TAB CONTENT: Settle Credit Payment */}
            {activeTab === 'settle' && (
              <form onSubmit={handleSettleSubmit} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Record Customer Credit Settlement
                </div>
                <p className="text-xs text-slate-600">
                  Record cash, UPI, or cheque payment received from {data.customer.name}. This immediately reduces their outstanding credit balance.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount Received (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    className="w-full px-3 py-2.5 text-lg font-bold border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <div className="flex gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setSettleAmount(data.creditBalance.toString())}
                      className="text-[11px] font-semibold text-emerald-700 hover:underline"
                    >
                      Fill Full Balance (₹{data.creditBalance})
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Payment Remarks / Reference (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via PhonePe / Cash handover"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('orders')}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={settling}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition disabled:opacity-50"
                  >
                    {settling ? 'Recording...' : 'Record Payment Settlement'}
                  </button>
                </div>
              </form>
            )}

            {/* TAB CONTENT: Orders List */}
            {activeTab === 'orders' && (
              <div className="space-y-3">
                {data.orderHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No orders found for this customer.</p>
                ) : (
                  data.orderHistory.map((o) => (
                    <div
                      key={o.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Order #{o.id}</span>
                          <span className="text-[11px] text-slate-500">
                            {new Date(o.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${
                            o.order_status === 'delivered'
                              ? 'bg-emerald-100 text-emerald-800'
                              : o.order_status === 'out_for_delivery'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {o.order_status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          <strong>{o.trays} trays</strong> @ ₹{o.price_per_tray} / tray
                          {o.notes && <span className="text-slate-400 ml-2">({o.notes})</span>}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-sm text-slate-900">
                          ₹{Number(o.total_amount).toLocaleString()}
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-0.5">
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                            o.payment_mode === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {o.payment_mode}
                          </span>
                          <span className={`text-[10px] font-bold ${
                            o.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {o.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: Credit Ledger */}
            {activeTab === 'ledger' && (
              <div className="space-y-2.5">
                <div className="text-xs text-slate-500 pb-1">
                  Complete audit log of credit extended and payments settled for this customer.
                </div>
                {data.ledgerHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No credit activity logged.</p>
                ) : (
                  data.ledgerHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          item.type === 'credit_settled'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.type === 'credit_settled' ? (
                            <ArrowDownRight className="w-4 h-4" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.type === 'credit_settled' ? 'Payment Received (Credit Settled)' : 'Credit Extended'}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {item.notes || (item.order_id ? `Order #${item.order_id}` : 'General Settlement')} • {item.date}
                          </div>
                        </div>
                      </div>

                      <div className={`font-extrabold text-sm ${
                        item.type === 'credit_settled' ? 'text-emerald-600' : 'text-amber-800'
                      }`}>
                        {item.type === 'credit_settled' ? '-' : '+'}₹{Number(item.amount).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
