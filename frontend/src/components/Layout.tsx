import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const roleNames: Record<string, string> = {
  courier: '快递员',
  recipient: '收件人',
  admin: '管理员',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <header className="app-header">
        <div className="app-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          快递驿站管理
        </div>
        <div className="app-nav">
          {user && (
            <div className="app-user">
              <span className="user-role">{roleNames[user.role] || user.role}</span>
              <span className="user-name">{user.name}</span>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>退出登录</button>
            </div>
          )}
        </div>
      </header>
      <main className="main-content">
        {children}
      </main>
    </>
  );
}
