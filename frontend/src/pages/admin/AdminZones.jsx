import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, MapPin, Edit, Trash2, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { zoneAPI, brandAPI } from '../../lib/api';

export default function AdminZones() {
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    states: '',
    districts: '',
    pincodes: '',
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
        const zonesRes = await zoneAPI.list({ brand_id: brandId });
        setZones(zonesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load zones');
    } finally {
      setLoading(false);
    }
  };
  
  const handleOpenDialog = (zone = null) => {
    if (zone) {
      setEditingZone(zone);
      setFormData({
        name: zone.name,
        states: zone.states?.join(', ') || '',
        districts: zone.districts?.join(', ') || '',
        pincodes: zone.pincodes?.join(', ') || '',
      });
    } else {
      setEditingZone(null);
      setFormData({ name: '', states: '', districts: '', pincodes: '' });
    }
    setShowDialog(true);
  };
  
  const handleSubmit = async () => {
    if (!formData.name) {
      toast.error('Zone name is required');
      return;
    }
    
    const data = {
      name: formData.name,
      brand_id: currentBrand?.id,
      states: formData.states.split(',').map(s => s.trim()).filter(Boolean),
      districts: formData.districts.split(',').map(s => s.trim()).filter(Boolean),
      pincodes: formData.pincodes.split(',').map(s => s.trim()).filter(Boolean),
    };
    
    try {
      if (editingZone) {
        await zoneAPI.update(editingZone.id, data);
        toast.success('Zone updated');
      } else {
        await zoneAPI.create(data);
        toast.success('Zone created');
      }
      setShowDialog(false);
      loadData();
    } catch (error) {
      toast.error('Failed to save zone');
    }
  };
  
  const handleDelete = async (zoneId) => {
    if (!window.confirm('Delete this zone?')) return;
    
    try {
      await zoneAPI.delete(zoneId);
      setZones(zones.filter(z => z.id !== zoneId));
      toast.success('Zone deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };
  
  const filteredZones = zones.filter(z => 
    z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    z.states?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  
  return (
    <AdminLayout 
      title="Zones"
      actions={
        <Button className="btn-brand" onClick={() => handleOpenDialog()} data-testid="create-zone-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Zone
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search zones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Zones Grid */}
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
      ) : filteredZones.length === 0 ? (
        <div className="card-brand p-12 text-center">
          <MapPin className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No zones yet</h3>
          <p className="text-slate-500 mb-4">Create zones to organize your dealers by region</p>
          <Button className="btn-brand" onClick={() => handleOpenDialog()}>
            <Plus className="w-4 h-4 mr-2" />
            Create First Zone
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredZones.map(zone => (
            <div key={zone.id} className="card-brand p-6" data-testid={`zone-${zone.id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#4F46E5]/10 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-[#4F46E5]" />
                  </div>
                  <h3 className="font-bold text-slate-900">{zone.name}</h3>
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => handleOpenDialog(zone)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(zone.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 text-sm">
                {zone.states?.length > 0 && (
                  <div>
                    <span className="text-slate-500">States:</span>
                    <span className="text-slate-700 ml-2">{zone.states.join(', ')}</span>
                  </div>
                )}
                {zone.districts?.length > 0 && (
                  <div>
                    <span className="text-slate-500">Districts:</span>
                    <span className="text-slate-700 ml-2">{zone.districts.slice(0, 3).join(', ')}{zone.districts.length > 3 ? '...' : ''}</span>
                  </div>
                )}
                {zone.pincodes?.length > 0 && (
                  <div>
                    <span className="text-slate-500">Pincodes:</span>
                    <span className="text-slate-700 ml-2">{zone.pincodes.length} covered</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingZone ? 'Edit Zone' : 'Create Zone'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Zone Name *</Label>
              <Input
                placeholder="e.g. North Zone"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>States (comma separated)</Label>
              <Input
                placeholder="e.g. Delhi, Punjab, Haryana"
                value={formData.states}
                onChange={(e) => setFormData({ ...formData, states: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Districts (comma separated)</Label>
              <Input
                placeholder="e.g. Central Delhi, South Delhi"
                value={formData.districts}
                onChange={(e) => setFormData({ ...formData, districts: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Pincodes (comma separated)</Label>
              <Input
                placeholder="e.g. 110001, 110002"
                value={formData.pincodes}
                onChange={(e) => setFormData({ ...formData, pincodes: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button className="btn-brand" onClick={handleSubmit}>
                {editingZone ? 'Update' : 'Create'} Zone
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
