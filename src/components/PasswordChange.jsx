import React, { useState } from 'react';
import { getEmployee, changePassword } from '../db';
import { Save, Lock, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export default function PasswordChange({ session, navigateTo }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('すべての項目を入力してください。');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('新しいパスワードと確認用パスワードが一致しません。');
      return;
    }

    if (newPassword.length < 4) {
      setError('新しいパスワードは4文字以上で入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      // Get user from database to verify current password
      const user = getEmployee(session.id);
      if (!user || user.password !== currentPassword) {
        setError('現在のパスワードが正しくありません。');
        setIsSubmitting(false);
        return;
      }

      if (currentPassword === newPassword) {
        setError('新しいパスワードは現在のパスワードと異なるものを設定してください。');
        setIsSubmitting(false);
        return;
      }

      // Change password
      const successFlag = await changePassword(session.id, newPassword);
      if (successFlag) {
        setSuccess('パスワードを変更しました。次回ログイン時から有効になります。');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError('パスワードの変更処理に失敗しました。');
      }
    } catch (err) {
      console.error(err);
      setError('エラーが発生しました。再度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (session.role === 'admin') {
      navigateTo('admin-dashboard');
    } else {
      navigateTo('payslip-list'); // For employees
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={handleBack}
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="page-title">パスワード変更</h1>
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
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          fontWeight: 500
        }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <h2 className="card-title">アカウントパスワードの更新</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group">
            <label htmlFor="currentPassword">現在のパスワード</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                id="currentPassword"
                type="password"
                className="form-control"
                style={{ paddingLeft: '38px', width: '100%' }}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="newPassword">新しいパスワード</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                id="newPassword"
                type="password"
                className="form-control"
                style={{ paddingLeft: '38px', width: '100%' }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">新しいパスワード（確認用）</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                id="confirmPassword"
                type="password"
                className="form-control"
                style={{ paddingLeft: '38px', width: '100%' }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
                autoComplete="new-password"
                required
              />
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'flex-end', 
            marginTop: '10px',
            borderTop: '1px solid var(--border)',
            paddingTop: '20px'
          }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>{isSubmitting ? '変更中...' : 'パスワードを変更'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
