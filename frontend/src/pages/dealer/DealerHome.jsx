import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Image, User, Layers, Search, Filter, ChevronRight, Star, Sparkles, TrendingUp, Clock, X } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { useAuthStore } from '../../lib/store';
import { feedAPI, dealerAPI, brandAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

// Horizontal scrollable carousel component
function CreativeCarousel({ title, icon: Icon, creatives, onCreativeClick, emptyText }) {
  const scrollRef = useRef(null);
  
  if (!creatives || creatives.length === 0) return null;
  
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between px-4 mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
          <h3 className="font-bold text-slate-900">{title}</h3>
        </div>
        <button className="flex items-center gap-1 text-sm text-indigo-600 font-medium">
          See all <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto px-4 pb-2 scrollbar-hide snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {creatives.map((creative) => (
          <div
            key={creative.id}
            className="flex-shrink-0 w-64 snap-start cursor-pointer group"
            onClick={() => onCreativeClick(creative.id)}
          >
            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 mb-2 shadow-sm group-hover:shadow-lg transition-shadow">
              {creative.variants?.[0]?.file_url ? (
                <img
                  src={creative.variants[0].file_url.startsWith('/api') 
                    ? `${process.env.REACT_APP_BACKEND_URL}${creative.variants[0].file_url}`
                    : creative.variants[0].file_url}
                  alt={creative.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-12 h-12 text-slate-300" />
                </div>
              )}
              
              {creative.is_featured && (
                <div className="absolute top-2 left-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-3 h-3 fill-white" /> Featured
                </div>
              )}
              
              {creative.variants?.length > 1 && (
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {creative.variants.length} sizes
                </div>
              )}
            </div>
            <h4 className="font-medium text-slate-900 text-sm truncate">{creative.name}</h4>
            {creative.highlight_tags?.length > 0 && (
              <div className="flex gap-1 mt-1">
                {creative.highlight_tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Highlight tag pill component
function HighlightTagPill({ tag, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
        ${isActive 
          ? 'bg-indigo-600 text-white shadow-md' 
          : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
        }`}
    >
      <span>{tag.icon}</span>
      <span>{tag.name}</span>
    </button>
  );
}

// Brand filter chip component  
function BrandChip({ brand, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all
        ${isActive 
          ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
    >
      {brand.logo ? (
        <img 
          src={brand.logo.startsWith('/api') ? `${process.env.REACT_APP_BACKEND_URL}${brand.logo}` : brand.logo} 
          alt={brand.name} 
          className="w-5 h-5 rounded-full object-cover"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-600">
          {brand.name?.[0]}
        </div>
      )}
      <span>{brand.name}</span>
    </button>
  );
}

export default function DealerHome() {
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dealer, setDealer] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [feedRes, dealerRes] = await Promise.all([
        feedAPI.get(),
        user?.dealer_id ? dealerAPI.get(user.dealer_id) : Promise.resolve({ data: null })
      ]);
      setFeed(feedRes.data);
      setDealer(dealerRes.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreativeClick = (creativeId) => {
    navigate(`/dealer/creative/${creativeId}`);
  };
  
  // Filter creatives based on search, tag, and brand
  const getFilteredCreatives = () => {
    if (!feed?.all) return [];
    
    let filtered = feed.all;
    
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (selectedTag) {
      filtered = filtered.filter(c => 
        c.highlight_tags?.includes(selectedTag) || c.tags?.includes(selectedTag)
      );
    }
    
    if (selectedBrand) {
      filtered = filtered.filter(c => c.brand_id === selectedBrand);
    }
    
    return filtered;
  };
  
  const filteredCreatives = getFilteredCreatives();
  const showCarousels = !searchQuery && !selectedTag && !selectedBrand;
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24" data-testid="dealer-home">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hey, {user?.name || 'Dealer'}!</h1>
            <p className="text-sm text-slate-500">{dealer?.name || 'Welcome back'}</p>
          </div>
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <span className="text-lg font-bold text-white">{user?.name?.[0] || 'D'}</span>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search creatives, brands, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-12 rounded-xl border-slate-200 bg-slate-50 focus:bg-white transition-colors"
            data-testid="search-input"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="pt-4">
        {/* Highlight Tags - Horizontal Scroll */}
        {feed?.highlight_tags && feed.highlight_tags.length > 0 && (
          <div className="mb-4">
            <div 
              className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                onClick={() => setSelectedTag(null)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${!selectedTag 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white text-slate-600 border border-slate-200'
                  }`}
              >
                All
              </button>
              {feed.highlight_tags.map(tag => (
                <HighlightTagPill 
                  key={tag.id}
                  tag={tag}
                  isActive={selectedTag === tag.id}
                  onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* My Brands Filter */}
        {feed?.brands && feed.brands.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 px-4 mb-2">
              <span className="text-sm font-medium text-slate-500">My Brands:</span>
            </div>
            <div 
              className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                onClick={() => setSelectedBrand(null)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-all
                  ${!selectedBrand 
                    ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                All Brands
              </button>
              {feed.brands.map(brand => (
                <BrandChip
                  key={brand.id}
                  brand={brand}
                  isActive={selectedBrand === brand.id}
                  onClick={() => setSelectedBrand(selectedBrand === brand.id ? null : brand.id)}
                />
              ))}
            </div>
          </div>
        )}
        
        {loading ? (
          /* Skeleton Loader */
          <div className="px-4">
            <div className="mb-6">
              <div className="h-6 bg-slate-200 rounded w-32 mb-3 animate-pulse" />
              <div className="flex gap-4 overflow-hidden">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex-shrink-0 w-64">
                    <div className="aspect-[4/3] bg-slate-200 rounded-2xl mb-2 animate-pulse" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-1 animate-pulse" />
                    <div className="h-3 bg-slate-200 rounded w-1/2 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Carousels - Only shown when no filters active */}
            {showCarousels && (
              <>
                {/* Featured Creatives */}
                <CreativeCarousel
                  title="Featured"
                  icon={Star}
                  creatives={feed?.featured}
                  onCreativeClick={handleCreativeClick}
                />
                
                {/* Seasonal Creatives */}
                <CreativeCarousel
                  title="Seasonal & Events"
                  icon={Sparkles}
                  creatives={feed?.seasonal}
                  onCreativeClick={handleCreativeClick}
                />
                
                {/* Trending */}
                <CreativeCarousel
                  title="Trending Now"
                  icon={TrendingUp}
                  creatives={feed?.trending}
                  onCreativeClick={handleCreativeClick}
                />
                
                {/* New Arrivals */}
                <CreativeCarousel
                  title="New Arrivals"
                  icon={Clock}
                  creatives={feed?.new}
                  onCreativeClick={handleCreativeClick}
                />
              </>
            )}
            
            {/* All Creatives Grid */}
            <div className="px-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {showCarousels ? 'All Creatives' : `Results (${filteredCreatives.length})`}
                </h2>
                <Button variant="ghost" size="sm" className="text-slate-500">
                  <Filter className="w-4 h-4 mr-1" />
                  Filter
                </Button>
              </div>
              
              {filteredCreatives.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
                  <Image className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No creatives found</p>
                  <p className="text-sm text-slate-400 mt-1">Try adjusting your filters</p>
                  {(searchQuery || selectedTag || selectedBrand) && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedTag(null);
                        setSelectedBrand(null);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {filteredCreatives.map((creative, index) => (
                    <div
                      key={creative.id}
                      className="bg-white rounded-2xl overflow-hidden cursor-pointer shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300 group"
                      style={{ animationDelay: `${index * 0.05}s` }}
                      onClick={() => handleCreativeClick(creative.id)}
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
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Image className="w-16 h-16 text-slate-300" />
                          </div>
                        )}
                        
                        {creative.is_featured && (
                          <div className="absolute top-3 left-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow">
                            <Star className="w-3 h-3 fill-white" /> Featured
                          </div>
                        )}
                        
                        {creative.variants?.length > 1 && (
                          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                            {creative.variants.length} sizes
                          </div>
                        )}
                      </div>
                      
                      {/* Creative Info */}
                      <div className="p-4">
                        <h3 className="font-bold text-slate-900 mb-1 line-clamp-1">{creative.name}</h3>
                        {creative.description && (
                          <p className="text-sm text-slate-500 mb-2 line-clamp-2">{creative.description}</p>
                        )}
                        
                        {/* Tags */}
                        {creative.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {creative.tags.slice(0, 3).map(tag => (
                              <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl h-10" data-testid={`personalize-btn-${creative.id}`}>
                          Personalize & Download
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      
      <DealerBottomNav active="home" />
    </div>
  );
}
