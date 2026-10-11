import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  Settings,
  WalletCards,
  ChevronDown,
  X,
  Users,
} from 'lucide-react';
import type { Workspace, UserProfile } from '../../types/expense';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace: Workspace;
  currentUser: UserProfile;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  workspace,
  currentUser,
}) => {
  // Close sidebar on Escape key when on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      badge: undefined,
    },
    {
      id: 'transactions',
      label: 'Transactions',
      icon: ReceiptText,
      badge: 'All',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      badge: 'v2',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      badge: undefined,
    },
  ];

  const handleNavClick = (tabId: string) => {
    onSelectTab(tabId);
    if (mobileOpen) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Main Navigation"
      >
        <div className="sidebar-header">
          <div className="brand-wrapper">
            <div className="brand-logo">
              <div className="brand-icon" aria-hidden="true">
                <WalletCards size={20} strokeWidth={2.2} />
              </div>
              <span className="brand-name">SpendWise</span>
            </div>
            {mobileOpen ? (
              <button
                type="button"
                className="modal-close-btn"
                onClick={onCloseMobile}
                aria-label="Close navigation sidebar"
              >
                <X size={18} />
              </button>
            ) : (
              <span className="brand-badge">Family</span>
            )}
          </div>

          {/* Family Budget Workspace Selector */}
          <div
            className="workspace-selector"
            role="button"
            tabIndex={0}
            title={`Active Workspace: ${workspace.name}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
              }
            }}
          >
            <div className="workspace-info">
              <div className="workspace-avatar" aria-hidden="true">
                <Users size={14} />
              </div>
              <div className="workspace-text">
                <span className="workspace-title">{workspace.name}</span>
                <span className="workspace-sub">
                  {workspace.membersCount} members • INR
                </span>
              </div>
            </div>
            <ChevronDown size={14} color="var(--text-tertiary)" />
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavClick(item.id)}
                aria-current={isActive ? 'page' : undefined}
              >
                <div className="nav-item-content">
                  <Icon className="nav-icon" size={18} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`nav-badge ${isActive ? 'accent' : ''}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar" aria-hidden="true">
              {currentUser.name.charAt(0)}
            </div>
            <div className="user-meta">
              <span className="user-name">{currentUser.name}</span>
              <span className="user-role">{currentUser.role}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

