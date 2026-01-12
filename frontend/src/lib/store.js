import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Auth Store
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },
      
      updateUser: (userData) => {
        set((state) => ({ user: { ...state.user, ...userData } }));
      },
      
      logout: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      
      isAdmin: () => {
        const { user } = get();
        return user?.role === 'platform_admin' || user?.role === 'brand_super_admin';
      },
      
      isManager: () => {
        const { user } = get();
        return user?.role === 'zonal_manager';
      },
      
      isDealer: () => {
        const { user } = get();
        return user?.role === 'dealer_owner' || user?.role === 'dealer_staff';
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// Brand Store
export const useBrandStore = create((set) => ({
  currentBrand: null,
  brands: [],
  
  setBrands: (brands) => set({ brands }),
  setCurrentBrand: (brand) => set({ currentBrand: brand }),
}));

// UI Store
export const useUIStore = create((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleMobileMenu: () => set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
}));
