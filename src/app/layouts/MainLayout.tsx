import { Outlet } from 'react-router';
import TabBar from '../components/TabBar';

export default function MainLayout() {
  return (
    <div className="size-full flex flex-col bg-white">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <TabBar />
    </div>
  );
}
