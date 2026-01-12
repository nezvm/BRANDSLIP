import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Phone, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { authAPI, seedData } from '../../lib/api';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authAPI.sendOTP(phone);
      toast.success('OTP sent successfully!');
      
      // For dev, show OTP in toast
      if (response.data.otp_for_dev) {
        toast.info(`Dev OTP: ${response.data.otp_for_dev}`, { duration: 10000 });
      }
      
      navigate('/verify-otp', { state: { phone } });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await seedData();
      toast.success('Demo data created!');
      if (response.data.admin_phone) {
        toast.info(`Admin phone: ${response.data.admin_phone}`, { duration: 10000 });
      }
    } catch (error) {
      if (error.response?.data?.message?.includes('already seeded')) {
        toast.info('Database already has data');
      } else {
        toast.error('Failed to seed data');
      }
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[#4F46E5]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[#FACC15]/10 rounded-full blur-3xl" />
      </div>
      
      <div className="w-full max-w-md relative">
        {/* Logo/Brand */}
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-brand mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">BrandSlip</h1>
          <p className="text-slate-500 mt-2">Brand-to-Dealer Creative Distribution</p>
        </div>
        
        {/* Login Card */}
        <div className="card-dealer p-8 animate-slide-up stagger-1" data-testid="login-card">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Welcome back</h2>
          <p className="text-slate-500 mb-6">Enter your phone number to continue</p>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                data-testid="phone-input"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field pl-12"
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              className="btn-dealer w-full"
              disabled={loading}
              data-testid="send-otp-btn"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                  Sending OTP...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue
                  <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>
          
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-sm text-slate-500 text-center mb-3">New to BrandSlip?</p>
            <p className="text-xs text-slate-400 text-center">
              Simply enter your phone number to get started. We'll help you set up your account.
            </p>
          </div>
        </div>
        
        {/* Dev seed button */}
        <div className="mt-6 text-center animate-slide-up stagger-2">
          <Button
            variant="ghost"
            onClick={handleSeedData}
            disabled={seeding}
            className="text-slate-400 hover:text-slate-600"
            data-testid="seed-data-btn"
          >
            {seeding ? 'Creating demo data...' : '🌱 Seed Demo Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}
