from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.user import User, UserRole
from app.core.security import get_password_hash
import random

def init_db():
    db = SessionLocal()
    
    existing_users = db.query(User).count()
    if existing_users > 5: 
        print("Database already initialized, skipping...")
        db.close()
        return
    
    print("Initializing database with test data...")
    
    admin = User(
        email="admin@test.com",
        password_hash=get_password_hash("admin123"),
        full_name="Admin Adminov",
        phone_number="+79009999999",
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(admin)
    
    courier_names = [
        "Роман Богданов", "Степан Воробьев", "Глеб Федоров", "Тимур Михайлов", "Арсений Беляев",
        "Ярослав Тарасов", "Лев Белов", "Марк Комаров", "Федор Егоров", "Вадим Соловьев"
    ]
    
    for i, name in enumerate(courier_names, 1):
        courier = User(
            email=f"courier{i}@test.com",
            password_hash=get_password_hash("courier123"),
            full_name=name,
            phone_number=f"+7900{random.randint(1000000, 9999999)}",
            role=UserRole.COURIER,
            is_active=True
        )
        db.add(courier)
    
    client_names = [
        "Артем Соколов", "Дарья Лебедева", "Максим Козлов", "Виктория Новикова", "Егор Павлов",
        "Полина Орлова", "Кирилл Зайцев", "Алиса Крылова", "Денис Фомин", "Ксения Виноградова"
    ]
    
    for i, name in enumerate(client_names, 1):
        client = User(
            email=f"client{i}@test.com",
            password_hash=get_password_hash("client123"),
            full_name=name,
            phone_number=f"+7900{random.randint(1000000, 9999999)}",
            role=UserRole.CLIENT,
            is_active=True
        )
        db.add(client)
    
    db.commit()
    
    print(f"Создано пользователей: {1 + len(courier_names) + len(client_names)} (1 админ, 10 курьеров, 10 клиентов)")
    print("\nТестовые аккаунты:")
    print("  Admin: admin@test.com / admin123")
    print("  Courier1: courier1@test.com / courier123")
    print("  Client1: client1@test.com / client123")
    
    db.close()

if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    init_db()