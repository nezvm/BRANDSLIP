import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, MapPin, Users, Image, Layers, BarChart3, 
  Settings, LogOut, ChevronLeft, Menu
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuthStore, useUIStore } from '../../lib/store';

export const AdminLayout = ({ children, title, actions }) => {
  const { user, logout } = useAuthStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: MapPin, label: 'Zones', path: '/admin/zones' },
    { icon: Users, label: 'Dealers', path: '/admin/dealers' },
    { icon: Image, label: 'Creatives', path: '/admin/creatives' },
    { icon: Layers, label: 'Slip Templates', path: '/admin/slip-templates' },
    { icon: Users, label: 'Users', path: '/admin/users' },
    { icon: BarChart3, label: 'Analytics', path: '/admin/analytics' },
  ];
  
  return (
    <div className="min-h-screen bg-slate-50" data-testid="admin-layout">
      {/* Sidebar */}
      <aside className={`sidebar transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="flex items-center justify-between mb-8">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                <span className="text-white font-bold text-sm">B</span>
              </div>
              <span className="font-bold text-slate-900">BrandSlip</span>
            </div>
          )}
          <Button variant="ghost" size="icon" onClick={toggleSidebar} className="ml-auto">
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        
        <nav className="space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) => 
                `sidebar-item ${isActive ? 'active' : ''} ${!sidebarOpen ? 'justify-center px-2' : ''}`
              }
              data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span>{item.label}</span>}
            </NavLink>
          ))}
        </nav>
        
        <div className="absolute bottom-4 left-4 right-4">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className={`w-full ${!sidebarOpen ? 'justify-center px-2' : 'justify-start'} text-slate-500 hover:text-red-500`}
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-3">Logout</span>}
          </Button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            </div>
            <div className="flex items-center gap-4">
              {actions}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">{user?.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-[#4F46E5] flex items-center justify-center">
                  <span className="text-white font-bold">{user?.name?.[0] || 'A'}</span>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
