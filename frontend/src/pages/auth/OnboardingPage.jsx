import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Store, MapPin, Phone, Mail, ArrowRight, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuthStore } from '../../lib/store';
import { userAPI, dealerAPI, brandAPI } from '../../lib/api';

const STATES = [
  'Delhi', 'Punjab', 'Haryana', 'Karnataka', 'Tamil Nadu', 'Kerala', 
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Uttar Pradesh'
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    shopName: '',
    ownerName: '',
    phone: user?.phone || '',
    whatsapp: user?.phone || '',
    address: '',
    pincode: '',
    district: '',
    state: '',
    selectedBrandId: '',
  });
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const handleStep1Submit = async () => {
    if (!formData.name) {
      toast.error('Please enter your name');
      return;
    }
    
    setLoading(true);
    try {
      // Update user profile
      await userAPI.updateProfile({ name: formData.name, email: formData.email });
      updateUser({ name: formData.name, email: formData.email });
      
      // Fetch available brands
      const brandsRes = await brandAPI.list();
      setBrands(brandsRes.data);
      
      setStep(2);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStep2Submit = async () => {
    const required = ['shopName', 'ownerName', 'address', 'pincode', 'district', 'state'];
    const missing = required.filter(f => !formData[f]);
    
    if (missing.length > 0) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // Create dealer profile
      const dealerRes = await dealerAPI.create({
        name: formData.shopName,
        owner_name: formData.ownerName,
        phone: formData.phone,
        whatsapp: formData.whatsapp,
        address: formData.address,
        pincode: formData.pincode,
        district: formData.district,
        state: formData.state,
        email: formData.email,
      }, formData.selectedBrandId);
      
      updateUser({ dealer_id: dealerRes.data.id, status: 'active' });
      toast.success('Profile created successfully!');
      navigate('/dealer');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create dealer profile');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 py-8 px-4">
      {/* Progress */}
      <div className="max-w-lg mx-auto mb-8">
        <div className="flex items-center justify-center gap-4">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 1 ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'}`}>
            1
          </div>
          <div className={`h-1 w-20 rounded ${step >= 2 ? 'bg-[#4F46E5]' : 'bg-slate-200'}`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step >= 2 ? 'bg-[#4F46E5] text-white' : 'bg-slate-200 text-slate-500'}`}>
            2
          </div>
        </div>
        <div className="flex justify-between mt-2 px-2">
          <span className="text-sm text-slate-600">Your Info</span>
          <span className="text-sm text-slate-600">Shop Details</span>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto">
        {step === 1 && (
          <div className="card-dealer p-8 animate-slide-up" data-testid="onboarding-step-1">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FACC15]/20 mb-6 mx-auto">
              <User className="w-7 h-7 text-[#4F46E5]" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Welcome aboard!</h2>
            <p className="text-slate-500 text-center mb-8">Let's set up your profile</p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="input-field mt-1"
                  data-testid="name-input"
                />
              </div>
              
              <div>
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="input-field mt-1"
                  data-testid="email-input"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleStep1Submit}
              className="btn-dealer w-full mt-8"
              disabled={loading}
              data-testid="continue-btn"
            >
              {loading ? 'Saving...' : (
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </div>
        )}
        
        {step === 2 && (
          <div className="card-dealer p-8 animate-slide-up" data-testid="onboarding-step-2">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#FACC15]/20 mb-6 mx-auto">
              <Store className="w-7 h-7 text-[#4F46E5]" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Shop Details</h2>
            <p className="text-slate-500 text-center mb-8">Tell us about your business</p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="shopName">Shop/Business Name *</Label>
                <Input
                  id="shopName"
                  placeholder="e.g. Kumar Electronics"
                  value={formData.shopName}
                  onChange={(e) => handleChange('shopName', e.target.value)}
                  className="input-field mt-1"
                  data-testid="shop-name-input"
                />
              </div>
              
              <div>
                <Label htmlFor="ownerName">Owner Name *</Label>
                <Input
                  id="ownerName"
                  placeholder="Business owner name"
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  className="input-field mt-1"
                  data-testid="owner-name-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="input-field mt-1"
                    data-testid="phone-input"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="input-field mt-1"
                    data-testid="whatsapp-input"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  placeholder="Shop address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="input-field mt-1"
                  data-testid="address-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pincode">Pincode *</Label>
                  <Input
                    id="pincode"
                    placeholder="110001"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    className="input-field mt-1"
                    data-testid="pincode-input"
                  />
                </div>
                <div>
                  <Label htmlFor="district">District *</Label>
                  <Input
                    id="district"
                    placeholder="Central Delhi"
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    className="input-field mt-1"
                    data-testid="district-input"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="state">State *</Label>
                <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                  <SelectTrigger className="input-field mt-1" data-testid="state-select">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATES.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {brands.length > 0 && (
                <div>
                  <Label htmlFor="brand">Select Brand to Join (optional)</Label>
                  <Select value={formData.selectedBrandId} onValueChange={(v) => handleChange('selectedBrandId', v)}>
                    <SelectTrigger className="input-field mt-1" data-testid="brand-select">
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
            </div>
            
            <Button 
              onClick={handleStep2Submit}
              className="btn-dealer w-full mt-8"
              disabled={loading}
              data-testid="complete-btn"
            >
              {loading ? 'Creating Profile...' : 'Complete Setup'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
