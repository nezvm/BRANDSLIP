import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Eye, TrendingUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { analyticsAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

export default function DealerActivity() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadAnalytics();
  }, []);
  
  const loadAnalytics = async () => {
    if (!user?.dealer_id) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await analyticsAPI.dealer(user.dealer_id);
      setAnalytics(res.data);
    } catch (error) {
      console.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="dealer-activity">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dealer')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-slate-900">My Activity</h1>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="card-dealer p-4 text-center">
            <Download className="w-6 h-6 text-[#4F46E5] mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics?.downloads || 0}</p>
            <p className="text-xs text-slate-500">Downloads</p>
          </div>
          <div className="card-dealer p-4 text-center">
            <Eye className="w-6 h-6 text-green-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics?.renders || 0}</p>
            <p className="text-xs text-slate-500">Renders</p>
          </div>
          <div className="card-dealer p-4 text-center">
            <Share2 className="w-6 h-6 text-blue-500 mx-auto mb-2" />
            <p className="text-2xl font-bold text-slate-900">{analytics?.shares || 0}</p>
            <p className="text-xs text-slate-500">Shares</p>
          </div>
        </div>
        
        {/* Recent Activity */}
        <h2 className="text-lg font-bold text-slate-900 mb-4">Recent Activity</h2>
        
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-dealer p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 bg-slate-200 rounded-full" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : analytics?.recent_activity?.length > 0 ? (
          <div className="space-y-3">
            {analytics.recent_activity.map((activity, index) => (
              <div key={index} className="card-dealer p-4">
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    activity.type === 'download' ? 'bg-[#4F46E5]/10' :
                    activity.type === 'render_generated' ? 'bg-green-100' :
                    'bg-blue-100'
                  }`}>
                    {activity.type === 'download' && <Download className="w-5 h-5 text-[#4F46E5]" />}
                    {activity.type === 'render_generated' && <Eye className="w-5 h-5 text-green-600" />}
                    {activity.type === 'share_clicked' && <Share2 className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 capitalize">
                      {activity.type.replace('_', ' ')}
                    </p>
                    <p className="text-sm text-slate-500">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="card-dealer p-8 text-center">
            <TrendingUp className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-900 mb-1">No activity yet</p>
            <p className="text-sm text-slate-500">Start downloading creatives to see your activity</p>
          </div>
        )}
      </div>
      
      <DealerBottomNav active="activity" />
    </div>
  );
}
