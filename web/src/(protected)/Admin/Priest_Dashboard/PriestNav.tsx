import React from 'react';
import { NavLink } from 'react-router-dom';
import { Calendar, CalendarOff, Package, Receipt, Wallet } from 'lucide-react';

const links = [
  { to: '/priest/PriestHomePage', label: 'Schedule', icon: Calendar, end: true },
  { to: '/priest/calendar', label: 'My Calendar', icon: CalendarOff, end: false },
  { to: '/priest/income', label: 'Income', icon: Wallet, end: false },
  { to: '/priest/inventory', label: 'Inventory', icon: Package, end: false },
  { to: '/priest/expenses', label: 'Expenses', icon: Receipt, end: false },
];

const PriestNav: React.FC = () => {
  return (
    <nav className="mb-6 flex flex-wrap gap-2" aria-label="Priest sections">
      {links.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200'
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
      <span className="self-center text-xs text-slate-400 ml-1">Income, inventory and expenses are view only</span>
    </nav>
  );
};

export default PriestNav;
