import React, { useState, useEffect } from 'react';
import { getEmployees, getEmployee, savePayslip, getPayslips, getPayslip, getSettings, getYearEndAdjustments } from '../db';
import { validatePayslip, parseNum, parseDecimal, calcEarningsTotal, calcDeductionsTotal, calcNetPayout, fmt, calcTaxableIncome, calcIncomeTax, calculateYearEndAdjustment } from '../utils';
import { ArrowLeft, Save, FileCheck, HelpCircle, Users, Copy, Edit2, ChevronDown, ChevronUp } from 'lucide-react';

export default function PayslipCreate({ editingPayslipId, navigateTo }) {
  const [viewMode, setViewMode] = useState(editingPayslipId ? 'edit' : 'list'); // 'list' or 'edit'
  
  // Shared global state for list mode
  const [targetYearMonth, setTargetYearMonth] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  
  const employees = getEmployees().filter(e => e.status === '在籍中');
  const allPayslips = getPayslips(); // Admin access
  const settings = getSettings();

  // Initialize dates
  useEffect(() => {
    if (!targetYearMonth && !editingPayslipId) {
      const now = new Date();
      const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setTargetYearMonth(ym);
      const pd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-25`;
      setPaymentDate(pd);
    }
  }, [targetYearMonth, editingPayslipId]);

  // Handle Select All
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedEmpIds(employees.map(emp => emp.id));
    } else {
      setSelectedEmpIds([]);
    }
  };

  const handleSelectEmp = (id) => {
    setSelectedEmpIds(prev => 
      prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]
    );
  };

  const getPrevMonthYm = (ym) => {
    if (!ym) return '';
    const [year, month] = ym.split('-');
    let y = parseInt(year, 10);
    let m = parseInt(month, 10);
    if (m === 1) {
      m = 12;
      y -= 1;
    } else {
      m -= 1;
    }
    return `${y}-${String(m).padStart(2, '0')}`;
  };

  const getSlipStatus = (empId, ym) => {
    if (!ym) return { text: '不明', className: '' };
    const slip = allPayslips.find(ps => ps.employeeId === empId && ps.targetYearMonth === ym);
    if (!slip) return { text: '未作成', className: 'badge-retired' };
    if (slip.status === 'confirmed') return { text: '確定済', className: 'badge-active' };
    return { text: '下書き', className: 'badge-warning' }; // Added inline style later
  };

  const hasPrevSlip = (empId, ym) => {
    const prevYm = getPrevMonthYm(ym);
    return allPayslips.some(ps => ps.employeeId === empId && ps.targetYearMonth === prevYm);
  };

  // Bulk Register Logic
  const handleBulkRegister = async () => {
    if (selectedEmpIds.length === 0) {
      alert('一括登録する従業員を選択してください。');
      return;
    }
    if (!targetYearMonth || !paymentDate) {
      alert('対象年月と支給日を設定してください。');
      return;
    }

    if (!window.confirm(`選択した${selectedEmpIds.length}名の従業員について、当月の明細を一括で「下書き保存」します。よろしいですか？\n※前月のデータがあればコピーし、なければ基本情報から初期化します。`)) {
      return;
    }

    const prevYm = getPrevMonthYm(targetYearMonth);
    let successCount = 0;

    for (const empId of selectedEmpIds) {
      const emp = getEmployee(empId);
      if (!emp) continue;

      // Find prev month
      const prevSlip = allPayslips.find(ps => ps.employeeId === empId && ps.targetYearMonth === prevYm);
      
      const newSlip = {
        id: `${empId}-${targetYearMonth}`,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        employmentType: emp.employmentType,
        targetYearMonth,
        paymentDate,
        status: 'draft',
        taxCategory: emp.taxCategory || 'ko',
        dependentsCount: emp.dependentsCount || 0,
        
        // Default to fixed values first
        workDays: 20,
        absenceDays: 0,
        paidLeaveDays: 0,
        overtimeHours: 0,
        midnightHours: 0,
        holidayWorkDays: 0,
        
        baseSalary: emp.baseSalary,
        titleAllowance: emp.titleAllowance,
        commuteAllowance: emp.commuteAllowance,
        overtimeAllowance: 0,
        midnightAllowance: 0,
        holidayAllowance: 0,
        otherAllowance: emp.otherFixedAllowance || 0,
        
        healthInsurance: emp.fixedHealthInsurance || 0,
        careInsurance: emp.fixedCareInsurance || 0,
        welfarePension: emp.fixedWelfarePension || 0,
        employmentInsurance: emp.fixedLaborInsurance || 0,
        contribution: emp.fixedContribution || 0,
        incomeTax: 0,
        residentTax: emp.fixedResidentTax || 0,
        otherDeduction: 0,
        differenceAdjustment: 0
      };

      if (prevSlip) {
        // Copy variable values from prev slip
        ['workDays', 'absenceDays', 'paidLeaveDays', 'overtimeHours', 'midnightHours', 'holidayWorkDays',
         'baseSalary', 'titleAllowance', 'commuteAllowance', 'overtimeAllowance', 'midnightAllowance', 'holidayAllowance', 'otherAllowance',
         'healthInsurance', 'careInsurance', 'welfarePension', 'employmentInsurance', 'contribution', 'residentTax', 'otherDeduction', 'differenceAdjustment'].forEach(key => {
           if (prevSlip[key] !== undefined) newSlip[key] = prevSlip[key];
         });
      }

      // Auto calc income tax
      const taxableIncome = calcTaxableIncome(newSlip);
      newSlip.incomeTax = calcIncomeTax(taxableIncome, newSlip.taxCategory, newSlip.dependentsCount);
      newSlip.yearEndTaxAdjustment = 0;

      // Auto-settlement for Year End Adjustment in December
      if (targetYearMonth.endsWith('-12')) {
        const targetYear = parseInt(targetYearMonth.split('-')[0], 10);
        const yeRecords = getYearEndAdjustments(empId, 'admin');
        const currentYeRecord = yeRecords.find(r => r.targetYear === targetYear && r.status === 'submitted');
        
        if (currentYeRecord) {
          const yeaResult = calculateYearEndAdjustment(empId, targetYear, allPayslips, currentYeRecord);
          // difference = withheldTax - finalTax. Positive = refund (還付), Negative = additional charge (追加徴収)
          // yearEndTaxAdjustment acts as a deduction, so refund is negative, charge is positive.
          newSlip.yearEndTaxAdjustment = -yeaResult.difference;
        }
      }

      savePayslip(newSlip);
      successCount++;
    }

    alert(`${successCount}件の給与明細を「下書き」として一括作成しました。`);
    // Refresh to show status changes
    navigateTo('payslip-create');
  };

  const openEditMode = (empId) => {
    // Check if slip exists for this month, if so edit it, else create new
    const existingSlip = allPayslips.find(ps => ps.employeeId === empId && ps.targetYearMonth === targetYearMonth);
    if (existingSlip) {
      navigateTo('payslip-create', { editingPayslipId: existingSlip.id });
    } else {
      // Setup initial form and switch mode directly without routing to preserve dates
      setSelectedEmployeeId(empId);
      
      const emp = getEmployee(empId);
      
      let initialYea = 0;
      if (targetYearMonth.endsWith('-12')) {
        const targetYear = parseInt(targetYearMonth.split('-')[0], 10);
        const yeRecords = getYearEndAdjustments(empId, 'admin');
        const currentYeRecord = yeRecords.find(r => r.targetYear === targetYear && r.status === 'submitted');
        if (currentYeRecord) {
          const yeaResult = calculateYearEndAdjustment(empId, targetYear, allPayslips, currentYeRecord);
          initialYea = -yeaResult.difference;
        }
      }

      setFormData({
        ...initialFormState,
        employeeId: emp.id,
        employeeName: emp.name,
        department: emp.department,
        employmentType: emp.employmentType,
        targetYearMonth,
        paymentDate,
        taxCategory: emp.taxCategory || 'ko',
        dependentsCount: emp.dependentsCount || 0,
        baseSalary: emp.baseSalary,
        titleAllowance: emp.titleAllowance,
        commuteAllowance: emp.commuteAllowance,
        otherAllowance: emp.otherFixedAllowance,
        healthInsurance: emp.fixedHealthInsurance || 0,
        careInsurance: emp.fixedCareInsurance || 0,
        welfarePension: emp.fixedWelfarePension || 0,
        employmentInsurance: emp.fixedLaborInsurance || 0,
        contribution: emp.fixedContribution || 0,
        residentTax: emp.fixedResidentTax || 0,
        yearEndTaxAdjustment: initialYea
      });
      setIsManualTaxOverride(false);
      setViewMode('edit');
    }
  };

  // --- EDIT MODE STATE ---
  const isEdit = !!editingPayslipId || (viewMode === 'edit');
  const initialFormState = {
    employeeId: '',
    employeeName: '',
    department: '',
    employmentType: '',
    targetYearMonth: '',
    paymentDate: '',
    status: 'draft',
    taxCategory: 'ko',
    dependentsCount: 0,
    workDays: 20, absenceDays: 0, paidLeaveDays: 0, overtimeHours: 0, midnightHours: 0, holidayWorkDays: 0,
    baseSalary: 0, titleAllowance: 0, commuteAllowance: 0, overtimeAllowance: 0, midnightAllowance: 0, holidayAllowance: 0, otherAllowance: 0,
    healthInsurance: 0, careInsurance: 0, welfarePension: 0, employmentInsurance: 0, contribution: 0, incomeTax: 0, residentTax: 0, otherDeduction: 0, differenceAdjustment: 0,
    yearEndTaxAdjustment: 0
  };

  const [formData, setFormData] = useState(initialFormState);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [isManualTaxOverride, setIsManualTaxOverride] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);

  // Load existing payslip if editing from router
  useEffect(() => {
    if (editingPayslipId) {
      const slip = getPayslip(editingPayslipId);
      if (slip) {
        const emp = getEmployee(slip.employeeId);
        // If it's a draft, check if master data differs and ask user
        const isDraft = slip.status === 'draft';
        const updatedFields = {};
        let shouldUpdate = false;
        
        if (isDraft && emp) {
          const hasChanges = 
            (emp.baseSalary !== undefined && Number(emp.baseSalary) !== Number(slip.baseSalary)) ||
            (emp.titleAllowance !== undefined && Number(emp.titleAllowance) !== Number(slip.titleAllowance)) ||
            (emp.commuteAllowance !== undefined && Number(emp.commuteAllowance) !== Number(slip.commuteAllowance)) ||
            (emp.otherFixedAllowance !== undefined && Number(emp.otherFixedAllowance) !== Number(slip.otherAllowance)) ||
            (Number(emp.fixedHealthInsurance || 0) !== Number(slip.healthInsurance || 0)) ||
            (Number(emp.fixedCareInsurance || 0) !== Number(slip.careInsurance || 0)) ||
            (Number(emp.fixedWelfarePension || 0) !== Number(slip.welfarePension || 0)) ||
            (Number(emp.fixedLaborInsurance || 0) !== Number(slip.employmentInsurance || 0)) ||
            (Number(emp.fixedContribution || 0) !== Number(slip.contribution || 0)) ||
            (Number(emp.fixedResidentTax || 0) !== Number(slip.residentTax || 0)) ||
            (emp.taxCategory !== slip.taxCategory && emp.taxCategory !== undefined) ||
            (emp.dependentsCount !== slip.dependentsCount && emp.dependentsCount !== undefined);
            
          if (hasChanges) {
            // Need setTimeout to avoid React strict mode / render phase alert issues in some browsers
            // But we are in useEffect, so window.confirm is usually safe here, though it blocks execution.
            if (window.confirm('従業員情報（基本給や保険料、税区分など）が更新されています。\nこの下書き明細の金額を最新の情報へ書き換えますか？')) {
              shouldUpdate = true;
            }
          }
          
          if (shouldUpdate) {
            if (emp.baseSalary !== undefined) updatedFields.baseSalary = emp.baseSalary;
            if (emp.titleAllowance !== undefined) updatedFields.titleAllowance = emp.titleAllowance;
            if (emp.commuteAllowance !== undefined) updatedFields.commuteAllowance = emp.commuteAllowance;
            if (emp.otherFixedAllowance !== undefined) updatedFields.otherAllowance = emp.otherFixedAllowance;
            if (emp.fixedHealthInsurance !== undefined) updatedFields.healthInsurance = emp.fixedHealthInsurance || 0;
            if (emp.fixedCareInsurance !== undefined) updatedFields.careInsurance = emp.fixedCareInsurance || 0;
            if (emp.fixedWelfarePension !== undefined) updatedFields.welfarePension = emp.fixedWelfarePension || 0;
            if (emp.fixedLaborInsurance !== undefined) updatedFields.employmentInsurance = emp.fixedLaborInsurance || 0;
            if (emp.fixedContribution !== undefined) updatedFields.contribution = emp.fixedContribution || 0;
            if (emp.fixedResidentTax !== undefined) updatedFields.residentTax = emp.fixedResidentTax || 0;
            if (emp.taxCategory !== undefined) updatedFields.taxCategory = emp.taxCategory;
            if (emp.dependentsCount !== undefined) updatedFields.dependentsCount = emp.dependentsCount;
          }
        }

        const newFormData = { 
          ...initialFormState, 
          ...slip,
          ...updatedFields
        };
        
        // Ensure taxCategory and dependentsCount fallback correctly
        if (!newFormData.taxCategory) newFormData.taxCategory = 'ko';
        if (newFormData.dependentsCount === undefined) newFormData.dependentsCount = 0;

        setSelectedEmployeeId(slip.employeeId);
        setTargetYearMonth(slip.targetYearMonth);
        setPaymentDate(slip.paymentDate);
        
        const oldTaxableIncome = calcTaxableIncome(slip);
        const oldAutoTax = calcIncomeTax(oldTaxableIncome, slip.taxCategory || 'ko', slip.dependentsCount || 0);
        
        const newTaxableIncome = calcTaxableIncome(newFormData);
        const newAutoTax = calcIncomeTax(newTaxableIncome, newFormData.taxCategory, newFormData.dependentsCount);
        
        let manualOverride = false;
        
        if (shouldUpdate) {
           if (Number(slip.incomeTax) === oldAutoTax || slip.incomeTax === undefined) {
             newFormData.incomeTax = newAutoTax;
           } else {
             manualOverride = true;
           }
        } else {
           if (Number(slip.incomeTax) !== newAutoTax && slip.incomeTax !== undefined) {
             manualOverride = true;
           }
        }
        
        setFormData(newFormData);
        setIsManualTaxOverride(manualOverride);
        setViewMode('edit');
      } else {
        alert('指定された給与明細が見つかりません。');
        navigateTo('payslip-list');
      }
    }
  }, [editingPayslipId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
  };

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseNum(value) }));
  };

  const handleDecimalChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseDecimal(value) }));
  };

  const totalEarnings = calcEarningsTotal(formData);
  const totalDeductions = calcDeductionsTotal(formData);
  const netPay = totalEarnings - totalDeductions;

  const handleSave = async (status) => {
    setErrors({});
    const sanitizedSlip = {
      ...formData,
      status,
      workDays: parseDecimal(formData.workDays), absenceDays: parseDecimal(formData.absenceDays), paidLeaveDays: parseDecimal(formData.paidLeaveDays),
      overtimeHours: parseDecimal(formData.overtimeHours), midnightHours: parseDecimal(formData.midnightHours), holidayWorkDays: parseDecimal(formData.holidayWorkDays),
      baseSalary: parseNum(formData.baseSalary), titleAllowance: parseNum(formData.titleAllowance), commuteAllowance: parseNum(formData.commuteAllowance),
      overtimeAllowance: parseNum(formData.overtimeAllowance), midnightAllowance: parseNum(formData.midnightAllowance), holidayAllowance: parseNum(formData.holidayAllowance),
      otherAllowance: parseNum(formData.otherAllowance),
      healthInsurance: parseNum(formData.healthInsurance), careInsurance: parseNum(formData.careInsurance), welfarePension: parseNum(formData.welfarePension),
      employmentInsurance: parseNum(formData.employmentInsurance), contribution: parseNum(formData.contribution), incomeTax: parseNum(formData.incomeTax),
      residentTax: parseNum(formData.residentTax), otherDeduction: parseNum(formData.otherDeduction), yearEndTaxAdjustment: parseNum(formData.yearEndTaxAdjustment),
      taxCategory: formData.taxCategory || 'ko', dependentsCount: parseNum(formData.dependentsCount)
    };

    const slipId = editingPayslipId || `${sanitizedSlip.employeeId}-${sanitizedSlip.targetYearMonth}`;
    const validation = validatePayslip(sanitizedSlip, editingPayslipId ? editingPayslipId : null);

    if (!validation.isValid) {
      setErrors(validation.errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      sanitizedSlip.id = slipId; // Ensure ID is set
      savePayslip(sanitizedSlip);
      alert(status === 'confirmed' ? '給与明細を確定保存しました。' : '給与明細を下書き保存しました。');
      
      if (editingPayslipId) {
        navigateTo('payslip-list');
      } else {
        setViewMode('list');
      }
    } catch (err) {
      console.error(err);
      setErrors({ global: '給与明細の保存中にエラーが発生しました。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (formData.employeeId && !isManualTaxOverride) {
      const taxableIncome = calcTaxableIncome(formData);
      const autoTax = calcIncomeTax(taxableIncome, formData.taxCategory || 'ko', formData.dependentsCount || 0);
      setFormData(prev => {
        if (prev.incomeTax !== autoTax) return { ...prev, incomeTax: autoTax };
        return prev;
      });
    }
  }, [
    formData.baseSalary, formData.titleAllowance, formData.overtimeAllowance, formData.midnightAllowance, formData.holidayAllowance, formData.otherAllowance,
    formData.healthInsurance, formData.careInsurance, formData.welfarePension, formData.employmentInsurance, formData.taxCategory, formData.dependentsCount,
    formData.employeeId, isManualTaxOverride
  ]);

  if (viewMode === 'list') {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', display: 'flex', alignItems: 'center' }}>
              <Users size={24} style={{ color: 'var(--primary-navy)' }} />
            </div>
            <h1 className="page-title">一括給与明細作成・管理</h1>
          </div>
        </div>

        <div className="card">
          <h2 className="card-title">基本設定</h2>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-group">
              <label>対象年月</label>
              <input type="month" className="form-control" value={targetYearMonth} onChange={(e) => setTargetYearMonth(e.target.value)} />
            </div>
            <div className="form-group">
              <label>支給日</label>
              <input type="date" className="form-control" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>従業員一覧 ({employees.length}名)</h2>
            <button 
              className="btn btn-secondary" 
              onClick={handleBulkRegister}
              disabled={selectedEmpIds.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--status-draft-text)', color: 'var(--status-draft-text)' }}
            >
              <Copy size={16} />
              <span>選択した従業員を一括下書き保存</span>
            </button>
          </div>

          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={selectedEmpIds.length === employees.length && employees.length > 0}
                      onChange={handleSelectAll} 
                    />
                  </th>
                  <th>社員番号</th>
                  <th>氏名</th>
                  <th>前月データ有無</th>
                  <th style={{ textAlign: 'center' }}>当月ステータス</th>
                  <th style={{ textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const stat = getSlipStatus(emp.id, targetYearMonth);
                  const hasPrev = hasPrevSlip(emp.id, targetYearMonth);
                  return (
                    <tr key={emp.id}>
                      <td style={{ textAlign: 'center' }}>
                        <input 
                          type="checkbox" 
                          checked={selectedEmpIds.includes(emp.id)}
                          onChange={() => handleSelectEmp(emp.id)}
                        />
                      </td>
                      <td>{emp.id}</td>
                      <td>{emp.name}</td>
                      <td>
                        {hasPrev ? <span style={{ color: '#16a34a', fontSize: '0.85rem' }}>✓ あり (コピー可)</span> : <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>- なし</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${stat.className}`} style={stat.text === '下書き' ? { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' } : {}}>
                          {stat.text}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => openEditMode(emp.id)}
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          <Edit2 size={14} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                          個別作成・編集
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      在籍中の従業員が見つかりません。
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- EDIT MODE RENDER ---
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (editingPayslipId) navigateTo('payslip-list');
              else setViewMode('list');
            }}
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
        <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.85rem' }}>
          <span>{errors.global}</span>
        </div>
      )}

      {/* Block 1: 基本情報 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>基本情報</h2>
          <span style={{ fontWeight: 600, color: 'var(--primary-navy)' }}>
            対象従業員: {formData.employeeName} ({formData.employeeId})
          </span>
        </div>
        
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label>対象年月 <span className="required">*</span></label>
            <input name="targetYearMonth" type="month" className="form-control" value={formData.targetYearMonth} onChange={handleChange} disabled={isEdit || isSubmitting} />
            {errors.targetYearMonth && <span className="form-error">{errors.targetYearMonth}</span>}
          </div>
          <div className="form-group">
            <label>支給日 <span className="required">*</span></label>
            <input name="paymentDate" type="date" className="form-control" value={formData.paymentDate} onChange={handleChange} disabled={isSubmitting} />
            {errors.paymentDate && <span className="form-error">{errors.paymentDate}</span>}
          </div>
        </div>

        {formData.employeeId && (
          <div style={{ marginTop: '16px', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden' }}>
            <button 
              type="button"
              onClick={() => setIsAccordionOpen(!isAccordionOpen)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: 'var(--bg-light)', border: 'none', cursor: 'pointer', fontWeight: 600, color: 'var(--text-main)' }}
            >
              <span>従業員付帯情報（税・控除用）</span>
              {isAccordionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            
            {isAccordionOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', padding: '16px', backgroundColor: '#fff', fontSize: '0.85rem', borderTop: '1px solid var(--border)' }}>
                <div><span style={{ color: 'var(--text-muted)' }}>氏名:</span> <strong>{formData.employeeName}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>社員番号:</span> <strong>{formData.employeeId}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>部署:</span> <strong>{formData.department || '-'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>雇用区分:</span> <strong>{formData.employmentType || '-'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>源泉徴収:</span> <strong>{formData.taxCategory === 'otsu' ? '乙欄' : '甲欄'}</strong></div>
                <div><span style={{ color: 'var(--text-muted)' }}>扶養人数:</span> <strong>{formData.dependentsCount || 0}人</strong></div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="payslip-net-highlight" style={{ animation: 'fadeIn 0.2s ease-out' }}>
        <span className="payslip-net-label">差引支給額 (手取り計算)</span>
        <span className="payslip-net-val">¥ {fmt(netPay)}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title" style={{ color: '#1d4ed8' }}>支給項目</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {['baseSalary:基本給', 'titleAllowance:役職手当', 'commuteAllowance:通勤手当', 'overtimeAllowance:残業手当', 'midnightAllowance:深夜手当', 'holidayAllowance:休日手当', 'otherAllowance:その他手当'].map(item => {
              const [name, label] = item.split(':');
              return (
                <div key={name} className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
                  <label htmlFor={name}>{label}</label>
                  <input id={name} name={name} type="number" min="0" className="form-control numeric" value={formData[name]} onChange={handleNumericChange} disabled={isSubmitting} />
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '14px', fontWeight: 700, fontSize: '1rem', color: 'var(--primary-navy)' }}>
              <span>支給合計</span><span className="numeric">¥ {fmt(totalEarnings)}</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <h2 className="card-title" style={{ color: '#ef4444' }}>控除項目</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {['healthInsurance:健康保険', 'careInsurance:介護保険', 'welfarePension:厚生年金', 'employmentInsurance:雇用・労働保険', 'contribution:搬出金'].map(item => {
              const [name, label] = item.split(':');
              return (
                <div key={name} className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
                  <label htmlFor={name}>{label}</label>
                  <input id={name} name={name} type="number" min="0" className="form-control numeric" value={formData[name]} onChange={handleNumericChange} disabled={isSubmitting} />
                </div>
              );
            })}
            
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="incomeTax" style={{ display: 'flex', flexDirection: 'column' }}>
                <span>所得税</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formData.taxCategory === 'otsu' ? '乙欄' : '甲欄'} ({formData.dependentsCount || 0}人)</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input id="incomeTax" name="incomeTax" type="number" min="0" className="form-control numeric" value={formData.incomeTax} onChange={(e) => { handleNumericChange(e); setIsManualTaxOverride(true); }} disabled={isSubmitting} style={{ flex: 1 }} />
                  {isManualTaxOverride && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setIsManualTaxOverride(false); setFormData(prev => ({ ...prev, incomeTax: calcIncomeTax(calcTaxableIncome(formData), formData.taxCategory || 'ko', formData.dependentsCount || 0) })); }} style={{ padding: '6px 10px', fontSize: '0.75rem' }} title="自動計算された税額に戻します">自動設定</button>
                  )}
                </div>
                {!isManualTaxOverride && formData.employeeId && <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>✓ 税額表から自動計算 (<a href={settings.taxTableUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-sky)' }}>参照元</a>)</span>}
                {isManualTaxOverride && formData.employeeId && <span style={{ fontSize: '0.75rem', color: '#ea580c' }}>⚠️ 手動調整中 (自動: ¥{fmt(calcIncomeTax(calcTaxableIncome(formData), formData.taxCategory || 'ko', formData.dependentsCount || 0))} - <a href={settings.taxTableUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-sky)' }}>税額表</a>)</span>}
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
            <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center' }}>
              <label htmlFor="differenceAdjustment">差額調整費</label>
              <input id="differenceAdjustment" name="differenceAdjustment" type="number" min="0" className="form-control numeric" value={formData.differenceAdjustment} onChange={handleNumericChange} disabled={isSubmitting} />
            </div>
            
            {formData.targetYearMonth?.endsWith('-12') && (
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', backgroundColor: '#fef3c7', padding: '8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                <label htmlFor="yearEndTaxAdjustment" style={{ color: '#92400e', fontWeight: 'bold' }}>年末調整過不足税額</label>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <input id="yearEndTaxAdjustment" name="yearEndTaxAdjustment" type="number" className="form-control numeric" value={formData.yearEndTaxAdjustment} onChange={handleNumericChange} disabled={isSubmitting} />
                  <span style={{ fontSize: '0.75rem', color: '#92400e', marginTop: '4px' }}>※プラスは追加徴収、マイナスは還付金として計算されます。</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid var(--border)', paddingTop: '14px', fontWeight: 700, fontSize: '1rem', color: '#ef4444' }}>
              <span>控除合計</span><span className="numeric">¥ {fmt(totalDeductions)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">勤怠項目</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px' }}>
          {['workDays:出勤日数 (日)', 'absenceDays:欠勤日数 (日)', 'paidLeaveDays:有給取得日数 (日)', 'overtimeHours:残業時間 (時間)', 'midnightHours:深夜時間 (時間)', 'holidayWorkDays:休日出勤日数 (日)'].map(item => {
            const [name, label] = item.split(':');
            return (
              <div key={name} className="form-group">
                <label htmlFor={name}>{label}</label>
                <input id={name} name={name} type="number" step={name.includes('Days') && name !== 'holidayWorkDays' ? "0.5" : name.includes('Hours') ? "0.1" : "1"} min="0" className="form-control numeric" value={formData[name]} onChange={name.includes('Days') && name !== 'holidayWorkDays' || name.includes('Hours') ? handleDecimalChange : handleNumericChange} disabled={isSubmitting} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '40px' }}>
        <button type="button" className="btn btn-secondary" onClick={() => { if (editingPayslipId) navigateTo('payslip-list'); else setViewMode('list'); }} disabled={isSubmitting}>キャンセル</button>
        <button type="button" className="btn btn-secondary" onClick={() => handleSave('draft')} disabled={isSubmitting || !formData.employeeId} style={{ borderColor: 'var(--status-draft-text)', color: 'var(--status-draft-text)' }}><Save size={18} /><span>下書き保存</span></button>
        <button type="button" className="btn btn-primary" onClick={() => handleSave('confirmed')} disabled={isSubmitting || !formData.employeeId}><FileCheck size={18} /><span>確定して保存</span></button>
      </div>
    </div>
  );
}
