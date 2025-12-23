import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../stores/notificationStore';
import type { NotificationItem } from '../stores/notificationStore';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'เมื่อกี้';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays === 1) return 'เมื่อวาน';
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}

function getNotificationIcon(type: string): string {
  switch (type) {
    case 'ROUND_UPCOMING':
      return '📅';
    case 'ROUND_DUE':
      return '📅';
    case 'WINNER_PENDING':
      return '⏰';
    case 'WINNER_RECORDED':
      return '✅';
    case 'GROUP_OPENED':
      return '🎉';
    case 'GROUP_COMPLETED':
      return '🏆';
    default:
      return '🔔';
  }
}

function NotificationItemRow({
  notification,
  onRead,
  onDelete,
  onClick,
}: {
  notification: NotificationItem;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  onClick: (notification: NotificationItem) => void;
}) {
  return (
    <div
      className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
        !notification.isRead ? 'bg-blue-50' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      <div className="flex items-start gap-3">
        <span className="text-lg">{getNotificationIcon(notification.type)}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {!notification.isRead && (
              <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
            )}
            <p className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </p>
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{notification.message}</p>
          <p className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(notification.createdAt)}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="ลบ"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    isOpen,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setOpen,
  } = useNotificationStore();

  // Fetch unread count on mount and periodically
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000); // Every minute
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setOpen]);

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Navigate based on reference type
    if (notification.referenceType === 'round' && notification.referenceId) {
      // Find the group ID from the notifications context or use a default navigation
      setOpen(false);
      // For now, just close the dropdown - could be enhanced to navigate to round
    } else if (notification.referenceType === 'shareGroup' && notification.referenceId) {
      setOpen(false);
      navigate(`/share-groups/${notification.referenceId}`);
    } else {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none"
        title="การแจ้งเตือน"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              การแจ้งเตือน {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">กำลังโหลด...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto mb-2 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <p>ไม่มีการแจ้งเตือน</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <NotificationItemRow
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
