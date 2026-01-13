from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form, Query, Request
from fastapi.responses import FileResponse, StreamingResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import hashlib
import random
import string
from jose import jwt, JWTError
import bcrypt
from PIL import Image
import qrcode
from io import BytesIO
import boto3
from botocore.exceptions import ClientError
import aiofiles
import json
import secrets
import httpx
import asyncio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 60 * 24
REFRESH_TOKEN_EXPIRE = 60 * 24 * 30

# S3 Configuration
S3_BUCKET = os.environ.get('S3_BUCKET', 'brandslip-assets')
S3_ENDPOINT = os.environ.get('S3_ENDPOINT', None)
S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY', None)
S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY', None)
USE_S3 = S3_ACCESS_KEY is not None

# Stripe Configuration
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', 'sk_test_emergent')

# WhatsApp Cloud API Configuration
WHATSAPP_PHONE_ID = os.environ.get('WHATSAPP_PHONE_ID', '')
WHATSAPP_ACCESS_TOKEN = os.environ.get('WHATSAPP_ACCESS_TOKEN', '')

# Local storage
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
for folder in ['creatives', 'slips', 'logos', 'rendered', 'slip_designs']:
    (UPLOAD_DIR / folder).mkdir(exist_ok=True)

app = FastAPI(title="BrandSlip API V2")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ==================== CONSTANTS ====================

CATEGORIES = [
    {"id": "fmcg", "name": "FMCG", "icon": "🛒"},
    {"id": "electronics", "name": "Electronics", "icon": "📱"},
    {"id": "appliances", "name": "Appliances", "icon": "🔌"},
    {"id": "steel", "name": "Steel & Metals", "icon": "🔩"},
    {"id": "paint", "name": "Paint & Coatings", "icon": "🎨"},
    {"id": "pharma", "name": "Pharma & Healthcare", "icon": "💊"},
    {"id": "automotive", "name": "Automotive", "icon": "🚗"},
    {"id": "fashion", "name": "Fashion & Apparel", "icon": "👕"},
    {"id": "jewelry", "name": "Jewelry", "icon": "💎"},
    {"id": "home_decor", "name": "Home Decor", "icon": "🏠"},
    {"id": "food_beverage", "name": "Food & Beverage", "icon": "🍽️"},
    {"id": "agriculture", "name": "Agriculture", "icon": "🌾"},
    {"id": "construction", "name": "Construction", "icon": "🏗️"},
    {"id": "chemicals", "name": "Chemicals", "icon": "🧪"},
]

CREATIVE_TAGS = [
    {"id": "featured", "name": "Featured", "icon": "⭐"},
    {"id": "seasonal", "name": "Seasonal", "icon": "🎉"},
    {"id": "product_ads", "name": "Product Ads", "icon": "🛍️"},
    {"id": "brand_awareness", "name": "Brand Awareness", "icon": "📣"},
    {"id": "trending", "name": "Trending", "icon": "🔥"},
    {"id": "new", "name": "New", "icon": "🆕"},
    {"id": "offers", "name": "Offers", "icon": "🏷️"},
    {"id": "local", "name": "Local", "icon": "📍"},
]

FEATURED_PACKAGES = {
    "basic": {"name": "Basic Featured", "price": 99.00, "duration_days": 7, "position": "feed"},
    "premium": {"name": "Premium Featured", "price": 299.00, "duration_days": 14, "position": "carousel"},
    "spotlight": {"name": "Spotlight", "price": 499.00, "duration_days": 30, "position": "top"},
}

# ==================== MODELS ====================

class UserRole:
    PLATFORM_ADMIN = "platform_admin"
    BRAND_SUPER_ADMIN = "brand_super_admin"
    ZONAL_MANAGER = "zonal_manager"
    DEALER_OWNER = "dealer_owner"
    DEALER_STAFF = "dealer_staff"

class UserCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    role: str = UserRole.DEALER_OWNER
    brand_ids: List[str] = []
    zone_ids: List[str] = []

class UserResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    email: Optional[str] = None
    role: str
    brand_ids: List[str] = []
    dealer_id: Optional[str] = None
    zone_ids: List[str] = []
    status: str = "active"
    created_at: str
    categories: List[str] = []

class OTPRequest(BaseModel):
    phone: str

class OTPVerify(BaseModel):
    phone: str
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

class BrandCreate(BaseModel):
    name: str
    logo: Optional[str] = None
    default_category: Optional[str] = None

class BrandSettings(BaseModel):
    dealer_auto_approve: bool = False
    slip_approval_required: bool = True
    max_upload_size_mb: int = 10

class BrandResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    logo: Optional[str] = None
    settings: dict
    default_category: Optional[str] = None
    created_at: str

class ZoneCreate(BaseModel):
    name: str
    brand_id: str
    states: List[str] = []
    districts: List[str] = []
    pincodes: List[str] = []

class ZoneResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    name: str
    states: List[str] = []
    districts: List[str] = []
    pincodes: List[str] = []
    created_at: str

class DealerCreate(BaseModel):
    name: str
    owner_name: str
    phone: str
    whatsapp: Optional[str] = None
    address: str
    pincode: str
    district: str
    state: str
    email: Optional[str] = None
    categories: List[str] = []

class DealerResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    owner_name: str
    phone: str
    whatsapp: Optional[str] = None
    address: str
    pincode: str
    district: str
    state: str
    logo_url: Optional[str] = None
    brand_links: List[dict] = []
    categories: List[str] = []
    default_slips: Dict[str, str] = {}
    created_at: str

class CreativeCreate(BaseModel):
    brand_id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    highlight_tags: List[str] = []
    language: str = "en"
    category: str = "general"
    validity_start: Optional[str] = None
    validity_end: Optional[str] = None
    targeting: dict = {"all": True, "zone_ids": [], "dealer_ids": []}
    is_featured: bool = False
    featured_priority: int = 0

class CreativeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    highlight_tags: List[str] = []
    language: str
    category: str
    validity_start: Optional[str] = None
    validity_end: Optional[str] = None
    targeting: dict
    status: str = "active"
    is_featured: bool = False
    featured_priority: int = 0
    featured_until: Optional[str] = None
    created_at: str
    variants: List[dict] = []

class SlipTemplateCreate(BaseModel):
    brand_id: str
    name: str
    position: str = "bottom"
    max_w_pct: int = 100
    max_h_pct: int = 20
    allowed_fields: List[str] = ["shop_name", "phone", "logo", "qr"]
    style_preset: str = "standard"
    bg_style: str = "light"

class SlipTemplateResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    name: str
    position: str
    max_w_pct: int
    max_h_pct: int
    allowed_fields: List[str]
    style_preset: str
    bg_style: str
    is_active: bool = True
    created_at: str

class SlipDesignCreate(BaseModel):
    dealer_id: str
    brand_id: str
    name: str
    design_json: dict
    thumbnail_url: Optional[str] = None

class SlipDesignResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    dealer_id: str
    brand_id: str
    name: str
    design_json: dict
    thumbnail_url: Optional[str] = None
    status: str = "approved"
    is_default: bool = False
    created_at: str

class DealerSlipResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    dealer_id: str
    brand_id: str
    file_url: str
    name: str
    status: str = "pending"
    reviewed_by: Optional[str] = None
    created_at: str

class RenderRequest(BaseModel):
    creative_variant_id: str
    slip_mode: str = "template"
    slip_template_id: Optional[str] = None
    dealer_slip_id: Optional[str] = None
    slip_design_id: Optional[str] = None
    dealer_id: str
    qr_type: Optional[str] = None
    qr_value: Optional[str] = None

class RenderResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    dealer_id: str
    creative_variant_id: str
    slip_mode: str
    output_url: str
    hash_key: str
    created_at: str

class DealerRequestCreate(BaseModel):
    dealer_id: str
    brand_id: str
    message: Optional[str] = None

