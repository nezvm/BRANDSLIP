import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Trash2, Image, Check, Clock, X, Upload } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { useAuthStore } from '../../lib/store';
import { dealerSlipAPI, brandAPI, dealerAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

export default function DealerSlips() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [dealer, setDealer] = useState(null);
  
  const [newSlip, setNewSlip] = useState({
    name: '',
    file: null,
    preview: null,
  });
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [slipsRes, dealerRes] = await Promise.all([
        dealerSlipAPI.list({ dealer_id: user?.dealer_id }),
        user?.dealer_id ? dealerAPI.get(user.dealer_id) : Promise.resolve({ data: null })
      ]);
      setSlips(slipsRes.data);
      setDealer(dealerRes.data);
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
    if (!newSlip.name || !newSlip.file) {
      toast.error('Please provide a name and select a file');
      return;
    }
    
    const brandId = dealer?.brand_links?.[0]?.brand_id;
    if (!brandId) {
      toast.error('No brand linked to your account');
      return;
    }
    
    setUploading(true);
    try {
      await dealerSlipAPI.create({
        dealer_id: user.dealer_id,
        brand_id: brandId,
        name: newSlip.name,
      }, newSlip.file);
      
      toast.success('Slip uploaded! Pending approval.');
      setShowUpload(false);
      setNewSlip({ name: '', file: null, preview: null });
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
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
            <X className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="dealer-slips">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dealer')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-slate-900">My Slips</h1>
          </div>
          <Dialog open={showUpload} onOpenChange={setShowUpload}>
            <DialogTrigger asChild>
              <Button className="btn-brand" data-testid="upload-slip-btn">
                <Plus className="w-4 h-4 mr-1" />
                Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Custom Slip</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>Slip Name</Label>
                  <Input
                    placeholder="e.g. My Store Footer"
                    value={newSlip.name}
                    onChange={(e) => setNewSlip(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field mt-1"
                  />
                </div>
                
                <div>
                  <Label>Slip Image</Label>
                  <div className="mt-1">
                    {newSlip.preview ? (
                      <div className="relative">
                        <img src={newSlip.preview} alt="Preview" className="w-full rounded-xl" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 bg-white/80"
                          onClick={() => setNewSlip(prev => ({ ...prev, file: null, preview: null }))}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#4F46E5] transition-colors">
                        <Upload className="w-8 h-8 text-slate-400 mb-2" />
                        <span className="text-sm text-slate-500">Click to upload</span>
                        <span className="text-xs text-slate-400">PNG or JPG</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                      </label>
                    )}
                  </div>
                </div>
                
                <Button
                  className="btn-dealer w-full"
                  onClick={handleUpload}
                  disabled={uploading || !newSlip.name || !newSlip.file}
                >
                  {uploading ? 'Uploading...' : 'Upload Slip'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="card-dealer p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-slate-200 rounded-lg" />
                  <div className="flex-1">
                    <div className="h-5 bg-slate-200 rounded w-1/2 mb-2" />
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : slips.length === 0 ? (
          <div className="card-dealer p-8 text-center">
            <Image className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-900 mb-1">No custom slips yet</p>
            <p className="text-sm text-slate-500 mb-4">Upload your own slip designs to use on creatives</p>
            <Button className="btn-dealer" onClick={() => setShowUpload(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Upload Your First Slip
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {slips.map(slip => (
              <div key={slip.id} className="card-dealer p-4" data-testid={`slip-${slip.id}`}>
                <div className="flex gap-4">
                  <div className="w-20 h-20 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={slip.file_url.startsWith('/api')
                        ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                        : slip.file_url}
                      alt={slip.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-900 truncate">{slip.name}</h3>
                    <div className="mt-1">{getStatusBadge(slip.status)}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-500"
                    onClick={() => handleDelete(slip.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
