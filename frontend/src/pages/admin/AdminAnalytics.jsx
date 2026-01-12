import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Download, Users, Share2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { analyticsAPI, brandAPI } from '../../lib/api';

export default function AdminAnalytics() {
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const brandsRes = await brandAPI.list();
      setBrands(brandsRes.data);
      
      if (brandsRes.data.length > 0 && !currentBrand) {
        setCurrentBrand(brandsRes.data[0]);
      }
      
      const brandId = brandsRes.data[0]?.id;
      if (brandId) {
        const analyticsRes = await analyticsAPI.brand(brandId);
        setAnalytics(analyticsRes.data);
      }
    } catch (error) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };
  
  const stats = [
    { 
      label: 'Total Dealers', 
      value: analytics?.dealers?.total || 0,
      subtext: `${analytics?.dealers?.active || 0} active`,
      icon: Users,
      color: 'bg-blue-500'
    },
    { 
      label: 'Total Downloads', 
      value: analytics?.downloads || 0,
      subtext: 'all time',
      icon: Download,
      color: 'bg-green-500'
    },
    { 
      label: 'Renders Generated', 
      value: analytics?.renders || 0,
      subtext: 'personalized creatives',
      icon: BarChart3,
      color: 'bg-purple-500'
    },
    { 
      label: 'Share Clicks', 
      value: analytics?.shares || 0,
      subtext: 'via share links',
      icon: Share2,
      color: 'bg-orange-500'
    },
  ];
  
  return (
    <AdminLayout title="Analytics" data-testid="admin-analytics">
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
                <p className="text-3xl font-bold text-slate-900">
                  {loading ? '-' : stat.value.toLocaleString()}
                </p>
                <p className="text-xs text-slate-400 mt-1">{stat.subtext}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Dealer Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card-brand p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Dealer Status Breakdown</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-slate-600">Active Dealers</span>
              </div>
              <span className="font-bold text-slate-900">{analytics?.dealers?.active || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-slate-600">Pending Approval</span>
              </div>
              <span className="font-bold text-slate-900">{analytics?.dealers?.pending || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-slate-300" />
                <span className="text-slate-600">Total Dealers</span>
              </div>
              <span className="font-bold text-slate-900">{analytics?.dealers?.total || 0}</span>
            </div>
          </div>
        </div>
        
        <div className="card-brand p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Content Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Active Creatives</span>
              <span className="font-bold text-slate-900">{analytics?.creatives || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total Downloads</span>
              <span className="font-bold text-slate-900">{analytics?.downloads || 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Share Engagement</span>
              <span className="font-bold text-slate-900">{analytics?.shares || 0}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Creatives */}
      {analytics?.top_creatives?.length > 0 && (
        <div className="card-brand p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Top Performing Creatives</h2>
          <div className="space-y-3">
            {analytics.top_creatives.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <span className="text-slate-700">Creative Variant</span>
                </div>
                <span className="font-bold text-slate-900">{item.downloads} downloads</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
