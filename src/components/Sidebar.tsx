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
  ChevronLeft,
  Menu,
  X,
} from 'lucide-react';
import type { Page } from '@/types';
import { currentUser, notifications } from '@/data';
import { Avatar } from '@/components/Avatar';
import { useLanguage } from '@/i18n';
import './Sidebar.css';

interface SidebarProps {
  current: Page;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
}

function FlagIcon({ code }: { code: 'en' | 'vi' }) {
  if (code === 'vi') {
    return (
      <span className="side-flag" aria-hidden="true">
        <svg viewBox="0 0 20 14">
          <rect width="20" height="14" fill="#DA251D" />
          <polygon points="10,3 11.18,6.62 15,6.62 11.91,8.85 13.09,12.48 10,10.24 6.91,12.48 8.09,8.85 5,6.62 8.82,6.62" fill="#FFDE00" />
        </svg>
      </span>
    );
  }
  return (
    <span className="side-flag" aria-hidden="true">
      <svg viewBox="0 0 20 14">
        <rect width="20" height="14" fill="#012169" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#fff" strokeWidth="2.5" />
        <path d="M0,0 L20,14 M20,0 L0,14" stroke="#C8102E" strokeWidth="1.2" />
        <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4" />
        <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

function SidebarFooter({ onSignOut, collapsed, onToggleCollapse }: { onSignOut: () => void; collapsed: boolean; onToggleCollapse: () => void }) {
  const { t, lang, setLang } = useLanguage();
  const [showNotif, setShowNotif] = useState(false);
  const [menuPinned, setMenuPinned] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className={`side-footer${collapsed ? ' side-footer--collapsed' : ''}`}>
      {showNotif && <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />}
      {showNotif && (
        <div role="dialog" aria-label={t('topbar.notif')} className="side-pop">
          <div className="side-pop__head">
            <span className="side-pop__title">{t('topbar.notif')}</span>
            <button type="button" className="text-xs text-cta-700 font-medium hover:underline">{t('topbar.markRead')}</button>
          </div>
          <div className="side-pop__list">
            {notifications.map((n) => (
              <div key={n.id} className="side-notif">
                <span aria-hidden="true" className={`side-notif__dot ${n.type === 'warning' ? 'bg-warning-500' : n.type === 'success' ? 'bg-success-500' : n.type === 'error' ? 'bg-error-500' : 'bg-primary-500'}`} />
                <span className="min-w-0">
                  <span className="side-notif__title">{n.title}</span>
                  <span className="side-notif__msg">{n.message}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="side-account">
        <div className="side-account__user-wrap">
          <button
            type="button"
            onClick={() => setMenuPinned((v) => !v)}
            aria-expanded={menuPinned}
            aria-label={t('topbar.account', { name: currentUser.name })}
            title={currentUser.name}
            className="side-account__user"
          >
            <Avatar name={currentUser.name} color={currentUser.avatarColor} size="sm" />
            {!collapsed && (
              <span className="side-account__info">
                <span className="side-account__name">{currentUser.name}</span>
                <span className="side-account__sub">{currentUser.department}</span>
              </span>
            )}
          </button>
          <div role="menu" aria-label="Account menu" className={`side-pop side-pop--menu${menuPinned ? ' side-pop--pinned' : ''}`}>
            <div className="side-pop__head">
              <span className="side-pop__title">{currentUser.name}</span>
            </div>
            <div className="side-pop__list">
              <button type="button" role="menuitem" className="side-pop__item">{t('topbar.profile')}</button>
              <button type="button" role="menuitem" className="side-pop__item">{t('topbar.history')}</button>
              <button type="button" role="menuitem" className="side-pop__item">{t('topbar.prefs')}</button>
              <button type="button" role="menuitem" onClick={onSignOut} className="side-pop__item side-pop__item--danger">{t('topbar.signOut')}</button>
            </div>
          </div>
        </div>
        <div className={`side-account__actions${collapsed ? ' side-account__actions--col' : ''}`}>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'vi' : 'en')}
            className="side-iconbtn"
            aria-label={t('lang.label')}
            title={t('lang.switchTo')}
          >
            <FlagIcon code={lang === 'en' ? 'en' : 'vi'} />
          </button>
          <button
            type="button"
            onClick={() => setShowNotif((v) => !v)}
            aria-expanded={showNotif}
            aria-label={unread > 0 ? t('topbar.notif.unread', { count: unread }) : t('topbar.notif')}
            title={t('topbar.notif')}
            className="side-iconbtn"
          >
            <Bell size={22} aria-hidden="true" />
            {unread > 0 && <span aria-hidden="true" className="side-badge">{unread}</span>}
          </button>
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-expanded={collapsed}
            aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
            title={collapsed ? t('nav.expand') : t('nav.collapse')}
            className="side-iconbtn"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface SidebarContentProps extends SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function SidebarContent({ current, onNavigate, onSignOut, collapsed, onToggleCollapse }: SidebarContentProps) {
  const { t } = useLanguage();
  const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'planner', label: t('nav.planner'), icon: CalendarPlus },
    { id: 'meeting', label: t('nav.meeting'), icon: Video },
    { id: 'post-meeting', label: t('nav.postMeeting'), icon: ClipboardList },
    { id: 'admin', label: t('nav.admin'), icon: Settings },
  ];
  return (
    <>
      <div className={`border-b border-ink-100 shrink-0 ${collapsed ? 'px-2 py-4 flex justify-center' : 'px-5 py-4'}`}>
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div aria-hidden="true" className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
            <VideoIcon size={22} />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-heading font-bold text-ink-900 text-[17px] leading-tight">Smart Meeting</p>
              <p className="text-[13px] text-ink-500 leading-tight mt-0.5">Room System</p>
            </div>
          )}
        </div>
      </div>

      <nav aria-label="Main navigation" className={`side-nav flex-1 py-3 space-y-1 ${collapsed ? 'side-nav--collapsed px-2' : 'px-4'}`}>
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.id)}
            aria-current={current === item.id ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
            className={`nav-item w-full !text-[15px] !px-3.5 !py-3 !gap-3 ${collapsed ? '!justify-center !px-0' : ''} ${current === item.id ? 'nav-item-active' : ''}`}
          >
            <item.icon size={22} aria-hidden="true" className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {!collapsed && item.id === 'meeting' && (
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                <span aria-hidden="true" className="w-2 h-2 bg-error-500 rounded-full animate-pulse-soft" />
                <span className="sr-only">{t('nav.meeting.live')}</span>
              </span>
            )}
          </button>
        ))}
      </nav>
      <SidebarFooter onSignOut={onSignOut} collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </>
  );
}

