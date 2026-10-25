from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base

class DocumentType(str, enum.Enum):
    BAGGAGE_TAG = "baggage_tag"
    BOARDING_PASS = "boarding_pass"
    BAGGAGE_PHOTO = "baggage_photo"

class BaggageDocument(Base):
    __tablename__ = "baggage_documents"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    
    document_type = Column(Enum(DocumentType), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_key = Column(String(500), nullable=False, unique=True)
    mime_type = Column(String(100), nullable=False)
    
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="documents")

class StatusHistory(Base):
    __tablename__ = "status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum("created", "awaiting_courier", "baggage_received", "in_transit", "delivered", "cancelled", name="status_enum"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="status_history")
    user = relationship("User", foreign_keys=[changed_by])