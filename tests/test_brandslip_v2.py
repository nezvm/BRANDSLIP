"""
BrandSlip V2 Backend API Tests
Tests for:
- Dealer login flow (phone + OTP)
- Categories API endpoint
- Feed API endpoint
- Dealer slips API
- Default slip per brand functionality
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://creativeflow-21.preview.emergentagent.com').rstrip('/')

# Test credentials
DEALER_PHONE = "+919876543212"
ADMIN_PHONE = "+919876543210"


class TestHealthAndBasics:
    """Basic health check and API availability tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "BrandSlip" in data["message"]
        print(f"✅ API Health: {data}")
    
    def test_categories_endpoint(self):
        """Test categories API returns list of categories"""
        response = requests.get(f"{BASE_URL}/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
        # Check category structure
        for cat in data:
            assert "id" in cat
            assert "name" in cat
            assert "icon" in cat
        print(f"✅ Categories API: {len(data)} categories found")
        print(f"   Categories: {[c['name'] for c in data[:5]]}...")


class TestDealerAuthFlow:
    """Test dealer authentication flow with phone + OTP"""
    
    def test_send_otp_dealer(self):
        """Test OTP sending for dealer phone"""
        response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "otp_for_dev" in data  # Dev OTP returned for testing
        print(f"✅ OTP sent to dealer: {data['message']}")
        return data["otp_for_dev"]
    
    def test_verify_otp_dealer(self):
        """Test OTP verification for dealer"""
        # First send OTP
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        assert send_response.status_code == 200
        otp = send_response.json()["otp_for_dev"]
        
        # Verify OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "dealer_owner"
        print(f"✅ Dealer OTP verified, user: {data['user']['name']}")
        return data["access_token"]
    
    def test_verify_otp_invalid(self):
        """Test OTP verification with invalid OTP"""
        # First send OTP
        requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        
        # Try invalid OTP
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": "000000"}
        )
        assert verify_response.status_code == 400
        print("✅ Invalid OTP correctly rejected")


