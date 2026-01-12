import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Shield, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';
import { authAPI } from '../../lib/api';
import { useAuthStore } from '../../lib/store';

export default function OTPVerifyPage() {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();
  
  const phone = location.state?.phone;
  
  useEffect(() => {
    if (!phone) {
      navigate('/login');
    }
  }, [phone, navigate]);
  
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  useEffect(() => {
    // Auto-submit when OTP is complete
    if (otp.length === 6) {
      handleVerify();
    }
  }, [otp]);
  
  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the complete OTP');
      return;
    }
    
    setLoading(true);
    try {
      const response = await authAPI.verifyOTP(phone, otp);
      const { access_token, refresh_token, user } = response.data;
      
      setAuth(user, access_token, refresh_token);
      toast.success('Login successful!');
      
      // Redirect based on user status/role
      if (user.status === 'pending_profile') {
        navigate('/onboarding');
      } else if (user.role === 'dealer_owner' || user.role === 'dealer_staff') {
        navigate('/dealer');
      } else if (user.role === 'zonal_manager') {
        navigate('/manager');
      } else {
        navigate('/admin');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };
  
  const handleResend = async () => {
    setResending(true);
    try {
      const response = await authAPI.sendOTP(phone);
      toast.success('OTP resent!');
      if (response.data.otp_for_dev) {
        toast.info(`Dev OTP: ${response.data.otp_for_dev}`, { duration: 10000 });
      }
      setCountdown(30);
    } catch (error) {
      toast.error('Failed to resend OTP');
    } finally {
      setResending(false);
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
        {/* Back button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/login')}
          className="mb-6 text-slate-600"
          data-testid="back-btn"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        
        {/* Verify Card */}
        <div className="card-dealer p-8 animate-slide-up" data-testid="otp-card">
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-[#4F46E5]/10 mb-6 mx-auto">
            <Shield className="w-7 h-7 text-[#4F46E5]" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">Verify OTP</h2>
          <p className="text-slate-500 text-center mb-8">
            Enter the 6-digit code sent to<br />
            <span className="font-medium text-slate-700">{phone}</span>
          </p>
          
          <div className="flex justify-center mb-8">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={setOtp}
              data-testid="otp-input"
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <InputOTPSlot 
                    key={index} 
                    index={index} 
                    className="w-12 h-14 text-xl font-bold border-2 border-slate-200 rounded-xl focus:border-[#4F46E5] focus:ring-2 focus:ring-[#4F46E5]/20"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          
          <Button 
            onClick={handleVerify}
            className="btn-dealer w-full"
            disabled={loading || otp.length !== 6}
            data-testid="verify-btn"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify & Continue'
            )}
          </Button>
          
          <div className="mt-6 text-center">
            {countdown > 0 ? (
              <p className="text-sm text-slate-500">
                Resend OTP in <span className="font-medium text-slate-700">{countdown}s</span>
              </p>
            ) : (
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={resending}
                className="text-[#4F46E5] hover:text-[#4338CA]"
                data-testid="resend-btn"
              >
                {resending ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Resending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Resend OTP
                  </span>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
