import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex h-screen bg-bg-base overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title={title} subtitle={subtitle} />
        <main className="flex-1 overflow-y-auto p-6 animate-fade-in">{children}</main>
      </div>
    </div>
  );
}
