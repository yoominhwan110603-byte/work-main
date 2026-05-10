import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, MessageCircle, Heart, Package, AlertCircle } from 'lucide-react';
import { mockNotifications } from '../data/mockData';

export default function NotificationsScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(mockNotifications);

  const getIcon = (type: string) => {
    switch (type) {
      case 'offer':
        return <Package size={20} className="text-blue-600" />;
      case 'chat':
        return <MessageCircle size={20} className="text-green-600" />;
      case 'favorite':
        return <Heart size={20} className="text-red-600" />;
      case 'listing':
        return <Bell size={20} className="text-purple-600" />;
      default:
        return <AlertCircle size={20} className="text-gray-600" />;
    }
  };

  const handleNotificationClick = (notification: typeof mockNotifications[0]) => {
    if (notification.link) {
      navigate(notification.link);
    }
    setNotifications(prev =>
      prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
    );
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR');
  };

  return (
    <div className="size-full bg-white overflow-y-auto">
      <header className="px-4 py-4 border-b sticky top-0 bg-white">
        <h1 className="text-2xl">알림</h1>
      </header>

      {notifications.length > 0 ? (
        <div>
          {notifications.map(notification => (
            <button
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`w-full px-4 py-4 flex gap-3 border-b hover:bg-gray-50 text-left ${
                !notification.isRead ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-1">
                {getIcon(notification.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm mb-1 ${!notification.isRead ? '' : 'text-gray-700'}`}>
                  {notification.title}
                </p>
                <p className="text-sm text-gray-600 mb-2">{notification.message}</p>
                <p className="text-xs text-gray-400">{formatTime(notification.timestamp)}</p>
              </div>
              {!notification.isRead && (
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-600 rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <Bell size={64} className="text-gray-300 mb-4" />
          <h2 className="text-lg text-gray-600 mb-2">알림이 없습니다</h2>
          <p className="text-sm text-gray-500">새로운 소식이 있으면 알려드릴게요</p>
        </div>
      )}
    </div>
  );
}
