from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, UploadFile, File, Form, Query
from fastapi.responses import FileResponse, StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', secrets.token_hex(32))
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = 60 * 24  # 24 hours in minutes
REFRESH_TOKEN_EXPIRE = 60 * 24 * 30  # 30 days in minutes

# S3 Configuration
S3_BUCKET = os.environ.get('S3_BUCKET', 'brandslip-assets')
S3_ENDPOINT = os.environ.get('S3_ENDPOINT', None)
S3_ACCESS_KEY = os.environ.get('S3_ACCESS_KEY', None)
S3_SECRET_KEY = os.environ.get('S3_SECRET_KEY', None)
USE_S3 = S3_ACCESS_KEY is not None

# Local storage fallback
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)
(UPLOAD_DIR / 'creatives').mkdir(exist_ok=True)
(UPLOAD_DIR / 'slips').mkdir(exist_ok=True)
(UPLOAD_DIR / 'logos').mkdir(exist_ok=True)
(UPLOAD_DIR / 'rendered').mkdir(exist_ok=True)

# SendGrid Configuration
SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'noreply@brandslip.com')

app = FastAPI(title="BrandSlip API")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

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

class DealerBrandLink(BaseModel):
    brand_id: str
    status: str = "pending"
    zone_id: Optional[str] = None

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
    created_at: str

class CreativeCreate(BaseModel):
    brand_id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    language: str = "en"
    category: str = "general"
    validity_start: Optional[str] = None
    validity_end: Optional[str] = None
    targeting: dict = {"all": True, "zone_ids": [], "dealer_ids": []}

class CreativeResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    brand_id: str
    name: str
    description: Optional[str] = None
    tags: List[str] = []
    language: str
    category: str
    validity_start: Optional[str] = None
    validity_end: Optional[str] = None
    targeting: dict
    status: str = "active"
    created_at: str
    variants: List[dict] = []

class CreativeVariantCreate(BaseModel):
    creative_id: str
    brand_id: str
    label: str
    width: int
    height: int
    file_type: str = "image/png"

class CreativeVariantResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    creative_id: str
    brand_id: str
    file_url: str
    file_type: str
    width: int
    height: int
    label: str
    created_at: str

class SlipTemplateCreate(BaseModel):
    brand_id: str
    name: str
    position: str = "bottom"  # top, bottom, left, right, corner
    max_w_pct: int = 100
    max_h_pct: int = 20
    allowed_fields: List[str] = ["shop_name", "phone", "logo", "qr"]
    style_preset: str = "standard"  # minimal, standard, detailed
    bg_style: str = "light"  # light, dark, transparent

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

class DealerSlipCreate(BaseModel):
    dealer_id: str
    brand_id: str
    name: str

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
    slip_mode: str = "template"  # template or dealer_slip
    slip_template_id: Optional[str] = None
    dealer_slip_id: Optional[str] = None
    dealer_id: str
    qr_type: Optional[str] = None  # whatsapp, maps, custom
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

class EventCreate(BaseModel):
    brand_id: str
    dealer_id: Optional[str] = None
    user_id: Optional[str] = None
    type: str
    meta: dict = {}

# ==================== UTILITIES ====================

def generate_id() -> str:
    return str(uuid.uuid4())

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=6))

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

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

# File storage utilities
async def save_file(file: UploadFile, folder: str) -> str:
    file_id = generate_id()
    ext = Path(file.filename).suffix or '.png'
    filename = f"{file_id}{ext}"
    
    if USE_S3:
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY
        )
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
        s3_client = boto3.client(
            's3',
            endpoint_url=S3_ENDPOINT,
            aws_access_key_id=S3_ACCESS_KEY,
            aws_secret_access_key=S3_SECRET_KEY
        )
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
    """Send OTP to phone number (via email for MVP)"""
    otp = generate_otp()
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    await db.otps.update_one(
        {"phone": request.phone},
        {"$set": {"otp": otp, "expires": expires.isoformat(), "attempts": 0}},
        upsert=True
    )
    
    # For MVP, log OTP (in production, send via SMS/Email)
    logger.info(f"OTP for {request.phone}: {otp}")
    
    # Try to send email if user has email
    user = await db.users.find_one({"phone": request.phone}, {"_id": 0})
    if user and user.get("email") and SENDGRID_API_KEY:
        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail
            message = Mail(
                from_email=SENDER_EMAIL,
                to_emails=user["email"],
                subject="Your BrandSlip OTP",
                html_content=f"<h2>Your OTP is: {otp}</h2><p>Valid for 10 minutes.</p>"
            )
            sg = SendGridAPIClient(SENDGRID_API_KEY)
            sg.send(message)
        except Exception as e:
            logger.error(f"SendGrid error: {e}")
    
    return {"message": "OTP sent successfully", "otp_for_dev": otp}

