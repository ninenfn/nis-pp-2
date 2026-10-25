import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import AppLayout from '../components/AppLayout';
import PageHeader from '../components/PageHeader';

const API_URL = 'http://localhost:8000/api/v1';

const STEPS = [
  { key: 'created', label: 'Создан' },
  { key: 'awaiting_courier', label: 'Ждёт курьера' },
  { key: 'baggage_received', label: 'Багаж получен' },
  { key: 'in_transit', label: 'В пути' },
  { key: 'delivered', label: 'Доставлен' },
];

const STATUS: Record<string, { label: string; cls: string }> = {
  created: { label: 'Создан', cls: 'badge-gray' },
  awaiting_courier: { label: 'Ждёт курьера', cls: 'badge-amber' },
  baggage_received: { label: 'Багаж получен', cls: 'badge-blue' },
  in_transit: { label: 'В пути', cls: 'badge-indigo' },
  delivered: { label: 'Доставлен', cls: 'badge-green' },
  cancelled: { label: 'Отменён', cls: 'badge-red' },
};

const DOC_TYPES: { key: string; label: string }[] = [
  { key: 'baggage_tag', label: 'Багажная квитанция' },
  { key: 'boarding_pass', label: 'Посадочный талон' },
  { key: 'baggage_photo', label: 'Фото багажа' },
];

