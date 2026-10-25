import logging

logger = logging.getLogger(__name__)

def send_notification(user_email: str, message: str):
    """Заглушка уведомлений — пишет в лог"""
    logger.info(f"📧 NOTIFICATION to {user_email}: {message}")
    print(f"📧 [NOTIFICATION] To: {user_email} | {message}")
    
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