class CampaignCreate(BaseModel):
    brand_id: str
    name: str
    creative_id: str
    variant_ids: List[str] = []
    message_template: str
    target_type: str = "dealers"
    target_zone_ids: List[str] = []
    target_dealer_ids: List[str] = []
    scheduled_at: Optional[str] = None

class CampaignResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    name: str
    creative_id: str
    variant_ids: List[str]
    message_template: str
    target_type: str
    status: str = "draft"
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    clicked_count: int = 0
    created_at: str

class FeaturedPaymentRequest(BaseModel):
    creative_id: str
    package_id: str
    origin_url: str

# ==================== UTILITIES ====================

def generate_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))

def create_token(data: dict, expires_delta: int) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expires_delta)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(token: str = None) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = token.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_auth_header():
    from fastapi import Header
    async def auth_dependency(authorization: str = Header(None)):
        return await get_current_user(authorization)
    return auth_dependency

async def save_file(file: UploadFile, folder: str) -> str:
    file_id = generate_id()
    ext = Path(file.filename).suffix or '.png'
    filename = f"{file_id}{ext}"
    
    if USE_S3:
        s3_client = boto3.client('s3', endpoint_url=S3_ENDPOINT, aws_access_key_id=S3_ACCESS_KEY, aws_secret_access_key=S3_SECRET_KEY)
        key = f"{folder}/{filename}"
        content = await file.read()
        s3_client.put_object(Bucket=S3_BUCKET, Key=key, Body=content, ContentType=file.content_type)
        if S3_ENDPOINT:
            return f"{S3_ENDPOINT}/{S3_BUCKET}/{key}"
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
    else:
        filepath = UPLOAD_DIR / folder / filename
        async with aiofiles.open(filepath, 'wb') as f:
            content = await file.read()
            await f.write(content)
        return f"/api/files/{folder}/{filename}"

async def save_bytes(content: bytes, folder: str, ext: str = ".png") -> str:
    file_id = generate_id()
    filename = f"{file_id}{ext}"
    
    if USE_S3:
        s3_client = boto3.client('s3', endpoint_url=S3_ENDPOINT, aws_access_key_id=S3_ACCESS_KEY, aws_secret_access_key=S3_SECRET_KEY)
        key = f"{folder}/{filename}"
        s3_client.put_object(Bucket=S3_BUCKET, Key=key, Body=content, ContentType="image/png")
        if S3_ENDPOINT:
            return f"{S3_ENDPOINT}/{S3_BUCKET}/{key}"
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{key}"
    else:
        filepath = UPLOAD_DIR / folder / filename
        async with aiofiles.open(filepath, 'wb') as f:
            await f.write(content)
        return f"/api/files/{folder}/{filename}"

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/send-otp")
async def send_otp(request: OTPRequest, background_tasks: BackgroundTasks):
    otp = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.otps.update_one(
        {"phone": request.phone},
        {"$set": {"otp": otp, "expires": expires.isoformat(), "attempts": 0}},
        upsert=True
    )
    
    logger.info(f"OTP for {request.phone}: {otp}")
    return {"message": "OTP sent successfully", "otp_for_dev": otp}

@api_router.post("/auth/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify):
    otp_doc = await db.otps.find_one({"phone": request.phone}, {"_id": 0})
    
    if not otp_doc:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")
    
    if otp_doc.get("attempts", 0) >= 5:
        raise HTTPException(status_code=400, detail="Too many attempts. Please request a new OTP.")
    
    expires = datetime.fromisoformat(otp_doc["expires"])
    if datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="OTP expired. Please request a new one.")
    
    if otp_doc["otp"] != request.otp:
        await db.otps.update_one({"phone": request.phone}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    await db.otps.delete_one({"phone": request.phone})
    
    user = await db.users.find_one({"phone": request.phone}, {"_id": 0})
    if not user:
        user = {
            "id": generate_id(),
            "name": "",
            "phone": request.phone,
            "email": None,
            "role": UserRole.DEALER_OWNER,
            "brand_ids": [],
            "dealer_id": None,
            "zone_ids": [],
            "status": "pending_profile",
            "categories": [],
            "created_at": now_iso()
        }
        await db.users.insert_one(user)
    
    access_token = create_token({"sub": user["id"], "role": user["role"]}, ACCESS_TOKEN_EXPIRE)
    refresh_token = create_token({"sub": user["id"], "type": "refresh"}, REFRESH_TOKEN_EXPIRE)
    
    user_response = {k: v for k, v in user.items() if k != "_id"}
    
    return TokenResponse(access_token=access_token, refresh_token=refresh_token, user=user_response)

@api_router.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    try:
        payload = jwt.decode(refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        new_access = create_token({"sub": user["id"], "role": user["role"]}, ACCESS_TOKEN_EXPIRE)
        return {"access_token": new_access, "token_type": "bearer"}
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid refresh token")

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_auth_header())):
    return UserResponse(**user)

# ==================== CATEGORIES ENDPOINTS ====================

@api_router.get("/categories")
async def list_categories():
    return CATEGORIES

@api_router.get("/creative-tags")
async def list_creative_tags():
    return CREATIVE_TAGS

# ==================== USER ENDPOINTS ====================

@api_router.put("/users/profile")
async def update_profile(
    name: str = Form(None),
    email: str = Form(None),
    categories: str = Form(None),
    user: dict = Depends(get_auth_header())
):
    updates = {}
    if name:
        updates["name"] = name
    if email:
        updates["email"] = email
    if categories:
        updates["categories"] = [c.strip() for c in categories.split(",") if c.strip()]
    if updates:
        updates["status"] = "active"
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return updated

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(brand_id: str = None, role: str = None, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if brand_id:
        query["brand_ids"] = brand_id
    if role:
        query["role"] = role
    
    users = await db.users.find(query, {"_id": 0}).to_list(1000)
    return [UserResponse(**u) for u in users]

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(get_auth_header())):
    if current_user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = await db.users.find_one({"phone": user_data.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="User with this phone already exists")
    
    user = {
        "id": generate_id(),
        **user_data.model_dump(),
        "dealer_id": None,
        "status": "active",
        "categories": [],
        "created_at": now_iso()
    }
    await db.users.insert_one(user)
    return UserResponse(**user)

# ==================== BRAND ENDPOINTS ====================

@api_router.post("/brands", response_model=BrandResponse)
async def create_brand(brand: BrandCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    brand_doc = {
        "id": generate_id(),
        **brand.model_dump(),
        "settings": {"dealer_auto_approve": False, "slip_approval_required": True, "max_upload_size_mb": 10},
        "whatsapp_config": {},
        "theme": {},
        "created_at": now_iso()
    }
    await db.brands.insert_one(brand_doc)
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"brand_ids": brand_doc["id"]}})
    
    return BrandResponse(**brand_doc)

@api_router.get("/brands", response_model=List[BrandResponse])
async def list_brands(user: dict = Depends(get_auth_header())):
    if user["role"] == UserRole.PLATFORM_ADMIN:
        brands = await db.brands.find({}, {"_id": 0}).to_list(100)
    elif user["role"] in [UserRole.DEALER_OWNER, UserRole.DEALER_STAFF]:
        dealer = await db.dealers.find_one({"id": user.get("dealer_id")}, {"_id": 0})
        if dealer:
            brand_ids = [bl["brand_id"] for bl in dealer.get("brand_links", []) if bl["status"] == "approved"]
            brands = await db.brands.find({"id": {"$in": brand_ids}}, {"_id": 0}).to_list(100)
        else:
            brands = await db.brands.find({}, {"_id": 0}).to_list(100)
    else:
        brands = await db.brands.find({"id": {"$in": user.get("brand_ids", [])}}, {"_id": 0}).to_list(100)
    return [BrandResponse(**b) for b in brands]

@api_router.get("/brands/{brand_id}", response_model=BrandResponse)
async def get_brand(brand_id: str, user: dict = Depends(get_auth_header())):
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return BrandResponse(**brand)

