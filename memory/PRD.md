# BrandSlip - Brand-to-Dealer Creative Distribution Platform

## Original Problem Statement
Build a multi-tenant B2B web app (responsive desktop + mobile) where BRANDS upload campaign creatives (posters/images/videos) in multiple sizes, and DEALERS/SHOPS download auto-personalized versions with a dealer "slip/label" (logo + contact + QR) added to the poster.

## User Personas
1. **Brand Super Admin** - Manages brand workspace, zones, dealers, creatives, slip templates
2. **Zonal Manager** - Approves dealers and slips in assigned zones
3. **Dealer Owner** - Downloads personalized creatives, uploads custom slips
4. **Dealer Staff** - Download/share only access (future)

## Core Requirements (Static)
- Phone OTP authentication with JWT tokens
- Multi-tenant brand workspace model
- Role-based access control (RBAC)
- Creative campaign management with multiple size variants
- Slip template builder with position/style options
- Personalization engine with QR code generation (WhatsApp, Maps, Custom URL)
- Dealer self-onboarding and approval workflow
- Analytics and event tracking
- S3-compatible file storage

---

## V2 Upgrade (Dec 2025)

### What's Been Implemented

#### Backend (FastAPI + MongoDB)
- ✅ Phone OTP authentication with JWT (access + refresh tokens)
- ✅ User management with roles (platform_admin, brand_super_admin, zonal_manager, dealer_owner)
- ✅ Brand workspace CRUD with settings
- ✅ Zone management (states, districts, pincodes)
- ✅ Dealer management with approval workflow
- ✅ Creative campaign CRUD with metadata (tags, highlight_tags, language, category, targeting)
- ✅ Creative variant upload (multiple sizes per creative)
- ✅ **V2: Feed API** (`/api/creatives/feed`) - Returns structured data with featured, seasonal, new, trending, all, brands, highlight_tags
- ✅ **V2: Categories API** (`/api/categories`) - Returns 14 business categories (FMCG, Electronics, etc.)
- ✅ **V2: Creative Tags API** (`/api/creative-tags`) - Returns 8 highlight tags (Featured, Seasonal, etc.)
- ✅ Slip template management (position, style, allowed fields)
- ✅ **V2: Slip Design API** (`/api/slip-designs`) - For Fabric.js JSON designs
- ✅ **V2: Default Slip per Brand** (`/api/dealers/{id}/default-slip`) - Set default slip per brand
- ✅ Dealer slip upload with approval workflow
- ✅ **V2: Dealer Requests API** (`/api/dealer-requests`) - Dealer brand join requests
- ✅ **V2: Campaign API** (`/api/campaigns`) - WhatsApp campaign management (MOCKED)
- ✅ **V2: Featured Payment API** (`/api/featured`) - Stripe integration stubs
- ✅ Personalization/Render engine using Pillow
- ✅ QR code generation (WhatsApp, Maps, Custom URL)
- ✅ Share link generation with click tracking
- ✅ Analytics endpoints (brand, zone, dealer level)
- ✅ Event logging (views, renders, downloads, shares)
- ✅ Seed data API for development

#### Frontend (React + Tailwind + Shadcn UI)
- ✅ Phone login with OTP verification
- ✅ **V2: Dealer Onboarding** - 3-step wizard with category selection
- ✅ Admin dashboard with stats and quick actions
- ✅ Admin zones CRUD
- ✅ Admin dealers management with approval
- ✅ Admin creatives list and detail with variant upload
- ✅ Admin slip templates CRUD
- ✅ Admin users management
- ✅ Admin analytics dashboard
- ✅ Manager dashboard and approvals
- ✅ **V2: Dealer Home Feed** - Modern UI with:
  - Search bar
  - Swipeable highlight tag pills (Featured, Seasonal, Product Ads, etc.)
  - "My Brands" filter chips
  - Creative cards grid with hover effects
  - Skeleton loading states
- ✅ **V2: Dealer Slips Page** - Enhanced UI with:
  - Grid/List view toggle
  - Brand filter dropdown
  - "Set as Default" per brand functionality
  - Upload dialog with brand selection
- ✅ Dealer creative personalization flow (4 steps: size, slip, QR, preview)
- ✅ Dealer profile management
- ✅ Dealer activity/analytics
- ✅ Bottom navigation for dealer portal

---

## Prioritized Backlog

### P0 (Critical for Launch)
- [ ] WhatsApp Cloud API integration (currently MOCKED - requires user credentials)
- [ ] Production S3 storage configuration
- [ ] Rate limiting on render endpoint

### P1 (Important Features)
- [ ] **Advanced Slip Designer** - Fabric.js canvas implementation (backend ready)
- [ ] Featured creatives carousel on Dealer Home
- [ ] PDF export for rendered creatives
- [ ] Bulk dealer import via CSV
- [ ] Campaign validity date filtering
- [ ] Dealer targeting (specific dealers/zones)
- [ ] Email notifications for approvals

### P2 (Nice to Have)
- [ ] Platform-level and Brand-level theming
- [ ] Stripe payment flow for featured placements
- [ ] Video file storage (no rendering)
- [ ] Multi-brand dealer switching
- [ ] Dealer staff role implementation
- [ ] Advanced analytics with charts

---

## Technical Stack
- **Backend:** FastAPI (Python)
- **Frontend:** React + Tailwind CSS + Shadcn UI
- **Database:** MongoDB
- **Auth:** JWT (access + refresh tokens)
- **File Storage:** Local (dev) / S3-compatible (prod)
- **Image Processing:** Pillow + qrcode
- **Planned Integrations:**
  - Stripe (payment stubs ready)
  - WhatsApp Cloud API (MOCKED)
  - Fabric.js (slip designer - backend ready)

---

## Test Credentials
- **Admin Phone:** `+919876543210`
- **Dealer Phone (Kumar Electronics):** `+919876543212`
- **Dealer Phone (Tech World):** `+919876543213`
- **Zonal Manager Phone:** `+919876543211`
- **Login Process:** Enter phone → OTP shown in blue toast → Enter OTP

---

## API Endpoints Summary

### Auth
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP, get tokens
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### V2 APIs
- `GET /api/categories` - List business categories
- `GET /api/creative-tags` - List highlight tags
- `GET /api/creatives/feed` - Dealer home feed data
- `GET /api/slip-designs` - List Fabric.js designs
- `POST /api/slip-designs` - Save slip design
- `PUT /api/dealers/{id}/default-slip` - Set default slip per brand
- `GET /api/dealer-requests` - List brand join requests
- `POST /api/campaigns` - Create WhatsApp campaign
- `POST /api/campaigns/{id}/send` - Send campaign (MOCKED)

### Core APIs
- CRUD for `/api/brands`, `/api/zones`, `/api/dealers`, `/api/creatives`
- `/api/creative-variants` - Upload size variants
- `/api/slip-templates` - Manage brand slip templates
- `/api/dealer-slips` - Dealer uploaded slips
- `/api/render` - Generate personalized creative
- `/api/analytics/*` - Analytics endpoints

---

## Last Updated
**Date:** January 13, 2026
**Status:** V2 Frontend Upgrade Complete - All 16 backend tests passed, frontend V2 features working
