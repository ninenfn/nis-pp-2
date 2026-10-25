from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional

from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.core.security import get_password_hash, verify_password, create_access_token

class AuthService:
    @staticmethod
    def register_user(db: Session, user_data: UserCreate) -> User:
        if user_data.role != UserRole.CLIENT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Self-registration is allowed only for clients"
            )

        existing_user = db.query(User).filter(User.email == user_data.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        user = User(
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            full_name=user_data.full_name,
            phone_number=user_data.phone_number,
            role=UserRole.CLIENT
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user
    
    @staticmethod
    def login(db: Session, email: str, password: str) -> dict:
        user = AuthService.authenticate_user(db, email, password)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
        return {"access_token": access_token, "token_type": "bearer"}

auth_service = AuthService()