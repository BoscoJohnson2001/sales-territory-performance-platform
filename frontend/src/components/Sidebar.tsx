import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NAV: { label: string; to: string; icon: string; roles: string[] }[] = [
  { label: 'Map',           to: '/map',                  icon: '🗺️', roles: ['ADMIN','MANAGEMENT','SALES'] },
  { label: 'Dashboard',    to: '/admin/dashboard',       icon: '📊', roles: ['ADMIN'] },
  { label: 'Dashboard',    to: '/management/dashboard',  icon: '📊', roles: ['MANAGEMENT'] },
  { label: 'My Stats',     to: '/sales/dashboard',       icon: '📊', roles: ['SALES'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const filtered = NAV.filter((n) => user && n.roles.includes(user.role));

  return (
    <aside className="flex flex-col w-[220px] min-h-screen bg-bg-surface border-r border-bg-border flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-bg-border">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-black text-black text-lg shadow-accent flex-shrink-0">P</div>
        <div>
          <p className="text-text-primary text-sm font-bold leading-tight">Pfizer Sales</p>
          <p className="text-text-subtle text-[10px] leading-tight">Intelligence Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
        {filtered.map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({ isActive }) => isActive ? 'nav-item-active' : 'nav-item'}>
            <span className="text-base">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-bg-border px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold">
            {user?.firstName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-text-primary text-xs font-semibold truncate">{user?.firstName} {user?.lastName}</p>
            <p className="text-text-subtle text-[10px] truncate">{user?.role}</p>
          </div>
        </div>
        <button id="logout-btn" onClick={() => { logout(); navigate('/login'); }}
          className="btn-secondary w-full justify-center text-xs py-1.5">
          Sign Out
        </button>
      </div>
    </aside>
  );
}