@api_router.post("/auth/verify-otp", response_model=TokenResponse)
async def verify_otp(request: OTPVerify):
    """Verify OTP and return JWT tokens"""
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
    
    # Delete OTP after successful verification
    await db.otps.delete_one({"phone": request.phone})
    
    # Find or create user
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
            "created_at": now_iso()
        }
        await db.users.insert_one(user)
    
    access_token = create_token({"sub": user["id"], "role": user["role"]}, ACCESS_TOKEN_EXPIRE)
    refresh_token = create_token({"sub": user["id"], "type": "refresh"}, REFRESH_TOKEN_EXPIRE)
    
    user_response = {k: v for k, v in user.items() if k != "_id"}
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=user_response
    )

@api_router.post("/auth/refresh")
async def refresh_token(refresh_token: str):
    """Refresh access token"""
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
    """Get current user profile"""
    return UserResponse(**user)

# ==================== USER ENDPOINTS ====================

@api_router.put("/users/profile")
async def update_profile(
    name: str = Form(None),
    email: str = Form(None),
    user: dict = Depends(get_auth_header())
):
    """Update user profile"""
    updates = {}
    if name:
        updates["name"] = name
    if email:
        updates["email"] = email
    if updates:
        updates["status"] = "active"
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0})
    return updated

@api_router.get("/users", response_model=List[UserResponse])
async def list_users(brand_id: str = None, role: str = None, user: dict = Depends(get_auth_header())):
    """List users (admin only)"""
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
    """Create a new user (admin only)"""
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
        "created_at": now_iso()
    }
    await db.users.insert_one(user)
    return UserResponse(**user)

# ==================== BRAND ENDPOINTS ====================

@api_router.post("/brands", response_model=BrandResponse)
async def create_brand(brand: BrandCreate, user: dict = Depends(get_auth_header())):
    """Create a new brand"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    brand_doc = {
        "id": generate_id(),
        **brand.model_dump(),
        "settings": {"dealer_auto_approve": False, "slip_approval_required": True, "max_upload_size_mb": 10},
        "created_at": now_iso()
    }
    await db.brands.insert_one(brand_doc)
    
    # Add brand to user's brand_ids
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"brand_ids": brand_doc["id"]}})
    
    return BrandResponse(**brand_doc)

@api_router.get("/brands", response_model=List[BrandResponse])
async def list_brands(user: dict = Depends(get_auth_header())):
    """List brands accessible to user"""
    if user["role"] == UserRole.PLATFORM_ADMIN:
        brands = await db.brands.find({}, {"_id": 0}).to_list(100)
    else:
        brands = await db.brands.find({"id": {"$in": user.get("brand_ids", [])}}, {"_id": 0}).to_list(100)
    return [BrandResponse(**b) for b in brands]

@api_router.get("/brands/{brand_id}", response_model=BrandResponse)
async def get_brand(brand_id: str, user: dict = Depends(get_auth_header())):
    """Get brand details"""
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    return BrandResponse(**brand)

@api_router.put("/brands/{brand_id}/settings")
async def update_brand_settings(brand_id: str, settings: BrandSettings, user: dict = Depends(get_auth_header())):
    """Update brand settings"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.brands.update_one({"id": brand_id}, {"$set": {"settings": settings.model_dump()}})
    brand = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    return brand

# ==================== ZONE ENDPOINTS ====================

@api_router.post("/zones", response_model=ZoneResponse)
async def create_zone(zone: ZoneCreate, user: dict = Depends(get_auth_header())):
    """Create a new zone"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    zone_doc = {
        "id": generate_id(),
        **zone.model_dump(),
        "created_at": now_iso()
    }
    await db.zones.insert_one(zone_doc)
    return ZoneResponse(**zone_doc)

@api_router.get("/zones", response_model=List[ZoneResponse])
async def list_zones(brand_id: str = None, user: dict = Depends(get_auth_header())):
    """List zones"""
    query = {}
    if brand_id:
        query["brand_id"] = brand_id
    if user["role"] == UserRole.ZONAL_MANAGER:
        query["id"] = {"$in": user.get("zone_ids", [])}
    
    zones = await db.zones.find(query, {"_id": 0}).to_list(500)
    return [ZoneResponse(**z) for z in zones]

@api_router.get("/zones/{zone_id}", response_model=ZoneResponse)
async def get_zone(zone_id: str, user: dict = Depends(get_auth_header())):
    """Get zone details"""
    zone = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return ZoneResponse(**zone)

@api_router.put("/zones/{zone_id}")
async def update_zone(zone_id: str, zone: ZoneCreate, user: dict = Depends(get_auth_header())):
    """Update zone"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.zones.update_one({"id": zone_id}, {"$set": zone.model_dump()})
    updated = await db.zones.find_one({"id": zone_id}, {"_id": 0})
    return updated

