import React, { useState, useEffect } from 'react';
import { getEmployees, saveEmployee, getYearEndAdjustments, saveYearEndAdjustment, uploadImage } from '../db';
import { ArrowLeft, Save, Send, ChevronDown, ChevronUp, FileText, Plus, Trash2, Calculator, Copy, Camera, Image as ImageIcon } from 'lucide-react';

// Helper for generating UUIDs
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function YearEndAdjustment({ session, navigateTo, targetEmployeeId = null }) {
  const isAdmin = session.role === 'admin';
  const isListView = isAdmin && !targetEmployeeId;
  const currentYear = new Date().getFullYear();
  
  const [targetYear, setTargetYear] = useState(currentYear);
  const [yeDataList, setYeDataList] = useState([]);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (isListView) {
      setEmployees(getEmployees().filter(e => e.status === '在籍中'));
      setYeDataList(getYearEndAdjustments(null, session.role));
    }
  }, [isListView, session.role]);

  // --- FORM STATE STRUCTURE ---
  const editingEmpId = targetEmployeeId || session.id;
  const editingEmp = getEmployees().find(e => e.id === editingEmpId);

  const defaultDependentForm = {
    spouse: { name: '', myNumber: '', birthDate: '', incomeEstimate: '', nonResident: false, disability: false },
    dependents: [],
    under16Dependents: [],
    disabilityType: 'none', // 'none', 'general', 'special', 'livingWith'
    singleParent: false,
    widow: false,
    workingStudent: false
  };

  // Function to build initial dependent form from employee basic info
  const buildDependentFormFromEmployee = (emp) => {
    const form = JSON.parse(JSON.stringify(defaultDependentForm));
    if (!emp || !emp.familyMembers) return form;

    emp.familyMembers.forEach(m => {
      if (['夫', '妻', '配偶者'].includes(m.relation)) {
        form.spouse = { ...form.spouse, ...m };
      } else {
        if (m.birthDate) {
          const birthYear = parseInt(m.birthDate.split('-')[0], 10);
          if (targetYear - birthYear < 16) {
            form.under16Dependents.push(m);
          } else {
            form.dependents.push(m);
          }
        } else {
          form.dependents.push(m); // Default to regular dependent if no age
        }
      }
    });
    return form;
  };

  const defaultBasicForm = {
    incomeEstimate: '',
    spouseIncomeEstimate: '',
    adjustmentDeduction: { apply: false, reason: 'none', details: '' }
  };

  const defaultInsuranceForm = {
    lifeInsurance: [],
    earthquakeInsurance: [],
    socialInsurance: [],
    smallEnterpriseMutual: '',
    images: [] // Array of image URLs or base64 strings
  };

  const [formData, setFormData] = useState({
    id: '',
    employeeId: editingEmpId,
    targetYear: currentYear,
    status: 'draft',
    dependentDeclaration: defaultDependentForm,
    basicDeclaration: defaultBasicForm,
    insuranceDeclaration: defaultInsuranceForm
  });

  const [openAccordions, setOpenAccordions] = useState({
    dependent: false,
    basic: false,
    insurance: false
  });

  useEffect(() => {
    if (!isListView) {
      const records = getYearEndAdjustments(editingEmpId, session.role);
      const currentRecord = records.find(r => r.targetYear === targetYear);
      
      if (currentRecord) {
        // Parse declarations which might be stored as string or legacy text
        const parse = (val, def) => {
          if (!val) return def;
          if (typeof val === 'string') {
            try { return JSON.parse(val); } catch(e) { return { ...def, _legacyText: val }; }
          }
          return { ...def, ...val };
        };

        setFormData({
          ...currentRecord,
          dependentDeclaration: parse(currentRecord.dependentDeclaration, buildDependentFormFromEmployee(editingEmp)),
          basicDeclaration: parse(currentRecord.basicDeclaration, defaultBasicForm),
          insuranceDeclaration: parse(currentRecord.insuranceDeclaration, defaultInsuranceForm)
        });
      } else {
        setFormData({
          id: '',
          employeeId: editingEmpId,
          targetYear: targetYear,
          status: 'draft',
          dependentDeclaration: buildDependentFormFromEmployee(editingEmp),
          basicDeclaration: defaultBasicForm,
          insuranceDeclaration: defaultInsuranceForm
        });
      }
    }
  }, [isListView, editingEmpId, targetYear, session.role]);

  const toggleAccordion = (key) => setOpenAccordions(prev => ({ ...prev, [key]: !prev[key] }));

  // --- HANDLERS FOR NESTED DATA ---
  const updateNestedObj = (section, path, value) => {
    setFormData(prev => {
      const newSection = { ...prev[section] };
      let current = newSection;
      const keys = path.split('.');
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return { ...prev, [section]: newSection };
    });
  };

  const updateListObj = (section, listName, id, field, value) => {
    setFormData(prev => {
      const newSection = { ...prev[section] };
      newSection[listName] = newSection[listName].map(item => 
        item.id === id ? { ...item, [field]: value } : item
      );
      return { ...prev, [section]: newSection };
    });
  };

  const addListItem = (section, listName, defaultItem) => {
    setFormData(prev => {
      const newSection = { ...prev[section] };
      newSection[listName] = [...newSection[listName], { ...defaultItem, id: generateId() }];
      return { ...prev, [section]: newSection };
    });
  };

  const removeListItem = (section, listName, id) => {
    setFormData(prev => {
      const newSection = { ...prev[section] };
      newSection[listName] = newSection[listName].filter(item => item.id !== id);
      return { ...prev, [section]: newSection };
    });
  };

  const handleAutoCalculateIncome = () => {
    if (!editingEmp) return;
    
    // Estimate gross salary for the year based on current fixed salary * 12
    const fixedGross = (
      (parseInt(editingEmp.baseSalary, 10) || 0) +
      (parseInt(editingEmp.titleAllowance, 10) || 0) +
      (parseInt(editingEmp.otherFixedAllowance, 10) || 0)
    ) * 12;
    
    let deduction = 0;
    const r = fixedGross;
    if (r <= 1625000) deduction = 550000;
    else if (r <= 1800000) deduction = r * 0.4 - 100000;
    else if (r <= 3600000) deduction = r * 0.3 + 80000;
    else if (r <= 6600000) deduction = r * 0.2 + 440000;
    else if (r <= 8500000) deduction = r * 0.1 + 1100000;
    else deduction = 1950000;
    
    const estimatedIncome = Math.max(0, r - deduction);
    
    updateNestedObj('basicDeclaration', 'incomeEstimate', Math.floor(estimatedIncome));
  };

  const handleCopyFromPreviousYear = () => {
    if (!window.confirm(`${targetYear - 1}年の申告データをコピーします。現在の入力内容は上書きされます。よろしいですか？`)) return;
    const records = getYearEndAdjustments(editingEmpId, session.role);
    const prevRecord = records.find(r => r.targetYear === targetYear - 1);
    
    if (prevRecord) {
      const parse = (val, def) => {
        if (!val) return def;
        if (typeof val === 'string') {
          try { return JSON.parse(val); } catch(e) { return def; }
        }
        return { ...def, ...val };
      };

      setFormData(prev => ({
        ...prev,
        dependentDeclaration: parse(prevRecord.dependentDeclaration, defaultDependentForm),
        basicDeclaration: parse(prevRecord.basicDeclaration, defaultBasicForm),
        insuranceDeclaration: parse(prevRecord.insuranceDeclaration, defaultInsuranceForm)
      }));
      alert(`${targetYear - 1}年のデータをコピーしました。`);
    } else {
      alert(`${targetYear - 1}年のデータが見つかりませんでした。`);
    }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    // Process and compress each image before uploading
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height && width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          } else if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Compress significantly for localStorage safety, or decent quality for Firebase
          const base64Compressed = canvas.toDataURL('image/jpeg', 0.6);
          
          try {
            // uploadImage will handle Firebase or fallback to returning Base64
            const finalUrl = await uploadImage(editingEmpId, base64Compressed);
            setFormData(prev => ({
              ...prev,
              insuranceDeclaration: {
                ...prev.insuranceDeclaration,
                images: [...(prev.insuranceDeclaration.images || []), finalUrl]
              }
            }));
          } catch (err) {
            console.error("Image processing error:", err);
            alert("画像のアップロードに失敗しました。");
          }
        };
      };
    }
  };

  const removeImage = (index) => {
    setFormData(prev => {
      const newImages = [...(prev.insuranceDeclaration.images || [])];
      newImages.splice(index, 1);
      return {
        ...prev,
        insuranceDeclaration: { ...prev.insuranceDeclaration, images: newImages }
      };
    });
  };

  const handleSave = async (status) => {
    const dataToSave = { ...formData, status };
    saveYearEndAdjustment(dataToSave);
    
    // Reverse sync back to employee basic info
    if (editingEmp) {
      const sp = dataToSave.dependentDeclaration.spouse;
      const deps = dataToSave.dependentDeclaration.dependents;
      const u16 = dataToSave.dependentDeclaration.under16Dependents;
      
      const newFamily = [];
      if (sp && sp.name) newFamily.push({ ...sp, relation: sp.relation || '配偶者' });
      deps.forEach(d => { if (d.name) newFamily.push(d); });
      u16.forEach(d => { if (d.name) newFamily.push(d); });
      
      const updatedEmp = { ...editingEmp, hasSpouse: (sp && sp.name) ? '有' : '無', familyMembers: newFamily };
      await saveEmployee(updatedEmp);
    }

    alert(status === 'submitted' ? '年末調整申告書を提出しました。' : '年末調整申告書を下書き保存しました。');
    
    if (isAdmin) {
      navigateTo('year-end-adjustment');
    } else {
      setFormData(dataToSave);
    }
  };

  if (isListView) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', display: 'flex', alignItems: 'center' }}><FileText size={24} style={{ color: 'var(--primary-navy)' }} /></div>
            <h1 className="page-title">年末調整 管理 ({targetYear}年)</h1>
          </div>
        </div>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 className="card-title" style={{ margin: 0 }}>従業員提出状況</h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <label>対象年:</label>
              <input type="number" className="form-control" value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} style={{ width: '100px' }} />
            </div>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>社員番号</th><th>氏名</th><th>部署</th><th style={{ textAlign: 'center' }}>提出ステータス</th><th style={{ textAlign: 'center' }}>操作</th></tr></thead>
              <tbody>
                {employees.map(emp => {
                  const record = yeDataList.find(r => r.employeeId === emp.id && r.targetYear === targetYear);
                  let statText = '未着手', badgeClass = 'badge-retired';
                  if (record) {
                    if (record.status === 'submitted') { statText = '提出済'; badgeClass = 'badge-active'; }
                    else { statText = '下書き作成中'; badgeClass = 'badge-warning'; }
                  }
                  return (
                    <tr key={emp.id}>
                      <td>{emp.id}</td><td>{emp.name}</td><td>{emp.department || '-'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${badgeClass}`} style={statText === '下書き作成中' ? { backgroundColor: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' } : {}}>{statText}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigateTo('year-end-adjustment', { targetEmployeeId: emp.id })}>詳細確認 / 編集</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // --- EDIT VIEW ---
  const dep = formData.dependentDeclaration;
  const bas = formData.basicDeclaration;
  const ins = formData.insuranceDeclaration;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isAdmin && <button className="btn btn-secondary btn-sm" onClick={() => navigateTo('year-end-adjustment')} style={{ padding: '8px' }}><ArrowLeft size={16} /></button>}
          <h1 className="page-title">年末調整申告 ({targetYear}年)</h1>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleCopyFromPreviousYear} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Copy size={16} /> 前年のデータをコピー
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">申告者情報</h2>
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>対象年度:</span> <strong>{targetYear}年分</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>氏名:</span> <strong>{editingEmp?.name || '不明'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>社員番号:</span> <strong>{editingEmpId}</strong></div>
        </div>
        {formData.status === 'submitted' && <div style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#15803d', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 'bold' }}>✓ この年の年末調整申告は「提出済」です。</div>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Accordion 1: 扶養控除等申告書 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: '#fff', overflow: 'hidden' }}>
          <button onClick={() => toggleAccordion('dependent')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-light)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', color: 'var(--primary-navy)' }}>
            <span>{openAccordions.dependent ? '▲' : '▼'} 1. 扶養控除等申告書</span>
            {openAccordions.dependent ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openAccordions.dependent && (
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
              
              {/* 配偶者 */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>源泉控除対象配偶者</h3>
              <div className="form-grid" style={{ marginBottom: '24px' }}>
                <div className="form-group"><label>氏名</label><input type="text" className="form-control" value={dep.spouse.name} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.name', e.target.value)} /></div>
                <div className="form-group"><label>個人番号</label><input type="text" className="form-control" value={dep.spouse.myNumber} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.myNumber', e.target.value)} /></div>
                <div className="form-group"><label>生年月日</label><input type="date" className="form-control" value={dep.spouse.birthDate} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.birthDate', e.target.value)} /></div>
                <div className="form-group"><label>本年中の所得見積額 (円)</label><input type="number" className="form-control" value={dep.spouse.incomeEstimate} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.incomeEstimate', e.target.value)} /></div>
                <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center', gridColumn: '1 / -1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={dep.spouse.nonResident} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.nonResident', e.target.checked)} /> 非居住者</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={dep.spouse.disability} onChange={e => updateNestedObj('dependentDeclaration', 'spouse.disability', e.target.checked)} /> 障害者</label>
                </div>
              </div>

              {/* 扶養親族 (16歳以上) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>控除対象扶養親族 (16歳以上)</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addListItem('dependentDeclaration', 'dependents', { name: '', relation: '', birthDate: '', myNumber: '', incomeEstimate: '', nonResident: false, disability: false })}>
                  <Plus size={14} /> 追加
                </button>
              </div>
              {dep.dependents.map((item, idx) => (
                <div key={item.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>扶養親族 {idx + 1}</span>
                    <button type="button" className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => removeListItem('dependentDeclaration', 'dependents', item.id)}><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label>氏名</label><input type="text" className="form-control" value={item.name} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'name', e.target.value)} /></div>
                    <div className="form-group"><label>続柄</label><input type="text" className="form-control" value={item.relation} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'relation', e.target.value)} /></div>
                    <div className="form-group"><label>生年月日</label><input type="date" className="form-control" value={item.birthDate} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'birthDate', e.target.value)} /></div>
                    <div className="form-group"><label>個人番号</label><input type="text" className="form-control" value={item.myNumber} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'myNumber', e.target.value)} /></div>
                    <div className="form-group"><label>所得見積額 (円)</label><input type="number" className="form-control" value={item.incomeEstimate} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'incomeEstimate', e.target.value)} /></div>
                    <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={item.nonResident} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'nonResident', e.target.checked)} /> 非居住者</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={item.disability} onChange={e => updateListObj('dependentDeclaration', 'dependents', item.id, 'disability', e.target.checked)} /> 障害者</label>
                    </div>
                  </div>
                </div>
              ))}

              {/* 障害者、寡婦、ひとり親、勤労学生 */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>本人に関する事項（障害者、寡婦、ひとり親、勤労学生）</h3>
              <div className="form-grid" style={{ marginBottom: '24px' }}>
                <div className="form-group">
                  <label>障害者区分</label>
                  <select className="form-control" value={dep.disabilityType} onChange={e => updateNestedObj('dependentDeclaration', 'disabilityType', e.target.value)}>
                    <option value="none">非該当</option>
                    <option value="general">一般の障害者</option>
                    <option value="special">特別障害者</option>
                    <option value="livingWith">同居特別障害者</option>
                  </select>
                </div>
                <div className="form-group" style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={dep.singleParent} onChange={e => updateNestedObj('dependentDeclaration', 'singleParent', e.target.checked)} /> ひとり親</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={dep.widow} onChange={e => updateNestedObj('dependentDeclaration', 'widow', e.target.checked)} /> 寡婦</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><input type="checkbox" checked={dep.workingStudent} onChange={e => updateNestedObj('dependentDeclaration', 'workingStudent', e.target.checked)} /> 勤労学生</label>
                </div>
              </div>

              {/* 16歳未満の扶養親族 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>16歳未満の扶養親族 (住民税用)</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addListItem('dependentDeclaration', 'under16Dependents', { name: '', relation: '', birthDate: '', myNumber: '', incomeEstimate: '', nonResident: false })}>
                  <Plus size={14} /> 追加
                </button>
              </div>
              {dep.under16Dependents.map((item, idx) => (
                <div key={item.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>扶養親族 (16歳未満) {idx + 1}</span>
                    <button type="button" className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => removeListItem('dependentDeclaration', 'under16Dependents', item.id)}><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label>氏名</label><input type="text" className="form-control" value={item.name} onChange={e => updateListObj('dependentDeclaration', 'under16Dependents', item.id, 'name', e.target.value)} /></div>
                    <div className="form-group"><label>続柄</label><input type="text" className="form-control" value={item.relation} onChange={e => updateListObj('dependentDeclaration', 'under16Dependents', item.id, 'relation', e.target.value)} /></div>
                    <div className="form-group"><label>生年月日</label><input type="date" className="form-control" value={item.birthDate} onChange={e => updateListObj('dependentDeclaration', 'under16Dependents', item.id, 'birthDate', e.target.value)} /></div>
                    <div className="form-group"><label>所得見積額 (円)</label><input type="number" className="form-control" value={item.incomeEstimate} onChange={e => updateListObj('dependentDeclaration', 'under16Dependents', item.id, 'incomeEstimate', e.target.value)} /></div>
                  </div>
                </div>
              ))}

              {dep._legacyText && (
                <div className="form-group"><label>【過去の入力データ】</label><textarea className="form-control" readOnly value={dep._legacyText} style={{ height: '80px', backgroundColor: '#f1f5f9' }} /></div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 2: 基礎控除申告書... */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: '#fff', overflow: 'hidden' }}>
          <button onClick={() => toggleAccordion('basic')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-light)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', color: 'var(--primary-navy)' }}>
            <span style={{ textAlign: 'left' }}>{openAccordions.basic ? '▲' : '▼'} 2. 基礎控除申告書兼配偶者控除等申告書兼所得金額調整控除申告書</span>
            {openAccordions.basic ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openAccordions.basic && (
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>本人の本年中の合計所得金額の見積額 (円)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input type="number" className="form-control" value={bas.incomeEstimate} onChange={e => updateNestedObj('basicDeclaration', 'incomeEstimate', e.target.value)} />
                    <button type="button" className="btn btn-secondary" onClick={handleAutoCalculateIncome} title="現在の基本給等から年間の所得金額を自動計算して入力します" style={{ padding: '0 12px' }}>
                      <Calculator size={18} />
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>配偶者の本年中の合計所得金額の見積額 (円)</label>
                  <input type="number" className="form-control" value={bas.spouseIncomeEstimate} onChange={e => updateNestedObj('basicDeclaration', 'spouseIncomeEstimate', e.target.value)} />
                </div>
              </div>

              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>所得金額調整控除申告書</h3>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={bas.adjustmentDeduction.apply} onChange={e => updateNestedObj('basicDeclaration', 'adjustmentDeduction.apply', e.target.checked)} />
                  所得金額調整控除の適用を受ける
                </label>
              </div>
              {bas.adjustmentDeduction.apply && (
                <div className="form-grid" style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <div className="form-group">
                    <label>要件</label>
                    <select className="form-control" value={bas.adjustmentDeduction.reason} onChange={e => updateNestedObj('basicDeclaration', 'adjustmentDeduction.reason', e.target.value)}>
                      <option value="none">選択してください</option>
                      <option value="special_disability_self">あなた自身が特別障害者</option>
                      <option value="special_disability_spouse">同一生計配偶者が特別障害者</option>
                      <option value="special_disability_dependent">扶養親族が特別障害者</option>
                      <option value="under_23_dependent">扶養親族が年齢23歳未満</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>対象者の氏名等詳細</label>
                    <input type="text" className="form-control" value={bas.adjustmentDeduction.details} onChange={e => updateNestedObj('basicDeclaration', 'adjustmentDeduction.details', e.target.value)} placeholder="例: 山田 一郎 (子)" />
                  </div>
                </div>
              )}

              {bas._legacyText && (
                <div className="form-group" style={{ marginTop: '24px' }}><label>【過去の入力データ】</label><textarea className="form-control" readOnly value={bas._legacyText} style={{ height: '80px', backgroundColor: '#f1f5f9' }} /></div>
              )}
            </div>
          )}
        </div>

        {/* Accordion 3: 保険料控除申告書 */}
        <div style={{ border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: '#fff', overflow: 'hidden' }}>
          <button onClick={() => toggleAccordion('insurance')} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-light)', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', color: 'var(--primary-navy)' }}>
            <span>{openAccordions.insurance ? '▲' : '▼'} 3. 保険料控除申告書</span>
            {openAccordions.insurance ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
          {openAccordions.insurance && (
            <div style={{ padding: '20px', borderTop: '1px solid var(--border)' }}>
              
              {/* 生命保険料 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>生命保険料控除</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addListItem('insuranceDeclaration', 'lifeInsurance', { type: 'general', company: '', policyName: '', contractorName: '', amount: '' })}>
                  <Plus size={14} /> 追加
                </button>
              </div>
              {ins.lifeInsurance.map((item, idx) => (
                <div key={item.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>保険 {idx + 1}</span>
                    <button type="button" className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => removeListItem('insuranceDeclaration', 'lifeInsurance', item.id)}><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>保険の種類</label>
                      <select className="form-control" value={item.type} onChange={e => updateListObj('insuranceDeclaration', 'lifeInsurance', item.id, 'type', e.target.value)}>
                        <option value="general">一般の生命保険料</option>
                        <option value="care">介護医療保険料</option>
                        <option value="pension">個人年金保険料</option>
                      </select>
                    </div>
                    <div className="form-group"><label>保険会社名</label><input type="text" className="form-control" value={item.company} onChange={e => updateListObj('insuranceDeclaration', 'lifeInsurance', item.id, 'company', e.target.value)} /></div>
                    <div className="form-group"><label>保険等の名称</label><input type="text" className="form-control" value={item.policyName} onChange={e => updateListObj('insuranceDeclaration', 'lifeInsurance', item.id, 'policyName', e.target.value)} /></div>
                    <div className="form-group"><label>本年中に支払った金額 (円)</label><input type="number" className="form-control" value={item.amount} onChange={e => updateListObj('insuranceDeclaration', 'lifeInsurance', item.id, 'amount', e.target.value)} /></div>
                  </div>
                </div>
              ))}

              {/* 地震保険料 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>
                <h3 style={{ fontSize: '1rem', margin: 0 }}>地震保険料控除</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => addListItem('insuranceDeclaration', 'earthquakeInsurance', { type: 'earthquake', company: '', amount: '' })}>
                  <Plus size={14} /> 追加
                </button>
              </div>
              {ins.earthquakeInsurance.map((item, idx) => (
                <div key={item.id} style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>地震保険 {idx + 1}</span>
                    <button type="button" className="btn btn-sm" style={{ color: '#ef4444' }} onClick={() => removeListItem('insuranceDeclaration', 'earthquakeInsurance', item.id)}><Trash2 size={16} /></button>
                  </div>
                  <div className="form-grid">
                    <div className="form-group"><label>保険会社名</label><input type="text" className="form-control" value={item.company} onChange={e => updateListObj('insuranceDeclaration', 'earthquakeInsurance', item.id, 'company', e.target.value)} /></div>
                    <div className="form-group"><label>本年中に支払った金額 (円)</label><input type="number" className="form-control" value={item.amount} onChange={e => updateListObj('insuranceDeclaration', 'earthquakeInsurance', item.id, 'amount', e.target.value)} /></div>
                  </div>
                </div>
              ))}

              {/* 社会保険料・小規模企業共済 */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>社会保険料・小規模企業共済等掛金</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>小規模企業共済等掛金 (iDeCo等) (円)</label>
                  <input type="number" className="form-control" value={ins.smallEnterpriseMutual} onChange={e => updateNestedObj('insuranceDeclaration', 'smallEnterpriseMutual', e.target.value)} />
                </div>
              </div>

              {/* 証明書アップロード */}
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '16px', marginTop: '24px' }}>証明書（控除証明書ハガキ等）の画像提出</h3>
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '12px' }}>
                  保険料控除等のハガキ原本を提出する前に、スマホで撮影して画像を添付しておくことができます。（管理者が金額を確認しやすくなります）
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
                  {(ins.images || []).map((imgUrl, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '100px', height: '100px', border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={imgUrl} alt={`証明書 ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeImage(idx)} style={{ position: 'absolute', top: '4px', right: '4px', backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
                    </div>
                  ))}
                </div>
                <label className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <Camera size={16} /> カメラで撮影 / 画像を選択
                  <input type="file" accept="image/*" capture="environment" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
              </div>

              {ins._legacyText && (
                <div className="form-group" style={{ marginTop: '24px' }}><label>【過去の入力データ】</label><textarea className="form-control" readOnly value={ins._legacyText} style={{ height: '80px', backgroundColor: '#f1f5f9' }} /></div>
              )}
            </div>
          )}
        </div>

      </div>

      <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '30px', marginBottom: '40px' }}>
        <button className="btn btn-secondary" onClick={() => handleSave('draft')} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--status-draft-text)', color: 'var(--status-draft-text)' }}>
          <Save size={18} /><span>一時保存（下書き）</span>
        </button>
        <button className="btn btn-primary" onClick={() => handleSave('submitted')} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Send size={18} /><span>提出する（確定）</span>
        </button>
      </div>
    </div>
  );
}
