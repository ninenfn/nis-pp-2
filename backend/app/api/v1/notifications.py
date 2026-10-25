from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.security import get_current_active_user, get_current_admin_user
from app.models.user import User, UserRole
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class NotificationResponse(BaseModel):
    id: int
    message: str
    read: bool
    created_at: datetime


class NotificationCreate(BaseModel):
    message: str


@router.get("/", response_model=List[NotificationResponse])
def get_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Получить уведомления текущего пользователя"""
    notifications = db.query(Notification).filter(
        Notification.user_id == current_user.id
    ).order_by(Notification.created_at.desc()).limit(50).all()
    return notifications


@router.post("/", response_model=NotificationResponse)
def create_notification(
    data: NotificationCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Создать уведомление для текущего пользователя"""
    notification = Notification(
        user_id=current_user.id,
        message=data.message,
        read=False
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


@router.put("/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Отметить уведомление как прочитанное"""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.read = True
    db.commit()
    return {"message": "Marked as read"}


@router.post("/admin")
def notify_admins(
    data: NotificationCreate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
    for admin in admins:
        notification = Notification(
            user_id=admin.id,
            message=data.message,
            read=False
        )
        db.add(notification)
    db.commit()
    return {"message": f"Notified {len(admins)} admins"}

@router.delete("/clear")
def clear_notifications(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Удалить все уведомления пользователя"""
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"message": "All notifications cleared"}