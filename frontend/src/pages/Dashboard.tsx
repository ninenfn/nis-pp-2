import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';

const API_URL = 'http://localhost:8000/api/v1';

interface Order {
  id: number;
  flight_number: string;
  status: string;
  delivery_address: string;
  delivery_price: number;
  created_at: string;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  created: { label: 'Создан', cls: 'badge-gray' },
  awaiting_courier: { label: 'Ждёт курьера', cls: 'badge-amber' },
  baggage_received: { label: 'Багаж получен', cls: 'badge-blue' },
  in_transit: { label: 'В пути', cls: 'badge-indigo' },
  delivered: { label: 'Доставлен', cls: 'badge-green' },
  cancelled: { label: 'Отменён', cls: 'badge-red' },
};

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/orders/`, { headers: { Authorization: `Bearer ${token}` } });
        setOrders(res.data);
      } finally { setLoading(false); }
    })();
  }, [token]);

  const active = orders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length;
  const delivered = orders.filter(o => o.status === 'delivered').length;

  return (
    <AppLayout title="Главная">
      <PageHeader
        title={`Здравствуйте, ${user?.full_name?.split(' ')[0] || ''}`}
        subtitle={
          user?.role === 'client' ? 'Отслеживайте статус доставки багажа'
          : user?.role === 'courier' ? 'Активные заказы на доставку'
          : 'Управление системой'
        }
        actions={user?.role === 'client' && (
          <button className="btn btn-primary" onClick={() => navigate('/new-order')}>＋ Новый заказ</button>
        )}
      />


      <div className="card-title" style={{ marginBottom: 12 }}>
	  {user?.role === 'client' ? 'Мои заказы' : user?.role === 'courier' ? 'Назначенные заказы' : 'Все заказы в системе'}
	  </div>

      {loading ? <div className="spinner" /> : orders.length === 0 ? (
        <div className="card empty">
          <div className="empty-title">Заказов пока нет</div>
          <div className="text-sm">Создайте первый заказ, чтобы начать.</div>
          {user?.role === 'client' && (
            <button className="btn btn-primary mt-4" onClick={() => navigate('/new-order')}>＋ Создать заказ</button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>№</th><th>Рейс</th><th>Адрес</th><th>Статус</th><th>Сумма</th><th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/order/${o.id}`)}>
                  <td>#{o.id}</td>
                  <td>{o.flight_number}</td>
                  <td className="muted">{o.delivery_address}</td>
                  <td><span className={`badge ${STATUS[o.status]?.cls || 'badge-gray'}`}>{STATUS[o.status]?.label || o.status}</span></td>
                  <td>{Number(o.delivery_price).toLocaleString('ru-RU')} ₽</td>
                  <td className="muted text-sm">{new Date(o.created_at).toLocaleDateString('ru-RU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}