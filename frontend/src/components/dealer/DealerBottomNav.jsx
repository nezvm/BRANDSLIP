import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Layers, User, Activity, LogOut } from 'lucide-react';
import { useAuthStore } from '../../lib/store';

export const DealerBottomNav = ({ active }) => {
  const { logout } = useAuthStore();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dealer' },
    { id: 'slips', icon: Layers, label: 'My Slips', path: '/dealer/slips' },
    { id: 'activity', icon: Activity, label: 'Activity', path: '/dealer/activity' },
    { id: 'profile', icon: User, label: 'Profile', path: '/dealer/profile' },
  ];
  
  return (
    <nav className="bottom-nav" data-testid="dealer-bottom-nav">
      <div className="flex justify-around">
        {navItems.map(item => (
          <NavLink
            key={item.id}
            to={item.path}
            className={`bottom-nav-item ${active === item.id ? 'active' : ''}`}
            data-testid={`nav-${item.id}`}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-xs">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default DealerBottomNav;