@api_router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, user: dict = Depends(get_auth_header())):
    """Delete zone"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.zones.delete_one({"id": zone_id})
    return {"message": "Zone deleted"}

# ==================== DEALER ENDPOINTS ====================

@api_router.post("/dealers", response_model=DealerResponse)
async def create_dealer(dealer: DealerCreate, brand_id: str = None, user: dict = Depends(get_auth_header())):
    """Create/register dealer"""
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
        "created_at": now_iso()
    }
    await db.dealers.insert_one(dealer_doc)
    
    # Link user to dealer
    await db.users.update_one({"id": user["id"]}, {"$set": {"dealer_id": dealer_doc["id"]}})
    
    return DealerResponse(**dealer_doc)

@api_router.get("/dealers", response_model=List[DealerResponse])
async def list_dealers(
    brand_id: str = None,
    zone_id: str = None,
    status: str = None,
    user: dict = Depends(get_auth_header())
):
    """List dealers"""
    query = {}
    
    if brand_id:
        query["brand_links.brand_id"] = brand_id
    if zone_id:
        query["brand_links.zone_id"] = zone_id
    if status:
        query["brand_links.status"] = status
    
    # Zonal managers can only see dealers in their zones
    if user["role"] == UserRole.ZONAL_MANAGER:
        query["brand_links.zone_id"] = {"$in": user.get("zone_ids", [])}
    
    dealers = await db.dealers.find(query, {"_id": 0}).to_list(1000)
    return [DealerResponse(**d) for d in dealers]

@api_router.get("/dealers/{dealer_id}", response_model=DealerResponse)
async def get_dealer(dealer_id: str, user: dict = Depends(get_auth_header())):
    """Get dealer details"""
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    return DealerResponse(**dealer)

@api_router.put("/dealers/{dealer_id}")
async def update_dealer(dealer_id: str, dealer: DealerCreate, user: dict = Depends(get_auth_header())):
    """Update dealer profile"""
    await db.dealers.update_one({"id": dealer_id}, {"$set": dealer.model_dump()})
    updated = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    return updated

@api_router.post("/dealers/{dealer_id}/logo")
async def upload_dealer_logo(dealer_id: str, file: UploadFile = File(...), user: dict = Depends(get_auth_header())):
    """Upload dealer logo"""
    file_url = await save_file(file, "logos")
    await db.dealers.update_one({"id": dealer_id}, {"$set": {"logo_url": file_url}})
    return {"logo_url": file_url}

@api_router.put("/dealers/{dealer_id}/approve")
async def approve_dealer(
    dealer_id: str,
    brand_id: str,
    zone_id: str = None,
    approve: bool = True,
    user: dict = Depends(get_auth_header())
):
    """Approve or reject dealer for a brand"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = "approved" if approve else "rejected"
    
    await db.dealers.update_one(
        {"id": dealer_id, "brand_links.brand_id": brand_id},
        {"$set": {"brand_links.$.status": status, "brand_links.$.zone_id": zone_id}}
    )
    
    # Log event
    await db.events.insert_one({
        "id": generate_id(),
        "brand_id": brand_id,
        "dealer_id": dealer_id,
        "user_id": user["id"],
        "type": "dealer_approval",
        "meta": {"status": status, "zone_id": zone_id},
        "created_at": now_iso()
    })
    
    dealer = await db.dealers.find_one({"id": dealer_id}, {"_id": 0})
    return dealer

@api_router.post("/dealers/{dealer_id}/join-brand")
async def dealer_join_brand(dealer_id: str, brand_id: str, user: dict = Depends(get_auth_header())):
    """Dealer requests to join a brand"""
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

# ==================== CREATIVE ENDPOINTS ====================

@api_router.post("/creatives", response_model=CreativeResponse)
async def create_creative(creative: CreativeCreate, user: dict = Depends(get_auth_header())):
    """Create a new creative campaign"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    creative_doc = {
        "id": generate_id(),
        **creative.model_dump(),
        "status": "active",
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
    user: dict = Depends(get_auth_header())
):
    """List creatives"""
    query = {"status": "active"}
    
    if brand_id:
        query["brand_id"] = brand_id
    if category:
        query["category"] = category
    if tag:
        query["tags"] = tag
    
    # For dealers, filter by targeting
    if user["role"] in [UserRole.DEALER_OWNER, UserRole.DEALER_STAFF]:
        dealer = await db.dealers.find_one({"id": user.get("dealer_id")}, {"_id": 0})
        if dealer:
            approved_brands = [bl["brand_id"] for bl in dealer.get("brand_links", []) if bl["status"] == "approved"]
            query["brand_id"] = {"$in": approved_brands}
            # TODO: Add targeting filter for zones/dealers
    
    creatives = await db.creatives.find(query, {"_id": 0}).to_list(500)
    
    # Fetch variants for each creative
    for creative in creatives:
        variants = await db.creative_variants.find({"creative_id": creative["id"]}, {"_id": 0}).to_list(20)
        creative["variants"] = variants
    
    return [CreativeResponse(**c) for c in creatives]

@api_router.get("/creatives/{creative_id}", response_model=CreativeResponse)
async def get_creative(creative_id: str, user: dict = Depends(get_auth_header())):
    """Get creative details with variants"""
    creative = await db.creatives.find_one({"id": creative_id}, {"_id": 0})
    if not creative:
        raise HTTPException(status_code=404, detail="Creative not found")
    
    variants = await db.creative_variants.find({"creative_id": creative_id}, {"_id": 0}).to_list(20)
    creative["variants"] = variants
    
    return CreativeResponse(**creative)

@api_router.put("/creatives/{creative_id}")
async def update_creative(creative_id: str, creative: CreativeCreate, user: dict = Depends(get_auth_header())):
    """Update creative"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creatives.update_one({"id": creative_id}, {"$set": creative.model_dump()})
    updated = await db.creatives.find_one({"id": creative_id}, {"_id": 0})
    variants = await db.creative_variants.find({"creative_id": creative_id}, {"_id": 0}).to_list(20)
    updated["variants"] = variants
    return updated

