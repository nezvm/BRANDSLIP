import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Layers, Edit, Trash2, Search, Check, X } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Checkbox } from '../../components/ui/checkbox';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { slipTemplateAPI, brandAPI } from '../../lib/api';

const POSITIONS = ['top', 'bottom', 'left', 'right', 'corner'];
const STYLE_PRESETS = ['minimal', 'standard', 'detailed'];
const BG_STYLES = ['light', 'dark', 'transparent'];
const FIELDS = ['shop_name', 'phone', 'whatsapp', 'address', 'logo', 'qr'];

export default function AdminSlipTemplates() {
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    position: 'bottom',
    max_w_pct: 100,
    max_h_pct: 20,
    allowed_fields: ['shop_name', 'phone', 'qr'],
    style_preset: 'standard',
    bg_style: 'light',
  });
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const brandsRes = await brandAPI.list();
      setBrands(brandsRes.data);
      
      if (brandsRes.data.length > 0 && !currentBrand) {
        setCurrentBrand(brandsRes.data[0]);
      }
      
      const brandId = brandsRes.data[0]?.id;
      if (brandId) {
        const templatesRes = await slipTemplateAPI.list({ brand_id: brandId });
        setTemplates(templatesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        position: template.position,
        max_w_pct: template.max_w_pct,
        max_h_pct: template.max_h_pct,
        allowed_fields: template.allowed_fields || [],
        style_preset: template.style_preset,
        bg_style: template.bg_style,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        position: 'bottom',
        max_w_pct: 100,
        max_h_pct: 20,
        allowed_fields: ['shop_name', 'phone', 'qr'],
        style_preset: 'standard',
        bg_style: 'light',
      });
    }
    setShowDialog(true);
  };
  
  const toggleField = (field) => {
    setFormData(prev => ({
      ...prev,
      allowed_fields: prev.allowed_fields.includes(field)
        ? prev.allowed_fields.filter(f => f !== field)
        : [...prev.allowed_fields, field]
    }));
  };
  
  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Template name is required');
      return;
    }
    
    const data = {
      ...formData,
      brand_id: currentBrand?.id,
    };
    
    try {
      if (editingTemplate) {
        await slipTemplateAPI.update(editingTemplate.id, data);
        toast.success('Template updated');
      } else {
        await slipTemplateAPI.create(data);
        toast.success('Template created');
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };
  
  const handleDelete = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    
    try {
      await slipTemplateAPI.delete(templateId);
      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success('Template deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <AdminLayout 
      title="Slip Templates"
      actions={
        <Button className="btn-brand" onClick={() => handleOpenDialog()} data-testid="create-template-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Templates Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-brand p-6 animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No slip templates yet</h3>
          <p className="text-slate-500 mb-4">Create templates for dealers to personalize creatives</p>
          <Button className="btn-brand" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Template
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <div key={template.id} className="card-brand p-6" data-testid={`template-${template.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    template.bg_style === 'dark' ? 'bg-slate-800' : 
                    template.bg_style === 'transparent' ? 'bg-slate-200' : 'bg-slate-100'
                  }`}>
                    <Layers className={`w-5 h-5 ${template.bg_style === 'dark' ? 'text-white' : 'text-slate-600'}`} />
                  </div>
                  <h3 className="font-bold text-slate-900">{template.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(template)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Position</span>
                  <span className="text-slate-700 capitalize">{template.position}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Style</span>
                  <span className="text-slate-700 capitalize">{template.style_preset}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Size</span>
                  <span className="text-slate-700">{template.max_w_pct}% × {template.max_h_pct}%</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-2">Included fields:</p>
                <div className="flex flex-wrap gap-1">
                  {template.allowed_fields?.map(field => (
                    <span key={field} className="text-xs bg-[#4F46E5]/10 text-[#4F46E5] px-2 py-0.5 rounded-full">
                      {field.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Create Template'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Template Name *</Label>
              <Input
                placeholder="e.g. Standard Footer"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Position</Label>
                <Select value={formData.position} onValueChange={(v) => setFormData({ ...formData, position: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map(p => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Style Preset</Label>
                <Select value={formData.style_preset} onValueChange={(v) => setFormData({ ...formData, style_preset: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STYLE_PRESETS.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Max Width %</Label>
                <Input
                  type="number"
                  value={formData.max_w_pct}
                  onChange={(e) => setFormData({ ...formData, max_w_pct: parseInt(e.target.value) || 100 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Max Height %</Label>
                <Input
                  type="number"
                  value={formData.max_h_pct}
                  onChange={(e) => setFormData({ ...formData, max_h_pct: parseInt(e.target.value) || 20 })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Background</Label>
                <Select value={formData.bg_style} onValueChange={(v) => setFormData({ ...formData, bg_style: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BG_STYLES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Allowed Fields</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {FIELDS.map(field => (
                  <label key={field} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                    <Checkbox
                      checked={formData.allowed_fields.includes(field)}
                      onCheckedChange={() => toggleField(field)}
                    />
                    <span className="text-sm capitalize">{field.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="btn-brand" onClick={handleSubmit}>
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
