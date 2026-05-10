import { Outlet } from 'react-router';

export default function AuthLayout() {
  return (
    <div className="size-full bg-white">
      <Outlet />
    </div>
  );
}
