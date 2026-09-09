import { useState, useCallback } from 'react';
import type { Page } from '@/types';
import { useLanguage } from '@/i18n';
import { Login } from '@/components/Login';
import { Sidebar, TopBar } from '@/components/Sidebar';
import { Dashboard } from '@/pages/Dashboard/index';
import { Planner } from '@/pages/Planner/index';
import { MeetingRoom } from '@/pages/MeetingRoom/index';
import { PostMeeting } from '@/pages/PostMeeting/index';
import { Admin } from '@/pages/Admin/index';

export default function App() {
  const { t } = useLanguage();
  const [loggedIn, setLoggedIn] = useState(() => !!localStorage.getItem('token'));
  const [page, setPage] = useState<Page>('dashboard');
  const [history, setHistory] = useState<Page[]>([]);

  const pageInfo: Record<Page, { title: string; subtitle: string }> = {
    dashboard: { title: t('page.dashboard.title'), subtitle: t('page.dashboard.sub') },
    planner: { title: t('page.planner.title'), subtitle: t('page.planner.sub') },
    meeting: { title: t('page.meeting.title'), subtitle: t('page.meeting.sub') },
    'post-meeting': { title: t('page.postMeeting.title'), subtitle: t('page.postMeeting.sub') },
    admin: { title: t('page.admin.title'), subtitle: t('page.admin.sub') },
  };

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
      <Sidebar current={page} onNavigate={navigate} onSignOut={() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userName');
        localStorage.removeItem('fullName');
        setLoggedIn(false);
      }} />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          title={pageInfo[page].title}
          subtitle={pageInfo[page].subtitle}
          onBack={goBack}
          canGoBack={canGoBack}
        />
        <main id="main-content" className="flex-1">
          {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
          {page === 'planner' && <Planner onNavigate={navigate} onBack={goBack} canGoBack={canGoBack} />}
          {page === 'post-meeting' && <PostMeeting onNavigate={navigate} onBack={goBack} canGoBack={canGoBack} />}
          {page === 'admin' && <Admin onBack={goBack} canGoBack={canGoBack} />}
        </main>
      </div>
    </div>
  );
}
