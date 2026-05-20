import React from 'react';
import { getEmployees, getPayslips } from '../db';
import { calcNetPayout, fmt } from '../utils';
import { Users, FileText, CheckCircle, FileSpreadsheet, UserPlus, FilePlus, Settings } from 'lucide-react';

export default function AdminDashboard({ navigateTo }) {
  const employees = getEmployees();
  const payslips = getPayslips(null, 'admin');

  // Calculations for stats
  const totalEmployeesCount = employees.length;
  const activeEmployeesCount = employees.filter(e => e.status === '在籍中').length;

  const confirmedSlips = payslips.filter(ps => ps.status === 'confirmed');
  const draftSlips = payslips.filter(ps => ps.status === 'draft');

  const totalPayout = confirmedSlips.reduce((sum, ps) => sum + calcNetPayout(ps), 0);

  // Get recent 5 slips
  const recentSlips = [...payslips]
    .sort((a, b) => b.targetYearMonth.localeCompare(a.targetYearMonth) || b.paymentDate.localeCompare(a.paymentDate))
    .slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">管理者ダッシュボード</h1>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">登録従業員数 (在籍中)</span>
            <span className="stat-value">
              {totalEmployeesCount}名 <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>({activeEmployeesCount}名在籍)</span>
            </span>
          </div>
          <div className="stat-icon">
            <Users size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">給与明細発行状況</span>
            <span className="stat-value">
              {confirmedSlips.length}件 <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--status-draft-text)' }}>({draftSlips.length}件下書き)</span>
            </span>
          </div>
          <div className="stat-icon" style={{ color: 'var(--accent-sky)', backgroundColor: 'var(--accent-light)' }}>
            <FileText size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-info">
            <span className="stat-label">確定支給額 合計 (全期間)</span>
            <span className="stat-value">¥{fmt(totalPayout)}</span>
          </div>
          <div className="stat-icon" style={{ color: '#166534', backgroundColor: '#dcfce7' }}>
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      {/* Main Grid: Quick Actions & Recent Slips */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Recent Slips Table */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title">最近作成された給与明細</h2>
          {recentSlips.length === 0 ? (
            <div style={{ padding: '40px 0', textPosition: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              給与明細がまだ作成されていません。
            </div>
          ) : (
            <div className="table-responsive" style={{ margin: '0' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>対象年月</th>
                    <th>社員番号</th>
                    <th>氏名</th>
                    <th className="numeric">差引支給額</th>
                    <th>ステータス</th>
                    <th style={{ textAlign: 'center' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSlips.map(slip => {
                    const netPay = calcNetPayout(slip);
                    return (
                      <tr key={slip.id}>
                        <td style={{ fontWeight: 600 }}>{slip.targetYearMonth}</td>
                        <td>{slip.employeeId}</td>
                        <td>{slip.employeeName}</td>
                        <td className="numeric" style={{ fontWeight: 700, color: slip.status === 'confirmed' ? 'var(--primary-navy)' : 'var(--text-muted)' }}>
                          ¥{fmt(netPay)}
                        </td>
                        <td>
                          <span className={`badge ${slip.status === 'confirmed' ? 'badge-confirmed' : 'badge-draft'}`}>
                            {slip.status === 'confirmed' ? '確定済' : '下書き'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => navigateTo('payslip-detail', { payslipId: slip.id })}
                          >
                            詳細
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Side: Quick Action Panel */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title">クイック操作</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid var(--border)' }}
              onClick={() => navigateTo('employee-edit', { employeeId: null })}
            >
              <UserPlus size={18} style={{ color: 'var(--accent-sky)' }} />
              <span>従業員の新規登録</span>
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid var(--border)' }}
              onClick={() => navigateTo('payslip-create', { editingPayslipId: null })}
            >
              <FilePlus size={18} style={{ color: 'var(--accent-sky)' }} />
              <span>給与明細の新規作成</span>
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid var(--border)' }}
              onClick={() => navigateTo('payslip-list')}
            >
              <FileSpreadsheet size={18} style={{ color: 'var(--accent-sky)' }} />
              <span>明細データ一覧・検索</span>
            </button>

            <button 
              className="btn btn-secondary" 
              style={{ justifyContent: 'flex-start', padding: '12px 16px', border: '1px solid var(--border)' }}
              onClick={() => navigateTo('system-settings')}
            >
              <Settings size={18} style={{ color: 'var(--accent-sky)' }} />
              <span>システム設定 (税額表URL)</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
