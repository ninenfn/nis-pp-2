from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, UserRole
from app.models.order import Order, OrderStatus, PaymentStatus
from app.models.document import StatusHistory
from app.schemas.order import OrderCreate, OrderResponse, OrderUpdate, StatusHistoryResponse
from app.services.notifications import send_notification
from app.services.logger import log_action

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=OrderResponse, status_code=201)
def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    order = Order(
        user_id=current_user.id,
        flight_number=order_data.flight_number,
        baggage_description=order_data.baggage_description,
        airport_code=order_data.airport_code,
        delivery_address=order_data.delivery_address,
        delivery_price=order_data.delivery_price,
        status=OrderStatus.CREATED,
        payment_status=PaymentStatus.PENDING
    )
    
    db.add(order)
    db.commit()
    db.refresh(order)
    
    history = StatusHistory(
        order_id=order.id,
        status=order.status.value,
        changed_by=current_user.id
    )
    db.add(history)
    db.commit()
    
    # Уведомление всем админам
    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
    for admin in admins:
        send_notification(db, admin.id, f"Создан новый заказ #{order.id}")
    log_action(db, "INFO", f"Создан заказ #{order.id}", current_user.id)
    return order


@router.get("/", response_model=List[OrderResponse])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    status: Optional[OrderStatus] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    
    if current_user.role == UserRole.CLIENT:
        query = query.filter(Order.user_id == current_user.id)
    elif current_user.role == UserRole.COURIER:
        query = query.filter(Order.courier_id == current_user.id)
    
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role == UserRole.COURIER and order.courier_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return order


@router.put("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_update: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    old_status = order.status
    
    # При оплате автоматически переводим в ожидание курьера
    if order_update.payment_status == PaymentStatus.PAID:
        order.payment_status = PaymentStatus.PAID
        order.status = OrderStatus.AWAITING_COURIER
    
    # При назначении курьера проверяем оплату
    if order_update.courier_id is not None:
        if order.payment_status != PaymentStatus.PAID:
            raise HTTPException(status_code=400, detail="Cannot assign courier to unpaid order")
        order.courier_id = order_update.courier_id
        # Уведомление курьеру
        send_notification(db, order_update.courier_id, f"Вас назначили на заказ #{order.id}")
        log_action(db, "INFO", f"Курьер назначен на заказ #{order.id}", current_user.id)
        # Уведомление клиенту
        send_notification(db, order.user_id, f"Курьер назначен на ваш заказ #{order.id}")
        
    if order_update.status is not None:
        order.status = order_update.status
        status_text = {
            'created': 'Создан',
            'awaiting_courier': 'Ожидает курьера',
            'baggage_received': 'Багаж получен',
            'in_transit': 'В пути',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён'
        }.get(order_update.status.value, order_update.status.value)
        
        # Уведомление клиенту
        send_notification(db, order.user_id, f"Статус заказа #{order.id}: {status_text}")
        log_action(db, "INFO", f"Статус заказа #{order.id}: {status_text}", current_user.id)
        
        # Уведомление админам
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            send_notification(db, admin.id, f"Заказ #{order.id}: {status_text}")
            log_action(db, "INFO", f"Заказ #{order.id} оплачен", current_user.id)
            
            
    if order_update.delivery_address is not None:
        order.delivery_address = order_update.delivery_address
        log_action(db, "INFO", f"Заказ #{order.id} доставлен", current_user.id)
    
    db.commit()
    db.refresh(order)
    
    if old_status != order.status:
        history = StatusHistory(
            order_id=order.id,
            status=order.status.value,
            changed_by=current_user.id
        )
        db.add(history)
        db.commit()
    
    return order


@router.delete("/{order_id}")
def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Cancel order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if order.status == OrderStatus.DELIVERED:
        raise HTTPException(status_code=400, detail="Cannot cancel delivered order")
    
    order.status = OrderStatus.CANCELLED
    db.commit()
    
    history = StatusHistory(
        order_id=order.id,
        status=order.status.value,
        changed_by=current_user.id
    )
    db.add(history)
    db.commit()
    
    return {"message": "Order cancelled"}


@router.get("/{order_id}/history", response_model=List[StatusHistoryResponse])
def get_order_history(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get order status history."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if current_user.role == UserRole.CLIENT and order.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return order.status_history