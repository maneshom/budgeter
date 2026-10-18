import React, { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  Settings,
  ChevronDown,
  X,
  Users,
  Check,
  Plus,
  LogOut,
} from 'lucide-react';
import type { Workspace, UserProfile } from '../../types/expense';
import { MoneyUndoMark } from '../brand/MoneyUndoMark';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  workspace: Workspace;
  workspaces: Workspace[];
  onSelectWorkspace: (ws: Workspace) => void;
  onOpenCreateWorkspace: () => void;
  currentUser: UserProfile;
  onSignOut: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  workspace,
  workspaces,
  onSelectWorkspace,
  onOpenCreateWorkspace,
  currentUser,
  onSignOut,
}) => {
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close sidebar on Escape key when on mobile
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isWorkspaceMenuOpen) {
          setIsWorkspaceMenuOpen(false);
        } else if (mobileOpen) {
          onCloseMobile();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile, isWorkspaceMenuOpen]);

  // Click outside listener for workspace dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
    };
    if (isWorkspaceMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isWorkspaceMenuOpen]);

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

  const isOwner = currentUser.systemRole === 'owner';

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
              <MoneyUndoMark />
              <span className="brand-name">MoneyUndo</span>
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
              <span className={`brand-badge ${isOwner ? 'owner' : ''}`}>
                {isOwner ? 'Owner' : 'Workspace'}
              </span>
            )}
          </div>

          {/* Interactive Workspace Selector */}
          <div className="workspace-selector-container" ref={dropdownRef}>
            <button
              type="button"
              className="workspace-selector"
              onClick={() => setIsWorkspaceMenuOpen((prev) => !prev)}
              aria-expanded={isWorkspaceMenuOpen}
              aria-haspopup="true"
              title={`Switch workspace (Current: ${workspace.name})`}
            >
              <div className="workspace-info">
                <div className="workspace-avatar" aria-hidden="true">
                  <Users size={14} />
                </div>
                <div className="workspace-text">
                  <span className="workspace-title">{workspace.name}</span>
                  <span className="workspace-sub">
                    {workspace.membersCount} {workspace.membersCount === 1 ? 'member' : 'members'} • {workspace.currency}
                  </span>
                </div>
              </div>
              <ChevronDown
                size={14}
                color="var(--text-tertiary)"
                style={{
                  transform: isWorkspaceMenuOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {/* Dropdown Menu */}
            {isWorkspaceMenuOpen && (
              <div className="workspace-dropdown-menu" role="menu">
                <div className="workspace-dropdown-header">
                  <span>Workspaces ({workspaces.length})</span>
                </div>
                <div className="workspace-dropdown-list">
                  {workspaces.map((ws) => {
                    const isSelected = ws.id === workspace.id;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        className={`workspace-dropdown-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          onSelectWorkspace(ws);
                          setIsWorkspaceMenuOpen(false);
                        }}
                        role="menuitem"
                      >
                        <div className="ws-drop-left">
                          <span className="ws-drop-name">{ws.name}</span>
                          <span className="ws-drop-role">{ws.role.toUpperCase()}</span>
                        </div>
                        {isSelected && <Check size={14} className="ws-drop-check" />}
                      </button>
                    );
                  })}
                </div>

                {isOwner && (
                  <button
                    type="button"
                    className="workspace-dropdown-action"
                    onClick={() => {
                      setIsWorkspaceMenuOpen(false);
                      onOpenCreateWorkspace();
                    }}
                  >
                    <Plus size={15} />
                    <span>Create New Workspace</span>
                  </button>
                )}
              </div>
            )}
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
                  <span className={`nav-badge ${isActive ? 'accent' : ''}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer & Sign Out */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar" aria-hidden="true">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-meta">
              <span className="user-name" title={currentUser.name}>
                {currentUser.name}
              </span>
              <span className="user-role" title={currentUser.email}>
                {workspace.role === 'owner' || isOwner
                  ? 'Owner'
                  : workspace.role === 'admin'
                  ? 'Admin'
                  : 'Member'}
              </span>
            </div>
            <button
              type="button"
              className="btn-signout"
              onClick={onSignOut}
              title="Sign Out"
              aria-label="Sign out of MoneyUndo"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
