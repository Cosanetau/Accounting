import { BookOpen, LogOut, Receipt, TrendingUp, Users } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';

const navItems = [
  { label: 'Income', path: '/', icon: TrendingUp },
  { label: 'Expenses', path: '/expenses', icon: Receipt },
  { label: 'Log book', path: '/logbook', icon: BookOpen },
];

export default function AccountingLayout() {
  const { accountingUser, isOwner, logout } = useAuth();

  return (
    <div className="accounting-shell">
      <aside className="accounting-sidebar">
        <div className="accounting-brand">
          <span className="accounting-brand-main">COSA</span>
          <span className="accounting-brand-sub">ACCOUNTING</span>
        </div>

        <nav className="accounting-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                className={({ isActive }) =>
                  `accounting-nav-link${isActive ? ' is-active' : ''}`
                }
                end={item.path === '/'}
                to={item.path}
              >
                <Icon size={18} />
                {item.label}
              </NavLink>
            );
          })}

          {isOwner ? (
            <NavLink
              className={({ isActive }) =>
                `accounting-nav-link accounting-nav-link-muted${isActive ? ' is-active' : ''}`
              }
              to="/users"
            >
              <Users size={18} />
              People
            </NavLink>
          ) : null}
        </nav>

        <div className="accounting-sidebar-foot">
          <div className="accounting-user-name">
            {accountingUser?.displayName || accountingUser?.email || 'COSA team'}
          </div>
          <div className="accounting-user-role">{accountingUser?.role || 'viewer'}</div>
          <button type="button" onClick={() => logout()}>
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="accounting-main">
        <Outlet />
      </main>
    </div>
  );
}
