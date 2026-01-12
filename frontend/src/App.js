import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "./lib/store";

// Auth Pages
import LoginPage from "./pages/auth/LoginPage";
import OTPVerifyPage from "./pages/auth/OTPVerifyPage";
import OnboardingPage from "./pages/auth/OnboardingPage";

// Dealer Pages
import DealerHome from "./pages/dealer/DealerHome";
import DealerCreativeDetail from "./pages/dealer/DealerCreativeDetail";
import DealerProfile from "./pages/dealer/DealerProfile";
import DealerSlips from "./pages/dealer/DealerSlips";
import DealerActivity from "./pages/dealer/DealerActivity";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminZones from "./pages/admin/AdminZones";
import AdminDealers from "./pages/admin/AdminDealers";
import AdminCreatives from "./pages/admin/AdminCreatives";
import AdminCreativeDetail from "./pages/admin/AdminCreativeDetail";
import AdminSlipTemplates from "./pages/admin/AdminSlipTemplates";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminAnalytics from "./pages/admin/AdminAnalytics";

// Manager Pages
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import ManagerApprovals from "./pages/manager/ManagerApprovals";

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    // Redirect based on role
    if (user?.role === 'dealer_owner' || user?.role === 'dealer_staff') {
      return <Navigate to="/dealer" replace />;
    }
    if (user?.role === 'zonal_manager') {
      return <Navigate to="/manager" replace />;
    }
    return <Navigate to="/admin" replace />;
  }
  
  return children;
};

// Role-based redirect
const RoleRedirect = () => {
  const { user, isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (user?.status === 'pending_profile') {
    return <Navigate to="/onboarding" replace />;
  }
  
  if (user?.role === 'dealer_owner' || user?.role === 'dealer_staff') {
    return <Navigate to="/dealer" replace />;
  }
  
  if (user?.role === 'zonal_manager') {
    return <Navigate to="/manager" replace />;
  }
  
  return <Navigate to="/admin" replace />;
};

function App() {
  return (
    <>
      <Toaster 
        position="top-center" 
        richColors 
        toastOptions={{
          style: {
            fontFamily: 'DM Sans, sans-serif',
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-otp" element={<OTPVerifyPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          
          {/* Role Redirect */}
          <Route path="/" element={<RoleRedirect />} />
          
          {/* Dealer Routes */}
          <Route path="/dealer" element={
            <ProtectedRoute allowedRoles={['dealer_owner', 'dealer_staff']}>
              <DealerHome />
            </ProtectedRoute>
          } />
          <Route path="/dealer/creative/:id" element={
            <ProtectedRoute allowedRoles={['dealer_owner', 'dealer_staff']}>
              <DealerCreativeDetail />
            </ProtectedRoute>
          } />
          <Route path="/dealer/profile" element={
            <ProtectedRoute allowedRoles={['dealer_owner', 'dealer_staff']}>
              <DealerProfile />
            </ProtectedRoute>
          } />
          <Route path="/dealer/slips" element={
            <ProtectedRoute allowedRoles={['dealer_owner', 'dealer_staff']}>
              <DealerSlips />
            </ProtectedRoute>
          } />
          <Route path="/dealer/activity" element={
            <ProtectedRoute allowedRoles={['dealer_owner', 'dealer_staff']}>
              <DealerActivity />
            </ProtectedRoute>
          } />
          
          {/* Admin Routes */}
          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/zones" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminZones />
            </ProtectedRoute>
          } />
          <Route path="/admin/dealers" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminDealers />
            </ProtectedRoute>
          } />
          <Route path="/admin/creatives" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminCreatives />
            </ProtectedRoute>
          } />
          <Route path="/admin/creatives/:id" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminCreativeDetail />
            </ProtectedRoute>
          } />
          <Route path="/admin/slip-templates" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminSlipTemplates />
            </ProtectedRoute>
          } />
          <Route path="/admin/users" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminUsers />
            </ProtectedRoute>
          } />
          <Route path="/admin/analytics" element={
            <ProtectedRoute allowedRoles={['platform_admin', 'brand_super_admin']}>
              <AdminAnalytics />
            </ProtectedRoute>
          } />
          
          {/* Manager Routes */}
          <Route path="/manager" element={
            <ProtectedRoute allowedRoles={['zonal_manager']}>
              <ManagerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/manager/approvals" element={
            <ProtectedRoute allowedRoles={['zonal_manager']}>
              <ManagerApprovals />
            </ProtectedRoute>
          } />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
