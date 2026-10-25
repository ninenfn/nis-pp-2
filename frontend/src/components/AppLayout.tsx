import { useState, ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import SupportChat from './SupportChat';
import AdminTicketList from './AdminTicketList';

interface Props {
  children: ReactNode;
  title?: string;
}

function initials(name?: string) {
  if (!name) return '?';
  return name.split(' ').filter(Boolean).map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

export default function AppLayout({ children, title }: Props) {
  const { user, logout, token } = useAuth();
  const { notifications, unreadCount, markAsRead, clearAll } = useNotifications();
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  
  const [showChat, setShowChat] = useState(false);
  const [showTicketList, setShowTicketList] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<number | undefined>(undefined);
  
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { 
    setSidebarOpen(false); 
    setNotifOpen(false); 
  }, [location.pathname]);

  useEffect(() => {
    const handleOpenSupport = (e: any) => {
      setActiveTicketId(e.detail);
      setShowChat(true);
      setShowTicketList(false);
      setChatUnreadCount(0);
    };
    window.addEventListener('open-support', handleOpenSupport);
    return () => window.removeEventListener('open-support', handleOpenSupport);
  }, []);

  useEffect(() => {
    if (!token) return;
    const checkUnreadChats = async () => {
      try {
        const res = await axios.get('http://localhost:8000/api/v1/support/unread-count', { 
          headers: { Authorization: `Bearer ${token}` } 
        });
        setChatUnreadCount(res.data.count);
      } catch (e) {}
    };
    checkUnreadChats();
    const interval = setInterval(checkUnreadChats, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const navItems: { label: string; to: string; icon: string; roles?: string[] }[] = [
    { label: 'Главная', to: '/', icon: '◧' },
    { label: 'Новый заказ', to: '/new-order', icon: '＋', roles: ['client'] },
    { label: 'Доставки', to: '/courier', icon: '▤', roles: ['courier', 'admin'] },
    { label: 'Админ-панель', to: '/admin', icon: '⚙', roles: ['admin'] },
  ];

  const roleLabel = user?.role === 'client' ? 'Клиент' : user?.role === 'courier' ? 'Курьер' : user?.role === 'admin' ? 'Администратор' : '';

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleChatClick = () => {
    setChatUnreadCount(0);
    if (user?.role === 'admin') {
      setShowTicketList(true);
    } else {
      setActiveTicketId(undefined);
      setShowChat(true);
    }
  };

  return (
    <div className="app-shell">
      <div className={`overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="brand-mark">A</span>
          <span>AeroBag</span>
        </div>
        <nav className="sidebar-nav">
          {navItems
            .filter(item => !item.roles || (user && item.roles.includes(user.role)))
            .map(item => {
              const active = location.pathname === item.to;
              return (
                <Link key={item.to} to={item.to} className={`nav-item ${active ? 'active' : ''}`}>
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="avatar">{initials(user?.full_name)}</div>
            <div className="user-chip-meta">
              <div className="user-chip-name">{user?.full_name}</div>
              <div className="user-chip-role">{roleLabel}</div>
            </div>
            <button className="logout-btn" title="Выйти" onClick={handleLogout}>⎋</button>
          </div>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="topbar-title">{title || 'AeroBag'}</div>
          
          <div className="bell-wrap">
            <button className="bell-btn" onClick={() => setNotifOpen(v => !v)}>
              ◔
              {unreadCount > 0 && <span className="bell-count">{unreadCount}</span>}
            </button>
            
            {notifOpen && (
              <div className="notif-panel">
                <div className="notif-head">
                  <span>Уведомления</span>
                  {notifications.length > 0 && (
                    <button className="logout-btn" onClick={clearAll} title="Очистить">✕</button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-item muted">Нет уведомлений</div>
                  ) : notifications.map(n => (
                    <div 
                      key={n.id} 
                      className={`notif-item ${n.read ? '' : 'unread'}`} 
						onClick={() => {
						  markAsRead(n.id);
						  
						  const lowerMsg = n.message.toLowerCase();
						  
						  // Если это про поддержку - открываем чат
						  if (lowerMsg.includes('тикет') || lowerMsg.includes('поддержк')) {
							handleChatClick();
							setNotifOpen(false);
							return;
						  }

						  // Если это про заказ - ищем ID заказа и переходим на него
						  const orderMatch = n.message.match(/#(\d+)/);
						  if (orderMatch && orderMatch[1]) {
							navigate(`/order/${orderMatch[1]}`);
							setNotifOpen(false);
						  }
						}}
                    >
                      <div>{n.message}</div>
                      {n.time && <div className="notif-time">{n.time}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <button className="bell-btn" onClick={handleChatClick} title="Поддержка">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            {chatUnreadCount > 0 && (
              <span className="bell-count" style={{ right: '-4px', top: '-4px' }}>
                {chatUnreadCount}
              </span>
            )}
          </button>
        </header>

        <main className="content">{children}</main>
      </div>

      {showChat && (
        <SupportChat 
          onClose={() => { setShowChat(false); setActiveTicketId(undefined); }} 
          ticketId={activeTicketId} 
        />
      )}

      {showTicketList && (
        <AdminTicketList 
          onClose={() => setShowTicketList(false)} 
          onOpenTicket={(id) => window.dispatchEvent(new CustomEvent('open-support', { detail: id }))} 
        />
      )}
    </div>
  );
}