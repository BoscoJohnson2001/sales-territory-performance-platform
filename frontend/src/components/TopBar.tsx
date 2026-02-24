import { useAuth } from '../context/AuthContext';

export default function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  const { user } = useAuth();
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-bg-border bg-bg-surface">
      <div>
        <h1 className="text-text-primary text-xl font-bold">{title}</h1>
        {subtitle && <p className="text-text-muted text-xs mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="status-dot bg-status-high animate-pulse" /> System Online
        </span>
        <div className="h-4 w-px bg-bg-border" />
        <span className="text-xs text-text-muted">{user?.userCode || user?.email}</span>
      </div>
    </header>
  );
}
