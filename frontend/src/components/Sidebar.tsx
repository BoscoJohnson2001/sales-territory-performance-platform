import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HiOutlineMap,
  HiOutlineViewGrid,
  HiOutlineChartBar,
  HiOutlineFlag,
  HiLogout,
  HiChevronLeft,
  HiChevronRight,
} from 'react-icons/hi';
import { IconType } from 'react-icons';

const NAV: { label: string; to: string; icon: IconType; roles: string[] }[] = [
  { label: 'Map', to: '/map', icon: HiOutlineMap, roles: ['ADMIN', 'MANAGEMENT', 'SALES'] },
  { label: 'Dashboard', to: '/admin/dashboard', icon: HiOutlineViewGrid, roles: ['ADMIN'] },
  { label: 'Dashboard', to: '/management/dashboard', icon: HiOutlineViewGrid, roles: ['MANAGEMENT'] },
  { label: 'My Stats', to: '/sales/dashboard', icon: HiOutlineViewGrid, roles: ['SALES'] },
  { label: 'Territory Performance', to: '/territory-performance', icon: HiOutlineChartBar, roles: ['MANAGEMENT', 'SALES'] },
  { label: 'Sales Targets', to: '/management/targets', icon: HiOutlineFlag, roles: ['MANAGEMENT'] },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const filtered = NAV.filter((n) => user && n.roles.includes(user.role));
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className="relative flex flex-col min-h-screen bg-bg-surface border-r border-bg-border flex-shrink-0 transition-all duration-300 ease-in-out"
      style={{ width: collapsed ? '64px' : '220px' }}
    >
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full bg-bg-card border border-bg-border flex items-center justify-center text-text-muted hover:text-accent hover:border-accent/50 transition-all duration-150 shadow-md"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <HiChevronRight className="text-xs" /> : <HiChevronLeft className="text-xs" />}
      </button>

      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-bg-border overflow-hidden">
        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center font-black text-black text-lg shadow-accent flex-shrink-0">
          P
        </div>
        <div
          className="transition-all duration-300 overflow-hidden whitespace-nowrap"
          style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
        >
          <p className="text-text-primary text-sm font-bold leading-tight">Pfizer Sales</p>
          <p className="text-text-subtle text-[10px] leading-tight">Intelligence Platform</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-1 px-2 py-4 flex-1">
        {filtered.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              `${isActive ? 'nav-item-active' : 'nav-item'} ${collapsed ? 'justify-center px-0' : ''} overflow-hidden`
            }
          >
            <item.icon className="text-lg flex-shrink-0" />
            <span
              className="transition-all duration-300 overflow-hidden whitespace-nowrap"
              style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto', marginLeft: collapsed ? 0 : undefined }}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-bg-border px-2 py-4">
        <div className={`flex items-center gap-3 mb-3 ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-sm font-bold flex-shrink-0"
            title={collapsed ? `${user?.firstName} ${user?.lastName}` : undefined}
          >
            {user?.firstName.charAt(0)}
          </div>
          <div
            className="overflow-hidden transition-all duration-300"
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          >
            <p className="text-text-primary text-xs font-semibold truncate whitespace-nowrap">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-text-subtle text-[10px] truncate whitespace-nowrap">{user?.role}</p>
          </div>
        </div>
        <button
          id="logout-btn"
          onClick={() => { logout(); navigate('/login'); }}
          title={collapsed ? 'Sign Out' : undefined}
          className={`btn-secondary w-full text-xs py-1.5 flex items-center gap-2 ${collapsed ? 'justify-center px-0' : 'justify-center'}`}
        >
          <HiLogout className="text-sm flex-shrink-0" />
          <span
            className="transition-all duration-300 overflow-hidden whitespace-nowrap"
            style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          >
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  );
}
