import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Image, User, Layers, Search, Filter } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { creativeAPI, dealerAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

export default function DealerHome() {
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dealer, setDealer] = useState(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [creativesRes, dealerRes] = await Promise.all([
        creativeAPI.list(),
        user?.dealer_id ? dealerAPI.get(user.dealer_id) : Promise.resolve({ data: null })
      ]);
      setCreatives(creativesRes.data);
      setDealer(dealerRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const filteredCreatives = creatives.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="dealer-home">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hey, {user?.name || 'Dealer'}!</h1>
            <p className="text-sm text-slate-500">{dealer?.name || 'Welcome back'}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#FACC15] flex items-center justify-center">
            <span className="text-lg font-bold text-slate-900">{user?.name?.[0] || 'D'}</span>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search creatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 input-field"
            data-testid="search-input"
          />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card-dealer p-4 bg-gradient-to-br from-[#4F46E5] to-[#818CF8]">
            <p className="text-white/80 text-sm">Available Creatives</p>
            <p className="text-3xl font-bold text-white">{creatives.length}</p>
          </div>
          <div className="card-dealer p-4 bg-gradient-to-br from-[#FACC15] to-[#FDE68A]">
            <p className="text-slate-600 text-sm">Your Downloads</p>
            <p className="text-3xl font-bold text-slate-900">-</p>
          </div>
        </div>
        
        {/* Creative Library */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900">Creative Library</h2>
          <Button variant="ghost" size="sm" className="text-slate-500">
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
        </div>
        
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="card-dealer p-4 animate-pulse">
                <div className="aspect-[4/3] bg-slate-200 rounded-xl mb-3" />
                <div className="h-5 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filteredCreatives.length === 0 ? (
          <div className="card-dealer p-8 text-center">
            <Image className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No creatives available yet</p>
            <p className="text-sm text-slate-400 mt-1">Check back later for new campaigns</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredCreatives.map((creative, index) => (
              <div
                key={creative.id}
                className="card-dealer overflow-hidden cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
                onClick={() => navigate(`/dealer/creative/${creative.id}`)}
                data-testid={`creative-card-${creative.id}`}
              >
                {/* Creative Image */}
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  {creative.variants?.[0]?.file_url ? (
                    <img
                      src={creative.variants[0].file_url.startsWith('/api') 
                        ? `${process.env.REACT_APP_BACKEND_URL}${creative.variants[0].file_url}`
                        : creative.variants[0].file_url}
                      alt={creative.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Image className="w-16 h-16 text-slate-300" />
                    </div>
                  )}
                  
                  {/* Variant count badge */}
                  {creative.variants?.length > 1 && (
                    <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                      {creative.variants.length} sizes
                    </div>
                  )}
                </div>
                
                {/* Creative Info */}
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 mb-1">{creative.name}</h3>
                  {creative.description && (
                    <p className="text-sm text-slate-500 mb-2 line-clamp-2">{creative.description}</p>
                  )}
                  
                  {/* Tags */}
                  {creative.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {creative.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <Button className="btn-dealer w-full" data-testid={`personalize-btn-${creative.id}`}>
                    Personalize & Download
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <DealerBottomNav active="home" />
    </div>
  );
}
