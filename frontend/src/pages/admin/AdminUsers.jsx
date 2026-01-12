import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Plus, Search, UserPlus, MoreVertical, Edit, Trash2, Shield } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { userAPI, brandAPI, zoneAPI } from '../../lib/api';

const ROLES = [
  { value: 'brand_super_admin', label: 'Brand Admin' },
  { value: 'zonal_manager', label: 'Zonal Manager' },
];

export default function AdminUsers() {
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [users, setUsers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    role: 'zonal_manager',
    zone_ids: [],
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
        const [usersRes, zonesRes] = await Promise.all([
          userAPI.list({ brand_id: brandId }),
          zoneAPI.list({ brand_id: brandId })
        ]);
        // Filter out dealers
        setUsers(usersRes.data.filter(u => !['dealer_owner', 'dealer_staff'].includes(u.role)));
        setZones(zonesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreate = async () => {
    if (!formData.name || !formData.phone) {
      toast.error('Name and phone are required');
      return;
    }
    
    try {
      await userAPI.create({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        role: formData.role,
        brand_ids: [currentBrand?.id],
        zone_ids: formData.zone_ids,
      });
      
      toast.success('User created! They can login with OTP.');
      setShowCreate(false);
      setFormData({ name: '', phone: '', email: '', role: 'zonal_manager', zone_ids: [] });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create user');
    }
  };
  
  const getRoleBadge = (role) => {
    switch (role) {
      case 'platform_admin':
        return <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Platform Admin</span>;
      case 'brand_super_admin':
        return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Brand Admin</span>;
      case 'zonal_manager':
        return <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Zonal Manager</span>;
      default:
        return <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full">{role}</span>;
    }
  };
  
  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone?.includes(searchQuery)
  );
  
  return (
    <AdminLayout 
      title="Users"
      actions={
        <Button className="btn-brand" onClick={() => setShowCreate(true)} data-testid="add-user-btn">
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      }
    >
      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      
      {/* Users Table */}
      <div className="card-brand overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">User</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Phone</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Role</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Zones</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Status</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50" data-testid={`user-row-${user.id}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                          <span className="font-bold text-[#4F46E5]">{user.name?.[0] || '?'}</span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{user.name || 'Unnamed'}</p>
                          <p className="text-sm text-slate-500">{user.email || '-'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{user.phone}</td>
                    <td className="px-6 py-4">{getRoleBadge(user.role)}</td>
                    <td className="px-6 py-4">
                      {user.zone_ids?.length > 0 ? (
                        <span className="text-slate-600">
                          {user.zone_ids.map(zid => zones.find(z => z.id === zid)?.name).filter(Boolean).join(', ') || '-'}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Full Name *</Label>
              <Input
                placeholder="Enter name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Phone Number *</Label>
              <Input
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Email (optional)</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {formData.role === 'zonal_manager' && zones.length > 0 && (
              <div>
                <Label>Assign Zones</Label>
                <Select 
                  value={formData.zone_ids[0] || ''} 
                  onValueChange={(v) => setFormData({ ...formData, zone_ids: [v] })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button className="btn-brand" onClick={handleCreate}>
                Add User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
