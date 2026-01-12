import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  Search, Filter, CheckCircle, Clock, XCircle, MapPin, Phone, 
  MoreVertical, UserCheck, UserX, Eye
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useBrandStore } from '../../lib/store';
import { dealerAPI, brandAPI, zoneAPI } from '../../lib/api';

export default function AdminDealers() {
  const { currentBrand, setBrands, setCurrentBrand } = useBrandStore();
  const [dealers, setDealers] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  
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
        const [dealersRes, zonesRes] = await Promise.all([
          dealerAPI.list({ brand_id: brandId }),
          zoneAPI.list({ brand_id: brandId })
        ]);
        setDealers(dealersRes.data);
        setZones(zonesRes.data);
      }
    } catch (error) {
      toast.error('Failed to load dealers');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApprove = async (dealer, approve = true, zoneId = null) => {
    try {
      await dealerAPI.approve(dealer.id, currentBrand?.id, zoneId, approve);
      toast.success(approve ? 'Dealer approved' : 'Dealer rejected');
      loadData();
    } catch (error) {
      toast.error('Failed to update dealer status');
    }
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };
  
  const filteredDealers = dealers.filter(dealer => {
    const matchesSearch = dealer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         dealer.phone.includes(searchQuery);
    const brandLink = dealer.brand_links?.find(bl => bl.brand_id === currentBrand?.id);
    const matchesStatus = statusFilter === 'all' || brandLink?.status === statusFilter;
    return matchesSearch && matchesStatus;
  });
  
  return (
    <AdminLayout title="Dealers" data-testid="admin-dealers">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Dealers Table */}
      <div className="card-brand overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Dealer</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Contact</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Location</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Zone</th>
                <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Status</th>
                <th className="text-right px-6 py-4 text-sm font-medium text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i}>
                    <td colSpan={6} className="px-6 py-4">
                      <div className="h-10 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : filteredDealers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    No dealers found
                  </td>
                </tr>
              ) : (
                filteredDealers.map(dealer => {
                  const brandLink = dealer.brand_links?.find(bl => bl.brand_id === currentBrand?.id);
                  const zone = zones.find(z => z.id === brandLink?.zone_id);
                  
                  return (
                    <tr key={dealer.id} className="hover:bg-slate-50" data-testid={`dealer-row-${dealer.id}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                            <span className="font-bold text-[#4F46E5]">{dealer.name?.[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{dealer.name}</p>
                            <p className="text-sm text-slate-500">{dealer.owner_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <Phone className="w-3 h-3" />
                          {dealer.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1 text-sm text-slate-600">
                          <MapPin className="w-3 h-3" />
                          {dealer.district}, {dealer.state}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {zone ? (
                          <span className="text-sm text-slate-600">{zone.name}</span>
                        ) : (
                          <span className="text-sm text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(brandLink?.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedDealer(dealer); setShowDetail(true); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            {brandLink?.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleApprove(dealer, true)}>
                                  <UserCheck className="w-4 h-4 mr-2 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleApprove(dealer, false)}>
                                  <UserX className="w-4 h-4 mr-2 text-red-600" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Dealer Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dealer Details</DialogTitle>
          </DialogHeader>
          
          {selectedDealer && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-[#4F46E5]">{selectedDealer.name?.[0]}</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedDealer.name}</h3>
                  <p className="text-slate-500">{selectedDealer.owner_name}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm text-slate-500">Phone</p>
                  <p className="font-medium text-slate-900">{selectedDealer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">WhatsApp</p>
                  <p className="font-medium text-slate-900">{selectedDealer.whatsapp || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm text-slate-500">Address</p>
                  <p className="font-medium text-slate-900">{selectedDealer.address}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Pincode</p>
                  <p className="font-medium text-slate-900">{selectedDealer.pincode}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">District</p>
                  <p className="font-medium text-slate-900">{selectedDealer.district}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">State</p>
                  <p className="font-medium text-slate-900">{selectedDealer.state}</p>
                </div>
              </div>
              
              {/* Assign Zone */}
              {selectedDealer.brand_links?.find(bl => bl.brand_id === currentBrand?.id)?.status === 'pending' && (
                <div className="pt-4 border-t">
                  <p className="text-sm font-medium text-slate-700 mb-2">Assign to Zone & Approve</p>
                  <div className="flex gap-2">
                    <Select onValueChange={(zoneId) => handleApprove(selectedDealer, true, zoneId)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select zone" />
                      </SelectTrigger>
                      <SelectContent>
                        {zones.map(zone => (
                          <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline" 
                      className="text-green-600"
                      onClick={() => handleApprove(selectedDealer, true)}
                    >
                      Approve
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
