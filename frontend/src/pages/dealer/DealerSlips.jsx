import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Image, Check, Clock, X, Upload, Star, Grid3X3, List } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuthStore } from '../../lib/store';
import { dealerSlipAPI, brandAPI, dealerAPI, dealerDefaultSlipAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

export default function DealerSlips() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [dealer, setDealer] = useState(null);
  const [brands, setBrands] = useState([]);
  const [selectedBrandFilter, setSelectedBrandFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  
  const [newSlip, setNewSlip] = useState({
    name: '',
    file: null,
    preview: null,
    brandId: '',
  });
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [slipsRes, dealerRes, brandsRes] = await Promise.all([
        dealerSlipAPI.list({ dealer_id: user?.dealer_id }),
        user?.dealer_id ? dealerAPI.get(user.dealer_id) : Promise.resolve({ data: null }),
        brandAPI.list()
      ]);
      setSlips(slipsRes.data);
      setDealer(dealerRes.data);
      
      // Filter brands to only show approved ones
      const approvedBrandIds = dealerRes.data?.brand_links
        ?.filter(bl => bl.status === 'approved')
        ?.map(bl => bl.brand_id) || [];
      const approvedBrands = brandsRes.data.filter(b => approvedBrandIds.includes(b.id));
      setBrands(approvedBrands);
      
      // Set default brand for upload
      if (approvedBrands.length > 0 && !newSlip.brandId) {
        setNewSlip(prev => ({ ...prev, brandId: approvedBrands[0].id }));
      }
    } catch (error) {
      toast.error('Failed to load slips');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const preview = URL.createObjectURL(file);
    setNewSlip(prev => ({ ...prev, file, preview }));
  };
  
  const handleUpload = async () => {
    if (!newSlip.name || !newSlip.file || !newSlip.brandId) {
      toast.error('Please provide a name, select a brand, and upload a file');
      return;
    }
    
    setUploading(true);
    try {
      await dealerSlipAPI.create({
        dealer_id: user.dealer_id,
        brand_id: newSlip.brandId,
        name: newSlip.name,
      }, newSlip.file);
      
      toast.success('Slip uploaded! Pending approval.');
      setShowUpload(false);
      setNewSlip({ name: '', file: null, preview: null, brandId: brands[0]?.id || '' });
      loadData();
    } catch (error) {
      toast.error('Failed to upload slip');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDelete = async (slipId) => {
    if (!window.confirm('Delete this slip?')) return;
    
    try {
      await dealerSlipAPI.delete(slipId);
      setSlips(slips.filter(s => s.id !== slipId));
      toast.success('Slip deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const handleSetDefault = async (slip) => {
    try {
      await dealerDefaultSlipAPI.set(user.dealer_id, slip.brand_id, slip.id, 'uploaded');
      
      // Update local dealer state
      setDealer(prev => ({
        ...prev,
        default_slips: {
          ...prev?.default_slips,
          [slip.brand_id]: `uploaded:${slip.id}`
        }
      }));
      
      toast.success(`Set "${slip.name}" as default for this brand`);
    } catch (error) {
      toast.error('Failed to set default slip');
    }
  };
  
  const isDefaultSlip = (slip) => {
    const defaultValue = dealer?.default_slips?.[slip.brand_id];
    return defaultValue === `uploaded:${slip.id}`;
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">
            <Check className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
            <X className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };
  
  const getBrandName = (brandId) => {
    return brands.find(b => b.id === brandId)?.name || 'Unknown Brand';
  };
  
  // Filter slips by brand
  const filteredSlips = selectedBrandFilter === 'all' 
    ? slips 
    : slips.filter(s => s.brand_id === selectedBrandFilter);
  
  // Group slips by brand for better organization
  const slipsByBrand = filteredSlips.reduce((acc, slip) => {
    const brandId = slip.brand_id;
    if (!acc[brandId]) {
      acc[brandId] = [];
    }
    acc[brandId].push(slip);
    return acc;
  }, {});
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white pb-24" data-testid="dealer-slips">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dealer')} className="rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">My Slips</h1>
              <p className="text-sm text-slate-500">{slips.length} slip{slips.length !== 1 ? 's' : ''} total</p>
            </div>
          </div>
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl shadow-lg shadow-indigo-200" data-testid="upload-slip-btn">
                <Plus className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl">Upload Custom Slip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label className="text-slate-700 font-medium">Slip Name</Label>
                  <Input
                    placeholder="e.g. My Store Footer"
                    value={newSlip.name}
                    onChange={(e) => setNewSlip(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-2 h-11 rounded-xl border-slate-200"
                  />
                </div>
                
                {brands.length > 0 && (
                  <div>
                    <Label className="text-slate-700 font-medium">Select Brand</Label>
                    <Select value={newSlip.brandId} onValueChange={(v) => setNewSlip(prev => ({ ...prev, brandId: v }))}>
                      <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200">
                        <SelectValue placeholder="Select a brand" />
                      </SelectTrigger>
                      <SelectContent>
                        {brands.map(brand => (
                          <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div>
                  <Label className="text-slate-700 font-medium">Slip Image</Label>
                  <div className="mt-2">
                    {newSlip.preview ? (
                      <div className="relative">
                        <img src={newSlip.preview} alt="Preview" className="w-full rounded-xl" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-white/80 rounded-xl"
                          onClick={() => setNewSlip(prev => ({ ...prev, file: null, preview: null }))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500">Click to upload</span>
                        <span className="text-xs text-slate-400">PNG or JPG recommended</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    )}
                  </div>
                </div>
                
                <Button
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium"
                  onClick={handleUpload}
                  disabled={uploading || !newSlip.name || !newSlip.file || !newSlip.brandId}
                >
                  {uploading ? 'Uploading...' : 'Upload Slip'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={selectedBrandFilter} onValueChange={setSelectedBrandFilter}>
            <SelectTrigger className="flex-1 h-10 rounded-xl border-slate-200 bg-white">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands.map(brand => (
                <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex bg-slate-100 rounded-xl p-1">
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse shadow-sm">
                <div className={viewMode === 'grid' ? 'aspect-square bg-slate-200 rounded-xl mb-3' : 'flex gap-4'}>
                  {viewMode === 'list' && <div className="w-20 h-20 bg-slate-200 rounded-xl" />}
                  {viewMode === 'list' && (
                    <div className="flex-1">
                      <div className="h-5 bg-slate-200 rounded w-1/2 mb-2" />
                      <div className="h-4 bg-slate-200 rounded w-1/4" />
                    </div>
                  )}
                </div>
                {viewMode === 'grid' && (
                  <>
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : filteredSlips.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-100">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Image className="w-8 h-8 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-900 mb-1">No custom slips yet</p>
            <p className="text-sm text-slate-500 mb-6">Upload your own slip designs to use on creatives</p>
            <Button 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl" 
              onClick={() => setShowUpload(true)}
            >
              <Plus className="w-4 h-4 mr-1" />
              Upload Your First Slip
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View */
          <div className="grid grid-cols-2 gap-4">
            {filteredSlips.map(slip => (
              <div 
                key={slip.id} 
                className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all ${isDefaultSlip(slip) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-100'}`}
                data-testid={`slip-${slip.id}`}
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  <img
                    src={slip.file_url.startsWith('/api')
                      ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                      : slip.file_url}
                    alt={slip.name}
                    className="w-full h-full object-cover"
                  />
                  
                  {isDefaultSlip(slip) && (
                    <div className="absolute top-2 left-2 bg-indigo-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" /> Default
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2">
                    {getStatusBadge(slip.status)}
                  </div>
                </div>
                
                <div className="p-3">
                  <h3 className="font-medium text-slate-900 text-sm truncate mb-1">{slip.name}</h3>
                  <p className="text-xs text-slate-500 mb-3">{getBrandName(slip.brand_id)}</p>
                  
                  <div className="flex gap-2">
                    {slip.status === 'approved' && !isDefaultSlip(slip) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 text-xs rounded-lg"
                        onClick={() => handleSetDefault(slip)}
                      >
                        <Star className="w-3 h-3 mr-1" /> Set Default
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-lg"
                      onClick={() => handleDelete(slip.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3">
            {filteredSlips.map(slip => (
              <div 
                key={slip.id} 
                className={`bg-white rounded-2xl p-4 shadow-sm border transition-all ${isDefaultSlip(slip) ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-100'}`}
                data-testid={`slip-${slip.id}`}
              >
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden flex-shrink-0 relative">
                    <img
                      src={slip.file_url.startsWith('/api')
                        ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                        : slip.file_url}
                      alt={slip.name}
                      className="w-full h-full object-cover"
                    />
                    {isDefaultSlip(slip) && (
                      <div className="absolute inset-0 bg-indigo-600/80 flex items-center justify-center">
                        <Star className="w-5 h-5 text-white fill-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-medium text-slate-900 truncate">{slip.name}</h3>
                        <p className="text-xs text-slate-500">{getBrandName(slip.brand_id)}</p>
                      </div>
                      {getStatusBadge(slip.status)}
                    </div>
                    
                    <div className="flex items-center gap-2 mt-3">
                      {slip.status === 'approved' && !isDefaultSlip(slip) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs rounded-lg"
                          onClick={() => handleSetDefault(slip)}
                        >
                          <Star className="w-3 h-3 mr-1" /> Set as Default
                        </Button>
                      )}
                      {isDefaultSlip(slip) && (
                        <span className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                          <Star className="w-3 h-3 fill-indigo-600" /> Default for this brand
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-500 rounded-lg ml-auto"
                        onClick={() => handleDelete(slip.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <DealerBottomNav active="slips" />
    </div>
  );
}
