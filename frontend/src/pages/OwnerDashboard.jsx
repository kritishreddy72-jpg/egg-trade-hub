import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { PriceModal } from '../components/PriceModal';
import { FastOrderModal } from '../components/FastOrderModal';
import { CustomerDetailDrawer } from '../components/CustomerDetailDrawer';
import { 
  Egg, Plus, TrendingUp, Users, DollarSign, Calendar, Search, 
  CheckCircle2, Clock, Truck, AlertCircle, RefreshCw, BarChart3,
  CreditCard, Banknote, ArrowRight, ChevronRight, Layers, FileText
} from 'lucide-react';

export function OwnerDashboard({ onPriceTrigger }) {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Navigation tabs in Owner Panel
  // 'today_orders', 'customers', 'analysis', 'price_history'
  const [activeTab, setActiveTab] = useState('today_orders');

  // Modals & Drawers
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [isFastOrderOpen, setIsFastOrderOpen] = useState(false);
  const [selectedCustomerIdForDrawer, setSelectedCustomerIdForDrawer] = useState(null);
  const [fastOrderInitialCustId, setFastOrderInitialCustId] = useState(null);

  // Data states
  const [todayData, setTodayData] = useState({
    date: new Date().toISOString().split('T')[0],
    totalTraysToday: 0,
    totalAmountToday: 0,
    totalOrdersToday: 0,
    orders: []
  });
  const [todayPriceInfo, setTodayPriceInfo] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [analysisDate, setAnalysisDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [analysisData, setAnalysisData] = useState(null);
  const [trendsData, setTrendsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Status filter for today's orders
  const [statusFilter, setStatusFilter] = useState('all');

  // Load core data
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('egg_trade_token');
      const authHeader = { Authorization: `Bearer ${token}` };

      const [ordersRes, priceRes, custRes, analysisRes, trendsRes] = await Promise.all([
        fetch('/api/orders/today', { headers: authHeader }),
        fetch('/api/prices/today'),
        fetch('/api/customers', { headers: authHeader }),
        fetch(`/api/analytics/daily-summary?date=${analysisDate}`, { headers: authHeader }),
        fetch('/api/analytics/trends?days=7', { headers: authHeader })
      ]);

      if (ordersRes.ok) {
        setTodayData(await ordersRes.json());
      }
      if (priceRes.ok) {
        setTodayPriceInfo(await priceRes.json());
      }
      if (custRes.ok) {
        const cJson = await custRes.json();
        setCustomers(cJson.customers || []);
      }
      if (analysisRes.ok) {
        setAnalysisData(await analysisRes.json());
      }
      if (trendsRes.ok) {
        const tJson = await trendsRes.json();
        setTrendsData(tJson.trends || []);
      }
    } catch (err) {
      console.error('Error fetching owner dashboard data:', err);
      addToast('Failed to refresh data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [analysisDate]);

  // Handle Order Status Update (e.g., Pending -> Confirmed -> Out for Delivery -> Delivered)
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('egg_trade_token')}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update order status');

      addToast(data.message, 'success');
      fetchAllData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const filteredOrders = todayData.orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.order_status === statusFilter;
  });

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || (c.address && c.address.toLowerCase().includes(q));
  });

  const totalAllTimeCredit = customers.reduce((sum, c) => sum + (c.credit_balance > 0 ? c.credit_balance : 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* 1. Daily Price Prompt / Status Banner (Requirement 3c) */}
      {todayPriceInfo && !todayPriceInfo.isSetForToday && (
        <div className="bg-amber-500 text-white rounded-2xl p-4 sm:p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl">
              <AlertCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">Set Today's Egg Tray Rate</h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Today's tray price has not been fixed yet. Set it now to ensure automatic pricing for all today's orders.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsPriceModalOpen(true)}
            className="px-5 py-2.5 bg-white text-amber-900 hover:bg-amber-50 text-xs sm:text-sm font-bold rounded-xl shadow transition self-start sm:self-auto shrink-0 flex items-center gap-1.5"
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            Set Today's Price Now
          </button>
        </div>
      )}

      {/* 2. Top Header & Action Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider">
            <span>Owner Control Panel</span>
            <span>•</span>
            <span className="text-slate-500 font-medium">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Egg Distribution Management
          </h1>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Set / Update Price Button */}
          <button
            onClick={() => setIsPriceModalOpen(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold flex items-center gap-2 transition"
          >
            <TrendingUp className="w-4 h-4 text-amber-600" />
            <span>Today's Rate: <strong>₹{todayPriceInfo?.price || '210'}</strong></span>
          </button>

          {/* Quick Refresh */}
          <button
            onClick={fetchAllData}
            title="Refresh dashboard"
            className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* Core Action: Rapid Order Entry */}
          <button
            onClick={() => {
              setFastOrderInitialCustId(null);
              setIsFastOrderOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-amber-600/20 transition active:scale-98"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Fast Order Entry</span>
          </button>
        </div>
      </div>

      {/* 3. Auto-calculated Summary Cards (Requirements 3b & 3f) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Trays Required Today (3b) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Trays Required Today</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900">
              {todayData.totalTraysToday}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {todayData.totalOrdersToday} order(s) received today
            </div>
          </div>
        </div>

        {/* Total Cash Received Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Today's Cash Received</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
              <Banknote className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              ₹{analysisData ? Number(analysisData.totalCashReceived).toLocaleString() : '0'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              COD orders + settlements
            </div>
          </div>
        </div>

        {/* Total New Credit Added Today */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>New Credit Today</span>
            <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-orange-600">
              ₹{analysisData ? Number(analysisData.totalCreditAdded).toLocaleString() : '0'}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Extended on credit today
            </div>
          </div>
        </div>

        {/* Running All-Time Outstanding Credit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>All-Time Credit Balance</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-700">
              ₹{Math.round(totalAllTimeCredit).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Total pending across all users
            </div>
          </div>
        </div>

        {/* Today's Total Value */}
        <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-4 rounded-2xl shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-amber-200 text-xs font-bold uppercase tracking-wider">
            <span>Today's Total Value</span>
            <Egg className="w-4 h-4 text-white" />
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-white">
              ₹{Number(todayData.totalAmountToday).toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-200 mt-0.5">
              @{todayPriceInfo?.price || '210'} per tray
            </div>
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation (Orders, Customers, Analysis, Price Log) */}
      <div className="flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab('today_orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'today_orders'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          Orders Received Today ({todayData.orders.length})
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'customers'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Accounts & Credit ({customers.length})
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition ${
            activeTab === 'analysis'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Daily Analysis & Summary
        </button>
      </div>

      {/* 5. TAB 1: Today's Orders (Live Dispatch & Status Workflow) */}
      {activeTab === 'today_orders' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header & Filter Row */}
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Today's Received Orders</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fulfill and update live delivery status for customer orders received today.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {['all', 'pending', 'confirmed', 'out_for_delivery', 'delivered'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap capitalize transition ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? 'All Orders' : st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Orders Table / Cards */}
          {filteredOrders.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Egg className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <p className="font-semibold text-sm">No orders matching this filter today</p>
              <button
                onClick={() => setIsFastOrderOpen(true)}
                className="mt-3 px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition"
              >
                Create an Order Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">Order #</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Trays</th>
                    <th className="py-3 px-4">Total Amount</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Delivery Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50/80 transition group">
                      {/* Order ID & Source */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        #{order.id}
                        <div className="text-[10px] text-slate-400 font-normal">
                          {order.created_by === 'owner' ? 'Counter' : 'Online App'}
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setSelectedCustomerIdForDrawer(order.user_id)}
                          className="font-bold text-slate-900 hover:text-amber-700 transition text-left flex items-center gap-1 group-hover:underline"
                        >
                          {order.customer_name}
                          <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition" />
                        </button>
                        <div className="text-[11px] text-slate-500">
                          {order.customer_phone}
                          {order.customer_address && ` • ${order.customer_address}`}
                        </div>
                        {order.notes && (
                          <div className="text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                            Note: {order.notes}
                          </div>
                        )}
                      </td>

                      {/* Trays */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 font-black text-amber-900 text-sm">
                          {order.trays} trays
                        </span>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {order.trays * 30} eggs
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4">
                        <div className="font-extrabold text-slate-900 text-sm">
                          ₹{Number(order.total_amount).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          @ ₹{order.price_per_tray}/tray
                        </div>
                      </td>

                      {/* Payment Mode & Status */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            order.payment_mode === 'cash'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.payment_mode}
                          </span>
                          <span className={`text-[11px] font-bold ${
                            order.payment_status === 'paid' ? 'text-emerald-600' : 'text-rose-600'
                          }`}>
                            {order.payment_status === 'paid' ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                      </td>

                      {/* Order Status with Quick Change Dropdown */}
                      <td className="py-3.5 px-4">
                        <select
                          value={order.order_status}
                          onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                          className={`text-xs font-bold py-1.5 px-2.5 rounded-xl border outline-none cursor-pointer transition ${
                            order.order_status === 'delivered'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : order.order_status === 'out_for_delivery'
                              ? 'bg-blue-50 border-blue-300 text-blue-800'
                              : order.order_status === 'confirmed'
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                              : 'bg-amber-50 border-amber-300 text-amber-800'
                          }`}
                        >
                          <option value="pending">⏳ Pending</option>
                          <option value="confirmed">✓ Confirmed</option>
                          <option value="out_for_delivery">🚚 Out for Delivery</option>
                          <option value="delivered">✅ Delivered</option>
                          <option value="cancelled">✕ Cancelled</option>
                        </select>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedCustomerIdForDrawer(order.user_id)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-amber-700 hover:bg-slate-100 rounded-lg transition"
                        >
                          Customer Info
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. TAB 2: Customer Accounts & Credit Ledger (Requirement 3d) */}
      {activeTab === 'customers' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Per-User Accounts & Outstanding Credit</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                View customer balances, credit history, and record settlements.
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by store name, phone..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {filteredCustomers.map((cust) => (
              <div
                key={cust.id}
                onClick={() => setSelectedCustomerIdForDrawer(cust.id)}
                className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-amber-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 group-hover:text-amber-700 transition">
                        {cust.name}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5">{cust.phone}</div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {cust.total_orders} orders
                    </span>
                  </div>

                  {cust.address && (
                    <div className="text-[11px] text-slate-400 mt-2 line-clamp-1">
                      {cust.address}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Credit Balance
                    </span>
                    <div className={`text-lg font-black ${
                      cust.credit_balance > 0 ? 'text-rose-600' : 'text-emerald-600'
                    }`}>
                      ₹{Math.round(cust.credit_balance).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFastOrderInitialCustId(cust.id);
                        setIsFastOrderOpen(true);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition"
                    >
                      + Order
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedCustomerIdForDrawer(cust.id)}
                      className="p-1 rounded-lg text-slate-400 group-hover:text-amber-600 transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TAB 3: Daily Analysis & Summary (Requirement 3f) */}
      {activeTab === 'analysis' && analysisData && (
        <div className="space-y-6">
          {/* Date Picker Header */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Daily Business Analysis & Audit</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Breakdown of trays sold, cash receipts, and credit additions by day.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Select Date:</span>
              <input
                type="date"
                value={analysisDate}
                onChange={(e) => setAnalysisDate(e.target.value)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
          </div>

          {/* 4 Core Summary Cards for Selected Date */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400">Total Trays Sold ({analysisDate})</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {analysisData.totalTraysSold}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">{analysisData.totalOrdersCount} orders placed</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400">Cash Received ({analysisDate})</span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">
                ₹{Number(analysisData.totalCashReceived).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Orders: ₹{analysisData.totalCashFromOrders} | Paid Credit: ₹{analysisData.totalCashFromSettlements}</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400">New Credit Added ({analysisDate})</span>
              <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-1">
                ₹{Number(analysisData.totalCreditAdded).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Extended on credit this day</div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-xs font-bold uppercase text-slate-400">All-Time Credit Balance</span>
              <div className="text-2xl sm:text-3xl font-black text-rose-600 mt-1">
                ₹{Number(analysisData.allTimeOutstandingCredit).toLocaleString()}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Running total across all users</div>
            </div>
          </div>

          {/* Simple Visual Trend Chart (Requirement 5: Simple charts bar/line) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">7-Day Sales & Volume Trend</h3>
                <p className="text-xs text-slate-500">Egg trays sold and daily revenue progression</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block"></span>
                  Trays Sold
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
                  Cash
                </span>
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 rounded bg-orange-400 inline-block"></span>
                  Credit
                </span>
              </div>
            </div>

            {/* Custom Responsive SVG / Bar Chart */}
            <div className="grid grid-cols-7 gap-2 pt-4 items-end h-52 border-b border-slate-100 pb-2">
              {trendsData.map((day) => {
                const maxTrays = Math.max(...trendsData.map((d) => d.trays), 100);
                const heightPercent = Math.max(10, Math.min(100, (day.trays / maxTrays) * 100));

                return (
                  <div key={day.date} className="flex flex-col items-center justify-end h-full group">
                    <div className="opacity-0 group-hover:opacity-100 transition text-[10px] font-bold text-slate-700 mb-1">
                      {day.trays} trays
                    </div>
                    {/* Bar container */}
                    <div className="w-full max-w-[42px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: `${heightPercent}%` }}>
                      <div className="bg-gradient-to-t from-amber-500 to-amber-400 w-full h-full rounded-t-lg transition hover:brightness-110"></div>
                    </div>
                    <div className="text-[10px] font-medium text-slate-500 mt-2 truncate max-w-full">
                      {day.displayDate}
                    </div>
                    <div className="text-[9px] text-amber-700 font-bold">
                      ₹{Math.round(day.totalSales / 1000)}k
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* User Breakdown Table (Requirement 3f) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">
                User Breakdown for {analysisDate}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Per-user breakdown of trays ordered, cash collected, credit added, and current running credit balance.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 text-[11px] uppercase font-bold tracking-wider">
                    <th className="py-3 px-4">User / Customer</th>
                    <th className="py-3 px-4 text-center">Trays on {analysisDate}</th>
                    <th className="py-3 px-4 text-right">Cash Received</th>
                    <th className="py-3 px-4 text-right">Credit Added</th>
                    <th className="py-3 px-4 text-right">Running Credit Balance</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysisData.userBreakdown.map((u) => (
                    <tr key={u.user_id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{u.user_name}</div>
                        <div className="text-[11px] text-slate-400">{u.user_phone}</div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-lg font-bold text-xs ${
                          u.trays_today > 0 ? 'bg-amber-100 text-amber-900 font-black' : 'text-slate-400'
                        }`}>
                          {u.trays_today}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-emerald-600">
                        {u.cash_today > 0 ? `₹${Number(u.cash_today).toLocaleString()}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right font-semibold text-orange-600">
                        {u.credit_added_today > 0 ? `₹${Number(u.credit_added_today).toLocaleString()}` : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-black ${
                          u.running_credit_balance > 0 ? 'text-rose-600 font-extrabold' : 'text-slate-700'
                        }`}>
                          ₹{Math.round(u.running_credit_balance).toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedCustomerIdForDrawer(u.user_id)}
                          className="px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 rounded-lg transition"
                        >
                          View Ledger
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      <PriceModal
        isOpen={isPriceModalOpen}
        onClose={() => setIsPriceModalOpen(false)}
        onPriceUpdated={() => {
          fetchAllData();
          if (onPriceTrigger) onPriceTrigger();
        }}
      />

      <FastOrderModal
        isOpen={isFastOrderOpen}
        initialCustomerId={fastOrderInitialCustId}
        onClose={() => {
          setIsFastOrderOpen(false);
          setFastOrderInitialCustId(null);
        }}
        onOrderPlaced={() => fetchAllData()}
      />

      <CustomerDetailDrawer
        customerId={selectedCustomerIdForDrawer}
        onClose={() => setSelectedCustomerIdForDrawer(null)}
        onRefreshRequired={() => fetchAllData()}
        onQuickOrderForCustomer={(cId) => {
          setFastOrderInitialCustId(cId);
          setIsFastOrderOpen(true);
        }}
      />
    </div>
  );
}
