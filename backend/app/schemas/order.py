from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from app.models.order import OrderStatus, PaymentStatus
from app.schemas.user import UserResponse
from app.schemas.document import DocumentResponse

class OrderBase(BaseModel):
    flight_number: str
    baggage_description: Optional[str] = None
    airport_code: str
    delivery_address: str
    delivery_price: Decimal

class OrderCreate(OrderBase):
    pass

class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    courier_id: Optional[int] = None
    payment_status: Optional[PaymentStatus] = None
    delivery_address: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    user_id: int
    courier_id: Optional[int]
    status: OrderStatus
    payment_status: PaymentStatus
    created_at: datetime
    updated_at: Optional[datetime]
    user: Optional[UserResponse] = None
    courier: Optional[UserResponse] = None
    documents: List[DocumentResponse] = []
    
    model_config = ConfigDict(from_attributes=True)

class StatusHistoryResponse(BaseModel):
    id: int
    order_id: int
    status: str
    changed_by: Optional[int]
    changed_at: datetime
    
    model_config = ConfigDict(from_attributes=True)