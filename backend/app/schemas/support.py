from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional

class MessageCreate(BaseModel):
    text: str

class SupportMessageResponse(BaseModel):
    id: int
    sender_id: int
    text: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TicketResponse(BaseModel):
    id: int
    user_id: int
    status: str
    created_at: datetime
    messages: List[SupportMessageResponse] = []
    last_message: Optional[str] = None
    messages_count: int = 0
    last_sender_id: Optional[int] = None
    model_config = ConfigDict(from_attributes=True)