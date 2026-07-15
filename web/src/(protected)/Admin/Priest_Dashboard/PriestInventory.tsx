import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../context/AuthContext';
import { priestAPI } from '../../../../library/priest';
import type { InventoryItem } from '../../../../library/inventory';
import { LogOut, RefreshCw, Search } from 'lucide-react';
import PriestNav from './PriestNav';

const statusLabel = (item: InventoryItem): { text: string; className: string } => {
  if (item.quantity <= 0) {
    return { text: 'Out of stock', className: 'bg-red-100 text-red-700' };
  }
  const available = item.available_quantity ?? item.quantity;
  if (item.is_borrowable && available <= 0) {
    return { text: 'All borrowed', className: 'bg-amber-100 text-amber-800' };
  }
  return { text: 'Available', className: 'bg-emerald-100 text-emerald-800' };
};

const PriestInventory: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'item' | 'consumable'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const perPage = 10;

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Priest inventory page loading...', { search, typeFilter, currentPage, perPage });
      const res = await priestAPI.getInventory({
        search: search.trim() || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        per_page: perPage,
        page: currentPage,
      });
      if (res.data?.success) {
        const data = res.data.data;
        if (data && typeof data === 'object' && 'data' in data && Array.isArray(data.data)) {
          setItems(data.data);
          setTotalPages(data.last_page || 1);
          setTotalItems(data.total || data.data.length);
          console.log('Priest inventory loaded:', {
            count: data.data.length,
            page: data.current_page,
            last_page: data.last_page,
            total: data.total,
          });
        } else if (Array.isArray(data)) {
          setItems(data);
          setTotalPages(1);
          setTotalItems(data.length);
        } else {
          setItems([]);
          setTotalPages(1);
          setTotalItems(0);
        }
      } else {
        setItems([]);
        setTotalPages(1);
        setTotalItems(0);
        setError(res.data?.message || 'Failed to load inventory.');
      }
    } catch (err) {
      console.error('Priest inventory error:', err);
      setItems([]);
      setTotalPages(1);
      setTotalItems(0);
      setError('Failed to load inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, currentPage]);

  // Keep page in range if filters shrink results
  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchInventory();
    }, 250);
    return () => clearTimeout(t);
  }, [fetchInventory]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleTypeFilterChange = (value: 'all' | 'item' | 'consumable') => {
    setTypeFilter(value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Welcome, {user?.full_name || 'Priest'} — inventory (view only)
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition self-start"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <PriestNav />

        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Inventory</h2>
            <p className="text-sm text-slate-500 mt-1">
              Browse parish items. You cannot add, edit, borrow, or delete.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchInventory}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 self-start"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search items..."
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) =>
              handleTypeFilterChange(e.target.value as 'all' | 'item' | 'consumable')
            }
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
          >
            <option value="all">All types</option>
            <option value="item">Item</option>
            <option value="consumable">Consumable</option>
          </select>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-16 text-center text-slate-500">No inventory items found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Name</th>
                    <th className="text-left px-4 py-3 font-semibold">Category</th>
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Quantity</th>
                    <th className="text-left px-4 py-3 font-semibold">Available</th>
                    <th className="text-left px-4 py-3 font-semibold">Borrowable</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => {
                    const status = statusLabel(item);
                    return (
                      <tr key={item.inventory_id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                        <td className="px-4 py-3 text-slate-600">{item.category || '—'}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{item.type}</td>
                        <td className="px-4 py-3 font-semibold">{item.quantity}</td>
                        <td className="px-4 py-3">
                          {item.available_quantity ?? item.quantity}
                        </td>
                        <td className="px-4 py-3">
                          {item.is_borrowable ? (
                            <span className="text-xs font-semibold text-blue-700">Yes</span>
                          ) : (
                            <span className="text-xs text-slate-400">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${status.className}`}
                          >
                            {status.text}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loading}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Previous
            </button>
            <div className="px-4 py-2 text-slate-600 font-medium text-sm">
              Page {currentPage} of {totalPages}
              {totalItems > 0 && (
                <span className="text-slate-400 font-normal"> · {totalItems} items</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || loading}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PriestInventory;
