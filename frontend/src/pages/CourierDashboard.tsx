import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';

const API_URL = 'http://localhost:8000/api/v1';

interface Order {
  id: number; flight_number: string; airport_code: string; delivery_address: string;
  delivery_price: number; status: string; created_at: string; user: { full_name: string };
}

const STATUS: Record<string, { label: string; cls: string }> = {
  awaiting_courier: { label: 'Ждёт получения', cls: 'badge-amber' },
  baggage_received: { label: 'Багаж получен', cls: 'badge-blue' },
  in_transit: { label: 'В пути', cls: 'badge-indigo' },
};

export default function CourierDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  const navigate = useNavigate();

	const fetchOrders = async () => {
	  const res = await axios.get(`${API_URL}/orders/?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
	  setOrders(res.data.filter((o: Order) => 
		!['delivered', 'cancelled', 'created'].includes(o.status)
	  ));
	};

  useEffect(() => { (async () => { try { await fetchOrders(); } finally { setLoading(false); } })(); }, []);

  const updateStatus = async (orderId: number, status: string) => {
    try {
      await axios.put(`${API_URL}/orders/${orderId}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      fetchOrders();
    } catch { alert('Ошибка'); }
  };

  return (
    <AppLayout title="Доставки">
      <PageHeader title="Текущие доставки" subtitle={`Текущих заказов: ${orders.length}`} />
      {loading ? <div className="spinner" /> : orders.length === 0 ? (
        <div className="card empty"><div className="empty-title">Нет активных заказов</div></div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>№</th><th>Рейс</th><th>Адрес</th><th>Клиент</th><th>Статус</th><th>Действие</th></tr></thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id}>
                  <td><span onClick={() => navigate(`/order/${o.id}`)} style={{ cursor: 'pointer', color: 'var(--accent)' }}>#{o.id}</span></td>
                  <td>{o.flight_number}</td>
                  <td className="muted">{o.delivery_address}</td>
                  <td>{o.user?.full_name}</td>
                  <td><span className={`badge ${STATUS[o.status]?.cls || 'badge-gray'}`}>{STATUS[o.status]?.label || o.status}</span></td>
                
					<td>
					  <div className="row">
						{user?.role === 'courier' && o.status === 'awaiting_courier' && (
						  <button className="btn btn-success btn-sm" onClick={() => updateStatus(o.id, 'baggage_received')}>Получено</button>
						)}
						{user?.role === 'courier' && o.status === 'baggage_received' && (
						  <button className="btn btn-primary btn-sm" onClick={() => updateStatus(o.id, 'in_transit')}>В путь</button>
						)}
						{user?.role === 'courier' && o.status === 'in_transit' && (
						  <button className="btn btn-success btn-sm" onClick={() => updateStatus(o.id, 'delivered')}>Доставлено</button>
						)}
						<button className="btn btn-outline btn-sm" onClick={() => navigate(`/order/${o.id}`)}>Открыть</button>
					  </div>
					</td>
				  
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}