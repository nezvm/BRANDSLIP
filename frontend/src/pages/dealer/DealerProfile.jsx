import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Save, Store, Phone, Mail, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuthStore } from '../../lib/store';
import { dealerAPI, userAPI } from '../../lib/api';
import DealerBottomNav from '../../components/dealer/DealerBottomNav';

export default function DealerProfile() {
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const [dealer, setDealer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    owner_name: '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    pincode: '',
    district: '',
    state: '',
  });
  
  useEffect(() => {
    loadDealer();
  }, []);
  
  const loadDealer = async () => {
    if (!user?.dealer_id) {
      setLoading(false);
      return;
    }
    
    try {
      const res = await dealerAPI.get(user.dealer_id);
      setDealer(res.data);
      setFormData({
        name: res.data.name || '',
        owner_name: res.data.owner_name || '',
        phone: res.data.phone || '',
        whatsapp: res.data.whatsapp || '',
        email: user?.email || '',
        address: res.data.address || '',
        pincode: res.data.pincode || '',
        district: res.data.district || '',
        state: res.data.state || '',
      });
    } catch (error) {
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleSave = async () => {
    setSaving(true);
    try {
      await dealerAPI.update(user.dealer_id, formData);
      await userAPI.updateProfile({ name: formData.owner_name, email: formData.email });
      updateUser({ name: formData.owner_name, email: formData.email });
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };
  
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const res = await dealerAPI.uploadLogo(user.dealer_id, file);
      setDealer(prev => ({ ...prev, logo_url: res.data.logo_url }));
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50 pb-24" data-testid="dealer-profile">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#4F46E5] to-[#818CF8] px-4 pt-4 pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dealer')} className="text-white hover:bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-white">My Profile</h1>
        </div>
      </div>
      
      {/* Profile Card */}
      <div className="px-4 -mt-16">
        <div className="card-dealer p-6">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                {dealer?.logo_url ? (
                  <img
                    src={dealer.logo_url.startsWith('/api')
                      ? `${process.env.REACT_APP_BACKEND_URL}${dealer.logo_url}`
                      : dealer.logo_url}
                    alt="Shop logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="w-10 h-10 text-slate-400" />
                )}
              </div>
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-[#FACC15] rounded-full flex items-center justify-center cursor-pointer shadow-lg">
                <Camera className="w-4 h-4 text-slate-900" />
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </label>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-3">{dealer?.name}</h2>
            <p className="text-slate-500">{dealer?.owner_name}</p>
          </div>
          
          {/* Form */}
          <div className="space-y-4">
            <div>
              <Label>Shop Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input-field mt-1"
              />
            </div>
            
            <div>
              <Label>Owner Name</Label>
              <Input
                value={formData.owner_name}
                onChange={(e) => handleChange('owner_name', e.target.value)}
                className="input-field mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  className="input-field mt-1"
                />
              </div>
              <div>
                <Label>WhatsApp</Label>
                <Input
                  value={formData.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  className="input-field mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="input-field mt-1"
              />
            </div>
            
            <div>
              <Label>Address</Label>
              <Input
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="input-field mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pincode</Label>
                <Input
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  className="input-field mt-1"
                />
              </div>
              <div>
                <Label>District</Label>
                <Input
                  value={formData.district}
                  onChange={(e) => handleChange('district', e.target.value)}
                  className="input-field mt-1"
                />
              </div>
            </div>
            
            <div>
              <Label>State</Label>
              <Input
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                className="input-field mt-1"
              />
            </div>
          </div>
          
          <Button 
            className="btn-dealer w-full mt-6" 
            onClick={handleSave}
            disabled={saving}
            data-testid="save-btn"
          >
            {saving ? 'Saving...' : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
      
      <DealerBottomNav active="profile" />
    </div>
  );
}
