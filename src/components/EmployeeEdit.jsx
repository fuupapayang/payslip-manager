import React, { useState, useEffect } from 'react';
import { getEmployee, getEmployees, saveEmployee } from '../db';
import { validateEmployee, parseNum } from '../utils';
import { ArrowLeft, Save, ShieldAlert, Plus, Trash2 } from 'lucide-react';

export default function EmployeeEdit({ employeeId, navigateTo }) {
  const isEdit = !!employeeId;
  const allEmployees = getEmployees();

  // Initial employee state template
  const initialFormState = {
    id: '',
    name: '',
    furigana: '',
    email: '',
    role: 'employee',
    plainTextPassword: '',
    department: '',
    employmentType: '正社員',
    hireDate: '',
    baseSalary: 0,
    commuteAllowance: 0,
    titleAllowance: 0,
    otherFixedAllowance: 0,
    fixedHealthInsurance: 0,
    fixedCareInsurance: 0,
    fixedWelfarePension: 0,
    fixedLaborInsurance: 0,
    fixedContribution: 0,
    fixedResidentTax: 0,
    bankName: '',
    branchName: '',
    accountType: '普通',
    accountNumber: '',
    status: '在籍中',
    taxCategory: 'ko', // ko | otsu
    dependentsCount: 0,
    postalCode: '',
    address: '',
    myNumber: '',
    hasSpouse: '無',
    birthDate: '',
    familyInfo: '',
    familyMembers: []
  };

  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load employee data on edit mode mount
  useEffect(() => {
    if (isEdit) {
      const emp = getEmployee(employeeId);
      if (emp) {
        setFormData({
          ...initialFormState,
          ...emp,
          plainTextPassword: '' // Don't expose password hash in input
        });
      } else {
        alert('指定された従業員が見つかりません。');
        navigateTo('employee-list');
      }
    }
  }, [employeeId, isEdit]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear field-specific error as user types
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
    // Keep empty input as empty, but convert to number on blur or math calculation
    setFormData(prev => ({
      ...prev,
      [name]: value === '' ? '' : parseNum(value)
    }));
  };

  const handleZipCodeSearch = async () => {
    if (!formData.postalCode) return;
    try {
      const cleanZip = formData.postalCode.replace(/-/g, '');
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${cleanZip}`);
      const data = await response.json();
      if (data.status === 200 && data.results) {
        const result = data.results[0];
        const addressStr = `${result.address1}${result.address2}${result.address3}`;
        setFormData(prev => ({
          ...prev,
          address: addressStr
        }));
      } else {
        alert('郵便番号から住所が見つかりませんでした。');
      }
    } catch (err) {
      console.error(err);
      alert('住所の自動取得に失敗しました。');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    // Formatting checks (convert empty numeric fields to 0 before validating)
    const sanitizedData = {
      ...formData,
      baseSalary: parseNum(formData.baseSalary),
      commuteAllowance: parseNum(formData.commuteAllowance),
      titleAllowance: parseNum(formData.titleAllowance),
      otherFixedAllowance: parseNum(formData.otherFixedAllowance),
      fixedHealthInsurance: parseNum(formData.fixedHealthInsurance),
      fixedCareInsurance: parseNum(formData.fixedCareInsurance),
      fixedWelfarePension: parseNum(formData.fixedWelfarePension),
      fixedLaborInsurance: parseNum(formData.fixedLaborInsurance),
      fixedContribution: parseNum(formData.fixedContribution),
      fixedResidentTax: parseNum(formData.fixedResidentTax),
      dependentsCount: parseNum(formData.dependentsCount),
    };

    const validation = validateEmployee(sanitizedData, allEmployees, isEdit);

    if (!validation.isValid) {
      setErrors(validation.errors);
      // Scroll to top of form or first error
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSubmitting(true);
    try {
      await saveEmployee(sanitizedData);
      alert(isEdit ? '従業員情報を更新しました。' : '新しい従業員を登録しました。');
      navigateTo('employee-list');
    } catch (err) {
      console.error(err);
      setErrors({ global: '保存中にエラーが発生しました。入力内容を確認してください。' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => navigateTo('employee-list')}
            style={{ padding: '8px' }}
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="page-title">
            {isEdit ? '従業員情報の編集' : '新規従業員登録'}
          </h1>
        </div>
      </div>

      {errors.global && (
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
          <ShieldAlert size={18} />
          <span>{errors.global}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        
        {/* Section 1: 基本情報 */}
        <div className="card">
          <h2 className="card-title">基本情報</h2>
          <div className="form-grid">
            
            <div className="form-group">
              <label htmlFor="id">
                社員番号 <span className="required">*</span>
              </label>
              <input
                id="id"
                name="id"
                type="text"
                className="form-control"
                placeholder="例: EMP004"
                value={formData.id}
                onChange={handleChange}
                disabled={isEdit || isSubmitting}
              />
              {errors.id && <span className="form-error">{errors.id}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="name">
                氏名 <span className="required">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-control"
                placeholder="例: 山田 太郎"
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="furigana">
                フリガナ <span className="required">*</span>
              </label>
              <input
                id="furigana"
                name="furigana"
                type="text"
                className="form-control"
                placeholder="例: ヤマダ タロウ"
                value={formData.furigana}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.furigana && <span className="form-error">{errors.furigana}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="email">
                メールアドレス <span className="required">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="text"
                className="form-control"
                placeholder="例: email@example.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
              />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="plainTextPassword">
                {isEdit ? 'ログインパスワード変更' : '初期ログインパスワード'}
              </label>
              <input
                id="plainTextPassword"
                name="plainTextPassword"
                type="password"
                className="form-control"
                placeholder={isEdit ? '変更する場合のみ入力' : '空欄時は「temp123」になります'}
                value={formData.plainTextPassword}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="department">部署</label>
              <input
                id="department"
                name="department"
                type="text"
                className="form-control"
                placeholder="例: 営業部"
                value={formData.department}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="employmentType">雇用区分</label>
              <select
                id="employmentType"
                name="employmentType"
                className="form-control"
                value={formData.employmentType}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="役員">役員</option>
                <option value="正社員">正社員</option>
                <option value="契約社員">契約社員</option>
                <option value="アルバイト">アルバイト</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="hireDate">入社日</label>
              <input
                id="hireDate"
                name="hireDate"
                type="date"
                className="form-control"
                value={formData.hireDate}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="taxCategory">源泉徴収区分</label>
              <select
                id="taxCategory"
                name="taxCategory"
                className="form-control"
                value={formData.taxCategory}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="ko">甲欄 (主たる給与・扶養控除等申告書あり)</option>
                <option value="otsu">乙欄 (従たる給与・他社が主)</option>
              </select>
              {errors.taxCategory && <span className="form-error">{errors.taxCategory}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="dependentsCount">扶養親族等の数 (人)</label>
              <input
                id="dependentsCount"
                name="dependentsCount"
                type="number"
                min="0"
                className="form-control"
                value={formData.dependentsCount}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.dependentsCount && <span className="form-error">{errors.dependentsCount}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="status">ステータス</label>
              <select
                id="status"
                name="status"
                className="form-control"
                value={formData.status}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="在籍中">在籍中</option>
                <option value="退職済み">退職済み</option>
              </select>
            </div>

          </div>
        </div>

        {/* Section 1.5: 詳細基本情報（年末調整等用） */}
        <div className="card">
          <h2 className="card-title">詳細基本情報（年末調整等に利用）</h2>
          <div className="form-grid">
            
            <div className="form-group">
              <label htmlFor="postalCode">郵便番号</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="postalCode"
                  name="postalCode"
                  type="text"
                  className="form-control"
                  placeholder="例: 1500043"
                  value={formData.postalCode || ''}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ flex: 1 }}
                />
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleZipCodeSearch}
                  disabled={isSubmitting || !formData.postalCode}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  住所自動入力
                </button>
              </div>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="address">住所</label>
              <input
                id="address"
                name="address"
                type="text"
                className="form-control"
                placeholder="例: 東京都渋谷区道玄坂1-2-3"
                value={formData.address || ''}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="myNumber">マイナンバー (個人番号)</label>
              <input
                id="myNumber"
                name="myNumber"
                type="text"
                className="form-control"
                placeholder="例: 123456789012"
                value={formData.myNumber}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="birthDate">生年月日</label>
              <input
                id="birthDate"
                name="birthDate"
                type="date"
                className="form-control"
                value={formData.birthDate}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="hasSpouse">配偶者の有無</label>
              <select
                id="hasSpouse"
                name="hasSpouse"
                className="form-control"
                value={formData.hasSpouse}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="無">無</option>
                <option value="有">有</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>扶養対象の家族情報・備考</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    familyMembers: [...(prev.familyMembers || []), { id: Math.random().toString(36).substr(2, 9), name: '', relation: '', birthDate: '', myNumber: '', incomeEstimate: '', nonResident: false, disability: false }]
                  }));
                }}>
                  <Plus size={14} /> 追加
                </button>
              </div>

              {(formData.familyMembers || []).map((item, idx) => (
                <div key={item.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>家族 {idx + 1}</span>
                    <button type="button" className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        familyMembers: prev.familyMembers.filter(f => f.id !== item.id)
                      }));
                    }}><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label>氏名</label><input type="text" className="form-control" value={item.name} onChange={e => {
                      const newMembers = [...formData.familyMembers];
                      newMembers[idx].name = e.target.value;
                      setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                    }} /></div>
                    <div className="form-group"><label>続柄</label><input type="text" className="form-control" value={item.relation} onChange={e => {
                      const newMembers = [...formData.familyMembers];
                      newMembers[idx].relation = e.target.value;
                      setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                    }} /></div>
                    <div className="form-group"><label>生年月日</label><input type="date" className="form-control" value={item.birthDate} onChange={e => {
                      const newMembers = [...formData.familyMembers];
                      newMembers[idx].birthDate = e.target.value;
                      setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                    }} /></div>
                    <div className="form-group"><label>個人番号</label><input type="text" className="form-control" value={item.myNumber} onChange={e => {
                      const newMembers = [...formData.familyMembers];
                      newMembers[idx].myNumber = e.target.value;
                      setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                    }} /></div>
                    <div className="form-group"><label>所得見積額 (円)</label><input type="number" className="form-control" value={item.incomeEstimate} onChange={e => {
                      const newMembers = [...formData.familyMembers];
                      newMembers[idx].incomeEstimate = e.target.value;
                      setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                    }} /></div>
                    <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={item.nonResident} onChange={e => {
                        const newMembers = [...formData.familyMembers];
                        newMembers[idx].nonResident = e.target.checked;
                        setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                      }} /> 非居住者</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={item.disability} onChange={e => {
                        const newMembers = [...formData.familyMembers];
                        newMembers[idx].disability = e.target.checked;
                        setFormData(prev => ({ ...prev, familyMembers: newMembers }));
                      }} /> 障害者</label>
                    </div>
                  </div>
                </div>
              ))}
              
              <label htmlFor="familyInfo" style={{ marginTop: '16px', display: 'block' }}>備考</label>
              <textarea
                id="familyInfo"
                name="familyInfo"
                className="form-control"
                placeholder="その他の情報など"
                value={formData.familyInfo}
                onChange={handleChange}
                disabled={isSubmitting}
                style={{ resize: 'vertical', minHeight: '60px' }}
              />
            </div>
          </div>
        </div>

        {/* Section 2: 固定支給項目 (テンプレート) */}
        <div className="card">
          <h2 className="card-title">固定支給項目（明細作成時の初期値になります）</h2>
          <div className="form-grid">
            
            <div className="form-group">
              <label htmlFor="baseSalary">基本給 (円)</label>
              <input
                id="baseSalary"
                name="baseSalary"
                type="number"
                min="0"
                className="form-control"
                value={formData.baseSalary}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.baseSalary && <span className="form-error">{errors.baseSalary}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="commuteAllowance">通勤手当 (円)</label>
              <input
                id="commuteAllowance"
                name="commuteAllowance"
                type="number"
                min="0"
                className="form-control"
                value={formData.commuteAllowance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.commuteAllowance && <span className="form-error">{errors.commuteAllowance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="titleAllowance">役職手当 (円)</label>
              <input
                id="titleAllowance"
                name="titleAllowance"
                type="number"
                min="0"
                className="form-control"
                value={formData.titleAllowance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.titleAllowance && <span className="form-error">{errors.titleAllowance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="otherFixedAllowance">その他固定手当 (円)</label>
              <input
                id="otherFixedAllowance"
                name="otherFixedAllowance"
                type="number"
                min="0"
                className="form-control"
                value={formData.otherFixedAllowance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.otherFixedAllowance && <span className="form-error">{errors.otherFixedAllowance}</span>}
            </div>

          </div>
        </div>

        {/* Section 2.5: 固定控除項目 (テンプレート) */}
        <div className="card">
          <h2 className="card-title">固定控除項目（明細作成時の初期値になります）</h2>
          <div className="form-grid">
            
            <div className="form-group">
              <label htmlFor="fixedHealthInsurance">健康保険 (円)</label>
              <input
                id="fixedHealthInsurance"
                name="fixedHealthInsurance"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedHealthInsurance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedHealthInsurance && <span className="form-error">{errors.fixedHealthInsurance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fixedCareInsurance">介護保険 (円)</label>
              <input
                id="fixedCareInsurance"
                name="fixedCareInsurance"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedCareInsurance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedCareInsurance && <span className="form-error">{errors.fixedCareInsurance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fixedWelfarePension">厚生年金 (円)</label>
              <input
                id="fixedWelfarePension"
                name="fixedWelfarePension"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedWelfarePension}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedWelfarePension && <span className="form-error">{errors.fixedWelfarePension}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fixedLaborInsurance">雇用保険・労働保険 (円)</label>
              <input
                id="fixedLaborInsurance"
                name="fixedLaborInsurance"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedLaborInsurance}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedLaborInsurance && <span className="form-error">{errors.fixedLaborInsurance}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fixedContribution">搬出金 (円)</label>
              <input
                id="fixedContribution"
                name="fixedContribution"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedContribution}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedContribution && <span className="form-error">{errors.fixedContribution}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="fixedResidentTax">市民・県民税 (円)</label>
              <input
                id="fixedResidentTax"
                name="fixedResidentTax"
                type="number"
                min="0"
                className="form-control"
                value={formData.fixedResidentTax}
                onChange={handleNumericChange}
                disabled={isSubmitting}
              />
              {errors.fixedResidentTax && <span className="form-error">{errors.fixedResidentTax}</span>}
            </div>

          </div>
        </div>

        {/* Section 3: 振込口座情報 */}
        <div className="card">
          <h2 className="card-title">振込口座情報</h2>
          <div className="form-grid">
            
            <div className="form-group">
              <label htmlFor="bankName">銀行名</label>
              <input
                id="bankName"
                name="bankName"
                type="text"
                className="form-control"
                placeholder="例: 三井住友銀行"
                value={formData.bankName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="branchName">支店名</label>
              <input
                id="branchName"
                name="branchName"
                type="text"
                className="form-control"
                placeholder="例: 渋谷支店"
                value={formData.branchName}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="accountType">口座種別</label>
              <select
                id="accountType"
                name="accountType"
                className="form-control"
                value={formData.accountType}
                onChange={handleChange}
                disabled={isSubmitting}
              >
                <option value="普通">普通</option>
                <option value="当座">当座</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="accountNumber">口座番号</label>
              <input
                id="accountNumber"
                name="accountNumber"
                type="text"
                className="form-control"
                placeholder="例: 1234567"
                value={formData.accountNumber}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginBottom: '40px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigateTo('employee-list')}
            disabled={isSubmitting}
          >
            キャンセル
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            <Save size={18} />
            <span>{isSubmitting ? '保存中...' : '従業員情報を保存'}</span>
          </button>
        </div>

      </form>
    </div>
  );
}
