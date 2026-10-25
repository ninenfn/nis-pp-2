from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_admin_user
from app.models.log import SystemLog

router = APIRouter(prefix="/logs", tags=["Logs"])

class LogResponse(BaseModel):
    id: int
    level: str
    message: str
    user_id: int | None
    ip_address: str | None
    created_at: datetime

@router.get("/", response_model=List[LogResponse])
def get_logs(
    limit: int = 100,
    current_user = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    logs = db.query(SystemLog).order_by(SystemLog.created_at.desc()).limit(limit).all()
    return logs