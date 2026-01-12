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

## What's Been Implemented (Dec 2025)

### Backend (FastAPI + MongoDB)
- ✅ Phone OTP authentication with JWT (access + refresh tokens)
- ✅ User management with roles (platform_admin, brand_super_admin, zonal_manager, dealer_owner)
- ✅ Brand workspace CRUD with settings
- ✅ Zone management (states, districts, pincodes)
- ✅ Dealer management with approval workflow
- ✅ Creative campaign CRUD with metadata (tags, language, category, targeting)
- ✅ Creative variant upload (multiple sizes per creative)
- ✅ Slip template management (position, style, allowed fields)
- ✅ Dealer slip upload with approval workflow
- ✅ Personalization/Render engine using Pillow
- ✅ QR code generation (WhatsApp, Maps, Custom URL)
- ✅ Share link generation with click tracking
- ✅ Analytics endpoints (brand, zone, dealer level)
- ✅ Event logging (views, renders, downloads, shares)
- ✅ Seed data API for development

### Frontend (React + Tailwind)
- ✅ Phone login with OTP verification
- ✅ Dealer onboarding wizard
- ✅ Admin dashboard with stats and quick actions
- ✅ Admin zones CRUD
- ✅ Admin dealers management with approval
- ✅ Admin creatives list and detail with variant upload
- ✅ Admin slip templates CRUD
- ✅ Admin users management
- ✅ Admin analytics dashboard
- ✅ Manager dashboard and approvals
- ✅ Dealer home with creative library (Bumble-style mobile UI)
- ✅ Dealer creative personalization flow (4 steps: size, slip, QR, preview)
- ✅ Dealer profile management
- ✅ Dealer slips upload page
- ✅ Dealer activity/analytics

## Prioritized Backlog

### P0 (Critical for Launch)
- [ ] WhatsApp share integration testing with real devices
- [ ] Production S3 storage configuration
- [ ] Rate limiting on render endpoint

### P1 (Important Features)
- [ ] PDF export for rendered creatives
- [ ] Bulk dealer import via CSV
- [ ] Campaign validity date filtering
- [ ] Dealer targeting (specific dealers/zones)
- [ ] Email notifications for approvals

### P2 (Nice to Have)
- [ ] Video file storage (no rendering)
- [ ] WhatsApp Cloud API integration for campaign sends
- [ ] Multi-brand dealer switching
- [ ] Dealer staff role implementation
- [ ] Advanced analytics with charts

## Next Tasks
1. Test WhatsApp share on mobile devices
2. Configure production S3 credentials
3. Add email notifications for dealer approvals
4. Implement PDF export option
5. Add campaign validity date filtering

## Technical Stack
- Backend: FastAPI (Python)
- Frontend: React + Tailwind CSS
- Database: MongoDB
- Auth: JWT (access + refresh tokens)
- File Storage: Local (dev) / S3-compatible (prod)
- Image Processing: Pillow + qrcode
