import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';

const API_URL = 'http://localhost:8000/api/v1';

const AIRPORTS = [
  { code: 'SVO', name: 'Шереметьево' },
  { code: 'DME', name: 'Домодедово' },
  { code: 'VKO', name: 'Внуково' },
];

export default function NewOrder() {
  const [formData, setFormData] = useState({
    flight_number: '', baggage_description: '', airport_code: 'SVO', delivery_address: '', delivery_price: '',
  });
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const recommended = () => {
    const base = 1000;
    if (formData.airport_code === 'SVO') return base + 500;
    if (formData.airport_code === 'DME') return base + 300;
    return base;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await axios.post(`${API_URL}/orders/`, {
        ...formData, delivery_price: parseFloat(formData.delivery_price) || 0,
      }, { headers: { Authorization: `Bearer ${token}` } });
      addNotification(`Создан заказ #${res.data.id}`);
      navigate(`/order/${res.data.id}`);
    } catch (err: any) {
      alert(`Ошибка: ${err.response?.data?.detail || 'не удалось создать заказ'}`);
    } finally { setLoading(false); }
  };

  return (
    <AppLayout title="Новый заказ">
      <PageHeader title="Новый заказ" subtitle="Укажите данные рейса и адрес доставки" />

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Номер рейса</label>
            <input className="form-control" placeholder="SU1234"
              value={formData.flight_number}
              onChange={e => setFormData({ ...formData, flight_number: e.target.value.toUpperCase() })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Аэропорт</label>
            <select className="form-control" value={formData.airport_code}
              onChange={e => setFormData({ ...formData, airport_code: e.target.value })}>
              {AIRPORTS.map(a => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Описание багажа</label>
            <textarea className="form-control" placeholder="Чемодан, цвет, особые приметы"
              value={formData.baggage_description}
              onChange={e => setFormData({ ...formData, baggage_description: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Адрес доставки</label>
            <input className="form-control" placeholder="Город, улица, дом, квартира"
              value={formData.delivery_address}
              onChange={e => setFormData({ ...formData, delivery_address: e.target.value })} required />
          </div>

          <div className="form-group">
            <label className="form-label">Стоимость доставки, ₽</label>
            <input type="number" className="form-control"
              value={formData.delivery_price}
              onChange={e => setFormData({ ...formData, delivery_price: e.target.value })} required />
            <div className="row mt-2 text-sm muted">
              <span>Рекомендуемая цена: {recommended()} ₽</span>
              <button type="button" className="btn btn-outline btn-sm"
                onClick={() => setFormData({ ...formData, delivery_price: String(recommended()) })}>
                Применить
              </button>
            </div>
          </div>

          <div className="row mt-4">
            <button type="button" className="btn btn-outline" onClick={() => navigate('/')}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Создание…' : 'Создать заказ'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}