@api_router.delete("/creatives/{creative_id}")
async def delete_creative(creative_id: str, user: dict = Depends(get_auth_header())):
    """Delete creative (soft delete)"""
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
    """Upload a creative variant"""
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
    """Get variant details"""
    variant = await db.creative_variants.find_one({"id": variant_id}, {"_id": 0})
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant

@api_router.delete("/creative-variants/{variant_id}")
async def delete_variant(variant_id: str, user: dict = Depends(get_auth_header())):
    """Delete variant"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.creative_variants.delete_one({"id": variant_id})
    return {"message": "Variant deleted"}

# ==================== SLIP TEMPLATE ENDPOINTS ====================

@api_router.post("/slip-templates", response_model=SlipTemplateResponse)
async def create_slip_template(template: SlipTemplateCreate, user: dict = Depends(get_auth_header())):
    """Create a slip template"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    template_doc = {
        "id": generate_id(),
        **template.model_dump(),
        "is_active": True,
        "created_at": now_iso()
    }
    await db.slip_templates.insert_one(template_doc)
    return SlipTemplateResponse(**template_doc)

@api_router.get("/slip-templates", response_model=List[SlipTemplateResponse])
async def list_slip_templates(brand_id: str = None, user: dict = Depends(get_auth_header())):
    """List slip templates"""
    query = {"is_active": True}
    if brand_id:
        query["brand_id"] = brand_id
    
    templates = await db.slip_templates.find(query, {"_id": 0}).to_list(100)
    return [SlipTemplateResponse(**t) for t in templates]

@api_router.get("/slip-templates/{template_id}", response_model=SlipTemplateResponse)
async def get_slip_template(template_id: str, user: dict = Depends(get_auth_header())):
    """Get slip template details"""
    template = await db.slip_templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return SlipTemplateResponse(**template)

@api_router.put("/slip-templates/{template_id}")
async def update_slip_template(template_id: str, template: SlipTemplateCreate, user: dict = Depends(get_auth_header())):
    """Update slip template"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.slip_templates.update_one({"id": template_id}, {"$set": template.model_dump()})
    updated = await db.slip_templates.find_one({"id": template_id}, {"_id": 0})
    return updated

@api_router.delete("/slip-templates/{template_id}")
async def delete_slip_template(template_id: str, user: dict = Depends(get_auth_header())):
    """Delete slip template (soft delete)"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.slip_templates.update_one({"id": template_id}, {"$set": {"is_active": False}})
    return {"message": "Template deleted"}

# ==================== DEALER SLIP ENDPOINTS ====================

