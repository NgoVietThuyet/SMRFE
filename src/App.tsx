import { useState, useCallback } from 'react';
import type { Page } from '@/types';
import { Login } from '@/components/Login';
import { Sidebar, TopBar } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard';
import { Planner } from '@/pages/Planner';
import { MeetingRoom } from '@/pages/MeetingRoom';
import { PostMeeting } from '@/pages/PostMeeting';
import { Admin } from '@/pages/Admin';

const pageInfo: Record<Page, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Your meetings, tasks, and insights at a glance' },
  planner: { title: 'Meeting Planner', subtitle: 'Schedule, manage, and join meetings' },
  meeting: { title: 'Meeting Room', subtitle: 'Live conference with AI assistance' },
  'post-meeting': { title: 'Post-Meeting', subtitle: 'Tasks, minutes, and reports' },
  admin: { title: 'Admin Settings', subtitle: 'System configuration and management' },
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [page, setPage] = useState<Page>('dashboard');
  const [history, setHistory] = useState<Page[]>([]);

  const navigate = useCallback((next: Page) => {
    setHistory((prev) => [...prev, page]);
    setPage(next);
  }, [page]);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const newHistory = [...prev];
      const prevPage = newHistory.pop()!;
      setPage(prevPage);
      return newHistory;
    });
  }, []);

  const canGoBack = history.length > 0;

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  if (page === 'meeting') {
    return <MeetingRoom onNavigate={navigate} onBack={goBack} canGoBack={canGoBack} />;
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar current={page} onNavigate={navigate} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          title={pageInfo[page].title}
          subtitle={pageInfo[page].subtitle}
          onNavigate={navigate}
          onBack={goBack}
          canGoBack={canGoBack}
          onSignOut={() => setLoggedIn(false)}
        />
        <main className="flex-1">
          {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {page === 'planner' && <Planner onNavigate={navigate} onBack={goBack} canGoBack={canGoBack} />}
          {page === 'post-meeting' && <PostMeeting onNavigate={navigate} onBack={goBack} canGoBack={canGoBack} />}
          {page === 'admin' && <Admin onBack={goBack} canGoBack={canGoBack} />}
        </main>
      </div>
    </div>
  );
}
