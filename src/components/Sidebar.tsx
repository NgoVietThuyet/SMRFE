import { useState } from 'react';
import {
  LayoutDashboard,
  CalendarPlus,
  Video,
  ClipboardList,
  Settings,
  Video as VideoIcon,
  Search,
  Bell,
  ChevronDown,
  ArrowLeft,
  Menu,
  X,
} from 'lucide-react';
import type { Page } from '@/types';
import { currentUser, notifications } from '@/data';
import { Avatar } from '@/components/Avatar';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'planner', label: 'Meeting Planner', icon: CalendarPlus },
  { id: 'meeting', label: 'Meeting Room', icon: Video },
  { id: 'post-meeting', label: 'Post-Meeting', icon: ClipboardList },
  { id: 'admin', label: 'Admin Settings', icon: Settings },
];

function SidebarContent({ current, onNavigate }: SidebarProps) {
  return (
    <>
      <div className="px-5 py-5 border-b border-ink-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
            <VideoIcon size={20} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-ink-900 text-sm leading-tight">Smart Meeting</p>
            <p className="text-xs text-ink-400 leading-tight">Room System</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <p className="px-3 pb-2 text-xs font-semibold text-ink-400 uppercase tracking-wider">Main</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`nav-item w-full ${current === item.id ? 'nav-item-active' : ''}`}
          >
            <item.icon size={18} className="shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.id === 'meeting' && (
              <span className="ml-auto w-2 h-2 bg-error-500 rounded-full animate-pulse-soft shrink-0" />
            )}
          </button>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-ink-100">
        <div className="rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 p-4 border border-primary-100">
          <p className="text-sm font-semibold text-ink-900">AI Credits</p>
          <p className="text-xs text-ink-500 mt-0.5">Transcription & summaries</p>
          <div className="mt-2.5 h-1.5 bg-white rounded-full overflow-hidden">
            <div className="h-full w-[72%] bg-gradient-to-r from-primary-500 to-accent-500 rounded-full" />
          </div>
          <p className="text-xs text-ink-600 mt-1.5">7,200 / 10,000 min</p>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Desktop sidebar — 1:6 ratio */}
      <aside className="hidden md:flex flex-col bg-white border-r border-ink-200 h-screen sticky top-0 md:w-[14.28%] lg:w-[14.28%] min-w-[180px] max-w-[260px]">
        <SidebarContent current={current} onNavigate={onNavigate} />
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-40 w-10 h-10 rounded-lg bg-white border border-ink-200 shadow-sm flex items-center justify-center text-ink-700"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-drawer-overlay" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white shadow-float animate-sidebar-slide flex flex-col h-full">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors z-10"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            <SidebarContent current={current} onNavigate={handleNavigate} />
          </aside>
        </div>
      )}
    </>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  onNavigate: (page: Page) => void;
  onBack: () => void;
  canGoBack: boolean;
  onSignOut: () => void;
}

export function TopBar({ title, subtitle, onBack, canGoBack, onSignOut }: TopBarProps) {
  const [showNotif, setShowNotif] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200 px-4 md:px-8 py-3.5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 md:ml-0 ml-12">
          {canGoBack && (
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900 transition-all active:scale-[0.98] shrink-0"
            >
              <ArrowLeft size={16} />
              <span className="hidden sm:inline">Back</span>
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-base md:text-xl font-bold text-ink-900 truncate">{title}</h1>
            {subtitle && <p className="text-xs md:text-sm text-ink-500 truncate">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="relative hidden lg:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              placeholder="Search meetings, tasks, transcripts..."
              className="w-64 pl-9 pr-3 py-2 text-sm rounded-lg bg-ink-100 border border-transparent focus:bg-white focus:border-primary-300 focus:ring-2 focus:ring-primary-500/10 transition-all"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowNotif(!showNotif); setShowProfile(false); }}
              className="relative p-2 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors"
            >
              <Bell size={20} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-error-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowNotif(false)} />
                <div className="absolute right-0 mt-2 w-72 md:w-80 bg-white rounded-xl shadow-float border border-ink-200 z-20 animate-scale-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink-100 flex items-center justify-between">
                    <span className="font-semibold text-ink-900 text-sm">Notifications</span>
                    <span className="text-xs text-primary-600 font-medium cursor-pointer">Mark all read</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-ink-50 hover:bg-ink-50 transition-colors cursor-pointer ${!n.read ? 'bg-primary-50/40' : ''}`}>
                        <div className="flex items-start gap-2.5">
                          <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${n.type === 'warning' ? 'bg-warning-500' : n.type === 'success' ? 'bg-success-500' : n.type === 'error' ? 'bg-error-500' : 'bg-primary-500'}`} />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink-900">{n.title}</p>
                            <p className="text-xs text-ink-500 mt-0.5">{n.message}</p>
                            <p className="text-xs text-ink-400 mt-1">{n.timestamp}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="relative">
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotif(false); }}
              className="flex items-center gap-2 p-1 pr-2 rounded-lg hover:bg-ink-100 transition-colors"
            >
              <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
              <div className="hidden lg:block text-left">
                <p className="text-sm font-medium text-ink-900 leading-tight">{currentUser.name}</p>
                <p className="text-xs text-ink-400 leading-tight">{currentUser.department}</p>
              </div>
              <ChevronDown size={16} className="text-ink-400 hidden lg:block" />
            </button>
            {showProfile && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowProfile(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-float border border-ink-200 z-20 animate-scale-in overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink-100">
                    <p className="text-sm font-semibold text-ink-900">{currentUser.name}</p>
                    <p className="text-xs text-ink-400">{currentUser.email}</p>
                  </div>
                  <div className="py-1.5">
                    <button className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors">My Profile</button>
                    <button className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors">Meeting History</button>
                    <button className="w-full text-left px-4 py-2 text-sm text-ink-600 hover:bg-ink-50 transition-colors">Preferences</button>
                    <div className="border-t border-ink-100 my-1.5" />
                    <button
                      onClick={onSignOut}
                      className="w-full text-left px-4 py-2 text-sm text-error-600 hover:bg-error-50 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
