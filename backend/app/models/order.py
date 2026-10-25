from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Text, Numeric
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base

class OrderStatus(str, enum.Enum):
    CREATED = "created"
    AWAITING_COURIER = "awaiting_courier"
    BAGGAGE_RECEIVED = "baggage_received"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PAID = "paid"
    REFUNDED = "refunded"

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    status = Column(Enum(OrderStatus), nullable=False, default=OrderStatus.CREATED)
    payment_status = Column(Enum(PaymentStatus), nullable=False, default=PaymentStatus.PENDING)
    
    flight_number = Column(String(20), nullable=False)
    baggage_description = Column(Text, nullable=True)
    airport_code = Column(String(10), nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_price = Column(Numeric(10, 2), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    user = relationship("User", foreign_keys=[user_id], backref="orders")
    courier = relationship("User", foreign_keys=[courier_id], backref="assigned_orders")
    documents = relationship("BaggageDocument", back_populates="order", cascade="all, delete-orphan")
    status_history = relationship("StatusHistory", back_populates="order", cascade="all, delete-orphan")