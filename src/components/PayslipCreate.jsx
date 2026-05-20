import React, { useState, useEffect } from 'react';
import { getEmployees, getEmployee, savePayslip, getPayslip, getSettings } from '../db';
import { validatePayslip, parseNum, parseDecimal, calcEarningsTotal, calcDeductionsTotal, calcNetPayout, fmt, calcTaxableIncome, calcIncomeTax } from '../utils';
import { ArrowLeft, Save, FileCheck, HelpCircle } from 'lucide-react';

export default function PayslipCreate({ editingPayslipId, navigateTo }) {
  const isEdit = !!editingPayslipId;
  const employees = getEmployees().filter(e => e.status === '在籍中');
  const settings = getSettings();

  // Core Payslip State template
  const initialFormState = {
    employeeId: '',
    employeeName: '',
    department: '',
    employmentType: '',
    targetYearMonth: '',
    paymentDate: '',
    status: 'draft', // draft | confirmed
    taxCategory: 'ko',
    dependentsCount: 0,

    // Attendance (勤怠)
    workDays: 20,
    absenceDays: 0,
    paidLeaveDays: 0,
    overtimeHours: 0,
    midnightHours: 0,
    holidayWorkDays: 0,

    // Earnings (支給)
    baseSalary: 0,
    titleAllowance: 0,
    commuteAllowance: 0,
    overtimeAllowance: 0,
    midnightAllowance: 0,
    holidayAllowance: 0,
    otherAllowance: 0,

    // Deductions (控除)
    healthInsurance: 0,
    careInsurance: 0,
    welfarePension: 0,
    employmentInsurance: 0,
    contribution: 0,
    incomeTax: 0,
    residentTax: 0,
    otherDeduction: 0
  };

  const [formData, setFormData] = useState(initialFormState);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isManualTaxOverride, setIsManualTaxOverride] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load existing payslip if editing
  useEffect(() => {
    if (isEdit) {
      const slip = getPayslip(editingPayslipId);
      if (slip) {
        setFormData({ ...initialFormState, ...slip });
        setSelectedEmployeeId(slip.employeeId);
        
        // Check if the saved incomeTax matches the calculated one
        const taxableIncome = calcTaxableIncome(slip);
        const autoTax = calcIncomeTax(taxableIncome, slip.taxCategory || 'ko', slip.dependentsCount || 0);
        if (Number(slip.incomeTax) !== autoTax) {
          setIsManualTaxOverride(true);
        }
      } else {
        alert('指定された給与明細が見つかりません。');
        navigateTo('payslip-list');
      }
    }
  }, [editingPayslipId, isEdit]);

  // Load employee fixed template when creating and selecting employee
  const handleEmployeeChange = (e) => {
    const id = e.target.value;
    setSelectedEmployeeId(id);
    setErrors({});
    
    setIsManualTaxOverride(false);
    if (id) {
      const emp = getEmployee(id);
      if (emp) {
        setFormData(prev => ({
          ...prev,
          employeeId: emp.id,
          employeeName: emp.name,
          department: emp.department,
          employmentType: emp.employmentType,
          taxCategory: emp.taxCategory || 'ko',
          dependentsCount: emp.dependentsCount || 0,
          baseSalary: emp.baseSalary,
          titleAllowance: emp.titleAllowance,
          commuteAllowance: emp.commuteAllowance,
          otherAllowance: emp.otherFixedAllowance,
          
          // Reset variable inputs
          workDays: 20,
          absenceDays: 0,
          paidLeaveDays: 0,
          overtimeHours: 0,
          midnightHours: 0,
          holidayWorkDays: 0,
          overtimeAllowance: 0,
          midnightAllowance: 0,
          holidayAllowance: 0,
          healthInsurance: emp.fixedHealthInsurance || 0,
          careInsurance: emp.fixedCareInsurance || 0,
          welfarePension: emp.fixedWelfarePension || 0,
          employmentInsurance: emp.fixedLaborInsurance || 0,
          contribution: emp.fixedContribution || 0,
          incomeTax: 0,
          residentTax: emp.fixedResidentTax || 0,
          otherDeduction: 0
        }));
      }
    } else {
      setFormData(initialFormState);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors
    if (errors[name]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : parseNum(value)
    }));
  };

  const handleDecimalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : parseDecimal(value)
    }));
  };

  // Auto Calculations
  const totalEarnings = calcEarningsTotal(formData);
  const totalDeductions = calcDeductionsTotal(formData);
  const netPay = totalEarnings - totalDeductions;

  const handleSave = async (status) => {
    setErrors({});

    // Hydrate empty number values to 0
    const sanitizedSlip = {
      ...formData,
      status, // update status to draft or confirmed
      workDays: parseDecimal(formData.workDays),
      absenceDays: parseDecimal(formData.absenceDays),
      paidLeaveDays: parseDecimal(formData.paidLeaveDays),
      overtimeHours: parseDecimal(formData.overtimeHours),
      midnightHours: parseDecimal(formData.midnightHours),
      holidayWorkDays: parseDecimal(formData.holidayWorkDays),
      
      baseSalary: parseNum(formData.baseSalary),
      titleAllowance: parseNum(formData.titleAllowance),
      commuteAllowance: parseNum(formData.commuteAllowance),
      overtimeAllowance: parseNum(formData.overtimeAllowance),
      midnightAllowance: parseNum(formData.midnightAllowance),
      holidayAllowance: parseNum(formData.holidayAllowance),
      otherAllowance: parseNum(formData.otherAllowance),
      
      healthInsurance: parseNum(formData.healthInsurance),
      careInsurance: parseNum(formData.careInsurance),
      welfarePension: parseNum(formData.welfarePension),
      employmentInsurance: parseNum(formData.employmentInsurance),
      contribution: parseNum(formData.contribution),
      incomeTax: parseNum(formData.incomeTax),
      residentTax: parseNum(formData.residentTax),
      otherDeduction: parseNum(formData.otherDeduction),
      
      taxCategory: formData.taxCategory || 'ko',
      dependentsCount: parseNum(formData.dependentsCount)
    };

    const validation = validatePayslip(sanitizedSlip, isEdit ? editingPayslipId : null);

    if (!validation.isValid) {
      setErrors(validation.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      savePayslip(sanitizedSlip);
      alert(status === 'confirmed' ? '給与明細を確定保存しました。' : '給与明細を下書き保存しました。');
      navigateTo('payslip-list');
    } catch (err) {
      console.error(err);
      setErrors({ global: '給与明細の保存中にエラーが発生しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Recalculate income tax automatically when inputs change
  useEffect(() => {
    if (formData.employeeId && !isManualTaxOverride) {
      const taxableIncome = calcTaxableIncome(formData);
      const autoTax = calcIncomeTax(taxableIncome, formData.taxCategory || 'ko', formData.dependentsCount || 0);
      setFormData(prev => {
        if (prev.incomeTax !== autoTax) {
          return { ...prev, incomeTax: autoTax };
        }
        return prev;
      });
    }
  }, [
    formData.baseSalary,
    formData.titleAllowance,
    formData.overtimeAllowance,
    formData.midnightAllowance,
    formData.holidayAllowance,
    formData.otherAllowance,
    formData.healthInsurance,
    formData.careInsurance,
    formData.welfarePension,
    formData.employmentInsurance,
    formData.taxCategory,
    formData.dependentsCount,
    formData.employeeId,
    isManualTaxOverride
  ]);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigateTo('payslip-list')}
            style={{ padding: '8px' }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="page-title">
            {isEdit ? '給与明細の編集' : '給与明細の作成'}
          </h1>
        </div>
      </div>

      {errors.global && (
        <div style={{
          backgroundColor: '#fee2e2',
          border: '1px solid #fca5a5',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '0.85rem'
        }}>
          <span>{errors.global}</span>
        </div>
      )}

      {/* Block 1: 従業員選択 & 基本情報 */}
      <div className="card">
        <h2 className="card-title">基本情報設定</h2>
        <div className="form-grid">
          
          <div className="form-group">
            <label htmlFor="employeeId">
              対象従業員 <span className="required">*</span>
            </label>
            <select
              id="employeeId"
              className="form-control"
              value={selectedEmployeeId}
              onChange={handleEmployeeChange}
              disabled={isEdit || isSubmitting}
            >
              <option value="">-- 従業員を選択してください --</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.id} : {emp.name} ({emp.department || '部署未設定'})
                </option>
              ))}
            </select>
            {errors.employeeId && <span className="form-error">{errors.employeeId}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="targetYearMonth">
              対象年月 <span className="required">*</span>
            </label>
            <input
              id="targetYearMonth"
              name="targetYearMonth"
              type="month"
              className="form-control"
              value={formData.targetYearMonth}
              onChange={handleChange}
              disabled={isEdit || isSubmitting}
            />
            {errors.targetYearMonth && <span className="form-error">{errors.targetYearMonth}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="paymentDate">
              支給日 <span className="required">*</span>
            </label>
            <input
              id="paymentDate"
              name="paymentDate"
              type="date"
              className="form-control"
              value={formData.paymentDate}
              onChange={handleChange}
              disabled={isSubmitting}
            />
            {errors.paymentDate && <span className="form-error">{errors.paymentDate}</span>}
          </div>

        </div>

        {formData.employeeId && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: '16px',
            backgroundColor: 'var(--bg-app)',
            padding: '16px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            fontSize: '0.85rem',
            marginTop: '12px'
          }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>氏名:</span>{' '}
              <strong style={{ color: 'var(--primary-navy)' }}>{formData.employeeName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>社員番号:</span>{' '}
              <strong>{formData.employeeId}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>部署:</span>{' '}
              <strong>{formData.department || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>雇用区分:</span>{' '}
              <strong>{formData.employmentType || '-'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>源泉徴収:</span>{' '}
              <strong>{formData.taxCategory === 'otsu' ? '乙欄' : '甲欄'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>扶養人数:</span>{' '}
              <strong>{formData.dependentsCount || 0}人</strong>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Display of Net Pay calculation */}
      <div className="payslip-net-highlight" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <span className="payslip-net-label">差引支給額 (手取り計算)</span>
        <span className="payslip-net-val">¥ {fmt(netPay)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* Earnings Form Card */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title" style={{ color: '#1d4ed8' }}>支給項目</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="baseSalary">基本給</label>
              <input id="baseSalary" name="baseSalary" type="number" min="0" className="form-control numeric" value={formData.baseSalary} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="titleAllowance">役職手当</label>
              <input id="titleAllowance" name="titleAllowance" type="number" min="0" className="form-control numeric" value={formData.titleAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="commuteAllowance">通勤手当</label>
              <input id="commuteAllowance" name="commuteAllowance" type="number" min="0" className="form-control numeric" value={formData.commuteAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="overtimeAllowance">残業手当</label>
              <input id="overtimeAllowance" name="overtimeAllowance" type="number" min="0" className="form-control numeric" value={formData.overtimeAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="midnightAllowance">深夜手当</label>
              <input id="midnightAllowance" name="midnightAllowance" type="number" min="0" className="form-control numeric" value={formData.midnightAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="holidayAllowance">休日手当</label>
              <input id="holidayAllowance" name="holidayAllowance" type="number" min="0" className="form-control numeric" value={formData.holidayAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="otherAllowance">その他手当</label>
              <input id="otherAllowance" name="otherAllowance" type="number" min="0" className="form-control numeric" value={formData.otherAllowance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '2px solid var(--border)',
              paddingTop: '14px',
              fontWeight: 700,
              fontSize: '1rem',
              color: 'var(--primary-navy)'
            }}>
              <span>支給合計</span>
              <span className="numeric">¥ {fmt(totalEarnings)}</span>
            </div>
          </div>
        </div>

        {/* Deductions Form Card */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title" style={{ color: '#ef4444' }}>控除項目</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="healthInsurance">健康保険</label>
              <input id="healthInsurance" name="healthInsurance" type="number" min="0" className="form-control numeric" value={formData.healthInsurance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="careInsurance">介護保険</label>
              <input id="careInsurance" name="careInsurance" type="number" min="0" className="form-control numeric" value={formData.careInsurance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="welfarePension">厚生年金</label>
              <input id="welfarePension" name="welfarePension" type="number" min="0" className="form-control numeric" value={formData.welfarePension} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="employmentInsurance">雇用保険・労働保険</label>
              <input id="employmentInsurance" name="employmentInsurance" type="number" min="0" className="form-control numeric" value={formData.employmentInsurance} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="contribution">搬出金</label>
              <input id="contribution" name="contribution" type="number" min="0" className="form-control numeric" value={formData.contribution} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="incomeTax" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>所得税</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {formData.taxCategory === 'otsu' ? '乙欄' : '甲欄'} ({formData.dependentsCount || 0}人)
                </span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    id="incomeTax"
                    name="incomeTax"
                    type="number"
                    min="0"
                    className="form-control numeric"
                    value={formData.incomeTax}
                    onChange={(e) => {
                      handleNumericChange(e);
                      setIsManualTaxOverride(true);
                    }}
                    disabled={isSubmitting}
                    style={{ flex: 1 }}
                  />
                  {isManualTaxOverride && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setIsManualTaxOverride(false);
                        const taxableIncome = calcTaxableIncome(formData);
                        const autoTax = calcIncomeTax(taxableIncome, formData.taxCategory || 'ko', formData.dependentsCount || 0);
                        setFormData(prev => ({ ...prev, incomeTax: autoTax }));
                      }}
                      style={{ padding: '6px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                      title="自動計算された税額に戻します"
                    >
                      自動設定
                    </button>
                  )}
                </div>
                {!isManualTaxOverride && formData.employeeId && (
                  <span style={{ fontSize: '0.75rem', color: '#16a34a', display: 'block' }}>
                    ✓ 税額表から自動計算 (<a href={settings.taxTableUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-sky)', textDecoration: 'underline' }}>参照元</a>)
                  </span>
                )}
                {isManualTaxOverride && formData.employeeId && (
                  <span style={{ fontSize: '0.75rem', color: '#ea580c', display: 'block' }}>
                    ⚠️ 手動調整中 (自動計算値: ¥{fmt(calcIncomeTax(calcTaxableIncome(formData), formData.taxCategory || 'ko', formData.dependentsCount || 0))} - <a href={settings.taxTableUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-sky)', textDecoration: 'underline' }}>税額表を確認</a>)
                  </span>
                )}
              </div>
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="residentTax">市民・県民税</label>
              <input id="residentTax" name="residentTax" type="number" min="0" className="form-control numeric" value={formData.residentTax} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="otherDeduction">その他控除</label>
              <input id="otherDeduction" name="otherDeduction" type="number" min="0" className="form-control numeric" value={formData.otherDeduction} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              borderTop: '2px solid var(--border)',
              paddingTop: '14px',
              fontWeight: 700,
              fontSize: '1rem',
              color: '#ef4444'
            }}>
              <span>控除合計</span>
              <span className="numeric">¥ {fmt(totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Form Card */}
      <div className="card">
        <h2 className="card-title">勤怠項目</h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '16px'
        }}>
          <div className="form-group">
            <label htmlFor="workDays">出勤日数 (日)</label>
            <input id="workDays" name="workDays" type="number" step="0.5" min="0" className="form-control numeric" value={formData.workDays} onChange={handleDecimalChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="absenceDays">欠勤日数 (日)</label>
            <input id="absenceDays" name="absenceDays" type="number" step="0.5" min="0" className="form-control numeric" value={formData.absenceDays} onChange={handleDecimalChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="paidLeaveDays">有給取得日数 (日)</label>
            <input id="paidLeaveDays" name="paidLeaveDays" type="number" step="0.5" min="0" className="form-control numeric" value={formData.paidLeaveDays} onChange={handleDecimalChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="overtimeHours">残業時間 (時間)</label>
            <input id="overtimeHours" name="overtimeHours" type="number" step="0.1" min="0" className="form-control numeric" value={formData.overtimeHours} onChange={handleDecimalChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="midnightHours">深夜時間 (時間)</label>
            <input id="midnightHours" name="midnightHours" type="number" step="0.1" min="0" className="form-control numeric" value={formData.midnightHours} onChange={handleDecimalChange} disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label htmlFor="holidayWorkDays">休日出勤日数 (日)</label>
            <input id="holidayWorkDays" name="holidayWorkDays" type="number" min="0" className="form-control numeric" value={formData.holidayWorkDays} onChange={handleNumericChange} disabled={isSubmitting} />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => navigateTo('payslip-list')}
          disabled={isSubmitting}
        >
          キャンセル
        </button>
        
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handleSave('draft')}
          disabled={isSubmitting || !formData.employeeId}
          style={{ borderColor: 'var(--status-draft-text)', color: 'var(--status-draft-text)' }}
        >
          <Save size={18} />
          <span>下書き保存</span>
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => handleSave('confirmed')}
          disabled={isSubmitting || !formData.employeeId}
        >
          <FileCheck size={18} />
          <span>確定して保存</span>
        </button>
      </div>

    </div>
  );
}
