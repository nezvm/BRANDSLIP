import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, Download, Share2, Check, ChevronRight, 
  MessageCircle, MapPin, Link, QrCode, Image as ImageIcon,
  Loader2
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { RadioGroup, RadioGroupItem } from '../../components/ui/radio-group';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import { useAuthStore } from '../../lib/store';
import { creativeAPI, slipTemplateAPI, dealerSlipAPI, renderAPI, dealerAPI } from '../../lib/api';

export default function DealerCreativeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  
  const [creative, setCreative] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [slipTemplates, setSlipTemplates] = useState([]);
  const [dealerSlips, setDealerSlips] = useState([]);
  const [dealer, setDealer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [renderedAsset, setRenderedAsset] = useState(null);
  
  // Selection state
  const [slipMode, setSlipMode] = useState('template'); // 'template' or 'dealer_slip'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedDealerSlipId, setSelectedDealerSlipId] = useState('');
  const [qrType, setQrType] = useState('whatsapp');
  const [customQrValue, setCustomQrValue] = useState('');
  
  const [step, setStep] = useState(1); // 1: size, 2: slip, 3: qr, 4: preview
  
  useEffect(() => {
    loadData();
  }, [id]);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [creativeRes, templatesRes, dealerRes] = await Promise.all([
        creativeAPI.get(id),
        slipTemplateAPI.list(),
        user?.dealer_id ? dealerAPI.get(user.dealer_id) : Promise.resolve({ data: null })
      ]);
      
      setCreative(creativeRes.data);
      setSlipTemplates(templatesRes.data);
      setDealer(dealerRes.data);
      
      if (creativeRes.data.variants?.length > 0) {
        setSelectedVariant(creativeRes.data.variants[0]);
      }
      
      if (templatesRes.data.length > 0) {
        setSelectedTemplateId(templatesRes.data[0].id);
      }
      
      // Load dealer slips
      if (user?.dealer_id) {
        const slipsRes = await dealerSlipAPI.list({ dealer_id: user.dealer_id, status: 'approved' });
        setDealerSlips(slipsRes.data);
      }
    } catch (error) {
      toast.error('Failed to load creative');
      navigate('/dealer');
    } finally {
      setLoading(false);
    }
  };
  
  const handleRender = async () => {
    if (!selectedVariant || !user?.dealer_id) {
      toast.error('Please select a size and ensure you have a dealer profile');
      return;
    }
    
    setRendering(true);
    try {
      const renderData = {
        creative_variant_id: selectedVariant.id,
        slip_mode: slipMode,
        slip_template_id: slipMode === 'template' ? selectedTemplateId : null,
        dealer_slip_id: slipMode === 'dealer_slip' ? selectedDealerSlipId : null,
        dealer_id: user.dealer_id,
        qr_type: qrType !== 'none' ? qrType : null,
        qr_value: qrType === 'custom' ? customQrValue : null,
      };
      
      const response = await renderAPI.render(renderData);
      setRenderedAsset(response.data);
      setStep(4);
      toast.success('Creative personalized!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to render creative');
    } finally {
      setRendering(false);
    }
  };
  
  const handleDownload = async () => {
    if (!renderedAsset) return;
    
    try {
      const downloadUrl = renderedAsset.output_url.startsWith('/api')
        ? `${process.env.REACT_APP_BACKEND_URL}${renderedAsset.output_url}`
        : renderedAsset.output_url;
      
      window.open(downloadUrl, '_blank');
      toast.success('Download started!');
    } catch (error) {
      toast.error('Download failed');
    }
  };
  
  const handleShare = async () => {
    if (!renderedAsset) return;
    
    try {
      const shareRes = await renderAPI.createShareLink(renderedAsset.id);
      const shareUrl = `${window.location.origin}/s/${shareRes.data.share_token}`;
      
      const shareText = `Check out this offer from ${dealer?.name || 'our store'}! Contact us at ${dealer?.phone || ''}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText + '\n' + shareUrl)}`;
      
      if (navigator.share) {
        await navigator.share({
          title: creative?.name,
          text: shareText,
          url: shareUrl,
        });
      } else {
        window.open(whatsappUrl, '_blank');
      }
      
      toast.success('Share link created!');
    } catch (error) {
      toast.error('Failed to create share link');
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#4F46E5] animate-spin" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50" data-testid="dealer-creative-detail">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dealer')} data-testid="back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold text-slate-900">{creative?.name}</h1>
            <p className="text-sm text-slate-500">Step {step} of 4</p>
          </div>
        </div>
      </div>
      
      {/* Progress Bar */}
      <div className="bg-white px-4 py-2 border-b border-slate-100">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map(s => (
            <div 
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[#FACC15]' : 'bg-slate-200'}`}
            />
          ))}
        </div>
      </div>
      
      <div className="p-4">
        {/* Step 1: Select Size */}
        {step === 1 && (
          <div className="animate-slide-up" data-testid="step-1">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Select Size</h2>
            
            {/* Preview */}
            <div className="card-dealer overflow-hidden mb-6">
              <div className="aspect-[4/3] bg-slate-100 relative">
                {selectedVariant?.file_url ? (
                  <img
                    src={selectedVariant.file_url.startsWith('/api') 
                      ? `${process.env.REACT_APP_BACKEND_URL}${selectedVariant.file_url}`
                      : selectedVariant.file_url}
                    alt={creative?.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-slate-300" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Size Options */}
            <div className="space-y-3">
              {creative?.variants?.map(variant => (
                <div
                  key={variant.id}
                  className={`card-dealer p-4 cursor-pointer transition-all ${
                    selectedVariant?.id === variant.id 
                      ? 'ring-2 ring-[#4F46E5] bg-[#4F46E5]/5' 
                      : 'hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedVariant(variant)}
                  data-testid={`variant-${variant.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{variant.label}</p>
                      <p className="text-sm text-slate-500">{variant.width} × {variant.height}px</p>
                    </div>
                    {selectedVariant?.id === variant.id && (
                      <div className="w-6 h-6 rounded-full bg-[#4F46E5] flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <Button 
              className="btn-dealer w-full mt-6" 
              onClick={() => setStep(2)}
              disabled={!selectedVariant}
              data-testid="next-btn"
            >
              Continue
              <ChevronRight className="w-5 h-5 ml-1" />
            </Button>
          </div>
        )}
        
        {/* Step 2: Select Slip */}
        {step === 2 && (
          <div className="animate-slide-up" data-testid="step-2">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Slip Style</h2>
            
            {/* Slip Mode Selection */}
            <RadioGroup value={slipMode} onValueChange={setSlipMode} className="mb-6">
              <div className={`card-dealer p-4 cursor-pointer ${slipMode === 'template' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="template" id="template" />
                  <Label htmlFor="template" className="flex-1 cursor-pointer">
                    <p className="font-medium text-slate-900">Use Brand Templates</p>
                    <p className="text-sm text-slate-500">Pre-designed slip layouts</p>
                  </Label>
                </div>
              </div>
              
              {dealerSlips.length > 0 && (
                <div className={`card-dealer p-4 cursor-pointer mt-3 ${slipMode === 'dealer_slip' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value="dealer_slip" id="dealer_slip" />
                    <Label htmlFor="dealer_slip" className="flex-1 cursor-pointer">
                      <p className="font-medium text-slate-900">Use My Custom Slip</p>
                      <p className="text-sm text-slate-500">Your uploaded slip designs</p>
                    </Label>
                  </div>
                </div>
              )}
            </RadioGroup>
            
            {/* Template Selection */}
            {slipMode === 'template' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-600 mb-2">Select Template</p>
                {slipTemplates.map(template => (
                  <div
                    key={template.id}
                    className={`card-dealer p-4 cursor-pointer ${
                      selectedTemplateId === template.id ? 'ring-2 ring-[#4F46E5] bg-[#4F46E5]/5' : ''
                    }`}
                    onClick={() => setSelectedTemplateId(template.id)}
                    data-testid={`template-${template.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{template.name}</p>
                        <p className="text-sm text-slate-500">
                          Position: {template.position} • Style: {template.style_preset}
                        </p>
                      </div>
                      {selectedTemplateId === template.id && (
                        <Check className="w-5 h-5 text-[#4F46E5]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Dealer Slip Selection */}
            {slipMode === 'dealer_slip' && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-600 mb-2">Select Your Slip</p>
                {dealerSlips.map(slip => (
                  <div
                    key={slip.id}
                    className={`card-dealer p-4 cursor-pointer ${
                      selectedDealerSlipId === slip.id ? 'ring-2 ring-[#4F46E5] bg-[#4F46E5]/5' : ''
                    }`}
                    onClick={() => setSelectedDealerSlipId(slip.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden">
                        <img
                          src={slip.file_url.startsWith('/api')
                            ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                            : slip.file_url}
                          alt={slip.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{slip.name}</p>
                        <p className="text-sm text-slate-500">Custom slip</p>
                      </div>
                      {selectedDealerSlipId === slip.id && (
                        <Check className="w-5 h-5 text-[#4F46E5]" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button 
                className="btn-dealer flex-1" 
                onClick={() => setStep(3)}
                disabled={slipMode === 'template' ? !selectedTemplateId : !selectedDealerSlipId}
                data-testid="next-btn"
              >
                Continue
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: QR Code */}
        {step === 3 && (
          <div className="animate-slide-up" data-testid="step-3">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Add QR Code</h2>
            <p className="text-sm text-slate-500 mb-6">Choose what your QR code should link to</p>
            
            <RadioGroup value={qrType} onValueChange={setQrType} className="space-y-3">
              <div className={`card-dealer p-4 cursor-pointer ${qrType === 'whatsapp' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="whatsapp" id="whatsapp" />
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  <Label htmlFor="whatsapp" className="flex-1 cursor-pointer">
                    <p className="font-medium text-slate-900">WhatsApp Chat</p>
                    <p className="text-sm text-slate-500">Customers can message you directly</p>
                  </Label>
                </div>
              </div>
              
              <div className={`card-dealer p-4 cursor-pointer ${qrType === 'maps' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="maps" id="maps" />
                  <MapPin className="w-5 h-5 text-red-500" />
                  <Label htmlFor="maps" className="flex-1 cursor-pointer">
                    <p className="font-medium text-slate-900">Google Maps</p>
                    <p className="text-sm text-slate-500">Show your shop location</p>
                  </Label>
                </div>
              </div>
              
              <div className={`card-dealer p-4 cursor-pointer ${qrType === 'custom' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="custom" id="custom" />
                  <Link className="w-5 h-5 text-blue-500" />
                  <Label htmlFor="custom" className="flex-1 cursor-pointer">
                    <p className="font-medium text-slate-900">Custom URL</p>
                    <p className="text-sm text-slate-500">Link to any website</p>
                  </Label>
                </div>
              </div>
              
              <div className={`card-dealer p-4 cursor-pointer ${qrType === 'none' ? 'ring-2 ring-[#4F46E5]' : ''}`}>
                <div className="flex items-center gap-3">
                  <RadioGroupItem value="none" id="none" />
                  <QrCode className="w-5 h-5 text-slate-400" />
                  <Label htmlFor="none" className="flex-1 cursor-pointer">
                    <p className="font-medium text-slate-900">No QR Code</p>
                    <p className="text-sm text-slate-500">Skip adding QR code</p>
                  </Label>
                </div>
              </div>
            </RadioGroup>
            
            {qrType === 'custom' && (
              <div className="mt-4">
                <Label>Custom URL</Label>
                <Input
                  placeholder="https://your-website.com"
                  value={customQrValue}
                  onChange={(e) => setCustomQrValue(e.target.value)}
                  className="input-field mt-1"
                />
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button 
                className="btn-dealer flex-1" 
                onClick={handleRender}
                disabled={rendering || (qrType === 'custom' && !customQrValue)}
                data-testid="generate-btn"
              >
                {rendering ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Generating...
                  </>
                ) : (
                  'Generate Creative'
                )}
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 4: Preview & Download */}
        {step === 4 && renderedAsset && (
          <div className="animate-slide-up" data-testid="step-4">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Your Personalized Creative</h2>
            
            {/* Preview */}
            <div className="card-dealer overflow-hidden mb-6">
              <img
                src={renderedAsset.output_url.startsWith('/api')
                  ? `${process.env.REACT_APP_BACKEND_URL}${renderedAsset.output_url}`
                  : renderedAsset.output_url}
                alt="Personalized creative"
                className="w-full"
              />
            </div>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <Button 
                className="btn-dealer"
                onClick={handleDownload}
                data-testid="download-btn"
              >
                <Download className="w-5 h-5 mr-2" />
                Download
              </Button>
              <Button 
                className="bg-green-500 hover:bg-green-600 text-white font-bold h-12 rounded-full"
                onClick={handleShare}
                data-testid="share-btn"
              >
                <Share2 className="w-5 h-5 mr-2" />
                Share
              </Button>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full mt-4" 
              onClick={() => {
                setStep(1);
                setRenderedAsset(null);
              }}
            >
              Create Another
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