export default function OrderDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const fetchOrder = async () => {
    const res = await axios.get(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    setOrder(res.data);
  };

  const checkDocs = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const map: Record<string, boolean> = {};
      DOC_TYPES.forEach(d => { map[d.key] = res.data.some((x: any) => x.document_type === d.key); });
      setUploaded(map);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      try { await Promise.all([fetchOrder(), checkDocs()]); }
      finally { setLoading(false); }
    })();
  }, [id, token]);

  const handleFileUpload = async (file: File, docType: string) => {
    setUploading(true);
    try {
      const res = await axios.post(
        `${API_URL}/documents/upload-url/${id}?document_type=${docType}&file_name=${encodeURIComponent(file.name)}&mime_type=${encodeURIComponent(file.type)}`,
        {}, { headers: { Authorization: `Bearer ${token}` } },
      );
      await axios.put(res.data.upload_url, file, { headers: { 'Content-Type': file.type } });
      setUploaded(p => ({ ...p, [docType]: true }));
    } catch { alert('Ошибка загрузки файла'); }
    finally { setUploading(false); }
  };

  const handleDeleteDocument = async (docType: string) => {
    if (!confirm('Удалить документ?')) return;
    try {
      const res = await axios.get(`${API_URL}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const doc = res.data.find((d: any) => d.document_type === docType);
      if (doc) {
        await axios.delete(`${API_URL}/documents/${id}/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } });
        setUploaded(p => ({ ...p, [docType]: false }));
      }
    } catch { alert('Ошибка удаления'); }
  };

  const handlePayment = async () => {
    try {
      await axios.put(`${API_URL}/orders/${id}`, { payment_status: 'paid' }, { headers: { Authorization: `Bearer ${token}` } });
      await fetchOrder();
      addNotification(`Заказ #${id} оплачен`);
    } catch { alert('Ошибка оплаты'); }
  };

  const handleCancel = async () => {
    if (!confirm('Отменить заказ?')) return;
    try {
      await axios.delete(`${API_URL}/orders/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      navigate('/');
    } catch { alert('Ошибка отмены'); }
  };

  const updateStatus = async (status: string) => {
    try {
      await axios.put(`${API_URL}/orders/${id}`, { status }, { headers: { Authorization: `Bearer ${token}` } });
      await fetchOrder();
      addNotification(`Статус заказа #${id}: ${STATUS[status]?.label || status}`);
    } catch { alert('Ошибка обновления статуса'); }
  };

  const viewAllDocs = async () => {
    try {
      const res = await axios.get(`${API_URL}/documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.data.length) return alert('Документы не загружены');
      for (const doc of res.data) {
        const url = await axios.get(`${API_URL}/documents/${id}/${doc.id}/download-url`, { headers: { Authorization: `Bearer ${token}` } });
        window.open(url.data.download_url, '_blank');
      }
    } catch { alert('Не удалось открыть документы'); }
  };

  if (loading) return <AppLayout><div className="spinner" /></AppLayout>;
  if (!order) return <AppLayout><div className="card empty">Заказ не найден</div></AppLayout>;

  const currentStep = STEPS.findIndex(s => s.key === order.status);
  const isCancelled = order.status === 'cancelled';
  const allDocsUploaded = DOC_TYPES.every(d => uploaded[d.key]);

  return (
    <AppLayout title={`Заказ #${order.id}`}>
      <PageHeader
        title={`Заказ #${order.id}`}
        subtitle={`Рейс ${order.flight_number} · ${order.airport_code}`}
        actions={<button className="btn btn-outline" onClick={() => navigate('/')}>← Назад</button>}
      />

      <div className="card">
        <div className="row-between">
          <div>
            <div className="muted text-sm">Сумма заказа</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{Number(order.delivery_price).toLocaleString('ru-RU')} ₽</div>
          </div>
          <div className="row">
            <span className={`badge ${order.payment_status === 'paid' ? 'badge-green' : 'badge-amber'}`}>
              {order.payment_status === 'paid' ? 'Оплачен' : 'Ожидает оплаты'}
            </span>
            <span className={`badge ${STATUS[order.status]?.cls}`}>{STATUS[order.status]?.label}</span>
          </div>
        </div>
      </div>

      {!isCancelled && (
        <div className="card">
          <div className="card-title">Статус доставки</div>
          <div className="progress-track">
            <div className="progress-line"><div className="progress-line-fill" style={{ width: `${(currentStep / (STEPS.length - 1)) * 100}%` }} /></div>
            {STEPS.map((s, i) => (
              <div key={s.key} className="progress-step">
                <div className={`progress-dot ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'current' : ''} ${i === currentStep && i === STEPS.length - 1 ? 'last-step' : ''}`}>{i + 1}</div>
                <div className={`progress-label ${i === currentStep ? 'active' : ''}`}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fef2f2' }}>
          <span className="badge badge-red">Заказ отменён</span>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Информация</div>
          <div className="text-sm" style={{ lineHeight: 1.8 }}>
            <div><span className="muted">Аэропорт:</span> {order.airport_code}</div>
            <div><span className="muted">Адрес:</span> {order.delivery_address}</div>
            {order.baggage_description && <div><span className="muted">Багаж:</span> {order.baggage_description}</div>}
            <div><span className="muted">Создан:</span> {new Date(order.created_at).toLocaleString('ru-RU')}</div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Курьер</div>
          {order.courier ? (
            <div className="text-sm" style={{ lineHeight: 1.8 }}>
              <div>{order.courier.full_name}</div>
              {order.courier.phone_number && <div className="muted">{order.courier.phone_number}</div>}
            </div>
          ) : <div className="text-sm muted">Курьер ещё не назначен</div>}
        </div>
      </div>

      {user?.role !== 'client' && (
        <div className="card">
          <div className="card-title">Документы</div>
          <button className="btn btn-outline" onClick={viewAllDocs}>Открыть документы</button>
        </div>
      )}

      {user?.role === 'client' && order.status === 'created' && (
        <div className="card">
          <div className="card-title">Документы</div>
          <div className="row">
            {DOC_TYPES.map(d => uploaded[d.key] ? (
              <button key={d.key} className="btn btn-outline btn-sm" onClick={() => handleDeleteDocument(d.key)}>
                {d.label} ✓
              </button>
            ) : (
              <label key={d.key} className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                <input type="file" accept="image/*,.pdf" style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0], d.key)}
                  disabled={uploading} />
                {uploading ? 'Загрузка…' : `Загрузить «${d.label}»`}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="row mt-4">
        {user?.role === 'client' && order.status === 'created' && (
          <>
            {allDocsUploaded && order.payment_status !== 'paid' && (
              <button className="btn btn-success" onClick={handlePayment}>Оплатить</button>
            )}
            <button className="btn btn-danger" onClick={handleCancel}>Отменить заказ</button>
          </>
        )}
        {user?.role === 'courier' && order.courier?.id === user.id && (
          <>
            {order.status === 'awaiting_courier' && <button className="btn btn-success" onClick={() => updateStatus('baggage_received')}>Подтвердить получение</button>}
            {order.status === 'baggage_received' && <button className="btn btn-primary" onClick={() => updateStatus('in_transit')}>Начать доставку</button>}
            {order.status === 'in_transit' && <button className="btn btn-success" onClick={() => updateStatus('delivered')}>Доставлено</button>}
          </>
        )}
      </div>
    </AppLayout>
  );
}