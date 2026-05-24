import React, { useState, useEffect } from 'react';
import { getEmployee, saveEmployee } from '../db';
import { Save, UserCircle, Plus, Trash2 } from 'lucide-react';

export default function EmployeeProfile({ session }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    furigana: '',
    email: '',
    postalCode: '',
    address: '',
    myNumber: '',
    hasSpouse: '無',
    birthDate: '',
    familyInfo: '',
    familyMembers: []
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    if (session && session.id) {
      const emp = getEmployee(session.id);
      if (emp) {
        setFormData({
          id: emp.id || '',
          name: emp.name || '',
          furigana: emp.furigana || '',
          email: emp.email || '',
          postalCode: emp.postalCode || '',
          address: emp.address || '',
          myNumber: emp.myNumber || '',
          hasSpouse: emp.hasSpouse || '無',
          birthDate: emp.birthDate || '',
          familyInfo: emp.familyInfo || '',
          familyMembers: emp.familyMembers || []
        });
      }
    }
  }, [session]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
    setMessage({ text: '', type: '' });
    setIsSubmitting(true);

    try {
      // Fetch the most recent full employee record to ensure we don't overwrite other fields
      const currentEmp = getEmployee(session.id);
      if (!currentEmp) throw new Error('従業員データが見つかりません');

      const updatedEmp = {
        ...currentEmp,
        name: formData.name,
        furigana: formData.furigana,
        email: formData.email,
        address: formData.address,
        myNumber: formData.myNumber,
        hasSpouse: formData.hasSpouse,
        birthDate: formData.birthDate,
        familyInfo: formData.familyInfo,
        familyMembers: formData.familyMembers
      };

      await saveEmployee(updatedEmp);
      setMessage({ text: '基本情報を保存しました。', type: 'success' });
      
      // Update session locally if name changed
      if (session.name !== formData.name) {
        session.name = formData.name;
        const KEY_SESSION = 'payslip_session';
        localStorage.setItem(KEY_SESSION, JSON.stringify(session));
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: '保存中にエラーが発生しました。', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ padding: '8px', display: 'flex', alignItems: 'center' }}>
            <UserCircle size={24} style={{ color: 'var(--primary-navy)' }} />
          </div>
          <h1 className="page-title">基本情報の確認・変更</h1>
        </div>
      </div>

      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '6px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: message.type === 'success' ? '#15803d' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fca5a5'}`
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <h2 className="card-title">従業員情報</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            年末調整等の各種申告に使用される基本情報です。正確に入力してください。
          </p>
          
          <div className="form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>社員番号</label>
              <div style={{ padding: '8px 12px', backgroundColor: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-muted)' }}>
                {formData.id}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="name">氏名 <span className="required">*</span></label>
              <input
                id="name"
                name="name"
                type="text"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="furigana">フリガナ <span className="required">*</span></label>
              <input
                id="furigana"
                name="furigana"
                type="text"
                className="form-control"
                value={formData.furigana}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="email">メールアドレス <span className="required">*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </div>

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
              <label htmlFor="address">住所 (住民票の住所)</label>
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
                placeholder="12桁の数字"
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
                    familyMembers: [...prev.familyMembers, { id: Math.random().toString(36).substr(2, 9), name: '', relation: '', birthDate: '', myNumber: '', incomeEstimate: '', nonResident: false, disability: false }]
                  }));
                }}>
                  <Plus size={14} /> 追加
                </button>
              </div>

              {formData.familyMembers.map((item, idx) => (
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

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '40px' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Save size={18} />
            <span>保存する</span>
          </button>
        </div>
      </form>
    </div>
  );
}
