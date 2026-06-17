import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) {
    const target = user.role === 'courier' ? '/courier' : user.role === 'recipient' ? '/recipient' : '/admin';
    navigate(target, { replace: true });
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (u: string, p: string) => {
    setError('');
    setLoading(true);
    try {
      await login(u, p);
    } catch (err: any) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
        </div>
        <h1 className="login-title">快递驿站管理系统</h1>
        <p className="login-subtitle">请登录您的账户</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              className="form-input"
              type="text"
              placeholder="请输入用户名"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">密码</label>
            <input
              className="form-input"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        <div className="quick-login">
          <div className="quick-login-label">快速体验</div>
          <div className="quick-login-grid">
            <button className="quick-login-btn" onClick={() => quickLogin('courier1', 'courier123')} disabled={loading}>
              <div className="role-icon">{'\u{1F4E6}'}</div>
              <span className="role-name">快递员</span>
              <span className="role-user">courier1</span>
            </button>
            <button className="quick-login-btn" onClick={() => quickLogin('user1', 'user123')} disabled={loading}>
              <div className="role-icon">{'\u{1F464}'}</div>
              <span className="role-name">收件人</span>
              <span className="role-user">user1</span>
            </button>
            <button className="quick-login-btn" onClick={() => quickLogin('admin', 'admin123')} disabled={loading}>
              <div className="role-icon">{'\u{1F4CB}'}</div>
              <span className="role-name">管理员</span>
              <span className="role-user">admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
