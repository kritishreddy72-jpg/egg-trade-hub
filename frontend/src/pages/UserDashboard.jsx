import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { 
  Egg, Layers, Calendar, Clock, CreditCard, Banknote, CheckCircle2, 
  Truck, AlertCircle, Plus, ChevronRight, ArrowDownRight, ArrowUpRight, 
  RefreshCw, MapPin, Phone, HelpCircle, FileText
} from 'lucide-react';

export function UserDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeOrder, setActiveOrder] = useState(null);
  const [orders, setOrders] = useState([]);
  const [balanceData, setBalanceData] = useState({
    outstandingBalance: 0,
    unpaidOrdersCount: 0,
    unpaidOrders: [],
    recentLedger: []
  });
  const [todayPrice, setTodayPrice] = useState(210);
  const [loading, setLoading] = useState(true);

  // New Order Form state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [trays, setTrays] = useState('25');
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('credit');
  const [notes, setNotes] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState(false);

  // Breakdown modal state
  const [showBreakdownModal, setShowBreakdownModal] = useState(false);

  const fetchUserData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('egg_trade_token');
      const authHeader = { Authorization: `Bearer ${token}` };

      const [ordersRes, activeRes, balanceRes, priceRes] = await Promise.all([
        fetch('/api/orders/my-orders', { headers: authHeader }),
        fetch('/api/orders/active', { headers: authHeader }),
        fetch('/api/customers/my/balance', { headers: authHeader }),
        fetch('/api/prices/today')
      ]);

      if (ordersRes.ok) {
        const oData = await ordersRes.json();
        setOrders(oData.orders || []);
      }
      if (activeRes.ok) {
        const aData = await activeRes.json();
        setActiveOrder(aData.activeOrder || null);
      }
      if (balanceRes.ok) {
        const bData = await balanceRes.json();
        setBalanceData(bData);
      }
      if (priceRes.ok) {
        const pData = await priceRes.json();
        if (pData.price) setTodayPrice(Number(pData.price));
      }
    } catch (err) {
      console.error('Error fetching user dashboard data:', err);
      addToast('Failed to refresh your dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const numTrays = parseInt(trays, 10) || 0;
  const estimatedTotal = Math.round(numTrays * todayPrice * 100) / 100;

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (numTrays <= 0) {
      addToast('Please enter a valid number of trays', 'error');
      return;
    }

    setSubmittingOrder(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        },
        body: JSON.stringify({
          trays: numTrays,
          delivery_date: deliveryDate,
          payment_mode: paymentMode,
          notes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to place order');
      }

      addToast('Your order has been placed successfully!', 'success');
      setIsOrderModalOpen(false);
      setNotes('');
      fetchUserData();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Helper for order status progress steps
  const getStatusStepIndex = (status) => {
    switch (status) {
      case 'pending': return 0;
      case 'confirmed': return 1;
      case 'out_for_delivery': return 2;
      case 'delivered': return 3;
      default: return 0;
    }
  };

  const steps = [
    { key: 'pending', label: 'Order Placed', desc: 'Received at hub' },
    { key: 'confirmed', label: 'Confirmed', desc: 'Crates packed' },
    { key: 'out_for_delivery', label: 'Out for Delivery', desc: 'On wholesale van' },
    { key: 'delivered', label: 'Delivered', desc: 'Stock received' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Customer Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <span>Customer Portal</span>
            <span>•</span>
            <span className="text-slate-500 font-medium">{user?.phone}</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Welcome, {user?.name}
          </h1>
          {user?.address && (
            <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{user.address}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchUserData}
            title="Refresh status"
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-amber-600/20 transition active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Place New Order</span>
          </button>
        </div>
      </div>

      {/* 2. Three Primary Summary Cards (Balance, Active Order, Today's Rate) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card A: Outstanding Credit Balance (Requirement 2c) */}
        <div className={`p-5 rounded-2xl border shadow-xs flex flex-col justify-between ${
          balanceData.outstandingBalance > 0
            ? 'bg-gradient-to-br from-rose-50 to-orange-50/70 border-rose-200'
            : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Outstanding Credit Balance
              </span>
              <div className={`p-1.5 rounded-lg ${
                balanceData.outstandingBalance > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                <CreditCard className="w-4 h-4" />
              </div>
            </div>

            <div className={`text-3xl font-black mt-2 ${
              balanceData.outstandingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
            }`}>
              ₹{Number(balanceData.outstandingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>

            <div className="text-xs text-slate-600 mt-1">
              {balanceData.outstandingBalance > 0
                ? `${balanceData.unpaidOrdersCount} unpaid credit order(s) pending payment`
                : 'All past orders fully settled! No credit due.'}
            </div>
          </div>

          {balanceData.outstandingBalance > 0 && (
            <button
              onClick={() => setShowBreakdownModal(true)}
              className="mt-4 pt-3 border-t border-rose-200/80 flex items-center justify-between text-xs font-bold text-rose-800 hover:text-rose-900 transition"
            >
              <span>View Contributing Orders Breakdown</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Card B: Today's Wholesale Egg Tray Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Today's Wholesale Price
              </span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                <Egg className="w-4 h-4" />
              </div>
            </div>

            <div className="text-3xl font-black text-slate-900 mt-2">
              ₹{todayPrice.toFixed(2)}
              <span className="text-xs text-slate-400 font-medium ml-1">/ tray</span>
            </div>

            <div className="text-xs text-slate-500 mt-1">
              Standard commercial wholesale pack (30 eggs/tray)
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600 flex items-center justify-between">
            <span>Direct from wholesale distributor</span>
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
              Live Rate
            </span>
          </div>
        </div>

        {/* Card C: Quick Order CTA */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
              Need Egg Stock?
            </span>
            <h3 className="text-xl font-bold mt-1">Book Today's Delivery</h3>
            <p className="text-xs text-amber-100 mt-1">
              Select tray quantity and choose delivery date. We supply directly to your doorstep.
            </p>
          </div>

          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="mt-4 py-2 px-4 bg-white hover:bg-amber-50 text-amber-900 font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Book Tray Order Now
          </button>
        </div>
      </div>

      {/* 3. Active Order Status Tracker (Requirement 2a) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-900">Current Order & Delivery Status</h2>
          </div>
          {activeOrder && (
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${
              activeOrder.order_status === 'delivered'
                ? 'bg-emerald-100 text-emerald-800'
                : activeOrder.order_status === 'out_for_delivery'
                ? 'bg-blue-100 text-blue-800 animate-pulse'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {activeOrder.order_status.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {!activeOrder ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Egg className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className="text-sm font-semibold text-slate-700">No active delivery in progress</p>
            <p className="text-xs text-slate-400 mt-1">
              All your previous orders have been fulfilled. Place a new order when ready.
            </p>
            <button
              onClick={() => setIsOrderModalOpen(true)}
              className="mt-3 px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
            >
              Order Trays
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Details Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-xl text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Order ID</span>
                <span className="font-mono font-bold text-slate-900 text-sm">#{activeOrder.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Quantity</span>
                <span className="font-bold text-slate-900 text-sm">{activeOrder.trays} trays ({activeOrder.trays * 30} eggs)</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery Date</span>
                <span className="font-bold text-slate-900 text-sm">{activeOrder.delivery_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Amount</span>
                <span className="font-black text-amber-900 text-sm">₹{Number(activeOrder.total_amount).toLocaleString()}</span>
              </div>
            </div>

            {/* Visual Step Progress Tracker */}
            <div className="pt-2">
              <div className="grid grid-cols-4 gap-2 sm:gap-4 relative">
                {steps.map((step, idx) => {
                  const currentIdx = getStatusStepIndex(activeOrder.order_status);
                  const isCompleted = idx <= currentIdx;
                  const isCurrent = idx === currentIdx;

                  return (
                    <div key={step.key} className="flex flex-col items-center text-center relative z-10">
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition shadow-xs ${
                        isCompleted
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {idx + 1}
                      </div>
                      <div className={`mt-2 font-bold text-xs sm:text-sm ${
                        isCurrent ? 'text-amber-900' : isCompleted ? 'text-slate-900' : 'text-slate-400'
                      }`}>
                        {step.label}
                      </div>
                      <div className="text-[10px] text-slate-400 hidden sm:block mt-0.5">
                        {step.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Past Order History Table (Requirement 2b) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your Order History</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete record of trays, price per tray, totals, and payment status.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
            {orders.length} orders
          </span>
        </div>

        {orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            No orders placed yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Trays</th>
                  <th className="py-3 px-4">Price / Tray</th>
                  <th className="py-3 px-4">Total Amount</th>
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4">Order Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50 transition">
                    <td className="py-3.5 px-4 font-medium text-slate-900">
                      {new Date(o.order_date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                      #{o.id}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {o.trays} trays
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      ₹{Number(o.price_per_tray).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 font-black text-slate-900">
                      ₹{Number(o.total_amount).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        o.payment_mode === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {o.payment_mode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[11px] font-bold ${
                        o.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {o.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${
                        o.order_status === 'delivered'
                          ? 'bg-emerald-50 text-emerald-700'
                          : o.order_status === 'out_for_delivery'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {o.order_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. MODAL: Place New Order */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Egg className="w-5 h-5" />
                <h3 className="font-bold text-base">Book Egg Tray Order</h3>
              </div>
              <button
                onClick={() => setIsOrderModalOpen(false)}
                className="p-1 rounded-lg text-amber-100 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePlaceOrder} className="p-6 space-y-4">
              {/* Number of trays */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Number of Egg Trays *
                </label>
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
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[11px] text-slate-400">Quick:</span>
                  {[10, 25, 50, 100].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTrays(t.toString())}
                      className={`px-2.5 py-0.5 text-xs font-semibold rounded-lg border transition ${
                        trays === t.toString()
                          ? 'bg-amber-100 border-amber-300 text-amber-900'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {t} trays
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Required Delivery Date *
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="date"
                    required
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Payment Mode Choice */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Payment Mode Preference *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      paymentMode === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    Cash on Delivery
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMode('credit')}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                      paymentMode === 'credit'
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-amber-600" />
                    Credit Account
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Delivery Remarks (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Please deliver before 10 AM"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              {/* Live Calculation */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-amber-900 font-medium">
                    {numTrays} trays × ₹{todayPrice.toFixed(2)}
                  </div>
                  <div className="text-xl font-black text-amber-950">
                    ₹{estimatedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">
                  Estimated Total
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOrder || numTrays <= 0}
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-md transition disabled:opacity-50"
                >
                  {submittingOrder ? 'Placing Order...' : 'Confirm & Place Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MODAL: Unpaid Credit Orders Breakdown (Requirement 2c) */}
      {showBreakdownModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                <h3 className="font-bold text-base">Outstanding Credit Breakdown</h3>
              </div>
              <button
                onClick={() => setShowBreakdownModal(false)}
                className="p-1 rounded-lg text-rose-100 hover:text-white transition"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-rose-800 font-medium">Total Credit Due</span>
                  <div className="text-2xl font-black text-rose-950">
                    ₹{Number(balanceData.outstandingBalance).toLocaleString()}
                  </div>
                </div>
                <span className="text-xs font-bold px-2 py-1 rounded bg-rose-200 text-rose-900">
                  {balanceData.unpaidOrdersCount} Pending Order(s)
                </span>
              </div>

              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Contributing Unpaid Credit Orders:
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {balanceData.unpaidOrders.map((uo) => (
                  <div key={uo.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-bold text-slate-900">Order #{uo.id}</div>
                      <div className="text-slate-500 text-[11px]">
                        {uo.order_date} • {uo.trays} trays @ ₹{uo.price_per_tray}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-rose-600 text-sm">
                        ₹{Number(uo.total_amount).toLocaleString()}
                      </div>
                      <span className="text-[10px] font-semibold text-slate-500 uppercase">
                        Unpaid Credit
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {balanceData.recentLedger && balanceData.recentLedger.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Recent Credit & Settlement Activity
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto text-[11px]">
                    {balanceData.recentLedger.slice(0, 5).map((l) => (
                      <div key={l.id} className="flex items-center justify-between p-1.5 rounded bg-slate-50">
                        <span className="text-slate-600">{l.notes || l.type} ({l.date})</span>
                        <span className={`font-bold ${l.type === 'credit_settled' ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {l.type === 'credit_settled' ? '-' : '+'}₹{Number(l.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowBreakdownModal(false)}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
