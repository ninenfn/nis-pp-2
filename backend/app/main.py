from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import time
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1 import auth, users, orders, documents, notifications, logs, support
from app.models.log import SystemLog
from app.core.init_data import init_db

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc"
)

# tables
Base.metadata.create_all(bind=engine)
init_db()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
 
    try:
        duration = time.time() - start_time
        level = 'WARN' if duration > 0.5 else 'INFO'
        message = f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s"
        
        db = SessionLocal()
        try:
            log = SystemLog(level=level, message=message)
            db.add(log)
            db.commit()
        except Exception as e:
            print(f"DB Log error: {e}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"Logging error: {e}")
    
    return response

# routers
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(users.router, prefix=settings.API_V1_STR)
app.include_router(orders.router, prefix=settings.API_V1_STR)
app.include_router(documents.router, prefix=settings.API_V1_STR)
app.include_router(notifications.router, prefix=settings.API_V1_STR)
app.include_router(logs.router, prefix=settings.API_V1_STR)
app.include_router(support.router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"name": settings.PROJECT_NAME, "version": settings.VERSION, "docs": "/docs"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}