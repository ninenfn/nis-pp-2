import sys
import os
import warnings
warnings.filterwarnings("ignore")

sys.path.insert(0, '/app')
os.chdir('/app')

sys.modules['app'] = type(sys)('app')
sys.modules['app'].__path__ = ['/app']

import importlib.util
spec = importlib.util.spec_from_file_location("main", "/app/main.py")
main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(main)

app = main.app

import pytest
from fastapi.testclient import TestClient

client = TestClient(app)

tokens = {}


class TestHealth:
    """Тесты health-check"""
    
    def test_health(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "healthy"}
    
    def test_root(self):
        response = client.get("/")
        assert response.status_code == 200
        assert response.json()["name"] == "AeroBag API"
        assert response.json()["version"] == "1.0.0"
    
    def test_docs(self):
        response = client.get("/docs")
        assert response.status_code == 200
    
    def test_redoc(self):
        response = client.get("/redoc")
        assert response.status_code == 200
    
    def test_openapi(self):
        response = client.get("/openapi.json")
        assert response.status_code == 200
        assert "paths" in response.json()


class TestAuth:
    """Тесты аутентификации"""
    
    def test_register_new_user(self):
        import random
        email = f"test_user_{random.randint(10000, 99999)}@test.com"
        response = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "test123",
            "full_name": "Test User",
            "phone_number": "+79001234567",
            "role": "client"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == email
        assert data["full_name"] == "Test User"
        assert data["role"] == "client"
    
    def test_register_existing_email(self):
        response = client.post("/api/v1/auth/register", json={
            "email": "client1@test.com",
            "password": "test123",
            "full_name": "Test User",
            "role": "client"
        })
        assert response.status_code == 400
    
    def test_login_client(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "client1@test.com",
            "password": "client123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        tokens["client"] = data["access_token"]
    
    def test_login_courier(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "courier1@test.com",
            "password": "courier123"
        })
        assert response.status_code == 200
        data = response.json()
        tokens["courier"] = data["access_token"]
    
    def test_login_admin(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "admin@test.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        tokens["admin"] = data["access_token"]
    
    def test_login_wrong_password(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "client1@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "nonexistent@test.com",
            "password": "test123"
        })
        assert response.status_code == 401


