from sqlalchemy.orm import Session
from app.models.log import SystemLog
from fastapi import Request

def log_action(db: Session, level: str, message: str, user_id: int = None, request: Request = None):
    """Записать лог в базу"""
    ip = None
    if request:
        ip = request.client.host if request.client else None
    
    log = SystemLog(
        level=level,
        message=message,
        user_id=user_id,
        ip_address=ip
    )
    db.add(log)
    db.commit()