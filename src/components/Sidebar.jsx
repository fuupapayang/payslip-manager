import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSpreadsheet, 
  FilePlus, 
  LogOut, 
  Lock,
  Settings,
  FileText,
  UserCircle
} from 'lucide-react';

export default function Sidebar({ session, currentView, navigateTo, onLogout }) {
  if (!session) return null;

  const isAdmin = session.role === 'admin';
  const isManager = session.role === 'manager';

  return (
    <aside className="sidebar print-hide">
      <div className="sidebar-brand">
        <Lock size={22} style={{ color: 'var(--accent-sky)' }} />
        <span>明治屋クリエイト</span>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {(isAdmin || isManager) ? (
            <>
              <li className={`sidebar-item ${currentView === 'admin-dashboard' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('admin-dashboard')}>
                  <LayoutDashboard size={18} />
                  <span>ダッシュボード</span>
                </button>
              </li>
              <li className={`sidebar-item ${currentView === 'employee-list' || currentView === 'employee-edit' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('employee-list')}>
                  <Users size={18} />
                  <span>従業員一覧</span>
                </button>
              </li>
              <li className={`sidebar-item ${currentView === 'payslip-list' || currentView === 'payslip-detail' && currentView !== 'employee-payslips' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('payslip-list')}>
                  <FileSpreadsheet size={18} />
                  <span>給与明細一覧</span>
                </button>
              </li>
              {isAdmin && (
                <li className={`sidebar-item ${currentView === 'payslip-create' ? 'active' : ''}`}>
                  <button onClick={() => navigateTo('payslip-create')}>
                    <FilePlus size={18} />
                    <span>給与明細作成</span>
                  </button>
                </li>
              )}
              <li className={`sidebar-item ${currentView === 'year-end-adjustment' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('year-end-adjustment')}>
                  <FileText size={18} />
                  <span>年末調整</span>
                </button>
              </li>
              {isAdmin && (
                <li className={`sidebar-item ${currentView === 'system-settings' ? 'active' : ''}`}>
                  <button onClick={() => navigateTo('system-settings')}>
                    <Settings size={18} />
                    <span>システム設定</span>
                  </button>
                </li>
              )}
              <li className={`sidebar-item ${currentView === 'password-change' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('password-change')}>
                  <Lock size={18} />
                  <span>パスワード変更</span>
                </button>
              </li>
            </>
          ) : (
            <>
              <li className={`sidebar-item ${currentView === 'employee-payslips' || currentView === 'payslip-detail' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('employee-payslips')}>
                  <FileSpreadsheet size={18} />
                  <span>給与明細一覧</span>
                </button>
              </li>
              <li className={`sidebar-item ${currentView === 'year-end-adjustment' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('year-end-adjustment')}>
                  <FileText size={18} />
                  <span>年末調整</span>
                </button>
              </li>
              <li className={`sidebar-item ${currentView === 'employee-profile' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('employee-profile')}>
                  <UserCircle size={18} />
                  <span>基本情報</span>
                </button>
              </li>
              <li className={`sidebar-item ${currentView === 'password-change' ? 'active' : ''}`}>
                <button onClick={() => navigateTo('password-change')}>
                  <Lock size={18} />
                  <span>パスワード変更</span>
                </button>
              </li>
            </>
          )}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="user-badge">
          <span className="user-badge-name">{session.name}</span>
          <span className="user-badge-role">
            {isAdmin ? '管理者' : `${session.department || ''} - ${session.employmentType || ''}`}
          </span>
        </div>
        
        <button className="logout-btn" onClick={onLogout}>
          <LogOut size={16} />
          <span>ログアウト</span>
        </button>
      </div>
    </aside>
  );
}
