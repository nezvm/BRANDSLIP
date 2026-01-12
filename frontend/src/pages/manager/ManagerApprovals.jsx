import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, Users, Image, CheckCircle, XCircle, Clock,
  MapPin, Phone, Eye
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuthStore } from '../../lib/store';
import { dealerAPI, dealerSlipAPI, zoneAPI, brandAPI } from '../../lib/api';

export default function ManagerApprovals() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  
  const [dealers, setDealers] = useState([]);
  const [pendingDealers, setPendingDealers] = useState([]);
  const [pendingSlips, setPendingSlips] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDealerDetail, setShowDealerDetail] = useState(false);
  const [brands, setBrands] = useState([]);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    setLoading(true);
    try {
      const [dealersRes, slipsRes, zonesRes, brandsRes] = await Promise.all([
        dealerAPI.list(),
        dealerSlipAPI.list({ status: 'pending' }),
        zoneAPI.list(),
        brandAPI.list()
      ]);
      
      setDealers(dealersRes.data);
      setPendingDealers(dealersRes.data.filter(d => 
        d.brand_links?.some(bl => bl.status === 'pending')
      ));
      setPendingSlips(slipsRes.data);
      setZones(zonesRes.data);
      setBrands(brandsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };
  
  const handleApproveDealer = async (dealer, approve = true, zoneId = null) => {
    const brandLink = dealer.brand_links?.find(bl => bl.status === 'pending');
    if (!brandLink) return;
    
    try {
      await dealerAPI.approve(dealer.id, brandLink.brand_id, zoneId, approve);
      toast.success(approve ? 'Dealer approved!' : 'Dealer rejected');
      loadData();
      setShowDealerDetail(false);
    } catch (error) {
      toast.error('Failed to update dealer');
    }
  };
  
  const handleApproveSlip = async (slipId, approve = true) => {
    try {
      await dealerSlipAPI.approve(slipId, approve);
      toast.success(approve ? 'Slip approved!' : 'Slip rejected');
      loadData();
    } catch (error) {
      toast.error('Failed to update slip');
    }
  };
  
  return (
    <div className="min-h-screen bg-slate-50" data-testid="manager-approvals">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/manager')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold text-slate-900">Approvals</h1>
        </div>
      </header>
      
      <main className="max-w-6xl mx-auto p-6">
        <Tabs defaultValue="dealers" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="dealers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Dealers
              {pendingDealers.length > 0 && (
                <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingDealers.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="slips" className="flex items-center gap-2">
              <Image className="w-4 h-4" />
              Slips
              {pendingSlips.length > 0 && (
                <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {pendingSlips.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="all-dealers" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              All Dealers
            </TabsTrigger>
          </TabsList>
          
          {/* Pending Dealers */}
          <TabsContent value="dealers">
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card-brand p-6 animate-pulse">
                    <div className="h-16 bg-slate-200 rounded" />
                  </div>
                ))}
              </div>
            ) : pendingDealers.length === 0 ? (
              <div className="card-brand p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">All caught up!</h3>
                <p className="text-slate-500">No pending dealer approvals</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingDealers.map(dealer => (
                  <div key={dealer.id} className="card-brand p-6" data-testid={`pending-dealer-${dealer.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                          <span className="font-bold text-yellow-700">{dealer.name?.[0]}</span>
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{dealer.name}</h3>
                          <p className="text-sm text-slate-500">{dealer.owner_name}</p>
                          <p className="text-sm text-slate-400 flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {dealer.district}, {dealer.state}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { setSelectedDealer(dealer); setShowDealerDetail(true); }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleApproveDealer(dealer, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleApproveDealer(dealer, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Pending Slips */}
          <TabsContent value="slips">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="card-brand p-4 animate-pulse">
                    <div className="aspect-video bg-slate-200 rounded mb-4" />
                    <div className="h-5 bg-slate-200 rounded w-1/2" />
                  </div>
                ))}
              </div>
            ) : pendingSlips.length === 0 ? (
              <div className="card-brand p-12 text-center">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">All caught up!</h3>
                <p className="text-slate-500">No pending slip approvals</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingSlips.map(slip => (
                  <div key={slip.id} className="card-brand overflow-hidden" data-testid={`pending-slip-${slip.id}`}>
                    <div className="aspect-video bg-slate-100">
                      <img
                        src={slip.file_url.startsWith('/api')
                          ? `${process.env.REACT_APP_BACKEND_URL}${slip.file_url}`
                          : slip.file_url}
                        alt={slip.name}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-slate-900 mb-1">{slip.name}</h3>
                      <p className="text-sm text-slate-500 mb-4">Custom dealer slip</p>
                      
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleApproveSlip(slip.id, true)}
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 text-red-500"
                          onClick={() => handleApproveSlip(slip.id, false)}
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* All Dealers */}
          <TabsContent value="all-dealers">
            <div className="card-brand overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Dealer</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Location</th>
                    <th className="text-left px-6 py-4 text-sm font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dealers.map(dealer => {
                    const brandLink = dealer.brand_links?.[0];
                    return (
                      <tr key={dealer.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#4F46E5]/10 flex items-center justify-center">
                              <span className="font-bold text-[#4F46E5]">{dealer.name?.[0]}</span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-900">{dealer.name}</p>
                              <p className="text-sm text-slate-500">{dealer.phone}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          {dealer.district}, {dealer.state}
                        </td>
                        <td className="px-6 py-4">
                          {brandLink?.status === 'approved' && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                              Approved
                            </span>
                          )}
                          {brandLink?.status === 'pending' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                              Pending
                            </span>
                          )}
                          {brandLink?.status === 'rejected' && (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                              Rejected
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
      </main>
      
      {/* Dealer Detail Dialog */}
      <Dialog open={showDealerDetail} onOpenChange={setShowDealerDetail}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Dealer</DialogTitle>
          </DialogHeader>
          
          {selectedDealer && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="text-2xl font-bold text-yellow-700">{selectedDealer.name?.[0]}</span>
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
                  <p className="text-sm text-slate-500">District</p>
                  <p className="font-medium text-slate-900">{selectedDealer.district}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">State</p>
                  <p className="font-medium text-slate-900">{selectedDealer.state}</p>
                </div>
              </div>
              
              {/* Assign Zone */}
              <div className="pt-4 border-t">
                <p className="text-sm font-medium text-slate-700 mb-2">Assign to Zone & Approve</p>
                <Select onValueChange={(zoneId) => handleApproveDealer(selectedDealer, true, zoneId)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select zone and approve" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map(zone => (
                      <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={() => handleApproveDealer(selectedDealer, true)}
                >
                  Approve Without Zone
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-red-500"
                  onClick={() => handleApproveDealer(selectedDealer, false)}
                >
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
