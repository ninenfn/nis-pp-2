from sqlalchemy.orm import Session
from app.models.notification import Notification

def send_notification(db: Session, user_id: int, message: str):
    """Отправить уведомление пользователю"""
    notification = Notification(
        user_id=user_id,
        message=message,
        read=False
    )
    db.add(notification)
    db.commit()