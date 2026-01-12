import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, CheckCircle, Clock, AlertCircle, MapPin, TrendingUp,
  LogOut, BarChart3
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { dealerAPI, zoneAPI, analyticsAPI, dealerSlipAPI } from '../../lib/api';
import { toast } from 'sonner';

export default function ManagerDashboard() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [pendingDealers, setPendingDealers] = useState([]);
  const [pendingSlips, setPendingSlips] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Get dealers in manager's zones
      const dealersRes = await dealerAPI.list();
      setDealers(dealersRes.data);
      
      // Filter pending dealers
      const pending = dealersRes.data.filter(d => 
        d.brand_links?.some(bl => bl.status === 'pending')
      );
      setPendingDealers(pending);
      
      // Get pending slips
      const slipsRes = await dealerSlipAPI.list({ status: 'pending' });
      setPendingSlips(slipsRes.data);
      
      // Get zone analytics if user has zones
      if (user?.zone_ids?.length > 0) {
        const analyticsRes = await analyticsAPI.zone(user.zone_ids[0]);
        setAnalytics(analyticsRes.data);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const stats = [
    { 
      label: 'Total Dealers', 
      value: dealers.length,
      icon: Users,
      color: 'bg-blue-500'
    },
    { 
      label: 'Pending Approvals', 
      value: pendingDealers.length + pendingSlips.length,
      icon: Clock,
      color: 'bg-yellow-500'
    },
    { 
      label: 'Downloads', 
      value: analytics?.downloads || 0,
      icon: TrendingUp,
      color: 'bg-green-500'
    },
  ];
  
  return (
    <div className="min-h-screen bg-slate-50" data-testid="manager-dashboard">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Zonal Manager</h1>
            <p className="text-sm text-slate-500">{user?.name}</p>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-slate-500">
            <LogOut className="w-5 h-5 mr-2" />
            Logout
          </Button>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div 
              key={stat.label}
              className="card-brand p-6 animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-slate-900">
                    {loading ? '-' : stat.value}
                  </p>
                </div>
                <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Button 
            className="btn-brand h-16 text-lg"
            onClick={() => navigate('/manager/approvals')}
          >
            <Clock className="w-6 h-6 mr-3" />
            Review Pending Approvals
            {(pendingDealers.length + pendingSlips.length) > 0 && (
              <span className="ml-2 bg-white/20 px-2 py-0.5 rounded-full text-sm">
                {pendingDealers.length + pendingSlips.length}
              </span>
            )}
          </Button>
          
          <Button 
            variant="outline"
            className="h-16 text-lg"
            onClick={() => navigate('/manager/approvals')}
          >
            <Users className="w-6 h-6 mr-3" />
            View Zone Dealers
          </Button>
        </div>
        
        {/* Pending Approvals Preview */}
        {(pendingDealers.length > 0 || pendingSlips.length > 0) && (
          <div className="card-brand p-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              <h2 className="text-lg font-bold text-slate-900">Pending Approvals</h2>
            </div>
            
            <div className="space-y-3">
              {pendingDealers.slice(0, 3).map(dealer => (
                <div key={dealer.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                      <Users className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{dealer.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {dealer.district}, {dealer.state}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                    Dealer Pending
                  </span>
                </div>
              ))}
              
              {pendingSlips.slice(0, 2).map(slip => (
                <div key={slip.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-100 overflow-hidden">
                      <img 
                        src={slip.file_url.startsWith('/api')
                          ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                          : slip.file_url}
                        alt={slip.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{slip.name}</p>
                      <p className="text-sm text-slate-500">Custom slip</p>
                    </div>
                  </div>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                    Slip Pending
                  </span>
                </div>
              ))}
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4"
              onClick={() => navigate('/manager/approvals')}
            >
              View All Pending
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
