import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

export default function SupportChat({ onClose, ticketId }: { onClose: () => void, ticketId?: number }) {
  const { token, user } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [ticketUser, setTicketUser] = useState<string>('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchTicket = async () => {
    try {
      const res = await axios.get(`${API_URL}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      
      let currentTicket;
      if (ticketId) {
        currentTicket = res.data.find((t: any) => t.id === ticketId);
      } else if (res.data.length > 0) {
        currentTicket = res.data[0]; 
      } else {
        const newTicket = await axios.post(`${API_URL}/support/tickets`, {}, { headers: { Authorization: `Bearer ${token}` } });
        currentTicket = newTicket.data;
      }
      
      setTicket(currentTicket);

      if (currentTicket && user?.role === 'admin') {
        try {
          const usersRes = await axios.get(`${API_URL}/users/`, { headers: { Authorization: `Bearer ${token}` } });
          const foundUser = usersRes.data.find((u: any) => u.id === currentTicket.user_id);
          if (foundUser) setTicketUser(foundUser.full_name);
        } catch (e) {}
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTicket(); }, [ticketId, token]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [ticket]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !ticket) return;
    try {
      const res = await axios.post(`${API_URL}/support/tickets/${ticket.id}/messages`, { text }, { headers: { Authorization: `Bearer ${token}` } });
      setTicket(res.data);
      setText('');
    } catch (e) { alert('Ошибка отправки'); }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Закрыть этот тикет?')) return;
    try {
      await axios.put(`${API_URL}/support/tickets/${ticket.id}/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchTicket();
    } catch { alert('Ошибка закрытия тикета'); }
  };

  const handleCreateNew = async () => {
    try {
      const res = await axios.post(`${API_URL}/support/tickets`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setTicket(res.data);
    } catch { alert('Ошибка'); }
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <div className="modal-title">Тикет не найден</div>
          <button className="btn btn-primary mt-4" onClick={onClose}>Закрыть</button>
        </div>
      </div>
    );
  }

  const lastMsg = ticket.messages[ticket.messages.length - 1];
  let statusText = 'Открыт';
  let statusCls = 'badge-green';

  if (ticket.status === 'closed') {
    statusText = 'Закрыт';
    statusCls = 'badge-gray';
  } else if (lastMsg && lastMsg.sender_id === user?.id) {
    statusText = user?.role === 'admin' ? 'Отвечено' : 'Ждёт оператора';
    statusCls = 'badge-indigo';
  } else if (lastMsg && lastMsg.sender_id !== user?.id) {
    statusText = user?.role === 'admin' ? 'Ждёт ответа' : 'Есть ответ';
    statusCls = 'badge-green';
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: 0, display: 'flex', flexDirection: 'column', height: '500px' }}>
        <div className="notif-head" style={{ padding: '16px', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: '16px' }}>Поддержка (Тикет #{ticket?.id})</span>
            {user?.role === 'admin' && ticketUser && (
              <div className="text-sm muted" style={{ marginTop: '4px' }}>
                Клиент: {ticketUser}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`badge ${statusCls}`}>
              {statusText}
            </span>
            
            {user?.role === 'admin' && ticket?.status === 'open' && (
              <button className="btn btn-outline btn-sm" onClick={handleCloseTicket}>
                Закрыть
              </button>
            )}
            
            <button className="logout-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', background: 'var(--bg)' }}>
          {ticket?.messages.length === 0 ? (
            <div className="text-sm muted" style={{ textAlign: 'center', marginTop: '20px' }}>
              Ожидайте оператора. Напишите ваш вопрос.
            </div>
          ) : (
            ticket?.messages.map((m: any) => (
              <div key={m.id} style={{
                marginBottom: '12px',
                textAlign: m.sender_id === user?.id ? 'right' : 'left'
              }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  background: m.sender_id === user?.id ? 'var(--accent)' : 'white',
                  color: m.sender_id === user?.id ? 'white' : 'black',
                  border: m.sender_id === user?.id ? 'none' : '1px solid var(--border)',
                  maxWidth: '80%',
                  fontSize: '14px'
                }}>
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {ticket?.status === 'open' ? (
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid var(--border)' }}>
            <input className="form-control" placeholder="Введите сообщение..." value={text} onChange={e => setText(e.target.value)} />
            <button type="submit" className="btn btn-primary">Отправить</button>
          </form>
        ) : (
          <div className="text-sm muted" style={{ padding: '16px', textAlign: 'center', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span>Тикет закрыт. Вы не можете отправлять сообщения.</span>
            {user?.role !== 'admin' && (
              <button className="btn btn-primary" onClick={handleCreateNew}>
                Создать новое обращение
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}