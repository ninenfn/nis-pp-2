from pydantic import BaseModel, ConfigDict
from datetime import datetime
from app.models.document import DocumentType

class DocumentBase(BaseModel):
    document_type: DocumentType

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    order_id: int
    file_name: str
    file_key: str
    mime_type: str
    uploaded_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class DocumentUploadUrl(BaseModel):
    upload_url: str
    file_key: str
    expires_in: int = 3600