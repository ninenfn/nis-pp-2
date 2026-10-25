import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

export default function AdminTicketList({ onClose, onOpenTicket }: { onClose: () => void, onOpenTicket: (id: number) => void }) {
  const { token, user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTickets = async () => {
    try {
      const [tRes, uRes] = await Promise.all([
        axios.get(`${API_URL}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/users/`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTickets(tRes.data);
      setUsers(uRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, [token]);

  const handleCloseTicket = async (id: number) => {
    if (!confirm('Закрыть этот тикет?')) return;
    try {
      await axios.put(`${API_URL}/support/tickets/${id}/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'closed' } : t));
    } catch { alert('Ошибка'); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ padding: 0, width: '650px', maxWidth: '100%' }}>
        <div className="notif-head" style={{ padding: '16px', background: 'var(--surface)' }}>
          <span>Все обращения (Тикеты)</span>
          <button className="logout-btn" onClick={onClose}>✕</button>
        </div>
        
        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
          {loading ? <div className="spinner" /> : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>ID</th>
                  <th>Клиент</th>
                  <th style={{ width: '120px' }}>Статус</th>
                  <th style={{ width: '200px' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(t => {
                  const u = users.find(x => x.id === t.user_id);
                  
                  let badgeText = 'Закрыт';
                  let badgeCls = 'badge-gray';

                  if (t.status === 'open') {
                    if (t.last_sender_id === user?.id) {
                      badgeText = 'Отвечено';
                      badgeCls = 'badge-indigo';
                    } else {
                      badgeText = 'Ждёт ответа';
                      badgeCls = 'badge-green';
                    }
                  }

                  return (
                    <tr key={t.id}>
                      <td>#{t.id}</td>
                      <td>{u ? u.full_name : `User ${t.user_id}`}</td>
                      <td>
                        <span className={`badge ${badgeCls}`}>
                          {badgeText}
                        </span>
                      </td>
                      <td>
                        <div className="row">
                          <button className="btn btn-primary btn-sm" onClick={() => onOpenTicket(t.id)}>
                            Открыть
                          </button>
                          {t.status === 'open' && (
                            <button className="btn btn-outline btn-sm" onClick={() => handleCloseTicket(t.id)}>
                              Закрыть
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tickets.length === 0 && (
                  <tr><td colSpan={4} className="empty">Тикетов нет</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}