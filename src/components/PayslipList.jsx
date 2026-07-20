import React, { useState, useRef } from 'react';
import { getPayslips, deletePayslip, savePayslip } from '../db';
import { calcNetPayout, fmt, fmtYearMonth, parseNum } from '../utils';
import { Search, FilePlus, Eye, Edit2, Trash2, Calendar, Download, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import Papa from 'papaparse';

export default function PayslipList({ navigateTo, session, employeeMode = false }) {
  // If in employee mode, load only their own confirmed payslips
  const targetEmployeeId = employeeMode ? session.id : null;
  const targetRole = employeeMode ? 'employee' : 'admin';

  const [slips, setSlips] = useState(() => getPayslips(targetEmployeeId, targetRole));
  
  // Filter states
  const [searchNameOrId, setSearchNameOrId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [sortConfig, setSortConfig] = useState({ key: 'targetYearMonth', direction: 'desc' });

  const fileInputRef = useRef(null);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDelete = (id, name, month) => {
    if (window.confirm(`「${name}」の ${month}分 の給与明細を削除しますか？\nこの操作は取り消せません。`)) {
      deletePayslip(id);
      setSlips(getPayslips(targetEmployeeId, targetRole)); // Refresh state
    }
  };

  const csvHeaderMap = {
    employeeId: '社員番号',
    employeeName: '氏名',
    department: '部署',
    employmentType: '雇用区分',
    targetYearMonth: '対象年月',
    paymentDate: '支給日',
    status: 'ステータス',
    workDays: '出勤日数',
    absenceDays: '欠勤日数',
    paidLeaveDays: '有休日数',
    overtimeHours: '残業時間',
    midnightHours: '深夜残業時間',
    holidayWorkDays: '休日出勤日数',
    baseSalary: '基本給',
    titleAllowance: '役職手当',
    commuteAllowance: '通勤手当',
    overtimeAllowance: '残業手当',
    midnightAllowance: '深夜残業手当',
    holidayAllowance: '休日出勤手当',
    otherAllowance: 'その他手当',
    healthInsurance: '健康保険',
    careInsurance: '介護保険',
    welfarePension: '厚生年金',
    employmentInsurance: '雇用保険',
    contribution: '搬出金',
    incomeTax: '所得税',
    residentTax: '住民税',
    otherDeduction: 'その他控除',
    differenceAdjustment: '差額調整費'
  };

  const reverseCsvHeaderMap = Object.entries(csvHeaderMap).reduce((acc, [key, value]) => {
    acc[value] = key;
    return acc;
  }, {});

  const handleExportCsv = () => {
    const exportData = filteredSlips.map(slip => {
      const row = {};
      Object.keys(csvHeaderMap).forEach(key => {
        row[csvHeaderMap[key]] = slip[key] !== undefined ? slip[key] : '';
      });
      return row;
    });

    const csvStr = Papa.unparse(exportData);
    // Add BOM for Excel
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, csvStr], { type: 'text/csv;charset=utf-8;' });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const filenameMonth = selectedMonth ? `_${selectedMonth}` : '';
    link.setAttribute('download', `賃金台帳${filenameMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedData = results.data;
        if (parsedData.length === 0) {
          alert('CSVファイルにデータがありません。');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        parsedData.forEach(row => {
          const slipData = {};
          let isValid = true;

          // Map CSV headers back to JS keys
          Object.keys(row).forEach(header => {
            const key = reverseCsvHeaderMap[header];
            if (key) {
              const val = row[header];
              // Numeric fields
              if ([
                'workDays', 'absenceDays', 'paidLeaveDays', 'overtimeHours', 'midnightHours', 'holidayWorkDays',
                'baseSalary', 'titleAllowance', 'commuteAllowance', 'overtimeAllowance', 'midnightAllowance', 'holidayAllowance', 'otherAllowance',
                'healthInsurance', 'careInsurance', 'welfarePension', 'employmentInsurance', 'contribution', 'incomeTax', 'residentTax', 'otherDeduction', 'differenceAdjustment'
              ].includes(key)) {
                slipData[key] = parseNum(val) || 0;
              } else {
                slipData[key] = val;
              }
            }
          });

          // Validation for mandatory fields
          if (!slipData.employeeId || !slipData.targetYearMonth) {
            isValid = false;
          }

          if (isValid) {
            slipData.status = slipData.status || 'draft';
            savePayslip(slipData);
            successCount++;
          } else {
            errorCount++;
          }
        });

        alert(`インポート完了\n成功: ${successCount}件\n失敗: ${errorCount}件\n(※社員番号と対象年月が必須です)`);
        setSlips(getPayslips(targetEmployeeId, targetRole)); // Refresh state
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
      },
      error: (error) => {
        alert('CSVファイルの読み込みに失敗しました。');
        console.error(error);
        if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
      }
    });
  };

  // Filter calculations
  const filteredSlips = slips.filter(slip => {
    // Month filter
    const matchesMonth = !selectedMonth || slip.targetYearMonth === selectedMonth;

    // Search query filter (only relevant for admin)
    const matchesSearch = employeeMode || 
      slip.employeeId.toLowerCase().includes(searchNameOrId.toLowerCase()) ||
      slip.employeeName.toLowerCase().includes(searchNameOrId.toLowerCase()) ||
      (slip.department && slip.department.toLowerCase().includes(searchNameOrId.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter === 'すべて' || slip.status === statusFilter;

    return matchesMonth && matchesSearch && matchesStatus;
  });

  // Apply sorting
  const sortedSlips = [...filteredSlips].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? -1 : 1;
    }
    if (a[sortConfig.key] > b[sortConfig.key]) {
      return sortConfig.direction === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">
          {employeeMode ? '給与明細一覧' : '給与明細管理'}
        </h1>
        
        {!employeeMode && session.role === 'admin' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="file" 
              accept=".csv" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImportCsv} 
            />
            <button 
              className="btn btn-secondary"
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              title="CSVインポート (既存のデータは上書きされます)"
            >
              <Upload size={18} />
              <span>インポート</span>
            </button>
            <button 
              className="btn btn-secondary"
              onClick={handleExportCsv}
              title="表示中のデータをCSVとしてダウンロード"
            >
              <Download size={18} />
              <span>エクスポート</span>
            </button>
            <button 
              className="btn btn-primary"
              onClick={() => navigateTo('payslip-create', { editingPayslipId: null })}
            >
              <FilePlus size={18} />
              <span>新規給与明細作成</span>
            </button>
          </div>
        )}
      </div>

      <div className="card">
        {/* Filters Panel */}
        <div className="filters-banner">
          
          <div className="form-group" style={{ width: '180px' }}>
            <label htmlFor="selectedMonth">対象年月</label>
            <div style={{ position: 'relative' }}>
              <input
                id="selectedMonth"
                type="month"
                className="form-control"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {!employeeMode && (
            <>
              <div className="form-group" style={{ flex: 1, minWidth: '220px' }}>
                <label htmlFor="searchNameOrId">従業員検索</label>
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    id="searchNameOrId"
                    type="text"
                    className="form-control"
                    placeholder="社員番号、氏名、部署名..."
                    value={searchNameOrId}
                    onChange={(e) => setSearchNameOrId(e.target.value)}
                    style={{ paddingLeft: '38px', width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ width: '150px' }}>
                <label htmlFor="statusFilter">ステータス</label>
                <select
                  id="statusFilter"
                  className="form-control"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="すべて">すべて</option>
                  <option value="draft">下書き</option>
                  <option value="confirmed">確定済</option>
                </select>
              </div>
            </>
          )}

          {/* Reset Filters Link */}
          {(selectedMonth || searchNameOrId || statusFilter !== 'すべて') && (
            <button
              className="btn btn-secondary btn-sm"
              style={{ height: '38px' }}
              onClick={() => {
                setSelectedMonth('');
                setSearchNameOrId('');
                setStatusFilter('すべて');
              }}
            >
              クリア
            </button>
          )}

        </div>

        {/* Payslips Table */}
        {filteredSlips.length === 0 ? (
          <div style={{ padding: '40px 0', textPosition: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
            対象の給与明細データがありません。
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('targetYearMonth')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      対象年月
                      {sortConfig.key === 'targetYearMonth' && (
                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      )}
                    </div>
                  </th>
                  {!employeeMode && (
                    <th onClick={() => handleSort('employeeId')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        社員番号
                        {sortConfig.key === 'employeeId' && (
                          sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                        )}
                      </div>
                    </th>
                  )}
                  {!employeeMode && <th>氏名</th>}
                  {!employeeMode && <th>部署</th>}
                  <th>支給日</th>
                  <th className="numeric">差引支給額</th>
                  {!employeeMode && <th style={{ textAlign: 'center' }}>ステータス</th>}
                  <th style={{ textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedSlips.map(slip => {
                  const netPay = calcNetPayout(slip);
                  return (
                    <tr key={slip.id}>
                      <td style={{ fontWeight: 600 }}>{fmtYearMonth(slip.targetYearMonth)}</td>
                      {!employeeMode && <td>{slip.employeeId}</td>}
                      {!employeeMode && <td>{slip.employeeName}</td>}
                      {!employeeMode && <td>{slip.department || '-'}</td>}
                      <td>{slip.paymentDate || '-'}</td>
                      <td className="numeric" style={{ fontWeight: 700, color: slip.status === 'confirmed' ? 'var(--primary-navy)' : 'var(--text-muted)' }}>
                        ¥{fmt(netPay)}
                      </td>
                      {!employeeMode && (
                        <td style={{ textAlign: 'center' }}>
                          <span className={`badge ${slip.status === 'confirmed' ? 'badge-confirmed' : 'badge-draft'}`}>
                            {slip.status === 'confirmed' ? '確定済' : '下書き'}
                          </span>
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            title="詳細閲覧"
                            onClick={() => navigateTo('payslip-detail', { payslipId: slip.id })}
                          >
                            <Eye size={14} />
                            <span>詳細</span>
                          </button>
                          
                          {!employeeMode && session.role === 'admin' && (
                            <>
                              <button 
                                className="btn btn-secondary btn-sm"
                                title="編集"
                                onClick={() => navigateTo('payslip-create', { editingPayslipId: slip.id })}
                                style={{ color: slip.status === 'confirmed' ? 'var(--text-muted)' : 'var(--primary-navy)' }}
                              >
                                <Edit2 size={14} />
                                <span>編集</span>
                              </button>
                              <button 
                                className="btn btn-danger btn-sm"
                                title="削除"
                                onClick={() => handleDelete(slip.id, slip.employeeName, fmtYearMonth(slip.targetYearMonth))}
                              >
                                <Trash2 size={14} />
                                <span>削除</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
