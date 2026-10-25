import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [formData, setFormData] = useState({
    email: '', password: '', full_name: '', phone_number: '', role: 'client',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try { await register(formData); navigate('/login'); }
    catch { setError('Ошибка регистрации. Возможно, email уже занят.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand"><span className="brand-mark">A</span><span>AeroBag</span></div>
        <h1 className="auth-title">Регистрация</h1>
        <p className="auth-sub">Создайте аккаунт для заказа доставки</p>

        {error && <div className="badge badge-red mb-3" style={{ display: 'block', padding: '10px 12px' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Полное имя</label>
            <input type="text" className="form-control" placeholder="Иван Петров"
              value={formData.full_name} onChange={e => setFormData({ ...formData, full_name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-control" placeholder="you@example.com"
              value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Телефон</label>
            <input type="tel" className="form-control" placeholder="+7 (900) 123-45-67"
              value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Пароль</label>
            <input type="password" className="form-control" placeholder="••••••••"
              value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">Роль</label>
            <select className="form-control" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
              <option value="client">Клиент</option>
              <option value="courier">Курьер</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>

        <p className="text-sm mt-4" style={{ textAlign: 'center' }}>
          Уже есть аккаунт? <Link to="/login">Войти</Link>
        </p>
      </div>
    </div>
  );
}