export function Sidebar({ current, onNavigate, onSignOut }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useLanguage();

  const handleNavigate = (page: Page) => {
    onNavigate(page);
    setMobileOpen(false);
  };
  const toggleCollapse = () => setCollapsed((v) => !v);

  return (
    <>
      {/* Desktop sidebar — 1:4 ratio (20% sidebar / 80% body), thu gon chi icon. */}
      <aside className={`hidden md:flex flex-col bg-white border-r border-ink-200 h-screen h-[100dvh] max-h-[100dvh] overflow-hidden sticky top-0 transition-all duration-200 ${collapsed ? 'w-20 min-w-[80px] max-w-[80px]' : 'md:w-[20%] lg:w-[20%] min-w-[200px] max-w-[320px]'}`}>
        <SidebarContent current={current} onNavigate={onNavigate} onSignOut={onSignOut} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen}
        aria-controls="mobile-sidebar"
        className="md:hidden fixed top-3 left-3 z-40 w-11 h-11 rounded-lg bg-white border border-ink-200 shadow-sm flex items-center justify-center text-ink-700 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
        aria-label={t('nav.openMenu')}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Main menu">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm animate-drawer-overlay" onClick={() => setMobileOpen(false)} />
          <aside id="mobile-sidebar" className="relative w-64 bg-white shadow-float animate-sidebar-slide flex flex-col h-full">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 min-w-[36px] min-h-[36px] p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors z-10 inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
              aria-label={t('nav.closeMenu')}
            >
              <X size={20} aria-hidden="true" />
            </button>
            <SidebarContent current={current} onNavigate={handleNavigate} onSignOut={onSignOut} collapsed={false} onToggleCollapse={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}
    </>
  );
}

interface TopBarProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  canGoBack: boolean;
}

export function TopBar({ title, subtitle, onBack, canGoBack }: TopBarProps) {
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-ink-200 px-5 md:px-8 py-4 md:py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0 md:ml-0 ml-12">
          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={t('topbar.goBack')}
              title={t('topbar.back')}
              className="back-btn back-btn-light"
            >
              <ChevronLeft size={22} aria-hidden="true" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-bold text-ink-900 truncate">{title}</h1>
            {subtitle && <p className="text-[13px] md:text-[15px] text-ink-500 truncate mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <div className="relative hidden lg:block" role="search">
            <label htmlFor="topbar-search" className="sr-only">{t('topbar.search.label')}</label>
            <Search size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              id="topbar-search"
              type="search"
              placeholder={t('topbar.search.placeholder')}
              className="input-field w-72 pl-10 pr-4 py-2.5 !text-[15px] !min-h-[44px] !bg-ink-100 !border-transparent focus:!bg-white focus:!border-primary-300"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
