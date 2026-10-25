import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';

const API_URL = 'http://localhost:8000/api/v1';

interface User { id: number; email: string; full_name: string; phone_number: string | null; role: string; is_active: boolean; created_at: string; }
interface Order { id: number; flight_number: string; status: string; payment_status: string; delivery_address: string; delivery_price: number; created_at: string; user: { full_name: string }; courier: { full_name: string } | null; courier_id?: number; documents?: any[]; }
interface Log { id: number; level: string; message: string; created_at: string; }

const STATUS: Record<string, { label: string; cls: string }> = {
  created: { label: 'Создан', cls: 'badge-gray' },
  awaiting_courier: { label: 'Ждёт курьера', cls: 'badge-amber' },
  baggage_received: { label: 'Багаж получен', cls: 'badge-blue' },
  in_transit: { label: 'В пути', cls: 'badge-indigo' },
  delivered: { label: 'Доставлен', cls: 'badge-green' },
  cancelled: { label: 'Отменён', cls: 'badge-red' },
};

export default function AdminDashboard() {
  const { token } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'orders' | 'users' | 'monitoring' | 'support'>('orders');
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', phone_number: '', role: 'client' });
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketFilter, setTicketFilter] = useState<'all' | 'open' | 'closed'>('open');

  const fetchTickets = async () => {
    try {
      const res = await axios.get(`${API_URL}/support/tickets`, { headers: { Authorization: `Bearer ${token}` } });
      setTickets(res.data);
    } catch { /* ignore */ }
  };

  const handleCloseTicket = async (ticketId: number) => {
    if (!confirm('Закрыть этот тикет?')) return;
    try {
      await axios.put(`${API_URL}/support/tickets/${ticketId}/close`, {}, { headers: { Authorization: `Bearer ${token}` } });
      fetchTickets();
    } catch { alert('Ошибка'); }
  };
  
  useEffect(() => { 
    if (tab === 'monitoring') fetchLogs(); 
    if (tab === 'support') fetchTickets();
  }, [tab]);
  
  const fetchData = async () => {
    const [u, o] = await Promise.all([
      axios.get(`${API_URL}/users/?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
      axios.get(`${API_URL}/orders/?limit=100`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    setUsers(u.data); setOrders(o.data);
  };

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_URL}/logs/?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      setLogs(res.data);
    } catch { /* ignore */ }
  };

  useEffect(() => { (async () => { try { await fetchData(); } finally { setLoading(false); } })(); }, []);
  useEffect(() => { if (tab === 'monitoring') fetchLogs(); }, [tab]);

  const couriers = users.filter(u => u.role === 'courier' && u.is_active);
  const busyCourierIds = orders
    .filter(o => !['delivered', 'cancelled'].includes(o.status) && o.courier_id)
    .map(o => o.courier_id);
  const freeCouriers = couriers.filter(c => !busyCourierIds.includes(c.id));

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/auth/register`, newUser, { headers: { Authorization: `Bearer ${token}` } });
      setShowCreate(false);
      setNewUser({ email: '', password: '', full_name: '', phone_number: '', role: 'client' });
      fetchData();
    } catch { alert('Ошибка создания'); }
  };

  const deactivate = async (id: number) => {
    if (!confirm('Деактивировать пользователя?')) return;
    try { await axios.put(`${API_URL}/users/${id}/deactivate`, {}, { headers: { Authorization: `Bearer ${token}` } }); fetchData(); }
    catch { alert('Ошибка'); }
  };

  const cancelOrder = async (id: number) => {
    if (!confirm('Отменить заказ?')) return;
    try { await axios.delete(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } }); fetchData(); }
    catch { alert('Ошибка'); }
  };

  const assignCourier = async (orderId: number, courierId: number) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}`, { courier_id: courierId, status: 'awaiting_courier' }, { headers: { Authorization: `Bearer ${token}` } });
      fetchData();
      addNotification(`Курьер назначен на заказ #${orderId}`);
    } catch { alert('Ошибка'); }
  };

  const openDocs = async (orderId: number) => {
    try {
      const res = await axios.get(`${API_URL}/documents/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.data.length) return alert('Документы не загружены');
      for (const doc of res.data) {
        const url = await axios.get(`${API_URL}/documents/${orderId}/${doc.id}/download-url`, { headers: { Authorization: `Bearer ${token}` } });
        window.open(url.data.download_url, '_blank');
      }
    } catch { alert('Не удалось открыть документы'); }
  };

  const filteredOrders = orders.filter(o =>
    (statusFilter === 'all' || o.status === statusFilter) &&
    (o.id.toString().includes(search) || o.flight_number.toLowerCase().includes(search.toLowerCase()) || o.user?.full_name.toLowerCase().includes(search.toLowerCase()))
  );
  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: orders.length,
    active: orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length,
    users: users.length,
    couriers: couriers.length,
  };

  return (
    <AppLayout title="Админ-панель">
      <PageHeader
        title="Админ-панель"
        subtitle="Управление заказами, пользователями и мониторинг"
        actions={
          <>
            <button className="btn btn-outline" onClick={fetchData}>Обновить</button>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>＋ Пользователь</button>
          </>
        }
      />

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Заказов</div></div>
        <div className="stat-card"><div className="stat-value">{stats.active}</div><div className="stat-label">Активных</div></div>
        <div className="stat-card"><div className="stat-value">{stats.users}</div><div className="stat-label">Пользователей</div></div>
        <div className="stat-card"><div className="stat-value">{stats.couriers}</div><div className="stat-label">Курьеров</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>Заказы</button>
        <button className={`tab ${tab === 'users' ? 'active' : ''}`} onClick={() => setTab('users')}>Пользователи</button>
        <button className={`tab ${tab === 'monitoring' ? 'active' : ''}`} onClick={() => setTab('monitoring')}>Мониторинг</button>
        <button className={`tab ${tab === 'support' ? 'active' : ''}`} onClick={() => setTab('support')}>Поддержка</button>
      </div>

      {(tab === 'orders' || tab === 'users') && (
        <div className="row mb-3">
          <input className="form-control" style={{ maxWidth: 320 }} placeholder="Поиск…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {tab === 'orders' && (
            <select className="form-control" style={{ maxWidth: 200 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">Все статусы</option>
              {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
        </div>
      )}

      {loading ? <div className="spinner" /> : (
        <>
          {tab === 'orders' && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>№</th><th>Рейс</th><th>Клиент</th><th>Курьер</th><th>Статус</th><th>Оплата</th><th>Сумма</th><th>Действия</th></tr></thead>
                <tbody>
                  {filteredOrders.map(o => (
                    <tr key={o.id}>
                      <td><span onClick={() => navigate(`/order/${o.id}`)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>#{o.id}</span></td>
                      <td>{o.flight_number}</td>
                      <td>{o.user?.full_name}</td>
                      <td className="muted">{o.courier?.full_name || '—'}</td>
                      <td><span className={`badge ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.label}</span></td>
                      <td>
                        <span className={`badge ${o.payment_status === 'paid' ? 'badge-green' : 'badge-amber'}`}>
                          {o.payment_status === 'paid' ? 'Оплачен' : o.payment_status === 'pending' ? 'Ожидает' : o.payment_status}
                        </span>
                      </td>
                      <td>{Number(o.delivery_price).toLocaleString('ru-RU')} ₽</td>
                      <td>
                        <div className="row">
                          {o.status === 'awaiting_courier' && o.payment_status === 'paid' && freeCouriers.length > 0 && (
                            <select className="form-control" style={{ width: 140, padding: '4px 8px', fontSize: 12 }}
                              onChange={e => e.target.value && assignCourier(o.id, Number(e.target.value))} defaultValue="">
                              <option value="">Курьер…</option>
                              {freeCouriers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                            </select>
                          )}
                          <button className="btn btn-outline btn-sm" onClick={() => openDocs(o.id)}>Документы</button>
                          {o.status !== 'cancelled' && o.status !== 'delivered' && (
                            <button className="btn btn-outline btn-sm" onClick={() => cancelOrder(o.id)}>Отменить</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'users' && (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>№</th><th>Имя</th><th>Email</th><th>Телефон</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td>#{u.id}</td>
                      <td>{u.full_name}</td>
                      <td className="muted">{u.email}</td>
                      <td className="muted">{u.phone_number || '—'}</td>
                      <td><span className={`badge ${u.role === 'admin' ? 'badge-red' : u.role === 'courier' ? 'badge-indigo' : 'badge-green'}`}>{u.role}</span></td>
                      <td><span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'активен' : 'заблокирован'}</span></td>
                      <td>
                        {u.is_active && u.role !== 'admin' && (
                          <button className="btn btn-outline btn-sm" onClick={() => deactivate(u.id)}>Заблокировать</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'monitoring' && (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Время</th><th>Уровень</th><th>Сообщение</th></tr></thead>
                  <tbody>
                    {logs.map(l => (
                      <tr key={l.id}>
                        <td className="muted text-sm">{new Date(l.created_at).toLocaleString('ru-RU')}</td>
                        <td><span className={`badge ${l.level === 'ERROR' ? 'badge-red' : l.level === 'WARN' ? 'badge-amber' : 'badge-green'}`}>{l.level}</span></td>
                        <td>{l.message}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && <tr><td colSpan={3} className="empty">Логов нет</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="row mt-3">
                <button className="btn btn-outline" onClick={fetchLogs}>Обновить логи</button>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'support' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Тикет</th>
                <th>Клиент</th>
                <th>Сообщений</th>
                <th>Дата</th>
                <th>Статус</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => {
                const ticketUser = users.find(u => u.id === t.user_id);
                return (
                  <tr key={t.id}>
                    <td><strong>#{t.id}</strong></td>
                    <td>{ticketUser ? ticketUser.full_name : `User ${t.user_id}`}</td>
                    <td><span className="badge badge-gray">{t.messages_count || 0}</span></td>
                    <td className="muted text-sm">{new Date(t.created_at).toLocaleString('ru-RU')}</td>
                    <td>
                      <span className={`badge ${t.status === 'open' ? 'badge-green' : 'badge-gray'}`}>
                        {t.status === 'open' ? 'Открыт' : 'Закрыт'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" onClick={() => window.dispatchEvent(new CustomEvent('open-support', { detail: t.id }))}>
                        Открыть чат
                      </button>
                    </td>
                  </tr>
                );
              })}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty">Тикетов нет</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Новый пользователь</div>
            <form onSubmit={createUser}>
              <div className="form-group"><label className="form-label">Email</label>
                <input type="email" className="form-control" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Пароль</label>
                <input type="password" className="form-control" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Полное имя</label>
                <input className="form-control" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} required /></div>
              <div className="form-group"><label className="form-label">Телефон</label>
                <input className="form-control" value={newUser.phone_number} onChange={e => setNewUser({ ...newUser, phone_number: e.target.value })} /></div>
              <div className="form-group"><label className="form-label">Роль</label>
                <select className="form-control" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="client">Клиент</option>
                  <option value="courier">Курьер</option>
                  <option value="admin">Администратор</option>
                </select></div>
              <div className="row mt-4">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary">Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}