@api_router.put("/brands/{brand_id}/settings")
async def update_brand_settings(brand_id: str, settings: BrandSettings, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.brands.update_one({"id": brand_id}, {"$set": {"settings": settings.model_dump()}})
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    return brand

@api_router.put("/brands/{brand_id}/whatsapp-config")
async def update_whatsapp_config(brand_id: str, config: dict, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.brands.update_one({"id": brand_id}, {"$set": {"whatsapp_config": config}})
    return {"message": "WhatsApp config updated"}

# ==================== ZONE ENDPOINTS ====================

@api_router.post("/zones", response_model=ZoneResponse)
async def create_zone(zone: ZoneCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    zone_doc = {"id": generate_id(), **zone.model_dump(), "created_at": now_iso()}
    await db.zones.insert_one(zone_doc)
    return ZoneResponse(**zone_doc)

@api_router.get("/zones", response_model=List[ZoneResponse])
async def list_zones(brand_id: str = None, user: dict = Depends(get_auth_header())):
    query = {}
    if brand_id:
        query["brand_id"] = brand_id
    if user["role"] == UserRole.ZONAL_MANAGER:
        query["id"] = {"$in": user.get("zone_ids", [])}
    
    zones = await db.zones.find(query, {"_id": 0}).to_list(500)
    return [ZoneResponse(**z) for z in zones]

@api_router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(zone_id: str, user: dict = Depends(get_auth_header())):
    zone = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return ZoneResponse(**zone)

@api_router.put("/zones/{zone_id}")
async def update_zone(zone_id: str, zone: ZoneCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.zones.update_one({"id": zone_id}, {"$set": zone.model_dump()})
    updated = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    return updated

@api_router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.zones.delete_one({"id": zone_id})
    return {"message": "Zone deleted"}

# ==================== DEALER ENDPOINTS ====================

@api_router.post("/dealers", response_model=DealerResponse)
async def create_dealer(dealer: DealerCreate, brand_id: str = None, user: dict = Depends(get_auth_header())):
    existing = await db.dealers.find_one({"phone": dealer.phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Dealer with this phone already exists")
    
    brand_links = []
    if brand_id:
        brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
        auto_approve = brand.get("settings", {}).get("dealer_auto_approve", False) if brand else False
        status = "approved" if auto_approve else "pending"
        brand_links.append({"brand_id": brand_id, "status": status, "zone_id": None})
    
    dealer_doc = {
        "id": generate_id(),
        **dealer.model_dump(),
        "logo_url": None,
        "brand_links": brand_links,
        "default_slips": {},
        "created_at": now_iso()
    }
    await db.dealers.insert_one(dealer_doc)
    await db.users.update_one({"id": user["id"]}, {"$set": {"dealer_id": dealer_doc["id"]}})
    
    return DealerResponse(**dealer_doc)

@api_router.get("/dealers", response_model=List[DealerResponse])
async def list_dealers(brand_id: str = None, zone_id: str = None, status: str = None, user: dict = Depends(get_auth_header())):
    query = {}
    
    if brand_id:
        query["brand_links.brand_id"] = brand_id
    if zone_id:
        query["brand_links.zone_id"] = zone_id
    if status:
        query["brand_links.status"] = status
    
    if user["role"] == UserRole.ZONAL_MANAGER:
        query["brand_links.zone_id"] = {"$in": user.get("zone_ids", [])}
    
    dealers = await db.dealers.find(query, {"_id": 0}).to_list(1000)
    return [DealerResponse(**d) for d in dealers]

@api_router.get("/dealers/{dealer_id}", response_model=DealerResponse)
async def get_dealer(dealer_id: str, user: dict = Depends(get_auth_header())):
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return DealerResponse(**dealer)

@api_router.put("/dealers/{dealer_id}")
async def update_dealer(dealer_id: str, dealer: DealerCreate, user: dict = Depends(get_auth_header())):
    await db.dealers.update_one({"id": dealer_id}, {"$set": dealer.model_dump()})
    updated = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    return updated

@api_router.post("/dealers/{dealer_id}/logo")
async def upload_dealer_logo(dealer_id: str, file: UploadFile = File(...), user: dict = Depends(get_auth_header())):
    file_url = await save_file(file, "logos")
    await db.dealers.update_one({"id": dealer_id}, {"$set": {"logo_url": file_url}})
    return {"logo_url": file_url}

@api_router.put("/dealers/{dealer_id}/approve")
async def approve_dealer(dealer_id: str, brand_id: str, zone_id: str = None, approve: bool = True, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = "approved" if approve else "rejected"
    
    await db.dealers.update_one(
        {"id": dealer_id, "brand_links.brand_id": brand_id},
        {"$set": {"brand_links.$.status": status, "brand_links.$.zone_id": zone_id}}
    )
    
    await db.events.insert_one({
        "id": generate_id(), "brand_id": brand_id, "dealer_id": dealer_id, "user_id": user["id"],
        "type": "dealer_approval", "meta": {"status": status, "zone_id": zone_id}, "created_at": now_iso()
    })
    
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    return dealer

@api_router.post("/dealers/{dealer_id}/join-brand")
async def dealer_join_brand(dealer_id: str, brand_id: str, user: dict = Depends(get_auth_header())):
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    
    auto_approve = brand.get("settings", {}).get("dealer_auto_approve", False)
    status = "approved" if auto_approve else "pending"
    
    await db.dealers.update_one(
        {"id": dealer_id},
        {"$addToSet": {"brand_links": {"brand_id": brand_id, "status": status, "zone_id": None}}}
    )
    
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    return dealer

@api_router.put("/dealers/{dealer_id}/default-slip")
async def set_default_slip(dealer_id: str, brand_id: str, slip_id: str, slip_type: str = "uploaded", user: dict = Depends(get_auth_header())):
    """Set default slip per brand for a dealer"""
    key = f"{brand_id}:{slip_type}"
    await db.dealers.update_one({"id": dealer_id}, {"$set": {f"default_slips.{brand_id}": f"{slip_type}:{slip_id}"}})
    return {"message": "Default slip set"}

# ==================== DEALER REQUESTS ENDPOINTS ====================

@api_router.post("/dealer-requests")
async def create_dealer_request(request_data: DealerRequestCreate, user: dict = Depends(get_auth_header())):
    """Dealer requests to join a brand"""
    existing = await db.dealer_requests.find_one({
        "dealer_id": request_data.dealer_id,
        "brand_id": request_data.brand_id,
        "status": "pending"
    }, {"_id": 0})
    
    if existing:
        raise HTTPException(status_code=400, detail="Request already pending")
    
    request_doc = {
        "id": generate_id(),
        **request_data.model_dump(),
        "status": "pending",
        "reviewed_by": None,
        "created_at": now_iso()
    }
    await db.dealer_requests.insert_one(request_doc)
    return request_doc

@api_router.get("/dealer-requests")
async def list_dealer_requests(brand_id: str = None, status: str = None, user: dict = Depends(get_auth_header())):
    """List dealer requests (for brand admins and zonal managers)"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if brand_id:
        query["brand_id"] = brand_id
    if status:
        query["status"] = status
    
    requests = await db.dealer_requests.find(query, {"_id": 0}).to_list(500)
    
    # Enrich with dealer info
    for req in requests:
        dealer = await db.dealers.find_one({"id": req["dealer_id"]}, {"_id": 0, "name": 1, "phone": 1, "district": 1, "state": 1})
        req["dealer"] = dealer
    
    return requests

@api_router.put("/dealer-requests/{request_id}/approve")
async def approve_dealer_request(request_id: str, approve: bool = True, zone_id: str = None, user: dict = Depends(get_auth_header())):
    """Approve or reject dealer request"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    request_doc = await db.dealer_requests.find_one({"id": request_id}, {"_id": 0})
    if not request_doc:
        raise HTTPException(status_code=404, detail="Request not found")
    
    status = "approved" if approve else "rejected"
    
    await db.dealer_requests.update_one(
        {"id": request_id},
        {"$set": {"status": status, "reviewed_by": user["id"]}}
    )
    
    if approve:
        await db.dealers.update_one(
            {"id": request_doc["dealer_id"]},
            {"$addToSet": {"brand_links": {"brand_id": request_doc["brand_id"], "status": "approved", "zone_id": zone_id}}}
        )
    
    return {"message": f"Request {status}"}

# ==================== CREATIVE ENDPOINTS ====================

@api_router.post("/creatives", response_model=CreativeResponse)
async def create_creative(creative: CreativeCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    creative_doc = {
        "id": generate_id(),
        **creative.model_dump(),
        "status": "active",
        "featured_until": None,
        "created_at": now_iso()
    }
    await db.creatives.insert_one(creative_doc)
    creative_doc["variants"] = []
    return CreativeResponse(**creative_doc)

@api_router.get("/creatives", response_model=List[CreativeResponse])
async def list_creatives(
    brand_id: str = None,
    category: str = None,
    tag: str = None,
    highlight_tag: str = None,
    is_featured: bool = None,
    user: dict = Depends(get_auth_header())
):
    query = {"status": "active"}
    
    if brand_id:
        query["brand_id"] = brand_id
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    if highlight_tag:
        query["highlight_tags"] = highlight_tag
    if is_featured is not None:
        query["is_featured"] = is_featured
    
    if user["role"] in [UserRole.DEALER_OWNER, UserRole.DEALER_STAFF]:
        dealer = await db.dealers.find_one({"id": user.get("dealer_id")}, {"_id": 0})
        if dealer:
            approved_brands = [bl["brand_id"] for bl in dealer.get("brand_links", []) if bl["status"] == "approved"]
            if approved_brands:
                query["brand_id"] = {"$in": approved_brands}
    
    creatives = await db.creatives.find(query, {"_id": 0}).sort([("is_featured", -1), ("featured_priority", -1), ("created_at", -1)]).to_list(500)
    
    for creative in creatives:
        variants = await db.creative_variants.find({"creative_id": creative["id"]}, {"_id": 0}).to_list(20)
        creative["variants"] = variants
    
    return [CreativeResponse(**c) for c in creatives]

@api_router.get("/creatives/feed")
async def get_creative_feed(user: dict = Depends(get_auth_header())):
    """Get structured feed for dealer home"""
    dealer = await db.dealers.find_one({"id": user.get("dealer_id")}, {"_id": 0})
    approved_brands = []
    if dealer:
        approved_brands = [bl["brand_id"] for bl in dealer.get("brand_links", []) if bl["status"] == "approved"]
    
    base_query = {"status": "active"}
    if approved_brands:
        base_query["brand_id"] = {"$in": approved_brands}
    
    # Featured creatives
    featured_query = {**base_query, "is_featured": True}
    featured = await db.creatives.find(featured_query, {"_id": 0}).sort("featured_priority", -1).limit(10).to_list(10)
    
    # Seasonal creatives
    seasonal_query = {**base_query, "highlight_tags": "seasonal"}
    seasonal = await db.creatives.find(seasonal_query, {"_id": 0}).limit(10).to_list(10)
    
    # New creatives
    new_query = {**base_query, "highlight_tags": "new"}
    new_creatives = await db.creatives.find(new_query, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    # Trending
    trending_query = {**base_query, "highlight_tags": "trending"}
    trending = await db.creatives.find(trending_query, {"_id": 0}).limit(10).to_list(10)
    
    # All creatives
    all_creatives = await db.creatives.find(base_query, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    # Add variants to all
    all_ids = set()
    for section in [featured, seasonal, new_creatives, trending, all_creatives]:
        for c in section:
            all_ids.add(c["id"])
    
    variants_map = {}
    for creative_id in all_ids:
        variants = await db.creative_variants.find({"creative_id": creative_id}, {"_id": 0}).to_list(20)
        variants_map[creative_id] = variants
    
    for section in [featured, seasonal, new_creatives, trending, all_creatives]:
        for c in section:
            c["variants"] = variants_map.get(c["id"], [])
    
    # Get brands for filter
    brands = await db.brands.find({"id": {"$in": approved_brands}}, {"_id": 0, "id": 1, "name": 1, "logo": 1}).to_list(50)
    
    return {
        "featured": featured,
        "seasonal": seasonal,
        "new": new_creatives,
        "trending": trending,
        "all": all_creatives,
        "brands": brands,
        "highlight_tags": CREATIVE_TAGS,
    }

@api_router.get("/creatives/{creative_id}", response_model=CreativeResponse)
async def get_creative(creative_id: str, user: dict = Depends(get_auth_header())):
    creative = await db.creatives.find_one({"id": creative_id}, {"_id": 0})
    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")
    
    variants = await db.creative_variants.find({"creative_id": creative_id}, {"_id": 0}).to_list(20)
    creative["variants"] = variants
    
    return CreativeResponse(**creative)

@api_router.put("/creatives/{creative_id}")
async def update_creative(creative_id: str, creative: CreativeCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creatives.update_one({"id": creative_id}, {"$set": creative.model_dump()})
    updated = await db.creatives.find_one({"id": creative_id}, {"_id": 0})
    variants = await db.creative_variants.find({"creative_id": creative_id}, {"_id": 0}).to_list(20)
    updated["variants"] = variants
    return updated

@api_router.delete("/creatives/{creative_id}")
async def delete_creative(creative_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creatives.update_one({"id": creative_id}, {"$set": {"status": "deleted"}})
    return {"message": "Creative deleted"}

# ==================== CREATIVE VARIANT ENDPOINTS ====================

@api_router.post("/creative-variants")
async def create_variant(
    creative_id: str = Form(...),
    brand_id: str = Form(...),
    label: str = Form(...),
    width: int = Form(...),
    height: int = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_auth_header())
):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    file_url = await save_file(file, "creatives")
    
    variant_doc = {
        "id": generate_id(),
        "creative_id": creative_id,
        "brand_id": brand_id,
        "file_url": file_url,
        "file_type": file.content_type or "image/png",
        "width": width,
        "height": height,
        "label": label,
        "created_at": now_iso()
    }
    await db.creative_variants.insert_one(variant_doc)
    return variant_doc

@api_router.get("/creative-variants/{variant_id}")
async def get_variant(variant_id: str, user: dict = Depends(get_auth_header())):
    variant = await db.creative_variants.find_one({"id": variant_id}, {"_id": 0})
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant

@api_router.delete("/creative-variants/{variant_id}")
async def delete_variant(variant_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creative_variants.delete_one({"id": variant_id})
    return {"message": "Variant deleted"}

# ==================== SLIP TEMPLATE ENDPOINTS ====================

@api_router.post("/slip-templates", response_model=SlipTemplateResponse)
async def create_slip_template(template: SlipTemplateCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template_doc = {"id": generate_id(), **template.model_dump(), "is_active": True, "created_at": now_iso()}
    await db.slip_templates.insert_one(template_doc)
    return SlipTemplateResponse(**template_doc)

@api_router.get("/slip-templates", response_model=List[SlipTemplateResponse])
async def list_slip_templates(brand_id: str = None, user: dict = Depends(get_auth_header())):
    query = {"is_active": True}
    if brand_id:
        query["brand_id"] = brand_id
    
    templates = await db.slip_templates.find(query, {"_id": 0}).to_list(100)
    return [SlipTemplateResponse(**t) for t in templates]

@api_router.get("/slip-templates/{template_id}", response_model=SlipTemplateResponse)
async def get_slip_template(template_id: str, user: dict = Depends(get_auth_header())):
    template = await db.slip_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return SlipTemplateResponse(**template)

@api_router.put("/slip-templates/{template_id}")
async def update_slip_template(template_id: str, template: SlipTemplateCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.slip_templates.update_one({"id": template_id}, {"$set": template.model_dump()})
    updated = await db.slip_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

@api_router.delete("/slip-templates/{template_id}")
async def delete_slip_template(template_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.slip_templates.update_one({"id": template_id}, {"$set": {"is_active": False}})
    return {"message": "Template deleted"}

# ==================== SLIP DESIGN ENDPOINTS (Fabric.js) ====================

@api_router.post("/slip-designs")
async def create_slip_design(design: SlipDesignCreate, user: dict = Depends(get_auth_header())):
    """Save a Fabric.js slip design"""
    brand = await db.brands.find_one({"id": design.brand_id}, {"_id": 0})
    requires_approval = brand.get("settings", {}).get("slip_approval_required", True) if brand else True
    status = "pending" if requires_approval else "approved"
    
    design_doc = {
        "id": generate_id(),
        **design.model_dump(),
        "status": status,
        "is_default": False,
        "created_at": now_iso()
    }
    await db.slip_designs.insert_one(design_doc)
    return design_doc

@api_router.get("/slip-designs")
async def list_slip_designs(dealer_id: str = None, brand_id: str = None, status: str = None, user: dict = Depends(get_auth_header())):
    query = {}
    if dealer_id:
        query["dealer_id"] = dealer_id
    if brand_id:
        query["brand_id"] = brand_id
    if status:
        query["status"] = status
    
    designs = await db.slip_designs.find(query, {"_id": 0}).to_list(100)
    return designs

@api_router.get("/slip-designs/{design_id}")
async def get_slip_design(design_id: str, user: dict = Depends(get_auth_header())):
    design = await db.slip_designs.find_one({"id": design_id}, {"_id": 0})
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    return design

@api_router.put("/slip-designs/{design_id}")
async def update_slip_design(design_id: str, design_json: dict, user: dict = Depends(get_auth_header())):
    await db.slip_designs.update_one({"id": design_id}, {"$set": {"design_json": design_json}})
    updated = await db.slip_designs.find_one({"id": design_id}, {"_id": 0})
    return updated

@api_router.delete("/slip-designs/{design_id}")
async def delete_slip_design(design_id: str, user: dict = Depends(get_auth_header())):
    await db.slip_designs.delete_one({"id": design_id})
    return {"message": "Design deleted"}

@api_router.put("/slip-designs/{design_id}/approve")
async def approve_slip_design(design_id: str, approve: bool = True, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = "approved" if approve else "rejected"
    await db.slip_designs.update_one({"id": design_id}, {"$set": {"status": status}})
    return {"message": f"Design {status}"}

# ==================== DEALER SLIP ENDPOINTS ====================

@api_router.post("/dealer-slips")
async def create_dealer_slip(
    dealer_id: str = Form(...),
    brand_id: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_auth_header())
):
    file_url = await save_file(file, "slips")
    
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    requires_approval = brand.get("settings", {}).get("slip_approval_required", True) if brand else True
    status = "pending" if requires_approval else "approved"
    
    slip_doc = {
        "id": generate_id(),
        "dealer_id": dealer_id,
        "brand_id": brand_id,
        "file_url": file_url,
        "name": name,
        "status": status,
        "reviewed_by": None,
        "created_at": now_iso()
    }
    await db.dealer_slips.insert_one(slip_doc)
    return slip_doc

@api_router.get("/dealer-slips", response_model=List[DealerSlipResponse])
async def list_dealer_slips(dealer_id: str = None, brand_id: str = None, status: str = None, user: dict = Depends(get_auth_header())):
    query = {}
    if dealer_id:
        query["dealer_id"] = dealer_id
    if brand_id:
        query["brand_id"] = brand_id
    if status:
        query["status"] = status
    
    slips = await db.dealer_slips.find(query, {"_id": 0}).to_list(500)
    return [DealerSlipResponse(**s) for s in slips]

@api_router.put("/dealer-slips/{slip_id}/approve")
async def approve_dealer_slip(slip_id: str, approve: bool = True, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = "approved" if approve else "rejected"
    await db.dealer_slips.update_one({"id": slip_id}, {"$set": {"status": status, "reviewed_by": user["id"]}})
    
    slip = await db.dealer_slips.find_one({"id": slip_id}, {"_id": 0})
    return slip

@api_router.delete("/dealer-slips/{slip_id}")
async def delete_dealer_slip(slip_id: str, user: dict = Depends(get_auth_header())):
    await db.dealer_slips.delete_one({"id": slip_id})
    return {"message": "Slip deleted"}

# ==================== RENDER ENGINE ====================

def generate_qr_code(data: str, size: int = 150) -> Image.Image:
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").resize((size, size))

def render_slip_on_creative(creative_img: Image.Image, slip_template: dict, dealer: dict, qr_data: str = None) -> Image.Image:
    from PIL import ImageDraw, ImageFont
    
    result = creative_img.copy()
    draw = ImageDraw.Draw(result)
    
    width, height = result.size
    position = slip_template.get("position", "bottom")
    max_h_pct = slip_template.get("max_h_pct", 20)
    max_w_pct = slip_template.get("max_w_pct", 100)
    bg_style = slip_template.get("bg_style", "light")
    allowed_fields = slip_template.get("allowed_fields", ["shop_name", "phone"])
    
    slip_height = int(height * max_h_pct / 100)
    slip_width = int(width * max_w_pct / 100)
    
    if position == "bottom":
        slip_x, slip_y = (width - slip_width) // 2, height - slip_height
    elif position == "top":
        slip_x, slip_y = (width - slip_width) // 2, 0
    elif position == "left":
        slip_x, slip_y = 0, (height - slip_height) // 2
    elif position == "right":
        slip_x, slip_y = width - slip_width, (height - slip_height) // 2
    else:
        slip_x, slip_y = width - slip_width, height - slip_height
    
    if bg_style == "light":
        bg_color, text_color = (255, 255, 255, 230), (15, 23, 42)
    elif bg_style == "dark":
        bg_color, text_color = (15, 23, 42, 230), (255, 255, 255)
    else:
        bg_color, text_color = (255, 255, 255, 180), (15, 23, 42)
    
    slip_overlay = Image.new('RGBA', (slip_width, slip_height), bg_color)
    slip_draw = ImageDraw.Draw(slip_overlay)
    
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    padding = 15
    current_y = padding
    content_x = padding
    
    qr_size = slip_height - 2 * padding
    if qr_data and "qr" in allowed_fields:
        qr_img = generate_qr_code(qr_data, qr_size)
        qr_x = slip_width - qr_size - padding
        slip_overlay.paste(qr_img, (qr_x, padding))
    
    if "shop_name" in allowed_fields and dealer.get("name"):
        slip_draw.text((content_x, current_y), dealer["name"], fill=text_color, font=font_large)
        current_y += 30
    
    if "phone" in allowed_fields and dealer.get("phone"):
        slip_draw.text((content_x, current_y), f"📞 {dealer['phone']}", fill=text_color, font=font_small)
        current_y += 22
    
    if "whatsapp" in allowed_fields and dealer.get("whatsapp"):
        slip_draw.text((content_x, current_y), f"💬 {dealer['whatsapp']}", fill=text_color, font=font_small)
        current_y += 22
    
    if "address" in allowed_fields and dealer.get("address"):
        addr = dealer["address"][:40] + "..." if len(dealer.get("address", "")) > 40 else dealer.get("address", "")
        slip_draw.text((content_x, current_y), f"📍 {addr}", fill=text_color, font=font_small)
    
    result = result.convert('RGBA')
    result.paste(slip_overlay, (slip_x, slip_y), slip_overlay)
    
    return result.convert('RGB')

def overlay_dealer_slip(creative_img: Image.Image, slip_img: Image.Image, position: str = "bottom", max_h_pct: int = 20) -> Image.Image:
    result = creative_img.copy()
    width, height = result.size
    
    target_height = int(height * max_h_pct / 100)
    aspect = slip_img.width / slip_img.height
    target_width = min(int(target_height * aspect), width)
    
    slip_resized = slip_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    if position == "bottom":
        x, y = (width - target_width) // 2, height - target_height
    elif position == "top":
        x, y = (width - target_width) // 2, 0
    else:
        x, y = width - target_width, height - target_height
    
    if slip_resized.mode == 'RGBA':
        result = result.convert('RGBA')
        result.paste(slip_resized, (x, y), slip_resized)
        result = result.convert('RGB')
    else:
        result.paste(slip_resized, (x, y))
    
    return result

@api_router.post("/render", response_model=RenderResponse)
async def render_creative(request: RenderRequest, user: dict = Depends(get_auth_header())):
    hash_input = f"{request.creative_variant_id}:{request.slip_mode}:{request.slip_template_id}:{request.dealer_slip_id}:{request.slip_design_id}:{request.dealer_id}:{request.qr_type}:{request.qr_value}"
    hash_key = hashlib.md5(hash_input.encode()).hexdigest()
    
    existing = await db.rendered_assets.find_one({"hash_key": hash_key}, {"_id": 0})
    if existing:
        await db.events.insert_one({
            "id": generate_id(), "brand_id": existing["brand_id"], "dealer_id": request.dealer_id,
            "user_id": user["id"], "type": "render_cached", "meta": {"rendered_asset_id": existing["id"]}, "created_at": now_iso()
        })
        return RenderResponse(**existing)
    
    variant = await db.creative_variants.find_one({"id": request.creative_variant_id}, {"_id": 0})
    if not variant:
        raise HTTPException(status_code=404, detail="Creative variant not found")
    
    dealer = await db.dealers.find_one({"id": request.dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    
    file_url = variant["file_url"]
    if file_url.startswith("/api/files/"):
        file_path = UPLOAD_DIR / file_url.replace("/api/files/", "")
        creative_img = Image.open(file_path)
    else:
        import requests
        response = requests.get(file_url)
        creative_img = Image.open(BytesIO(response.content))
    
    qr_data = None
    if request.qr_type == "whatsapp":
        phone = request.qr_value or dealer.get("whatsapp") or dealer.get("phone")
        qr_data = f"https://wa.me/{phone.replace('+', '').replace(' ', '')}"
    elif request.qr_type == "maps" and dealer.get("address"):
        qr_data = f"https://maps.google.com/?q={dealer['address']}, {dealer['district']}, {dealer['state']}"
    elif request.qr_type == "custom" and request.qr_value:
        qr_data = request.qr_value
    
    if request.slip_mode == "template":
        template = await db.slip_templates.find_one({"id": request.slip_template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Slip template not found")
        result_img = render_slip_on_creative(creative_img, template, dealer, qr_data)
    elif request.slip_mode == "design":
        design = await db.slip_designs.find_one({"id": request.slip_design_id}, {"_id": 0})
        if not design:
            raise HTTPException(status_code=404, detail="Slip design not found")
        # For Fabric.js designs, we'd render the JSON - simplified for now
        template = {"position": "bottom", "max_h_pct": 20, "bg_style": "light", "allowed_fields": ["shop_name", "phone", "qr"]}
        result_img = render_slip_on_creative(creative_img, template, dealer, qr_data)
    else:
        dealer_slip = await db.dealer_slips.find_one({"id": request.dealer_slip_id}, {"_id": 0})
        if not dealer_slip:
            raise HTTPException(status_code=404, detail="Dealer slip not found")
        
        slip_url = dealer_slip["file_url"]
        if slip_url.startswith("/api/files/"):
            slip_path = UPLOAD_DIR / slip_url.replace("/api/files/", "")
            slip_img = Image.open(slip_path)
        else:
            import requests
            response = requests.get(slip_url)
            slip_img = Image.open(BytesIO(response.content))
        
        result_img = overlay_dealer_slip(creative_img, slip_img)
    
    output_buffer = BytesIO()
    result_img.save(output_buffer, format='PNG', quality=95)
    output_buffer.seek(0)
    
    output_url = await save_bytes(output_buffer.getvalue(), "rendered", ".png")
    
    rendered_doc = {
        "id": generate_id(),
        "brand_id": variant["brand_id"],
        "dealer_id": request.dealer_id,
        "creative_variant_id": request.creative_variant_id,
        "slip_mode": request.slip_mode,
        "slip_template_id": request.slip_template_id,
        "dealer_slip_id": request.dealer_slip_id,
        "slip_design_id": request.slip_design_id,
        "output_url": output_url,
        "hash_key": hash_key,
        "created_at": now_iso()
    }
    await db.rendered_assets.insert_one(rendered_doc)
    
    await db.events.insert_one({
        "id": generate_id(), "brand_id": variant["brand_id"], "dealer_id": request.dealer_id,
        "user_id": user["id"], "type": "render_generated", "meta": {"rendered_asset_id": rendered_doc["id"]}, "created_at": now_iso()
    })
    
    return RenderResponse(**rendered_doc)

# ==================== DOWNLOAD & SHARE ====================

@api_router.get("/download/{asset_id}")
async def download_asset(asset_id: str, user: dict = Depends(get_auth_header())):
    asset = await db.rendered_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    await db.events.insert_one({
        "id": generate_id(), "brand_id": asset["brand_id"], "dealer_id": asset["dealer_id"],
        "user_id": user["id"], "type": "download", "meta": {"rendered_asset_id": asset_id}, "created_at": now_iso()
    })
    
    file_url = asset["output_url"]
    if file_url.startswith("/api/files/"):
        file_path = UPLOAD_DIR / file_url.replace("/api/files/", "")
        return FileResponse(file_path, media_type="image/png", filename=f"creative_{asset_id}.png")
    else:
        return {"download_url": file_url}

@api_router.post("/share/{asset_id}")
async def create_share_link(asset_id: str, user: dict = Depends(get_auth_header())):
    asset = await db.rendered_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    share_token = secrets.token_urlsafe(16)
    await db.share_links.insert_one({
        "id": generate_id(), "token": share_token, "asset_id": asset_id,
        "brand_id": asset["brand_id"], "dealer_id": asset["dealer_id"],
        "created_at": now_iso(), "clicks": 0
    })
    
    return {"share_token": share_token, "share_url": f"/s/{share_token}"}

@api_router.get("/s/{token}")
async def track_share_click(token: str):
    share_link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    await db.share_links.update_one({"token": token}, {"$inc": {"clicks": 1}})
    
    await db.events.insert_one({
        "id": generate_id(), "brand_id": share_link["brand_id"], "dealer_id": share_link["dealer_id"],
        "user_id": None, "type": "share_clicked", "meta": {"share_token": token}, "created_at": now_iso()
    })
    
    asset = await db.rendered_assets.find_one({"id": share_link["asset_id"]}, {"_id": 0})
    if asset:
        return {"download_url": asset["output_url"]}
    
    raise HTTPException(status_code=404, detail="Asset not found")

# ==================== WHATSAPP CAMPAIGN ENDPOINTS ====================

@api_router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(campaign: CampaignCreate, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    campaign_doc = {
        "id": generate_id(),
        **campaign.model_dump(),
        "status": "draft",
        "total_recipients": 0,
        "sent_count": 0,
        "delivered_count": 0,
        "clicked_count": 0,
        "created_at": now_iso()
    }
    await db.campaigns.insert_one(campaign_doc)
    return CampaignResponse(**campaign_doc)

@api_router.get("/campaigns", response_model=List[CampaignResponse])
async def list_campaigns(brand_id: str = None, status: str = None, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {}
    if brand_id:
        query["brand_id"] = brand_id
    if status:
        query["status"] = status
    
    campaigns = await db.campaigns.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [CampaignResponse(**c) for c in campaigns]

@api_router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, user: dict = Depends(get_auth_header())):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignResponse(**campaign)

@api_router.post("/campaigns/{campaign_id}/send")
async def send_campaign(campaign_id: str, background_tasks: BackgroundTasks, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Get brand WhatsApp config
    brand = await db.brands.find_one({"id": campaign["brand_id"]}, {"_id": 0})
    wa_config = brand.get("whatsapp_config", {}) if brand else {}
    
    if not wa_config.get("phone_id") or not wa_config.get("access_token"):
        raise HTTPException(status_code=400, detail="WhatsApp not configured for this brand")
    
    # Get recipients
    if campaign["target_type"] == "dealers":
        query = {"brand_links.brand_id": campaign["brand_id"], "brand_links.status": "approved"}
        if campaign["target_zone_ids"]:
            query["brand_links.zone_id"] = {"$in": campaign["target_zone_ids"]}
        if campaign["target_dealer_ids"]:
            query["id"] = {"$in": campaign["target_dealer_ids"]}
        
        dealers = await db.dealers.find(query, {"_id": 0}).to_list(10000)
    else:
        dealers = []
    
    # Update campaign
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "sending", "total_recipients": len(dealers)}}
    )
    
    # Queue sending in background
    background_tasks.add_task(send_campaign_messages, campaign_id, campaign, dealers, wa_config)
    
    return {"message": f"Campaign started, sending to {len(dealers)} recipients"}

async def send_campaign_messages(campaign_id: str, campaign: dict, dealers: list, wa_config: dict):
    """Background task to send WhatsApp messages"""
    phone_id = wa_config["phone_id"]
    access_token = wa_config["access_token"]
    
    sent_count = 0
    
    for dealer in dealers:
        try:
            # Generate personalized download link
            creative = await db.creatives.find_one({"id": campaign["creative_id"]}, {"_id": 0})
            variants = await db.creative_variants.find({"creative_id": campaign["creative_id"]}, {"_id": 0}).to_list(5)
            
            if variants:
                # Create a share link for this dealer
                share_token = secrets.token_urlsafe(16)
                await db.campaign_links.insert_one({
                    "id": generate_id(),
                    "campaign_id": campaign_id,
                    "dealer_id": dealer["id"],
                    "token": share_token,
                    "clicked": False,
                    "created_at": now_iso()
                })
                
                # Format message with variables
                message = campaign["message_template"]
                message = message.replace("{dealer_name}", dealer.get("owner_name", ""))
                message = message.replace("{shop_name}", dealer.get("name", ""))
                message = message.replace("{phone}", dealer.get("phone", ""))
                message = message.replace("{creative_link}", f"https://brandslip.app/c/{share_token}")
                
                # Send via WhatsApp Cloud API
                phone = dealer.get("whatsapp") or dealer.get("phone")
                if phone:
                    async with httpx.AsyncClient() as client:
                        response = await client.post(
                            f"https://graph.facebook.com/v18.0/{phone_id}/messages",
                            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                            json={
                                "messaging_product": "whatsapp",
                                "to": phone.replace("+", "").replace(" ", ""),
                                "type": "text",
                                "text": {"body": message}
                            }
                        )
                        
                        if response.status_code == 200:
                            sent_count += 1
                
            await asyncio.sleep(0.5)  # Rate limiting
            
        except Exception as e:
            logger.error(f"Failed to send to dealer {dealer['id']}: {e}")
    
    # Update campaign status
    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"status": "completed", "sent_count": sent_count}}
    )

@api_router.get("/campaigns/{campaign_id}/stats")
async def get_campaign_stats(campaign_id: str, user: dict = Depends(get_auth_header())):
    campaign = await db.campaigns.find_one({"id": campaign_id}, {"_id": 0})
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Count clicked links
    clicked = await db.campaign_links.count_documents({"campaign_id": campaign_id, "clicked": True})
    
    return {
        "total_recipients": campaign.get("total_recipients", 0),
        "sent_count": campaign.get("sent_count", 0),
        "delivered_count": campaign.get("delivered_count", 0),
        "clicked_count": clicked,
        "status": campaign.get("status", "draft")
    }

@api_router.get("/c/{token}")
async def track_campaign_link(token: str):
    """Track campaign link click and redirect to download"""
    link = await db.campaign_links.find_one({"token": token}, {"_id": 0})
    if not link:
        raise HTTPException(status_code=404, detail="Link not found")
    
    await db.campaign_links.update_one({"token": token}, {"$set": {"clicked": True}})
    
    # Return creative download page info
    campaign = await db.campaigns.find_one({"id": link["campaign_id"]}, {"_id": 0})
    if campaign:
        creative = await db.creatives.find_one({"id": campaign["creative_id"]}, {"_id": 0})
        variants = await db.creative_variants.find({"creative_id": campaign["creative_id"]}, {"_id": 0}).to_list(10)
        
        return {
            "dealer_id": link["dealer_id"],
            "creative": creative,
            "variants": variants
        }
    
    raise HTTPException(status_code=404, detail="Campaign not found")

# ==================== FEATURED PLACEMENT & PAYMENTS ====================

@api_router.get("/featured-packages")
async def list_featured_packages():
    return FEATURED_PACKAGES

@api_router.post("/featured/checkout")
async def create_featured_checkout(request: FeaturedPaymentRequest, http_request: Request, user: dict = Depends(get_auth_header())):
    """Create Stripe checkout for featured placement"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if request.package_id not in FEATURED_PACKAGES:
        raise HTTPException(status_code=400, detail="Invalid package")
    
    package = FEATURED_PACKAGES[request.package_id]
    
    from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
    
    host_url = request.origin_url or str(http_request.base_url)
    webhook_url = f"{host_url}api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    
    success_url = f"{host_url}admin/featured/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{host_url}admin/featured"
    
    checkout_request = CheckoutSessionRequest(
        amount=package["price"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "creative_id": request.creative_id,
            "package_id": request.package_id,
            "user_id": user["id"],
            "type": "featured_placement"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    # Create payment transaction record
    await db.payment_transactions.insert_one({
        "id": generate_id(),
        "session_id": session.session_id,
        "user_id": user["id"],
        "creative_id": request.creative_id,
        "package_id": request.package_id,
        "amount": package["price"],
        "currency": "usd",
        "payment_status": "pending",
        "created_at": now_iso()
    })
    
    return {"checkout_url": session.url, "session_id": session.session_id}

@api_router.get("/featured/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, user: dict = Depends(get_auth_header())):
    """Check payment status and activate featured placement"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update transaction
    transaction = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    
    if transaction and status.payment_status == "paid" and transaction["payment_status"] != "paid":
        # Activate featured placement
        package = FEATURED_PACKAGES.get(transaction["package_id"], {})
        duration_days = package.get("duration_days", 7)
        featured_until = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()
        
        await db.creatives.update_one(
            {"id": transaction["creative_id"]},
            {"$set": {
                "is_featured": True,
                "featured_priority": 10 if transaction["package_id"] == "spotlight" else 5,
                "featured_until": featured_until
            }}
        )
        
        await db.payment_transactions.update_one(
            {"session_id": session_id},
            {"$set": {"payment_status": "paid"}}
        )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks"""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    body = await request.body()
    stripe_signature = request.headers.get("Stripe-Signature")
    
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url="")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, stripe_signature)
        
        if webhook_response.payment_status == "paid":
            metadata = webhook_response.metadata or {}
            
            if metadata.get("type") == "featured_placement":
                creative_id = metadata.get("creative_id")
                package_id = metadata.get("package_id")
                
                if creative_id and package_id:
                    package = FEATURED_PACKAGES.get(package_id, {})
                    duration_days = package.get("duration_days", 7)
                    featured_until = (datetime.now(timezone.utc) + timedelta(days=duration_days)).isoformat()
                    
                    await db.creatives.update_one(
                        {"id": creative_id},
                        {"$set": {
                            "is_featured": True,
                            "featured_priority": 10 if package_id == "spotlight" else 5,
                            "featured_until": featured_until
                        }}
                    )
        
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return JSONResponse(status_code=400, content={"error": str(e)})

# ==================== ANALYTICS ====================

@api_router.get("/analytics/brand/{brand_id}")
async def get_brand_analytics(brand_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dealer_count = await db.dealers.count_documents({"brand_links.brand_id": brand_id})
    active_dealers = await db.dealers.count_documents({"brand_links.brand_id": brand_id, "brand_links.status": "approved"})
    pending_dealers = await db.dealers.count_documents({"brand_links.brand_id": brand_id, "brand_links.status": "pending"})
    
    creative_count = await db.creatives.count_documents({"brand_id": brand_id, "status": "active"})
    
    downloads = await db.events.count_documents({"brand_id": brand_id, "type": "download"})
    renders = await db.events.count_documents({"brand_id": brand_id, "type": "render_generated"})
    shares = await db.events.count_documents({"brand_id": brand_id, "type": "share_clicked"})
    
    pending_requests = await db.dealer_requests.count_documents({"brand_id": brand_id, "status": "pending"})
    
    return {
        "dealers": {"total": dealer_count, "active": active_dealers, "pending": pending_dealers},
        "creatives": creative_count,
        "downloads": downloads,
        "renders": renders,
        "shares": shares,
        "pending_requests": pending_requests
    }

@api_router.get("/analytics/zone/{zone_id}")
async def get_zone_analytics(zone_id: str, user: dict = Depends(get_auth_header())):
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    dealers = await db.dealers.find({"brand_links.zone_id": zone_id}, {"_id": 0, "id": 1}).to_list(1000)
    dealer_ids = [d["id"] for d in dealers]
    
    downloads = await db.events.count_documents({"dealer_id": {"$in": dealer_ids}, "type": "download"})
    renders = await db.events.count_documents({"dealer_id": {"$in": dealer_ids}, "type": "render_generated"})
    
    return {"dealer_count": len(dealer_ids), "downloads": downloads, "renders": renders}

@api_router.get("/analytics/dealer/{dealer_id}")
async def get_dealer_analytics(dealer_id: str, user: dict = Depends(get_auth_header())):
    downloads = await db.events.count_documents({"dealer_id": dealer_id, "type": "download"})
    renders = await db.events.count_documents({"dealer_id": dealer_id, "type": "render_generated"})
    shares = await db.events.count_documents({"dealer_id": dealer_id, "type": "share_clicked"})
    
    recent = await db.events.find({"dealer_id": dealer_id}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    
    return {"downloads": downloads, "renders": renders, "shares": shares, "recent_activity": recent}

# ==================== FILE SERVING ====================

@api_router.get("/files/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    file_path = UPLOAD_DIR / folder / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    media_type = "image/png"
    if filename.endswith(".jpg") or filename.endswith(".jpeg"):
        media_type = "image/jpeg"
    elif filename.endswith(".pdf"):
        media_type = "application/pdf"
    
    return FileResponse(file_path, media_type=media_type)

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    existing = await db.brands.find_one({}, {"_id": 0})
    if existing:
        return {"message": "Database already seeded"}
    
    # Create brand
    brand = {
        "id": generate_id(), "name": "Sunrise Electronics",
        "logo": "https://images.unsplash.com/photo-1628760584600-6c31148991e9?w=200",
        "default_category": "electronics",
        "settings": {"dealer_auto_approve": False, "slip_approval_required": True, "max_upload_size_mb": 10},
        "whatsapp_config": {},
        "theme": {},
        "created_at": now_iso()
    }
    await db.brands.insert_one(brand)
    
    # Create admin user
    admin = {
        "id": generate_id(), "name": "Brand Admin", "phone": "+919876543210", "email": "admin@sunrise.com",
        "role": UserRole.BRAND_SUPER_ADMIN, "brand_ids": [brand["id"]], "dealer_id": None, "zone_ids": [],
        "status": "active", "categories": [], "created_at": now_iso()
    }
    await db.users.insert_one(admin)
    
    # Create zones
    zones = []
    for zone_name, states in [("North Zone", ["Delhi", "Punjab", "Haryana"]), ("South Zone", ["Karnataka", "Tamil Nadu", "Kerala"])]:
        zone = {"id": generate_id(), "brand_id": brand["id"], "name": zone_name, "states": states, "districts": [], "pincodes": [], "created_at": now_iso()}
        zones.append(zone)
        await db.zones.insert_one(zone)
    
    # Create zonal manager
    manager = {
        "id": generate_id(), "name": "North Zone Manager", "phone": "+919876543211", "email": "manager@sunrise.com",
        "role": UserRole.ZONAL_MANAGER, "brand_ids": [brand["id"]], "dealer_id": None, "zone_ids": [zones[0]["id"]],
        "status": "active", "categories": [], "created_at": now_iso()
    }
    await db.users.insert_one(manager)
    
    # Create dealers
    dealers_data = [
        {"name": "Kumar Electronics", "owner_name": "Raj Kumar", "phone": "+919876543212", "address": "Shop 12, Main Market", "pincode": "110001", "district": "Central Delhi", "state": "Delhi", "categories": ["electronics", "appliances"]},
        {"name": "Tech World", "owner_name": "Priya Sharma", "phone": "+919876543213", "address": "34 Mall Road", "pincode": "560001", "district": "Bangalore Urban", "state": "Karnataka", "categories": ["electronics"]}
    ]
    
    for i, d in enumerate(dealers_data):
        dealer = {
            "id": generate_id(), **d, "whatsapp": d["phone"], "email": None, "logo_url": None,
            "brand_links": [{"brand_id": brand["id"], "status": "approved", "zone_id": zones[i]["id"]}],
            "default_slips": {},
            "created_at": now_iso()
        }
        await db.dealers.insert_one(dealer)
        
        dealer_user = {
            "id": generate_id(), "name": d["owner_name"], "phone": d["phone"], "email": None,
            "role": UserRole.DEALER_OWNER, "brand_ids": [brand["id"]], "dealer_id": dealer["id"], "zone_ids": [],
            "status": "active", "categories": d.get("categories", []), "created_at": now_iso()
        }
        await db.users.insert_one(dealer_user)
    
    # Create creatives with highlight tags
    creatives_data = [
        {"name": "Diwali Sale 2024", "description": "Festival special discounts", "tags": ["diwali", "sale", "festival"], "highlight_tags": ["featured", "seasonal"], "category": "seasonal", "is_featured": True, "featured_priority": 10},
        {"name": "New Year Offer", "description": "Ring in the new year with savings", "tags": ["newyear", "offer"], "highlight_tags": ["new", "offers"], "category": "seasonal", "is_featured": False, "featured_priority": 0}
    ]
    
    for c in creatives_data:
        creative = {
            "id": generate_id(), "brand_id": brand["id"], **c, "language": "en",
            "validity_start": now_iso(), "validity_end": None,
            "targeting": {"all": True, "zone_ids": [], "dealer_ids": []},
            "status": "active", "featured_until": None, "created_at": now_iso()
        }
        await db.creatives.insert_one(creative)
        
        variants = [
            {"label": "WhatsApp Status", "width": 1080, "height": 1920, "file_url": "https://images.unsplash.com/photo-1703680325701-c2e7e03824a3?w=1080"},
            {"label": "Instagram Post", "width": 1080, "height": 1080, "file_url": "https://images.unsplash.com/photo-1758061115348-831ae14a801e?w=1080"}
        ]
        for v in variants:
            variant = {"id": generate_id(), "creative_id": creative["id"], "brand_id": brand["id"], **v, "file_type": "image/jpeg", "created_at": now_iso()}
            await db.creative_variants.insert_one(variant)
    
    # Create slip templates
    templates = [
        {"name": "Minimal Bottom", "position": "bottom", "max_w_pct": 100, "max_h_pct": 15, "allowed_fields": ["shop_name", "phone", "qr"], "style_preset": "minimal", "bg_style": "light"},
        {"name": "Standard Footer", "position": "bottom", "max_w_pct": 100, "max_h_pct": 20, "allowed_fields": ["shop_name", "phone", "address", "qr"], "style_preset": "standard", "bg_style": "dark"}
    ]
    
    for t in templates:
        template = {"id": generate_id(), "brand_id": brand["id"], **t, "is_active": True, "created_at": now_iso()}
        await db.slip_templates.insert_one(template)
    
    return {"message": "Seed data created", "brand_id": brand["id"], "admin_phone": admin["phone"]}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "BrandSlip API V2", "version": "2.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
