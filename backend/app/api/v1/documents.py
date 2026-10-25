from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, UserRole
from app.models.order import Order
from app.models.document import BaggageDocument, DocumentType
from app.schemas.document import DocumentResponse, DocumentUploadUrl
from app.services.storage import storage

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.post("/upload-url/{order_id}")
def get_upload_url(
    order_id: int,
    document_type: DocumentType,
    file_name: str,
    mime_type: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Только владелец заказа может загружать документы
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    upload_url, file_key = storage.generate_upload_url(file_name, mime_type)
    
    # Создаём запись о документе
    document = BaggageDocument(
        order_id=order_id,
        document_type=document_type,
        file_name=file_name,
        file_key=file_key,
        mime_type=mime_type
    )
    
    db.add(document)
    db.commit()
    db.refresh(document)
    
    return {
        "upload_url": upload_url,
        "file_key": file_key,
        "document_id": document.id
    }


@router.get("/{order_id}", response_model=List[DocumentResponse])
def list_documents(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all documents for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    #владелец, назначенный курьер или админ
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.COURIER and order.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return order.documents


@router.get("/{order_id}/{document_id}/download-url")
def get_download_url(
    order_id: int,
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get presigned URL for file download."""
    document = db.query(BaggageDocument).filter(
        BaggageDocument.id == document_id,
        BaggageDocument.order_id == order_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    
    #владелец, назначенный курьер или админ
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.COURIER and order.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    download_url = storage.generate_download_url(document.file_key)
    return {"download_url": download_url}


@router.delete("/{order_id}/{document_id}")
def delete_document(
    order_id: int,
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a document."""
    document = db.query(BaggageDocument).filter(
        BaggageDocument.id == document_id,
        BaggageDocument.order_id == order_id
    ).first()
    
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    order = db.query(Order).filter(Order.id == order_id).first()
    
    # Только владелец или админ может удалять
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Удаляем из S3
    storage.delete_file(document.file_key)
    
    # Удаляем из БД
    db.delete(document)
    db.commit()
    
    return {"message": "Document deleted"}