@api_router.post("/dealer-slips")
async def create_dealer_slip(
    dealer_id: str = Form(...),
    brand_id: str = Form(...),
    name: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(get_auth_header())
):
    """Upload a dealer slip"""
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
async def list_dealer_slips(
    dealer_id: str = None,
    brand_id: str = None,
    status: str = None,
    user: dict = Depends(get_auth_header())
):
    """List dealer slips"""
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
    """Approve or reject dealer slip"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    status = "approved" if approve else "rejected"
    await db.dealer_slips.update_one(
        {"id": slip_id},
        {"$set": {"status": status, "reviewed_by": user["id"]}}
    )
    
    slip = await db.dealer_slips.find_one({"id": slip_id}, {"_id": 0})
    return slip

@api_router.delete("/dealer-slips/{slip_id}")
async def delete_dealer_slip(slip_id: str, user: dict = Depends(get_auth_header())):
    """Delete dealer slip"""
    await db.dealer_slips.delete_one({"id": slip_id})
    return {"message": "Slip deleted"}

# ==================== RENDER ENGINE ====================

def generate_qr_code(data: str, size: int = 150) -> Image.Image:
    """Generate QR code image"""
    qr = qrcode.QRCode(version=1, error_correction=qrcode.constants.ERROR_CORRECT_L, box_size=10, border=2)
    qr.add_data(data)
    qr.make(fit=True)
    return qr.make_image(fill_color="black", back_color="white").resize((size, size))

def render_slip_on_creative(
    creative_img: Image.Image,
    slip_template: dict,
    dealer: dict,
    qr_data: str = None
) -> Image.Image:
    """Render slip template onto creative image"""
    from PIL import ImageDraw, ImageFont
    
    result = creative_img.copy()
    draw = ImageDraw.Draw(result)
    
    width, height = result.size
    position = slip_template.get("position", "bottom")
    max_h_pct = slip_template.get("max_h_pct", 20)
    max_w_pct = slip_template.get("max_w_pct", 100)
    bg_style = slip_template.get("bg_style", "light")
    allowed_fields = slip_template.get("allowed_fields", ["shop_name", "phone"])
    
    # Calculate slip dimensions
    slip_height = int(height * max_h_pct / 100)
    slip_width = int(width * max_w_pct / 100)
    
    # Determine slip position
    if position == "bottom":
        slip_x = (width - slip_width) // 2
        slip_y = height - slip_height
    elif position == "top":
        slip_x = (width - slip_width) // 2
        slip_y = 0
    elif position == "left":
        slip_x = 0
        slip_y = (height - slip_height) // 2
    elif position == "right":
        slip_x = width - slip_width
        slip_y = (height - slip_height) // 2
    else:  # corner (bottom-right)
        slip_x = width - slip_width
        slip_y = height - slip_height
    
    # Draw slip background
    if bg_style == "light":
        bg_color = (255, 255, 255, 230)
        text_color = (15, 23, 42)
    elif bg_style == "dark":
        bg_color = (15, 23, 42, 230)
        text_color = (255, 255, 255)
    else:  # transparent
        bg_color = (255, 255, 255, 180)
        text_color = (15, 23, 42)
    
    # Create slip overlay
    slip_overlay = Image.new('RGBA', (slip_width, slip_height), bg_color)
    slip_draw = ImageDraw.Draw(slip_overlay)
    
    # Try to use a nice font, fallback to default
    try:
        font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except:
        font_large = ImageFont.load_default()
        font_small = ImageFont.load_default()
    
    # Layout content
    padding = 15
    current_y = padding
    content_x = padding
    
    # Add QR code if requested
    qr_size = slip_height - 2 * padding
    if qr_data and "qr" in allowed_fields:
        qr_img = generate_qr_code(qr_data, qr_size)
        qr_x = slip_width - qr_size - padding
        slip_overlay.paste(qr_img, (qr_x, padding))
        max_text_width = qr_x - 2 * padding
    else:
        max_text_width = slip_width - 2 * padding
    
    # Add shop name
    if "shop_name" in allowed_fields and dealer.get("name"):
        slip_draw.text((content_x, current_y), dealer["name"], fill=text_color, font=font_large)
        current_y += 30
    
    # Add phone
    if "phone" in allowed_fields and dealer.get("phone"):
        slip_draw.text((content_x, current_y), f"📞 {dealer['phone']}", fill=text_color, font=font_small)
        current_y += 22
    
    # Add WhatsApp
    if "whatsapp" in allowed_fields and dealer.get("whatsapp"):
        slip_draw.text((content_x, current_y), f"💬 {dealer['whatsapp']}", fill=text_color, font=font_small)
        current_y += 22
    
    # Add address
    if "address" in allowed_fields and dealer.get("address"):
        addr = dealer["address"][:40] + "..." if len(dealer.get("address", "")) > 40 else dealer.get("address", "")
        slip_draw.text((content_x, current_y), f"📍 {addr}", fill=text_color, font=font_small)
    
    # Paste slip onto result
    result = result.convert('RGBA')
    result.paste(slip_overlay, (slip_x, slip_y), slip_overlay)
    
    return result.convert('RGB')

def overlay_dealer_slip(creative_img: Image.Image, slip_img: Image.Image, position: str = "bottom", max_h_pct: int = 20) -> Image.Image:
    """Overlay dealer's custom slip onto creative"""
    result = creative_img.copy()
    width, height = result.size
    
    # Calculate target dimensions
    target_height = int(height * max_h_pct / 100)
    aspect = slip_img.width / slip_img.height
    target_width = min(int(target_height * aspect), width)
    
    slip_resized = slip_img.resize((target_width, target_height), Image.Resampling.LANCZOS)
    
    # Position slip
    if position == "bottom":
        x = (width - target_width) // 2
        y = height - target_height
    elif position == "top":
        x = (width - target_width) // 2
        y = 0
    else:
        x = width - target_width
        y = height - target_height
    
    # Paste with alpha if available
    if slip_resized.mode == 'RGBA':
        result = result.convert('RGBA')
        result.paste(slip_resized, (x, y), slip_resized)
        result = result.convert('RGB')
    else:
        result.paste(slip_resized, (x, y))
    
    return result

