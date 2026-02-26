import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({
  children,
  title,
  subtitle,
  actions,
  fixedHeight = false
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  fixedHeight?: boolean;
}) {
  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title={title} subtitle={subtitle} actions={actions} />
        <main className={`flex-1 min-h-0 animate-fade-in ${fixedHeight ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-6'}`}>
          {fixedHeight ? <div className="flex-1 min-h-0 p-6 flex flex-col">{children}</div> : children}
        </main>
      </div>
    </div>
  );
}
