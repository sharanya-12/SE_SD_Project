import React from 'react';
import { AppView, AuthUser } from '../types/parking';

interface TopBarProps {
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  activePassCount: number;
  currentUser: AuthUser | null;
  onSignOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  activePassCount,
  currentUser,
  onSignOut,
}) => {
  const passesLabel = activePassCount > 0 ? `My Passes (${activePassCount})` : 'My Passes';

  const navItems: Array<{ id: AppView; label: string }> =
    currentUser?.role === 'admin'
      ? [
          { id: 'admin_dashboard', label: 'Admin Console' },
          { id: 'finder', label: 'Find Parking' },
          { id: 'monthly', label: 'Monthly Passes' },
          { id: 'passes', label: `All Passes (${activePassCount})` },
        ]
      : currentUser?.role === 'user'
      ? [
          { id: 'finder', label: 'Find Parking' },
          { id: 'monthly', label: 'Monthly Passes' },
          { id: 'venues', label: 'Venues & Airports' },
          { id: 'passes', label: passesLabel },
        ]
      : [
          { id: 'user_login', label: 'User Login' },
          { id: 'admin_login', label: 'Admin Login' },
        ];

  const firstName = currentUser?.name.split(' ')[0] || 'Account';

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() =>
            onSelectView(
              currentUser
                ? currentUser.role === 'admin'
                  ? 'admin_dashboard'
                  : 'finder'
                : 'user_login'
            )
          }
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 cursor-pointer"
        >
          CurbGrid
        </button>

        {/* Zone 2: Navigation links (only portal switchers when signed out) */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 ${
                  isActive
                    ? 'border-blue-600 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={onSignOut}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Sign Out ({currentUser.role === 'admin' ? 'Admin' : firstName})
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                onSelectView(activeView === 'admin_login' ? 'user_login' : 'admin_login')
              }
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              {activeView === 'admin_login' ? 'Driver Login' : 'Admin Portal'}
            </button>
          )}
        </div>
      </div>

      {/* Compact mobile navigation row */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden items-center gap-3 px-4 pb-2.5 overflow-x-auto text-xs font-medium border-t border-slate-100 pt-2"
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              className={`whitespace-nowrap shrink-0 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
