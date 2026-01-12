import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, Image, Download, TrendingUp, ArrowUpRight, MapPin,
  Clock, CheckCircle, AlertCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuthStore, useBrandStore } from '../../lib/store';
import { analyticsAPI, brandAPI, dealerAPI, creativeAPI } from '../../lib/api';

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [analytics, setAnalytics] = useState(null);
  const [recentDealers, setRecentDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      // Load brands
      const brandsRes = await brandAPI.list();
      setBrands(brandsRes.data);
      
      if (brandsRes.data.length > 0 && !currentBrand) {
        setCurrentBrand(brandsRes.data[0]);
      }
      
      const brandId = brandsRes.data[0]?.id;
      if (brandId) {
        const [analyticsRes, dealersRes] = await Promise.all([
          analyticsAPI.brand(brandId),
          dealerAPI.list({ brand_id: brandId })
        ]);
        
        setAnalytics(analyticsRes.data);
        setRecentDealers(dealersRes.data.slice(0, 5));
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const stats = [
    { 
      label: 'Total Dealers', 
      value: analytics?.dealers?.total || 0, 
      icon: Users,
      color: 'bg-blue-500',
      subtext: `${analytics?.dealers?.active || 0} active`
    },
    { 
      label: 'Active Creatives', 
      value: analytics?.creatives || 0, 
      icon: Image,
      color: 'bg-purple-500',
      subtext: 'campaigns'
    },
    { 
      label: 'Total Downloads', 
      value: analytics?.downloads || 0, 
      icon: Download,
      color: 'bg-green-500',
      subtext: 'this month'
    },
    { 
      label: 'Share Clicks', 
      value: analytics?.shares || 0, 
      icon: TrendingUp,
      color: 'bg-orange-500',
      subtext: 'via links'
    },
  ];
  
  return (
    <AdminLayout title="Dashboard" data-testid="admin-dashboard">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div 
            key={stat.label} 
            className="card-brand p-6 animate-slide-up"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500 mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-1">{stat.subtext}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Dealers */}
        <div className="lg:col-span-2 card-brand p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Dealers</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin/dealers')}>
              View All
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
          
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 animate-pulse">
                  <div className="w-10 h-10 bg-slate-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/3 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentDealers.length > 0 ? (
            <div className="space-y-3">
              {recentDealers.map(dealer => {
                const brandLink = dealer.brand_links?.[0];
                return (
                  <div 
                    key={dealer.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/admin/dealers`)}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                      <span className="font-bold text-[#4F46E5]">{dealer.name?.[0]}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{dealer.name}</p>
                      <p className="text-sm text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {dealer.district}, {dealer.state}
                      </p>
                    </div>
                    <div>
                      {brandLink?.status === 'approved' && (
                        <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </span>
                      )}
                      {brandLink?.status === 'pending' && (
                        <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              No dealers yet
            </div>
          )}
        </div>
        
        {/* Quick Actions */}
        <div className="card-brand p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Button 
              className="btn-brand w-full justify-start"
              onClick={() => navigate('/admin/creatives')}
            >
              <Image className="w-5 h-5 mr-2" />
              Create New Creative
            </Button>
            <Button 
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/dealers')}
            >
              <Users className="w-5 h-5 mr-2" />
              Manage Dealers
            </Button>
            <Button 
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/zones')}
            >
              <MapPin className="w-5 h-5 mr-2" />
              Manage Zones
            </Button>
            <Button 
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/slip-templates')}
            >
              <Image className="w-5 h-5 mr-2" />
              Slip Templates
            </Button>
          </div>
          
          {/* Pending Approvals */}
          {analytics?.dealers?.pending > 0 && (
            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Pending Approvals</span>
              </div>
              <p className="text-sm text-yellow-700">
                {analytics.dealers.pending} dealer(s) awaiting approval
              </p>
              <Button 
                size="sm" 
                variant="outline"
                className="mt-3 border-yellow-400 text-yellow-700 hover:bg-yellow-100"
                onClick={() => navigate('/admin/dealers')}
              >
                Review Now
              </Button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
