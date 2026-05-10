import { Home, Search, PlusCircle, Heart, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export default function TabBar() {
  const location = useLocation();

  const tabs = [
    { icon: Home, label: '홈', path: '/app' },
    { icon: Search, label: '검색', path: '/app/search' },
    { icon: PlusCircle, label: '판매', path: '/sell' },
    { icon: Heart, label: '찜', path: '/app/favorites' },
    { icon: User, label: '프로필', path: '/app/profile' },
  ];

  return (
    <nav className="border-t bg-white px-4 py-2 safe-area-bottom">
      <div className="flex justify-around items-center">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.pathname === tab.path ||
            (tab.path === '/app' && location.pathname === '/app');

          return (
            <Link
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center gap-1 py-2"
            >
              <Icon
                size={24}
                className={isActive ? 'text-blue-600' : 'text-gray-400'}
              />
              <span className={`text-xs ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
