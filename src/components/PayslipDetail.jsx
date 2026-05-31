import React, { useEffect, useState } from 'react';
import { getPayslip, getEmployee } from '../db';
import { 
  calcEarningsTotal, 
  calcDeductionsTotal, 
  calcNetPayout, 
  fmt, 
  fmtYearMonth, 
  fmtDate 
} from '../utils';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';

export default function PayslipDetail({ payslipId, navigateTo, session }) {
  const [slip, setSlip] = useState(null);
  const [bankInfo, setBankInfo] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (payslipId && session) {
      const data = getPayslip(payslipId, session.id, session.role);
      if (data) {
        setSlip(data);
        
        // Hydrate banking info from the employee profile (for safety/audit trail)
        const emp = getEmployee(data.employeeId);
        if (emp) {
          setBankInfo({
            bankName: emp.bankName,
            branchName: emp.branchName,
            accountType: emp.accountType,
            accountNumber: emp.accountNumber
          });
        }
      } else {
        setError(true);
      }
    }
  }, [payslipId, session]);

  if (error || !slip) {
    return (
      <div style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }} className="card">
        <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
        <h2 style={{ marginBottom: '8px' }}>アクセスエラー</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          明細データが見つからないか、閲覧権限がありません。
        </p>
        <button 
          className="btn btn-primary"
          onClick={() => navigateTo(session?.role === 'admin' ? 'payslip-list' : 'employee-payslips')}
        >
          一覧へ戻る
        </button>
      </div>
    );
  }

  const earningsTotal = calcEarningsTotal(slip);
  const deductionsTotal = calcDeductionsTotal(slip);
  const netPay = calcNetPayout(slip);

  const handlePrint = () => {
    window.print();
  };

  const backRoute = session.role === 'admin' ? 'payslip-list' : 'employee-payslips';

  return (
    <div style={{ maxWidth: '880px', margin: '0 auto' }}>
      
      {/* Detail view toolbar */}
      <div className="page-header print-hide">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigateTo(backRoute)}
            style={{ padding: '8px' }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="page-title">給与明細詳細</h1>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {session.role === 'admin' && slip.status === 'draft' && (
            <button 
              className="btn btn-secondary"
              onClick={() => navigateTo('payslip-create', { editingPayslipId: slip.id })}
            >
              明細を編集する
            </button>
          )}
          
          <button 
            className="btn btn-primary"
            onClick={handlePrint}
          >
            <Printer size={18} />
            <span>PDF保存・印刷</span>
          </button>
        </div>
      </div>

      {/* Main Payslip Container */}
      <div className="payslip-container">
        
        {/* Header */}
        <div className="payslip-header">
          <h1>給与明細書</h1>
          <div style={{ fontSize: '1.05rem', fontWeight: 600, marginTop: '8px', color: 'var(--primary-navy)' }}>
            {fmtYearMonth(slip.targetYearMonth)}分
          </div>
        </div>

        {/* Employee & Payment Meta */}
        <div className="payslip-meta-grid">
          <div className="payslip-meta-block">
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">氏名</span>
              <span className="payslip-meta-val" style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                {slip.employeeName} 様
              </span>
            </div>
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">社員番号</span>
              <span className="payslip-meta-val">{slip.employeeId}</span>
            </div>
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">所属部署</span>
              <span className="payslip-meta-val">{slip.department || '-'}</span>
            </div>
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">雇用区分</span>
              <span className="payslip-meta-val">{slip.employmentType || '-'}</span>
            </div>
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">税額区分</span>
              <span className="payslip-meta-val">
                {slip.taxCategory === 'otsu' ? '乙欄' : '甲欄'} (扶養:{slip.dependentsCount || 0}人)
              </span>
            </div>
          </div>

          <div className="payslip-meta-block">
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">支給日</span>
              <span className="payslip-meta-val" style={{ fontWeight: 600 }}>
                {fmtDate(slip.paymentDate)}
              </span>
            </div>
            <div className="payslip-meta-row">
              <span className="payslip-meta-label">支払者</span>
              <span className="payslip-meta-val" style={{ fontWeight: 600 }}>
                明治屋クリエイト 株式会社
              </span>
            </div>
            {slip.status === 'draft' && (
              <div className="payslip-meta-row print-hide">
                <span className="payslip-meta-label">状況</span>
                <span className="payslip-meta-val">
                  <span className="badge badge-draft">下書き (管理者のみ閲覧可)</span>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Net Pay Box */}
        <div className="payslip-net-highlight">
          <span className="payslip-net-label">差引支給額 (振込金額)</span>
          <span className="payslip-net-val">¥ {fmt(netPay)}</span>
        </div>

        {/* Grid for Earnings & Deductions Tables */}
        <div className="payslip-table-grid">
          
          {/* Earnings (支給) Column */}
          <div>
            <div className="payslip-block-title">支給項目</div>
            <table className="payslip-table">
              <thead>
                <tr>
                  <th>項目名</th>
                  <th style={{ textAlign: 'right' }}>金額</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>基本給</td>
                  <td className="amount">¥{fmt(slip.baseSalary)}</td>
                </tr>
                <tr>
                  <td>役職手当</td>
                  <td className="amount">¥{fmt(slip.titleAllowance)}</td>
                </tr>
                <tr>
                  <td>通勤手当</td>
                  <td className="amount">¥{fmt(slip.commuteAllowance)}</td>
                </tr>
                <tr>
                  <td>残業手当</td>
                  <td className="amount">¥{fmt(slip.overtimeAllowance)}</td>
                </tr>
                <tr>
                  <td>深夜手当</td>
                  <td className="amount">¥{fmt(slip.midnightAllowance)}</td>
                </tr>
                <tr>
                  <td>休日手当</td>
                  <td className="amount">¥{fmt(slip.holidayAllowance)}</td>
                </tr>
                {slip.otherAllowance > 0 ? (
                  <tr>
                    <td>その他手当</td>
                    <td className="amount">¥{fmt(slip.otherAllowance)}</td>
                  </tr>
                ) : (
                  <tr>
                    <td style={{ color: 'transparent' }}>-</td>
                    <td style={{ color: 'transparent' }}>-</td>
                  </tr>
                )}
                
                {/* Spacer row to match Deductions table height */}
                <tr>
                  <td style={{ color: 'transparent' }}>-</td>
                  <td style={{ color: 'transparent' }}>-</td>
                </tr>
                
                <tr className="payslip-summary-row">
                  <td>支給合計</td>
                  <td className="amount">¥{fmt(earningsTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Deductions (控除) Column */}
          <div>
            <div className="payslip-block-title">控除項目</div>
            <table className="payslip-table">
              <thead>
                <tr>
                  <th>項目名</th>
                  <th style={{ textAlign: 'right' }}>金額</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>健康保険</td>
                  <td className="amount deduction-color">¥{fmt(slip.healthInsurance)}</td>
                </tr>
                <tr>
                  <td>介護保険</td>
                  <td className="amount deduction-color">¥{fmt(slip.careInsurance)}</td>
                </tr>
                <tr>
                  <td>厚生年金</td>
                  <td className="amount deduction-color">¥{fmt(slip.welfarePension)}</td>
                </tr>
                <tr>
                  <td>雇用保険・労働保険</td>
                  <td className="amount deduction-color">¥{fmt(slip.employmentInsurance)}</td>
                </tr>
                <tr>
                  <td>搬出金</td>
                  <td className="amount deduction-color">¥{fmt(slip.contribution)}</td>
                </tr>
                <tr>
                  <td>所得税</td>
                  <td className="amount deduction-color">¥{fmt(slip.incomeTax)}</td>
                </tr>
                <tr>
                  <td>市民・県民税</td>
                  <td className="amount deduction-color">¥{fmt(slip.residentTax)}</td>
                </tr>
                {slip.otherDeduction > 0 ? (
                  <tr>
                    <td>その他控除</td>
                    <td className="amount deduction-color">¥{fmt(slip.otherDeduction)}</td>
                  </tr>
                ) : (
                  <tr>
                    <td style={{ color: 'transparent' }}>-</td>
                    <td style={{ color: 'transparent' }}>-</td>
                  </tr>
                )}
                {slip.differenceAdjustment > 0 ? (
                  <tr>
                    <td>差額調整費</td>
                    <td className="amount deduction-color">¥{fmt(slip.differenceAdjustment)}</td>
                  </tr>
                ) : (
                  <tr>
                    <td style={{ color: 'transparent' }}>-</td>
                    <td style={{ color: 'transparent' }}>-</td>
                  </tr>
                )}
                
                <tr className="payslip-summary-row">
                  <td>控除合計</td>
                  <td className="amount deduction-color">¥{fmt(deductionsTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

        </div>

        {/* Attendance (勤怠) Block */}
        <div className="payslip-attendance-block">
          <div className="payslip-block-title">勤怠項目</div>
          <div className="payslip-attendance-grid">
            <div className="attendance-item">
              <span className="attendance-label">出勤日数</span>
              <span className="attendance-val">{slip.workDays || 0} 日</span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label">欠勤日数</span>
              <span className="attendance-val">{slip.absenceDays || 0} 日</span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label">有給取得日数</span>
              <span className="attendance-val">{slip.paidLeaveDays || 0} 日</span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label">残業時間</span>
              <span className="attendance-val">{slip.overtimeHours || 0} 割</span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label">深夜時間</span>
              <span className="attendance-val">{slip.midnightHours || 0} 割</span>
            </div>
            <div className="attendance-item">
              <span className="attendance-label">休日出勤</span>
              <span className="attendance-val">{slip.holidayWorkDays || 0} 日</span>
            </div>
          </div>
        </div>

        {/* Banking details */}
        {bankInfo && bankInfo.bankName && (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '4px' }}>
            <span style={{ fontWeight: 600, color: 'var(--primary-navy)', marginRight: '16px' }}>振込口座情報</span>
            <span>
              {bankInfo.bankName}　{bankInfo.branchName}支店　{bankInfo.accountType}口座　口座番号: {bankInfo.accountNumber}
            </span>
          </div>
        )}

        {/* Print Layout Footer */}
        <div className="payslip-footer">
          <p>※本明細書に記載されている内容についてご不明な点がございましたら、管理部までお問い合わせください。</p>
          <p style={{ marginTop: '4px', fontSize: '0.7rem' }}>Powered by PaySlip Manager</p>
        </div>

      </div>
    </div>
  );
}