@api_router.post("/render", response_model=RenderResponse)
async def render_creative(request: RenderRequest, user: dict = Depends(get_auth_header())):
    """Render personalized creative with slip"""
    # Create hash key for caching
    hash_input = f"{request.creative_variant_id}:{request.slip_mode}:{request.slip_template_id}:{request.dealer_slip_id}:{request.dealer_id}:{request.qr_type}:{request.qr_value}"
    hash_key = hashlib.md5(hash_input.encode()).hexdigest()
    
    # Check cache
    existing = await db.rendered_assets.find_one({"hash_key": hash_key}, {"_id": 0})
    if existing:
        # Log view event
        await db.events.insert_one({
            "id": generate_id(),
            "brand_id": existing["brand_id"],
            "dealer_id": request.dealer_id,
            "user_id": user["id"],
            "type": "render_cached",
            "meta": {"rendered_asset_id": existing["id"]},
            "created_at": now_iso()
        })
        return RenderResponse(**existing)
    
    # Get variant
    variant = await db.creative_variants.find_one({"id": request.creative_variant_id}, {"_id": 0})
    if not variant:
        raise HTTPException(status_code=404, detail="Creative variant not found")
    
    # Get dealer
    dealer = await db.dealers.find_one({"id": request.dealer_id}, {"_id": 0})
    if not dealer:
        raise HTTPException(status_code=404, detail="Dealer not found")
    
    # Load creative image
    file_url = variant["file_url"]
    if file_url.startswith("/api/files/"):
        # Local file
        file_path = UPLOAD_DIR / file_url.replace("/api/files/", "")
        creative_img = Image.open(file_path)
    else:
        # Remote URL - download
        import requests
        response = requests.get(file_url)
        creative_img = Image.open(BytesIO(response.content))
    
    # Prepare QR data
    qr_data = None
    if request.qr_type == "whatsapp":
        phone = request.qr_value or dealer.get("whatsapp") or dealer.get("phone")
        qr_data = f"https://wa.me/{phone.replace('+', '').replace(' ', '')}"
    elif request.qr_type == "maps" and dealer.get("address"):
        qr_data = f"https://maps.google.com/?q={dealer['address']}, {dealer['district']}, {dealer['state']}"
    elif request.qr_type == "custom" and request.qr_value:
        qr_data = request.qr_value
    
    # Render based on mode
    if request.slip_mode == "template":
        template = await db.slip_templates.find_one({"id": request.slip_template_id}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Slip template not found")
        
        result_img = render_slip_on_creative(creative_img, template, dealer, qr_data)
    else:
        # Dealer uploaded slip
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
    
    # Save rendered output
    output_buffer = BytesIO()
    result_img.save(output_buffer, format='PNG', quality=95)
    output_buffer.seek(0)
    
    output_url = await save_bytes(output_buffer.getvalue(), "rendered", ".png")
    
    # Create rendered asset record
    rendered_doc = {
        "id": generate_id(),
        "brand_id": variant["brand_id"],
        "dealer_id": request.dealer_id,
        "creative_variant_id": request.creative_variant_id,
        "slip_mode": request.slip_mode,
        "slip_template_id": request.slip_template_id,
        "dealer_slip_id": request.dealer_slip_id,
        "output_url": output_url,
        "hash_key": hash_key,
        "created_at": now_iso()
    }
    await db.rendered_assets.insert_one(rendered_doc)
    
    # Log event
    await db.events.insert_one({
        "id": generate_id(),
        "brand_id": variant["brand_id"],
        "dealer_id": request.dealer_id,
        "user_id": user["id"],
        "type": "render_generated",
        "meta": {"rendered_asset_id": rendered_doc["id"]},
        "created_at": now_iso()
    })
    
    return RenderResponse(**rendered_doc)

# ==================== DOWNLOAD & SHARE ====================

@api_router.get("/download/{asset_id}")
async def download_asset(asset_id: str, user: dict = Depends(get_auth_header())):
    """Download rendered asset"""
    asset = await db.rendered_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Log download event
    await db.events.insert_one({
        "id": generate_id(),
        "brand_id": asset["brand_id"],
        "dealer_id": asset["dealer_id"],
        "user_id": user["id"],
        "type": "download",
        "meta": {"rendered_asset_id": asset_id},
        "created_at": now_iso()
    })
    
    file_url = asset["output_url"]
    if file_url.startswith("/api/files/"):
        file_path = UPLOAD_DIR / file_url.replace("/api/files/", "")
        return FileResponse(file_path, media_type="image/png", filename=f"creative_{asset_id}.png")
    else:
        # Redirect to S3 URL
        return {"download_url": file_url}

@api_router.post("/share/{asset_id}")
async def create_share_link(asset_id: str, user: dict = Depends(get_auth_header())):
    """Create shareable link for asset"""
    asset = await db.rendered_assets.find_one({"id": asset_id}, {"_id": 0})
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Create share token
    share_token = secrets.token_urlsafe(16)
    await db.share_links.insert_one({
        "id": generate_id(),
        "token": share_token,
        "asset_id": asset_id,
        "brand_id": asset["brand_id"],
        "dealer_id": asset["dealer_id"],
        "created_at": now_iso(),
        "clicks": 0
    })
    
    return {"share_token": share_token, "share_url": f"/s/{share_token}"}

@api_router.get("/s/{token}")
async def track_share_click(token: str):
    """Track share link click and redirect to download"""
    share_link = await db.share_links.find_one({"token": token}, {"_id": 0})
    if not share_link:
        raise HTTPException(status_code=404, detail="Share link not found")
    
    # Increment click count
    await db.share_links.update_one({"token": token}, {"$inc": {"clicks": 1}})
    
    # Log event
    await db.events.insert_one({
        "id": generate_id(),
        "brand_id": share_link["brand_id"],
        "dealer_id": share_link["dealer_id"],
        "user_id": None,
        "type": "share_clicked",
        "meta": {"share_token": token},
        "created_at": now_iso()
    })
    
    asset = await db.rendered_assets.find_one({"id": share_link["asset_id"]}, {"_id": 0})
    if asset:
        return {"download_url": asset["output_url"]}
    
    raise HTTPException(status_code=404, detail="Asset not found")

# ==================== ANALYTICS ====================

@api_router.get("/analytics/brand/{brand_id}")
async def get_brand_analytics(brand_id: str, user: dict = Depends(get_auth_header())):
    """Get brand analytics"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Count dealers
    dealer_count = await db.dealers.count_documents({"brand_links.brand_id": brand_id})
    active_dealers = await db.dealers.count_documents({"brand_links.brand_id": brand_id, "brand_links.status": "approved"})
    pending_dealers = await db.dealers.count_documents({"brand_links.brand_id": brand_id, "brand_links.status": "pending"})
    
    # Count creatives
    creative_count = await db.creatives.count_documents({"brand_id": brand_id, "status": "active"})
    
    # Count events
    downloads = await db.events.count_documents({"brand_id": brand_id, "type": "download"})
    renders = await db.events.count_documents({"brand_id": brand_id, "type": "render_generated"})
    shares = await db.events.count_documents({"brand_id": brand_id, "type": "share_clicked"})
    
    # Top performing creatives
    pipeline = [
        {"$match": {"brand_id": brand_id, "type": "download"}},
        {"$lookup": {"from": "rendered_assets", "localField": "meta.rendered_asset_id", "foreignField": "id", "as": "asset"}},
        {"$unwind": "$asset"},
        {"$group": {"_id": "$asset.creative_variant_id", "downloads": {"$sum": 1}}},
        {"$sort": {"downloads": -1}},
        {"$limit": 5}
    ]
    top_creatives = await db.events.aggregate(pipeline).to_list(5)
    
    return {
        "dealers": {"total": dealer_count, "active": active_dealers, "pending": pending_dealers},
        "creatives": creative_count,
        "downloads": downloads,
        "renders": renders,
        "shares": shares,
        "top_creatives": top_creatives
    }

@api_router.get("/analytics/zone/{zone_id}")
async def get_zone_analytics(zone_id: str, user: dict = Depends(get_auth_header())):
    """Get zone analytics"""
    if user["role"] not in [UserRole.PLATFORM_ADMIN, UserRole.BRAND_SUPER_ADMIN, UserRole.ZONAL_MANAGER]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get dealers in zone
    dealers = await db.dealers.find({"brand_links.zone_id": zone_id}, {"_id": 0, "id": 1}).to_list(1000)
    dealer_ids = [d["id"] for d in dealers]
    
    downloads = await db.events.count_documents({"dealer_id": {"$in": dealer_ids}, "type": "download"})
    renders = await db.events.count_documents({"dealer_id": {"$in": dealer_ids}, "type": "render_generated"})
    
    return {
        "dealer_count": len(dealer_ids),
        "downloads": downloads,
        "renders": renders
    }

@api_router.get("/analytics/dealer/{dealer_id}")
async def get_dealer_analytics(dealer_id: str, user: dict = Depends(get_auth_header())):
    """Get dealer analytics"""
    downloads = await db.events.count_documents({"dealer_id": dealer_id, "type": "download"})
    renders = await db.events.count_documents({"dealer_id": dealer_id, "type": "render_generated"})
    shares = await db.events.count_documents({"dealer_id": dealer_id, "type": "share_clicked"})
    
    # Recent activity
    recent = await db.events.find(
        {"dealer_id": dealer_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        "downloads": downloads,
        "renders": renders,
        "shares": shares,
        "recent_activity": recent
    }

# ==================== FILE SERVING ====================

@api_router.get("/files/{folder}/{filename}")
async def serve_file(folder: str, filename: str):
    """Serve uploaded files"""
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
    """Seed demo data for development"""
    # Check if already seeded
    existing = await db.brands.find_one({}, {"_id": 0})
    if existing:
        return {"message": "Database already seeded"}
    
    # Create brand
    brand = {
        "id": generate_id(),
        "name": "Sunrise Electronics",
        "logo": "https://images.unsplash.com/photo-1628760584600-6c31148991e9?w=200",
        "settings": {"dealer_auto_approve": False, "slip_approval_required": True, "max_upload_size_mb": 10},
        "created_at": now_iso()
    }
    await db.brands.insert_one(brand)
    
    # Create admin user
    admin = {
        "id": generate_id(),
        "name": "Brand Admin",
        "phone": "+919876543210",
        "email": "admin@sunrise.com",
        "role": UserRole.BRAND_SUPER_ADMIN,
        "brand_ids": [brand["id"]],
        "dealer_id": None,
        "zone_ids": [],
        "status": "active",
        "created_at": now_iso()
    }
    await db.users.insert_one(admin)
    
    # Create zones
    zones = []
    for zone_name, states in [("North Zone", ["Delhi", "Punjab", "Haryana"]), ("South Zone", ["Karnataka", "Tamil Nadu", "Kerala"])]:
        zone = {
            "id": generate_id(),
            "brand_id": brand["id"],
            "name": zone_name,
            "states": states,
            "districts": [],
            "pincodes": [],
            "created_at": now_iso()
        }
        zones.append(zone)
        await db.zones.insert_one(zone)
    
    # Create zonal manager
    manager = {
        "id": generate_id(),
        "name": "North Zone Manager",
        "phone": "+919876543211",
        "email": "manager@sunrise.com",
        "role": UserRole.ZONAL_MANAGER,
        "brand_ids": [brand["id"]],
        "dealer_id": None,
        "zone_ids": [zones[0]["id"]],
        "status": "active",
        "created_at": now_iso()
    }
    await db.users.insert_one(manager)
    
    # Create dealers
    dealers_data = [
        {"name": "Kumar Electronics", "owner_name": "Raj Kumar", "phone": "+919876543212", "address": "Shop 12, Main Market", "pincode": "110001", "district": "Central Delhi", "state": "Delhi"},
        {"name": "Tech World", "owner_name": "Priya Sharma", "phone": "+919876543213", "address": "34 Mall Road", "pincode": "560001", "district": "Bangalore Urban", "state": "Karnataka"}
    ]
    
    dealer_ids = []
    for i, d in enumerate(dealers_data):
        dealer = {
            "id": generate_id(),
            **d,
            "whatsapp": d["phone"],
            "email": None,
            "logo_url": None,
            "brand_links": [{"brand_id": brand["id"], "status": "approved", "zone_id": zones[i]["id"]}],
            "created_at": now_iso()
        }
        dealer_ids.append(dealer["id"])
        await db.dealers.insert_one(dealer)
        
        # Create dealer user
        dealer_user = {
            "id": generate_id(),
            "name": d["owner_name"],
            "phone": d["phone"],
            "email": None,
            "role": UserRole.DEALER_OWNER,
            "brand_ids": [brand["id"]],
            "dealer_id": dealer["id"],
            "zone_ids": [],
            "status": "active",
            "created_at": now_iso()
        }
        await db.users.insert_one(dealer_user)
    
    # Create creatives
    creatives_data = [
        {"name": "Diwali Sale 2024", "description": "Festival special discounts", "tags": ["diwali", "sale", "festival"], "category": "seasonal"},
        {"name": "New Year Offer", "description": "Ring in the new year with savings", "tags": ["newyear", "offer"], "category": "seasonal"}
    ]
    
    for c in creatives_data:
        creative = {
            "id": generate_id(),
            "brand_id": brand["id"],
            **c,
            "language": "en",
            "validity_start": now_iso(),
            "validity_end": None,
            "targeting": {"all": True, "zone_ids": [], "dealer_ids": []},
            "status": "active",
            "created_at": now_iso()
        }
        await db.creatives.insert_one(creative)
        
        # Create variants (using sample images)
        variants = [
            {"label": "WhatsApp Status", "width": 1080, "height": 1920, "file_url": "https://images.unsplash.com/photo-1703680325701-c2e7e03824a3?w=1080"},
            {"label": "Instagram Post", "width": 1080, "height": 1080, "file_url": "https://images.unsplash.com/photo-1758061115348-831ae14a801e?w=1080"}
        ]
        for v in variants:
            variant = {
                "id": generate_id(),
                "creative_id": creative["id"],
                "brand_id": brand["id"],
                **v,
                "file_type": "image/jpeg",
                "created_at": now_iso()
            }
            await db.creative_variants.insert_one(variant)
    
    # Create slip templates
    templates = [
        {"name": "Minimal Bottom", "position": "bottom", "max_w_pct": 100, "max_h_pct": 15, "allowed_fields": ["shop_name", "phone", "qr"], "style_preset": "minimal", "bg_style": "light"},
        {"name": "Standard Footer", "position": "bottom", "max_w_pct": 100, "max_h_pct": 20, "allowed_fields": ["shop_name", "phone", "address", "qr"], "style_preset": "standard", "bg_style": "dark"}
    ]
    
    for t in templates:
        template = {
            "id": generate_id(),
            "brand_id": brand["id"],
            **t,
            "is_active": True,
            "created_at": now_iso()
        }
        await db.slip_templates.insert_one(template)
    
    return {"message": "Seed data created", "brand_id": brand["id"], "admin_phone": admin["phone"]}

# ==================== HEALTH CHECK ====================

@api_router.get("/")
async def root():
    return {"message": "BrandSlip API", "version": "1.0.0"}

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
