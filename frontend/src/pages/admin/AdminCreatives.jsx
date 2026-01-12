import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Search, Image, MoreVertical, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { creativeAPI, brandAPI } from '../../lib/api';

export default function AdminCreatives() {
  const navigate = useNavigate();
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [creatives, setCreatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: '',
    language: 'en',
    category: 'general',
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
        const creativesRes = await creativeAPI.list({ brand_id: brandId });
        setCreatives(creativesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load creatives');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = async () => {
    if (!formData.name) {
      toast.error('Name is required');
      return;
    }
    
    try {
      const data = {
        brand_id: currentBrand?.id,
        name: formData.name,
        description: formData.description,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
        language: formData.language,
        category: formData.category,
        targeting: { all: true, zone_ids: [], dealer_ids: [] },
      };
      
      const res = await creativeAPI.create(data);
      toast.success('Creative created!');
      setShowCreate(false);
      navigate(`/admin/creatives/${res.data.id}`);
    } catch (error) {
      toast.error('Failed to create creative');
    }
  };
  
  const handleDelete = async (creativeId) => {
    if (!window.confirm('Delete this creative?')) return;
    
    try {
      await creativeAPI.delete(creativeId);
      setCreatives(creatives.filter(c => c.id !== creativeId));
      toast.success('Creative deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const filteredCreatives = creatives.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <AdminLayout 
      title="Creatives"
      actions={
        <Button className="btn-brand" onClick={() => setShowCreate(true)} data-testid="create-creative-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Creative
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search creatives..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Creatives Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="card-brand overflow-hidden animate-pulse">
              <div className="aspect-video bg-slate-200" />
              <div className="p-4">
                <div className="h-5 bg-slate-200 rounded w-2/3 mb-2" />
                <div className="h-4 bg-slate-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCreatives.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <Image className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No creatives yet</h3>
          <p className="text-slate-500 mb-4">Create your first campaign creative</p>
          <Button className="btn-brand" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Creative
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCreatives.map(creative => (
            <div key={creative.id} className="card-brand overflow-hidden group" data-testid={`creative-${creative.id}`}>
              {/* Thumbnail */}
              <div className="aspect-video bg-slate-100 relative overflow-hidden">
                {creative.variants?.[0]?.file_url ? (
                  <img
                    src={creative.variants[0].file_url.startsWith('/api')
                      ? `${process.env.REACT_APP_BACKEND_URL}${creative.variants[0].file_url}`
                      : creative.variants[0].file_url}
                    alt={creative.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Image className="w-12 h-12 text-slate-300" />
                  </div>
                )}
                
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <Button 
                    className="btn-brand"
                    onClick={() => navigate(`/admin/creatives/${creative.id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View
                  </Button>
                </div>
                
                {/* Variant count */}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {creative.variants?.length || 0} variants
                </div>
              </div>
              
              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{creative.name}</h3>
                    {creative.description && (
                      <p className="text-sm text-slate-500 mt-1 line-clamp-2">{creative.description}</p>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="flex-shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/creatives/${creative.id}`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-red-600"
                        onClick={() => handleDelete(creative.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                {/* Tags */}
                {creative.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {creative.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Creative Campaign</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Campaign Name *</Label>
              <Input
                placeholder="e.g. Diwali Sale 2024"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the campaign..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1"
                rows={3}
              />
            </div>
            
            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="e.g. diwali, sale, festival"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Language</Label>
                <Input
                  placeholder="e.g. en, hi"
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Input
                  placeholder="e.g. seasonal, product"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button className="btn-brand" onClick={handleCreate}>
                Create & Add Variants
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
