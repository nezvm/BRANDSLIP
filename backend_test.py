import requests
import sys
from datetime import datetime
import json

class BrandSlipAPITester:
    def __init__(self, base_url="https://creativeflow-21.preview.emergentagent.com"):
        self.base_url = base_url
        self.admin_token = None
        self.dealer_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.brand_id = None
        self.zone_id = None
        self.dealer_id = None
        self.creative_id = None
        self.slip_template_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return True, response.json() if response.content else {}
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test API health"""
        success, _ = self.run_test("Health Check", "GET", "", 200)
        return success

    def test_seed_data(self):
        """Test seeding demo data"""
        success, response = self.run_test("Seed Data", "POST", "seed", 200)
        if success and response.get('brand_id'):
            self.brand_id = response['brand_id']
            print(f"   Brand ID: {self.brand_id}")
        return success

    def test_admin_login(self):
        """Test admin login flow"""
        # Send OTP
        success, response = self.run_test(
            "Admin Send OTP",
            "POST",
            "auth/send-otp",
            200,
            data={"phone": "+919876543210"}
        )
        
        if not success:
            return False
            
        otp = response.get('otp_for_dev')
        if not otp:
            print("❌ No OTP returned for dev testing")
            return False
            
        print(f"   OTP: {otp}")
        
        # Verify OTP
        success, response = self.run_test(
            "Admin Verify OTP",
            "POST",
            "auth/verify-otp",
            200,
            data={"phone": "+919876543210", "otp": otp}
        )
        
        if success and response.get('access_token'):
            self.admin_token = response['access_token']
            print(f"   Admin logged in successfully")
            return True
        return False

    def test_dealer_login(self):
        """Test dealer login flow"""
        # Send OTP
        success, response = self.run_test(
            "Dealer Send OTP",
            "POST",
            "auth/send-otp",
            200,
            data={"phone": "+919876543212"}
        )
        
        if not success:
            return False
            
        otp = response.get('otp_for_dev')
        if not otp:
            print("❌ No OTP returned for dev testing")
            return False
            
        print(f"   OTP: {otp}")
        
        # Verify OTP
        success, response = self.run_test(
            "Dealer Verify OTP",
            "POST",
            "auth/verify-otp",
            200,
            data={"phone": "+919876543212", "otp": otp}
        )
        
        if success and response.get('access_token'):
            self.dealer_token = response['access_token']
            print(f"   Dealer logged in successfully")
            return True
        return False

    def test_admin_endpoints(self):
        """Test admin-specific endpoints"""
        if not self.admin_token:
            print("❌ No admin token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        # Test brands list
        success, response = self.run_test(
            "List Brands",
            "GET",
            "brands",
            200,
            headers=headers
        )
        
        if success and response and len(response) > 0:
            self.brand_id = response[0]['id']
            print(f"   Found brand: {response[0]['name']}")
        
        # Test zones CRUD
        success, response = self.run_test(
            "Create Zone",
            "POST",
            "zones",
            200,
            data={
                "name": "Test Zone",
                "brand_id": self.brand_id,
                "states": ["Test State"],
                "districts": ["Test District"],
                "pincodes": ["123456"]
            },
            headers=headers
        )
        
        if success and response.get('id'):
            self.zone_id = response['id']
            print(f"   Zone created: {self.zone_id}")
        
        # Test zones list
        success, _ = self.run_test(
            "List Zones",
            "GET",
            f"zones?brand_id={self.brand_id}",
            200,
            headers=headers
        )
        
        # Test dealers list
        success, response = self.run_test(
            "List Dealers",
            "GET",
            f"dealers?brand_id={self.brand_id}",
            200,
            headers=headers
        )
        
        if success and response and len(response) > 0:
            self.dealer_id = response[0]['id']
            print(f"   Found dealer: {response[0]['name']}")
        
        # Test creatives list
        success, response = self.run_test(
            "List Creatives",
            "GET",
            f"creatives?brand_id={self.brand_id}",
            200,
            headers=headers
        )
        
        if success and response and len(response) > 0:
            self.creative_id = response[0]['id']
            print(f"   Found creative: {response[0]['name']}")
        
        # Test slip templates
        success, response = self.run_test(
            "List Slip Templates",
            "GET",
            f"slip-templates?brand_id={self.brand_id}",
            200,
            headers=headers
        )
        
        if success and response and len(response) > 0:
            self.slip_template_id = response[0]['id']
            print(f"   Found slip template: {response[0]['name']}")
        
        return True

    def test_dealer_endpoints(self):
        """Test dealer-specific endpoints"""
        if not self.dealer_token:
            print("❌ No dealer token available")
            return False
            
        headers = {'Authorization': f'Bearer {self.dealer_token}'}
        
        # Test dealer creatives access
        success, response = self.run_test(
            "Dealer List Creatives",
            "GET",
            "creatives",
            200,
            headers=headers
        )
        
        if success:
            print(f"   Dealer can access {len(response)} creatives")
        
        # Test dealer profile
        success, _ = self.run_test(
            "Dealer Profile",
            "GET",
            "auth/me",
            200,
            headers=headers
        )
        
        return success

    def test_analytics(self):
        """Test analytics endpoints"""
        if not self.admin_token or not self.brand_id:
            print("❌ No admin token or brand ID available")
            return False
            
        headers = {'Authorization': f'Bearer {self.admin_token}'}
        
        success, _ = self.run_test(
            "Brand Analytics",
            "GET",
            f"analytics/brand/{self.brand_id}",
            200,
            headers=headers
        )
        
        return success

def main():
    print("🚀 Starting BrandSlip API Tests")
    print("=" * 50)
    
    tester = BrandSlipAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("Seed Data", tester.test_seed_data),
        ("Admin Login", tester.test_admin_login),
        ("Dealer Login", tester.test_dealer_login),
        ("Admin Endpoints", tester.test_admin_endpoints),
        ("Dealer Endpoints", tester.test_dealer_endpoints),
        ("Analytics", tester.test_analytics),
    ]
    
    for test_name, test_func in tests:
        print(f"\n📋 Running {test_name} tests...")
        try:
            success = test_func()
            if not success:
                print(f"❌ {test_name} tests failed - stopping execution")
                break
        except Exception as e:
            print(f"❌ {test_name} tests crashed: {str(e)}")
            break
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if tester.failed_tests:
        print("\n❌ Failed Tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure.get('test', 'Unknown')}: {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())