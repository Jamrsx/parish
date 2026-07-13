import { useState, useEffect } from 'react';
import { Menu, X, Home, Calendar, User, LogOut } from 'lucide-react';
import NotificationBell from './notification';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

interface NavLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const navLinks: NavLink[] = [
  { label: 'Home', href: '/parishioner/ParishionerHomePage', icon: <Home size={18} /> },
  { label: 'Services', href: '/parishioner/church-service', icon: <Calendar size={18} /> },
  { label: 'Profile', href: '/parishioner/profile', icon: <User size={18} /> },
];

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isScrolled, setIsScrolled] = useState<boolean>(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobileMenu = (): void => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = (): void => {
    setIsMobileMenuOpen(false);
  };

  const handleLogout = async (): Promise<void> => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
      navigate('/login');
    }
  };

  return (
    <nav className={`sticky top-0 z-50 transition-shadow duration-300 ${
      isScrolled ? 'bg-white shadow-lg' : 'bg-white shadow-md'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo / Title */}
          <div className="flex-shrink-0">
            <a href="/parishioner" className="text-xl font-bold text-gray-800 hover:text-blue-600 transition-colors">
              San Guillermo Parish
            </a>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex md:items-center md:space-x-6">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors font-medium"
              >
                {link.icon}
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Side - Notification & Logout */}
          <div className="hidden md:flex md:items-center md:space-x-4">
            {/* Notification Bell */}
            <NotificationBell />
            
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition-colors font-medium"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-3 md:hidden">
            {/* Notification Bell for Mobile */}
            <NotificationBell className="md:hidden" />
            
            <button
              onClick={toggleMobileMenu}
              className="text-gray-600 hover:text-blue-600 focus:outline-none"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-100">
            <div className="flex flex-col space-y-3 pb-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={closeMobileMenu}
                  className="flex items-center gap-3 text-gray-600 hover:text-blue-600 transition-colors font-medium px-2 py-2 rounded hover:bg-gray-50"
                >
                  {link.icon}
                  {link.label}
                </a>
              ))}
              {/* Logout in Mobile Menu */}
              <button
                onClick={() => {
                  closeMobileMenu();
                  handleLogout();
                }}
                className="flex items-center gap-3 text-red-600 hover:text-red-700 transition-colors font-medium px-2 py-2 rounded hover:bg-red-50 w-full text-left"
              >
                <LogOut size={18} />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;