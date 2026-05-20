import React, { useState } from 'react';
import { getEmployees, deleteEmployee } from '../db';
import { fmt } from '../utils';
import { UserPlus, Search, Edit2, Trash2, Eye, EyeOff } from 'lucide-react';

export default function EmployeeList({ navigateTo }) {
  const [employees, setEmployees] = useState(() => getEmployees());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [visiblePasswords, setVisiblePasswords] = useState({});

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`従業員「${name}」を削除しますか？\n※関連する給与明細データもすべて削除されます。この操作は取り消せません。`)) {
      deleteEmployee(id);
      setEmployees(getEmployees()); // Refresh state
    }
  };

  // Filter logic
  const filteredEmployees = employees.filter(emp => {
    // Search keyword match (ID, Name, Furigana, Email)
    const matchesSearch = 
      emp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.furigana.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter match
    const matchesStatus = statusFilter === 'すべて' || emp.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">従業員一覧</h1>
        <button 
          className="btn btn-primary"
          onClick={() => navigateTo('employee-edit', { employeeId: null })}
        >
          <UserPlus size={18} />
          <span>新規従業員登録</span>
        </button>
      </div>

      <div className="card">
        {/* Filters and search banner */}
        <div className="filters-banner">
          <div className="form-group" style={{ flex: 1, minWidth: '240px' }}>
            <label htmlFor="search">キーワード検索</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                id="search"
                type="text"
                className="form-control"
                placeholder="社員番号、氏名、フリガナ、メールアドレス..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ paddingLeft: '38px', width: '100%' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ width: '180px' }}>
            <label htmlFor="statusFilter">ステータス</label>
            <select
              id="statusFilter"
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="すべて">すべて</option>
              <option value="在籍中">在籍中</option>
              <option value="退職済み">退職済み</option>
            </select>
          </div>
        </div>

        {/* Employee Table */}
        {filteredEmployees.length === 0 ? (
          <div style={{ padding: '40px 0', textPosition: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
            該当する従業員が見つかりません。
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>社員番号</th>
                  <th>氏名</th>
                  <th>メールアドレス</th>
                  <th>部署 / 雇用区分</th>
                  <th>入社日</th>
                  <th className="numeric">基本給</th>
                  <th>パスワード</th>
                  <th style={{ textAlign: 'center' }}>ステータス</th>
                  <th style={{ textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => (
                  <tr key={emp.id}>
                    <td style={{ fontWeight: 600 }}>{emp.id}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{emp.furigana}</span>
                        <span style={{ fontWeight: 600 }}>{emp.name}</span>
                      </div>
                    </td>
                    <td>{emp.email}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span>{emp.department || '未設定'}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {emp.employmentType || '-'} / {emp.taxCategory === 'otsu' ? '乙欄' : '甲欄'} ({emp.dependentsCount || 0}人)
                        </span>
                      </div>
                    </td>
                    <td>{emp.hireDate || '-'}</td>
                    <td className="numeric" style={{ fontWeight: 500 }}>¥{fmt(emp.baseSalary)}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.9rem', fontFamily: visiblePasswords[emp.id] ? 'monospace' : 'inherit', letterSpacing: visiblePasswords[emp.id] ? '0px' : '2px' }}>
                          {visiblePasswords[emp.id] ? (emp.password || '未設定') : '••••••••'}
                        </span>
                        <button
                          type="button"
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}
                          onClick={() => togglePasswordVisibility(emp.id)}
                          title={visiblePasswords[emp.id] ? "非表示" : "表示"}
                        >
                          {visiblePasswords[emp.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${emp.status === '在籍中' ? 'badge-active' : 'badge-retired'}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary btn-sm"
                          title="編集"
                          onClick={() => navigateTo('employee-edit', { employeeId: emp.id })}
                        >
                          <Edit2 size={14} />
                          <span>編集</span>
                        </button>
                        <button 
                          className="btn btn-danger btn-sm"
                          title="削除"
                          onClick={() => handleDelete(emp.id, emp.name)}
                        >
                          <Trash2 size={14} />
                          <span>削除</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