class TestUsers:
    """Тесты управления пользователями"""
    
    def test_get_me_client(self):
        response = client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "client1@test.com"
        assert data["role"] == "client"
    
    def test_get_me_courier(self):
        response = client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {tokens.get('courier')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "courier"
    
    def test_get_me_admin(self):
        response = client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {tokens.get('admin')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
    
    def test_get_me_unauthorized(self):
        response = client.get("/api/v1/users/me")
        assert response.status_code == 401
    
    def test_update_me(self):
        response = client.put("/api/v1/users/me", json={
            "full_name": "Updated Name",
            "phone_number": "+79009999999"
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "Updated Name"
    
    def test_list_users_as_admin(self):
        response = client.get("/api/v1/users/", headers={
            "Authorization": f"Bearer {tokens.get('admin')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0
    
    def test_list_users_as_client(self):
        response = client.get("/api/v1/users/", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 403


class TestOrders:
    """Тесты заказов"""
    
    created_order_id = None
    
    def test_create_order(self):
        response = client.post("/api/v1/orders/", json={
            "flight_number": "TEST123",
            "baggage_description": "Test baggage",
            "airport_code": "SVO",
            "delivery_address": "Test address, 123",
            "delivery_price": 1500.00
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["flight_number"] == "TEST123"
        assert data["status"] == "created"
        assert data["payment_status"] == "pending"
        TestOrders.created_order_id = data["id"]
    
   
    def test_get_my_orders_as_client(self):
        response = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_orders_as_courier(self):
        response = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('courier')}"
        })
        assert response.status_code == 200
    
    def test_get_orders_as_admin(self):
        response = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('admin')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_orders_unauthorized(self):
        response = client.get("/api/v1/orders/")
        assert response.status_code == 401
    
    def test_get_single_order(self):
        if not TestOrders.created_order_id:
            self.test_create_order()
        
        response = client.get(f"/api/v1/orders/{TestOrders.created_order_id}", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == TestOrders.created_order_id
    
    def test_get_nonexistent_order(self):
        response = client.get("/api/v1/orders/99999", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 404
    
    def test_update_order_payment(self):
        if not TestOrders.created_order_id:
            self.test_create_order()
        
        response = client.put(f"/api/v1/orders/{TestOrders.created_order_id}", json={
            "payment_status": "paid"
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["payment_status"] == "paid"
        assert data["status"] == "awaiting_courier"
    
    def test_cancel_order(self):
        # Создаём новый заказ для отмены
        response = client.post("/api/v1/orders/", json={
            "flight_number": "CANCEL123",
            "airport_code": "DME",
            "delivery_address": "Cancel address",
            "delivery_price": 1000.00
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        order_id = response.json()["id"]
        
        response = client.delete(f"/api/v1/orders/{order_id}", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
    
    def test_get_order_history(self):
        if not TestOrders.created_order_id:
            self.test_create_order()
        
        response = client.get(f"/api/v1/orders/{TestOrders.created_order_id}/history", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestDocuments:
    """Тесты документов"""
    
    def test_list_documents_empty(self):
        # Берём существующий заказ клиента
        orders_resp = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        orders = orders_resp.json()
        if len(orders) == 0:
            pytest.skip("No orders available")
        
        order_id = orders[0]["id"]
        response = client.get(f"/api/v1/documents/{order_id}", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 200
        
    def test_get_upload_url(self):
        # Берём существующий заказ клиента
        orders_resp = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        orders = orders_resp.json()
        if len(orders) == 0:
            # Создаём новый заказ
            create_resp = client.post("/api/v1/orders/", json={
                "flight_number": "DOCTEST",
                "airport_code": "SVO",
                "delivery_address": "Test address",
                "delivery_price": 1500.00
            }, headers={
                "Authorization": f"Bearer {tokens.get('client')}"
            })
            order_id = create_resp.json()["id"]
        else:
            order_id = orders[0]["id"]
        
        response = client.post(
            f"/api/v1/documents/upload-url/{order_id}?document_type=baggage_photo&file_name=test.jpg&mime_type=image/jpeg",
            headers={"Authorization": f"Bearer {tokens.get('client')}"}
        )
        assert response.status_code == 200
    
    def test_documents_access_denied(self):
        # Чужой заказ
        response = client.get("/api/v1/documents/999", headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        assert response.status_code == 404


class TestCourierActions:
    """Тесты действий курьера"""
    
    def test_courier_can_see_assigned_orders(self):
        response = client.get("/api/v1/orders/", headers={
            "Authorization": f"Bearer {tokens.get('courier')}"
        })
        assert response.status_code == 200
    
    def test_courier_cannot_access_other_orders(self):
        # Создаём заказ от клиента
        create_resp = client.post("/api/v1/orders/", json={
            "flight_number": "COURIER123",
            "airport_code": "VKO",
            "delivery_address": "Test",
            "delivery_price": 2000.00
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        order_id = create_resp.json()["id"]
        
        # Курьер пытается получить доступ (не назначен)
        response = client.get(f"/api/v1/orders/{order_id}", headers={
            "Authorization": f"Bearer {tokens.get('courier')}"
        })
        assert response.status_code == 403


class TestAdminActions:
    """Тесты действий администратора"""
    
    def test_admin_can_see_all_users(self):
        response = client.get("/api/v1/users/", headers={
            "Authorization": f"Bearer {tokens.get('admin')}"
        })
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 5
    
    def test_admin_can_deactivate_user(self):
        # Сначала создаём пользователя
        import random
        email = f"to_deactivate_{random.randint(10000, 99999)}@test.com"
        create_resp = client.post("/api/v1/auth/register", json={
            "email": email,
            "password": "test123",
            "full_name": "To Deactivate",
            "role": "client"
        }, headers={
            "Authorization": f"Bearer {tokens.get('admin')}"
        })
        
        if create_resp.status_code == 201:
            user_id = create_resp.json()["id"]
            
            response = client.put(f"/api/v1/users/{user_id}/deactivate", headers={
                "Authorization": f"Bearer {tokens.get('admin')}"
            })
            assert response.status_code == 200
    
    def test_admin_can_cancel_any_order(self):
        # Создаём заказ
        create_resp = client.post("/api/v1/orders/", json={
            "flight_number": "ADMINCANCEL",
            "airport_code": "SVO",
            "delivery_address": "Test",
            "delivery_price": 1000.00
        }, headers={
            "Authorization": f"Bearer {tokens.get('client')}"
        })
        
        if create_resp.status_code == 201:
            order_id = create_resp.json()["id"]
            
            response = client.delete(f"/api/v1/orders/{order_id}", headers={
                "Authorization": f"Bearer {tokens.get('admin')}"
            })
            assert response.status_code == 200


class TestEdgeCases:
    """Тесты граничных случаев"""
    
    def test_invalid_token(self):
        response = client.get("/api/v1/users/me", headers={
            "Authorization": "Bearer invalid_token_here"
        })
        assert response.status_code == 401
    
    def test_expired_token(self):
        # Токен с истёкшим сроком
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
        response = client.get("/api/v1/users/me", headers={
            "Authorization": f"Bearer {expired_token}"
        })
        assert response.status_code == 401
    
    def test_sql_injection_attempt(self):
        response = client.post("/api/v1/auth/login", data={
            "username": "' OR '1'='1",
            "password": "' OR '1'='1"
        })
        assert response.status_code == 401
    
    def test_xss_attempt(self):
        response = client.post("/api/v1/auth/register", json={
            "email": "<script>alert('xss')</script>@test.com",
            "password": "test123",
            "full_name": "<img src=x onerror=alert(1)>",
            "role": "client"
        })
        assert response.status_code == 422 or response.status_code == 400