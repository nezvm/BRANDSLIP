import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, Plus, Upload, Trash2, Image as ImageIcon, 
  Monitor, Smartphone, FileImage, X
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { creativeAPI, variantAPI } from '../../lib/api';

const SIZE_PRESETS = [
  { label: 'WhatsApp Status', width: 1080, height: 1920, icon: Smartphone },
  { label: 'Instagram Post', width: 1080, height: 1080, icon: Monitor },
  { label: 'Instagram Story', width: 1080, height: 1920, icon: Smartphone },
  { label: 'Facebook Post', width: 1200, height: 630, icon: Monitor },
  { label: 'A4 Print', width: 2480, height: 3508, icon: FileImage },
  { label: 'Custom', width: 0, height: 0, icon: ImageIcon },
];

export default function AdminCreativeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentBrand } = useBrandStore();
  
  const [creative, setCreative] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [variantForm, setVariantForm] = useState({
    label: '',
    width: 1080,
    height: 1080,
    file: null,
    preview: null,
  });
  
  useEffect(() => {
    loadCreative();
  }, [id]);
  
  const loadCreative = async () => {
    setLoading(true);
    try {
      const res = await creativeAPI.get(id);
      setCreative(res.data);
    } catch (error) {
      toast.error('Failed to load creative');
      navigate('/admin/creatives');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePresetSelect = (preset) => {
    setVariantForm(prev => ({
      ...prev,
      label: preset.label,
      width: preset.width,
      height: preset.height,
    }));
  };
  
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const preview = URL.createObjectURL(file);
    setVariantForm(prev => ({ ...prev, file, preview }));
    
    // Try to get image dimensions
    const img = new window.Image();
    img.onload = () => {
      if (variantForm.width === 0 || variantForm.height === 0) {
        setVariantForm(prev => ({
          ...prev,
          width: img.width,
          height: img.height,
        }));
      }
    };
    img.src = preview;
  };
  
  const handleUploadVariant = async () => {
    if (!variantForm.file || !variantForm.label) {
      toast.error('Please select a file and enter a label');
      return;
    }
    
    setUploading(true);
    try {
      await variantAPI.create({
        creative_id: id,
        brand_id: currentBrand?.id || creative?.brand_id,
        label: variantForm.label,
        width: variantForm.width,
        height: variantForm.height,
      }, variantForm.file);
      
      toast.success('Variant uploaded!');
      setShowUpload(false);
      setVariantForm({ label: '', width: 1080, height: 1080, file: null, preview: null });
      loadCreative();
    } catch (error) {
      toast.error('Failed to upload variant');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDeleteVariant = async (variantId) => {
    if (!window.confirm('Delete this variant?')) return;
    
    try {
      await variantAPI.delete(variantId);
      toast.success('Variant deleted');
      loadCreative();
    } catch (error) {
      toast.error('Failed to delete variant');
    }
  };
  
  if (loading) {
    return (
      <AdminLayout title="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }
  
  return (
    <AdminLayout
      title={creative?.name || 'Creative Details'}
      actions={
        <Button className="btn-brand" onClick={() => setShowUpload(true)} data-testid="upload-variant-btn">
          <Plus className="w-4 h-4 mr-2" />
          Upload Variant
        </Button>
      }
    >
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/admin/creatives')} className="mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Creatives
      </Button>
      
      {/* Creative Info */}
      <div className="card-brand p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <Label className="text-slate-500">Campaign Name</Label>
            <p className="font-medium text-slate-900 mt-1">{creative?.name}</p>
          </div>
          <div>
            <Label className="text-slate-500">Category</Label>
            <p className="font-medium text-slate-900 mt-1">{creative?.category}</p>
          </div>
          <div>
            <Label className="text-slate-500">Language</Label>
            <p className="font-medium text-slate-900 mt-1">{creative?.language}</p>
          </div>
          {creative?.description && (
            <div className="col-span-full">
              <Label className="text-slate-500">Description</Label>
              <p className="text-slate-900 mt-1">{creative?.description}</p>
            </div>
          )}
          {creative?.tags?.length > 0 && (
            <div className="col-span-full">
              <Label className="text-slate-500">Tags</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {creative.tags.map(tag => (
                  <span key={tag} className="text-sm bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Variants */}
      <h2 className="text-lg font-bold text-slate-900 mb-4">
        Creative Variants ({creative?.variants?.length || 0})
      </h2>
      
      {creative?.variants?.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No variants yet</h3>
          <p className="text-slate-500 mb-4">Upload at least one variant to publish this creative</p>
          <Button className="btn-brand" onClick={() => setShowUpload(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload First Variant
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {creative?.variants?.map(variant => (
            <div key={variant.id} className="card-brand overflow-hidden group" data-testid={`variant-${variant.id}`}>
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                <img
                  src={variant.file_url.startsWith('/api')
                    ? `${process.env.REACT_APP_BACKEND_URL}${variant.file_url}`
                    : variant.file_url}
                  alt={variant.label}
                  className="w-full h-full object-contain"
                />
                
                {/* Delete button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-white/80 hover:bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteVariant(variant.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-slate-900">{variant.label}</h3>
                <p className="text-sm text-slate-500">{variant.width} × {variant.height}px</p>
              </div>
            </div>
          ))}
          
          {/* Add variant card */}
          <div 
            className="card-brand border-2 border-dashed border-slate-200 hover:border-[#4F46E5] transition-colors cursor-pointer flex items-center justify-center min-h-[200px]"
            onClick={() => setShowUpload(true)}
          >
            <div className="text-center">
              <Plus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-slate-500">Add Variant</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Creative Variant</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            {/* Size Presets */}
            <div>
              <Label>Select Size Preset</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {SIZE_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    type="button"
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      variantForm.label === preset.label
                        ? 'border-[#4F46E5] bg-[#4F46E5]/5'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                    onClick={() => handlePresetSelect(preset)}
                  >
                    <preset.icon className="w-5 h-5 text-slate-400 mb-1" />
                    <p className="font-medium text-slate-900 text-sm">{preset.label}</p>
                    {preset.width > 0 && (
                      <p className="text-xs text-slate-500">{preset.width}×{preset.height}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Custom size */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Label *</Label>
                <Input
                  value={variantForm.label}
                  onChange={(e) => setVariantForm({ ...variantForm, label: e.target.value })}
                  placeholder="e.g. Instagram Post"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Width (px)</Label>
                <Input
                  type="number"
                  value={variantForm.width}
                  onChange={(e) => setVariantForm({ ...variantForm, width: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Height (px)</Label>
                <Input
                  type="number"
                  value={variantForm.height}
                  onChange={(e) => setVariantForm({ ...variantForm, height: parseInt(e.target.value) || 0 })}
                  className="mt-1"
                />
              </div>
            </div>
            
            {/* File upload */}
            <div>
              <Label>Creative Image *</Label>
              <div className="mt-2">
                {variantForm.preview ? (
                  <div className="relative">
                    <img 
                      src={variantForm.preview} 
                      alt="Preview" 
                      className="max-h-64 mx-auto rounded-xl"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 bg-white/80"
                      onClick={() => setVariantForm(prev => ({ ...prev, file: null, preview: null }))}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-[#4F46E5] transition-colors">
                    <Upload className="w-10 h-10 text-slate-400 mb-2" />
                    <span className="text-slate-500">Click to upload image</span>
                    <span className="text-xs text-slate-400 mt-1">PNG, JPG up to 10MB</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileSelect}
                    />
                  </label>
                )}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowUpload(false)}>
                Cancel
              </Button>
              <Button 
                className="btn-brand" 
                onClick={handleUploadVariant}
                disabled={uploading || !variantForm.file || !variantForm.label}
              >
                {uploading ? 'Uploading...' : 'Upload Variant'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
