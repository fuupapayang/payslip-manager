import React, { useState } from 'react';
import { authenticateUser } from '../db';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [usernameOrId, setUsernameOrId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Client-side validation
    if (!usernameOrId.trim() || !password.trim()) {
      setError('社員番号/メールアドレスとパスワードの両方を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await authenticateUser(usernameOrId.trim(), password);
      if (session) {
        onLoginSuccess(session);
      } else {
        setError('社員番号/メールアドレス、またはパスワードが正しくありません。');
      }
    } catch (err) {
      console.error(err);
      setError('ログイン処理中にエラーが発生しました。時間をおいて再度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          {/* Logo Icon */}
          <div style={{
            width: '60px',
            height: '60px',
            background: 'linear-gradient(135deg, var(--accent-sky), var(--primary-navy))',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            margin: '0 auto 16px',
            boxShadow: 'var(--shadow-md)'
          }}>
            <Lock size={32} />
          </div>
          <h1 className="login-title">明治屋クリエイト</h1>
          <p className="login-subtitle">給与明細管理システム ログイン</p>
        </div>

        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#b91c1c',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label htmlFor="usernameOrId">社員番号 または メールアドレス</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
              <input
                id="usernameOrId"
                type="text"
                className="form-control"
                placeholder="EMP001 または email@example.com"
                value={usernameOrId}
                onChange={(e) => setUsernameOrId(e.target.value)}
                disabled={isSubmitting}
                style={{ paddingLeft: '44px', width: '100%' }}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label htmlFor="password">パスワード</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{ position: 'absolute', left: '14px', top: '12px', color: '#94a3b8' }} />
              <input
                id="password"
                type="password"
                className="form-control"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                style={{ paddingLeft: '44px', width: '100%' }}
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ width: '100%', height: '45px', fontSize: '1rem' }}
          >
            {isSubmitting ? '認証中...' : 'ログイン'}
          </button>
        </form>
        
        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
          <p>※ パスワードをお忘れの場合は、管理者へお問い合わせください。</p>
        </div>
      </div>
    </div>
  );
}
