import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { User, Store, MapPin, Phone, Mail, ArrowRight, ArrowLeft, Building2, Check, Tag } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuthStore } from '../../lib/store';
import { userAPI, dealerAPI, brandAPI, categoryAPI } from '../../lib/api';

const STATES = [
  'Delhi', 'Punjab', 'Haryana', 'Karnataka', 'Tamil Nadu', 'Kerala', 
  'Maharashtra', 'Gujarat', 'Rajasthan', 'Uttar Pradesh', 'West Bengal',
  'Bihar', 'Madhya Pradesh', 'Telangana', 'Andhra Pradesh', 'Odisha'
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const { user, updateUser } = useAuthStore();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    selectedCategories: [],
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
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  const loadCategories = async () => {
    try {
      const res = await categoryAPI.list();
      setCategories(res.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const toggleCategory = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.includes(categoryId)
        ? prev.selectedCategories.filter(id => id !== categoryId)
        : [...prev.selectedCategories, categoryId]
    }));
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
      setStep(2);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStep2Submit = async () => {
    if (formData.selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }
    
    setLoading(true);
    try {
      // Fetch brands filtered by selected categories (or all for now)
      const brandsRes = await brandAPI.list();
      setBrands(brandsRes.data);
      setStep(3);
    } catch (error) {
      toast.error('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };
  
  const handleStep3Submit = async () => {
    const required = ['shopName', 'ownerName', 'address', 'pincode', 'district', 'state'];
    const missing = required.filter(f => !formData[f]);
    
    if (missing.length > 0) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setLoading(true);
    try {
      // Create dealer profile with categories
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
        categories: formData.selectedCategories,
      }, formData.selectedBrandId);
      
      // Update user with categories
      await userAPI.updateProfile({ 
        name: formData.name, 
        email: formData.email,
        categories: formData.selectedCategories.join(',')
      });
      
      updateUser({ 
        dealer_id: dealerRes.data.id, 
        status: 'active',
        categories: formData.selectedCategories
      });
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
        <div className="flex items-center justify-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${step >= 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-500'}`}>
            {step > 1 ? <Check className="w-5 h-5" /> : '1'}
          </div>
          <div className={`h-1 w-16 rounded transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-500'}`}>
            {step > 2 ? <Check className="w-5 h-5" /> : '2'}
          </div>
          <div className={`h-1 w-16 rounded transition-all ${step >= 3 ? 'bg-indigo-600' : 'bg-slate-200'}`} />
          <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${step >= 3 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-200 text-slate-500'}`}>
            3
          </div>
        </div>
        <div className="flex justify-between mt-2 px-1 text-xs text-slate-500">
          <span>Your Info</span>
          <span>Categories</span>
          <span>Shop Details</span>
        </div>
      </div>
      
      <div className="max-w-lg mx-auto">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="onboarding-step-1">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-6 mx-auto shadow-lg">
              <User className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Welcome aboard!</h2>
            <p className="text-slate-500 text-center mb-8">Let's set up your profile</p>
            
            <div className="space-y-5">
              <div>
                <Label htmlFor="name" className="text-slate-700 font-medium">Your Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  data-testid="name-input"
                />
              </div>
              
              <div>
                <Label htmlFor="email" className="text-slate-700 font-medium">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  className="mt-2 h-12 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  data-testid="email-input"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleStep1Submit}
              className="w-full mt-8 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-200"
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
        
        {/* Step 2: Category Selection */}
        {step === 2 && (
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="onboarding-step-2">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-6 mx-auto shadow-lg">
              <Tag className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Your Business Categories</h2>
            <p className="text-slate-500 text-center mb-8">Select categories that match your business</p>
            
            <div className="grid grid-cols-2 gap-3 mb-8">
              {categories.map(category => (
                <button
                  key={category.id}
                  onClick={() => toggleCategory(category.id)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left
                    ${formData.selectedCategories.includes(category.id)
                      ? 'border-indigo-500 bg-indigo-50 shadow-md'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  data-testid={`category-${category.id}`}
                >
                  <span className="text-2xl">{category.icon}</span>
                  <span className={`text-sm font-medium ${formData.selectedCategories.includes(category.id) ? 'text-indigo-700' : 'text-slate-700'}`}>
                    {category.name}
                  </span>
                  {formData.selectedCategories.includes(category.id) && (
                    <Check className="w-4 h-4 text-indigo-600 ml-auto" />
                  )}
                </button>
              ))}
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline"
                onClick={() => setStep(1)}
                className="h-12 rounded-xl border-slate-200"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleStep2Submit}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-200"
                disabled={loading || formData.selectedCategories.length === 0}
                data-testid="continue-categories-btn"
              >
                {loading ? 'Loading...' : (
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="w-5 h-5" />
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Shop Details */}
        {step === 3 && (
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 animate-in fade-in slide-in-from-bottom-4 duration-500" data-testid="onboarding-step-3">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-6 mx-auto shadow-lg">
              <Store className="w-8 h-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Shop Details</h2>
            <p className="text-slate-500 text-center mb-8">Tell us about your business</p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="shopName" className="text-slate-700 font-medium">Shop/Business Name *</Label>
                <Input
                  id="shopName"
                  placeholder="e.g. Kumar Electronics"
                  value={formData.shopName}
                  onChange={(e) => handleChange('shopName', e.target.value)}
                  className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  data-testid="shop-name-input"
                />
              </div>
              
              <div>
                <Label htmlFor="ownerName" className="text-slate-700 font-medium">Owner Name *</Label>
                <Input
                  id="ownerName"
                  placeholder="Business owner name"
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  data-testid="owner-name-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone" className="text-slate-700 font-medium">Phone *</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                    data-testid="phone-input"
                  />
                </div>
                <div>
                  <Label htmlFor="whatsapp" className="text-slate-700 font-medium">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                    data-testid="whatsapp-input"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address" className="text-slate-700 font-medium">Address *</Label>
                <Input
                  id="address"
                  placeholder="Shop address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                  data-testid="address-input"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pincode" className="text-slate-700 font-medium">Pincode *</Label>
                  <Input
                    id="pincode"
                    placeholder="110001"
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                    data-testid="pincode-input"
                  />
                </div>
                <div>
                  <Label htmlFor="district" className="text-slate-700 font-medium">District *</Label>
                  <Input
                    id="district"
                    placeholder="Central Delhi"
                    value={formData.district}
                    onChange={(e) => handleChange('district', e.target.value)}
                    className="mt-2 h-11 rounded-xl border-slate-200 focus:border-indigo-500 focus:ring-indigo-500"
                    data-testid="district-input"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="state" className="text-slate-700 font-medium">State *</Label>
                <Select value={formData.state} onValueChange={(v) => handleChange('state', v)}>
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200" data-testid="state-select">
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
                  <Label htmlFor="brand" className="text-slate-700 font-medium">Select Brand to Join (optional)</Label>
                  <Select value={formData.selectedBrandId} onValueChange={(v) => handleChange('selectedBrandId', v)}>
                    <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200" data-testid="brand-select">
                      <SelectValue placeholder="Select a brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">You can join more brands later from your profile</p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-8">
              <Button 
                variant="outline"
                onClick={() => setStep(2)}
                className="h-12 rounded-xl border-slate-200"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
              <Button 
                onClick={handleStep3Submit}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-200"
                disabled={loading}
                data-testid="complete-btn"
              >
                {loading ? 'Creating Profile...' : 'Complete Setup'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