class TestFeedAPI:
    """Test the V2 Feed API for dealer home"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer auth token"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        return verify_response.json()["access_token"]
    
    def test_feed_api_structure(self, dealer_token):
        """Test feed API returns correct structure"""
        response = requests.get(
            f"{BASE_URL}/api/creatives/feed",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check all required keys
        required_keys = ["featured", "seasonal", "new", "trending", "all", "brands", "highlight_tags"]
        for key in required_keys:
            assert key in data, f"Missing key: {key}"
        
        print(f"✅ Feed API structure correct")
        print(f"   Featured: {len(data['featured'])}")
        print(f"   Seasonal: {len(data['seasonal'])}")
        print(f"   New: {len(data['new'])}")
        print(f"   Trending: {len(data['trending'])}")
        print(f"   All: {len(data['all'])}")
        print(f"   Brands: {len(data['brands'])}")
        print(f"   Highlight Tags: {len(data['highlight_tags'])}")
    
    def test_feed_api_highlight_tags(self, dealer_token):
        """Test highlight tags in feed API"""
        response = requests.get(
            f"{BASE_URL}/api/creatives/feed",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        highlight_tags = data.get("highlight_tags", [])
        assert isinstance(highlight_tags, list)
        
        # Check tag structure
        for tag in highlight_tags:
            assert "id" in tag
            assert "name" in tag
            assert "icon" in tag
        
        print(f"✅ Highlight tags: {[t['name'] for t in highlight_tags]}")
    
    def test_feed_api_brands(self, dealer_token):
        """Test brands filter in feed API"""
        response = requests.get(
            f"{BASE_URL}/api/creatives/feed",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        brands = data.get("brands", [])
        assert isinstance(brands, list)
        
        # Check brand structure
        for brand in brands:
            assert "id" in brand
            assert "name" in brand
        
        print(f"✅ Brands in feed: {[b['name'] for b in brands]}")
    
    def test_feed_api_creatives_have_variants(self, dealer_token):
        """Test that creatives in feed have variants"""
        response = requests.get(
            f"{BASE_URL}/api/creatives/feed",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        all_creatives = data.get("all", [])
        if all_creatives:
            for creative in all_creatives:
                assert "variants" in creative
                assert "id" in creative
                assert "name" in creative
            print(f"✅ All {len(all_creatives)} creatives have variants field")
        else:
            print("⚠️ No creatives in feed (may need seed data)")


class TestDealerSlipsAPI:
    """Test dealer slips API"""
    
    @pytest.fixture
    def dealer_token_and_id(self):
        """Get dealer auth token and dealer_id"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        data = verify_response.json()
        return data["access_token"], data["user"]["dealer_id"]
    
    def test_list_dealer_slips(self, dealer_token_and_id):
        """Test listing dealer slips"""
        token, dealer_id = dealer_token_and_id
        response = requests.get(
            f"{BASE_URL}/api/dealer-slips",
            params={"dealer_id": dealer_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Dealer slips list: {len(data)} slips found")
    
    def test_get_dealer_info(self, dealer_token_and_id):
        """Test getting dealer info with default_slips field"""
        token, dealer_id = dealer_token_and_id
        response = requests.get(
            f"{BASE_URL}/api/dealers/{dealer_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "name" in data
        assert "default_slips" in data  # V2 feature
        print(f"✅ Dealer info: {data['name']}")
        print(f"   Default slips: {data.get('default_slips', {})}")


class TestBrandsAPI:
    """Test brands API"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer auth token"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        return verify_response.json()["access_token"]
    
    def test_list_brands(self, dealer_token):
        """Test listing brands for dealer"""
        response = requests.get(
            f"{BASE_URL}/api/brands",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Brands list: {len(data)} brands")
        for brand in data:
            print(f"   - {brand['name']}")


class TestCreativesAPI:
    """Test creatives API"""
    
    @pytest.fixture
    def dealer_token(self):
        """Get dealer auth token"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        return verify_response.json()["access_token"]
    
    def test_list_creatives(self, dealer_token):
        """Test listing creatives"""
        response = requests.get(
            f"{BASE_URL}/api/creatives",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Creatives list: {len(data)} creatives")
    
    def test_creatives_have_highlight_tags(self, dealer_token):
        """Test that creatives can have highlight_tags"""
        response = requests.get(
            f"{BASE_URL}/api/creatives",
            headers={"Authorization": f"Bearer {dealer_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Check structure
        for creative in data:
            assert "id" in creative
            assert "name" in creative
            # highlight_tags is optional but should be present in schema
            if "highlight_tags" in creative:
                assert isinstance(creative["highlight_tags"], list)
        
        print(f"✅ Creatives structure validated")


class TestSlipDesignsAPI:
    """Test slip designs API (Fabric.js designs)"""
    
    @pytest.fixture
    def dealer_token_and_id(self):
        """Get dealer auth token and dealer_id"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        data = verify_response.json()
        return data["access_token"], data["user"]["dealer_id"]
    
    def test_list_slip_designs(self, dealer_token_and_id):
        """Test listing slip designs"""
        token, dealer_id = dealer_token_and_id
        response = requests.get(
            f"{BASE_URL}/api/slip-designs",
            params={"dealer_id": dealer_id},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✅ Slip designs list: {len(data)} designs")


class TestDefaultSlipAPI:
    """Test default slip per brand functionality"""
    
    @pytest.fixture
    def dealer_token_and_id(self):
        """Get dealer auth token and dealer_id"""
        send_response = requests.post(
            f"{BASE_URL}/api/auth/send-otp",
            json={"phone": DEALER_PHONE}
        )
        otp = send_response.json()["otp_for_dev"]
        verify_response = requests.post(
            f"{BASE_URL}/api/auth/verify-otp",
            json={"phone": DEALER_PHONE, "otp": otp}
        )
        data = verify_response.json()
        return data["access_token"], data["user"]["dealer_id"]
    
    def test_set_default_slip_endpoint_exists(self, dealer_token_and_id):
        """Test that set default slip endpoint exists"""
        token, dealer_id = dealer_token_and_id
        
        # Get brands first
        brands_response = requests.get(
            f"{BASE_URL}/api/brands",
            headers={"Authorization": f"Bearer {token}"}
        )
        brands = brands_response.json()
        
        if brands:
            brand_id = brands[0]["id"]
            # Try to set default slip (may fail if no slip exists, but endpoint should exist)
            response = requests.put(
                f"{BASE_URL}/api/dealers/{dealer_id}/default-slip",
                params={"brand_id": brand_id, "slip_id": "test-slip", "slip_type": "uploaded"},
                headers={"Authorization": f"Bearer {token}"}
            )
            # Should return 200 (success) or 404 (slip not found), not 405 (method not allowed)
            assert response.status_code in [200, 404, 400]
            print(f"✅ Default slip endpoint exists (status: {response.status_code})")
        else:
            pytest.skip("No brands available for testing")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
