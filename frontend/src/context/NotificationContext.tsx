import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const API_URL = 'http://localhost:8000/api/v1';

interface Notification { id: string; message: string; read: boolean; time?: string; }

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const playSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.log('Звук заблокирован браузером до первого клика', e);
  }
};

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API_URL}/notifications/`, { headers: { Authorization: `Bearer ${token}` } });
      const formatted = res.data.map((n: any) => ({
        id: n.id.toString(),
        message: n.message,
        read: n.read,
        time: n.created_at ? new Date(n.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '',
      }));
      
      setNotifications(prev => {
        const prevUnreadIds = prev.filter(n => !n.read).map(n => n.id);
        const newUnread = formatted.filter((n: any) => !n.read && !prevUnreadIds.includes(n.id));
        
        if (newUnread.length > 0) {
          playSound();
        }
        return formatted;
      });
    } catch (e) {
      console.error('Ошибка уведомлений', e);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const t = setInterval(fetchNotifications, 5000); 
    return () => clearInterval(t);
  }, [token]);

  const addNotification = async (message: string) => {
    try {
      await axios.post(`${API_URL}/notifications/`, { message }, { headers: { Authorization: `Bearer ${token}` } });
      await fetchNotifications();
    } catch (e) {}
  };

  const markAsRead = async (id: string) => {
    try {
      await axios.put(`${API_URL}/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
      await fetchNotifications();
    } catch (e) {}
  };

  const clearAll = async () => {
    try {
      await axios.delete(`${API_URL}/notifications/clear`, { headers: { Authorization: `Bearer ${token}` } });
      setNotifications([]);
    } catch (e) {}
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, markAsRead, clearAll, unreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}