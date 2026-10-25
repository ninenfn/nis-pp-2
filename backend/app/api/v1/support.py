from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User, UserRole
from app.models.support import SupportTicket, SupportMessage
from app.schemas.support import MessageCreate, TicketResponse
from app.services.notifications import send_notification

router = APIRouter(prefix="/support", tags=["Support"])

@router.post("/tickets", response_model=TicketResponse)
def create_ticket(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    ticket = SupportTicket(user_id=current_user.id, status="open")
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    
    admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
    for admin in admins:
        send_notification(db, admin.id, f"Новый тикет в поддержку от {current_user.full_name}")
    return ticket

@router.get("/tickets", response_model=List[TicketResponse])
def get_tickets(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    query = db.query(SupportTicket)
    if current_user.role != UserRole.ADMIN:
        query = query.filter(SupportTicket.user_id == current_user.id)
        
    tickets = query.order_by(SupportTicket.created_at.desc()).all()
    
    result = []
    for t in tickets:
        last_msg = t.messages[-1] if t.messages else None
        t_dict = {
            "id": t.id,
            "user_id": t.user_id,
            "status": t.status,
            "created_at": t.created_at,
            "messages": t.messages,
            "messages_count": len(t.messages),
            "last_message": last_msg.text if last_msg else "Нет сообщений",
            "last_sender_id": last_msg.sender_id if last_msg else None # <--- ДОБАВИТЬ ЭТО
        }
        result.append(t_dict)
    return result

@router.post("/tickets/{ticket_id}/messages", response_model=TicketResponse)
def send_message(ticket_id: int, data: MessageCreate, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if current_user.role != UserRole.ADMIN and ticket.user_id != current_user.id:
        raise HTTPException(403, "Access denied")

    msg = SupportMessage(ticket_id=ticket.id, sender_id=current_user.id, text=data.text)
    db.add(msg)
    db.commit()
    
    if current_user.role == UserRole.ADMIN:
        send_notification(db, ticket.user_id, f"Ответ поддержки по тикету #{ticket.id}")
    else:
        admins = db.query(User).filter(User.role == UserRole.ADMIN).all()
        for admin in admins:
            send_notification(db, admin.id, f"Новое сообщение в тикете #{ticket.id}")
            
    db.refresh(ticket)
    return ticket
@router.put("/tickets/{ticket_id}/close")
def close_ticket(ticket_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(403, "Только админ может закрывать тикеты")
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    ticket.status = "closed"
    db.commit()
    return {"message": "Ticket closed"}
    
@router.get("/unread-count")
def get_unread_count(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if current_user.role == UserRole.ADMIN:
        tickets = db.query(SupportTicket).filter(SupportTicket.status == "open").all()
        count = sum(1 for t in tickets if t.messages and t.messages[-1].sender_id != current_user.id)
        return {"count": count}
    else:
        tickets = db.query(SupportTicket).filter(SupportTicket.user_id == current_user.id, SupportTicket.status == "open").all()
        count = sum(1 for t in tickets if t.messages and t.messages[-1].sender_id != current_user.id)
        return {"count": count}