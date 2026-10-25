import boto3
from botocore.exceptions import ClientError
from typing import Optional
import uuid
from datetime import datetime, timedelta

from app.core.config import settings

class S3Storage:
    def __init__(self):
        self.client = boto3.client(
            's3',
            endpoint_url=f"{'https' if settings.S3_SECURE else 'http'}://{settings.S3_ENDPOINT}",
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name='us-east-1'
        )
        self.bucket = settings.S3_BUCKET_NAME
        self._ensure_bucket()
    
    def _ensure_bucket(self):
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except ClientError:
            self.client.create_bucket(Bucket=self.bucket)
    
    def generate_upload_url(self, file_name: str, mime_type: str, expires_in: int = 3600) -> tuple[str, str]:
        file_key = f"{uuid.uuid4()}-{file_name}"
        
        url = self.client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket,
                'Key': file_key,
                'ContentType': mime_type
            },
            ExpiresIn=expires_in
        )
        
        # Заменяем внутренний URL на localhost для доступа из браузера
        url = url.replace('minio:9000', 'localhost:9000')
        
        return url, file_key
    
    def generate_download_url(self, file_key: str, expires_in: int = 3600) -> str:
        url = self.client.generate_presigned_url(
            'get_object',
            Params={
                'Bucket': self.bucket,
                'Key': file_key
            },
            ExpiresIn=expires_in
        )
        
        # Заменяем внутренний URL на localhost
        url = url.replace('minio:9000', 'localhost:9000')
        
        return url
    
    def delete_file(self, file_key: str) -> bool:
        try:
            self.client.delete_object(Bucket=self.bucket, Key=file_key)
            return True
        except ClientError:
            return False

storage = S3Storage()