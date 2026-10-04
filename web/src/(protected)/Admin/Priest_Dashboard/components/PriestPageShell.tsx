import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../../../../context/AuthContext';
import PriestNav from '../PriestNav';
import PriestAvailabilitySwitch from './PriestAvailabilitySwitch';

interface PriestPageShellProps {
  subtitle: string;
  onAvailabilityChanged?: () => void;
  children: React.ReactNode;
}

const PriestPageShell: React.FC<PriestPageShellProps> = ({ subtitle, onAvailabilityChanged, children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Failed to logout. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <span>⛪</span> Priest Dashboard
            </h1>
            <p className="text-slate-500 mt-1 text-sm">
              Welcome, {user?.full_name || 'Priest'} — {subtitle}
            </p>
          </div>
          <div className="flex items-start gap-3 flex-wrap">
            <PriestAvailabilitySwitch onChanged={onAvailabilityChanged} />
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        <PriestNav />

        {children}
      </div>
    </div>
  );
};

export default PriestPageShell;
