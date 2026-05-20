import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../db';
import { Save, RotateCcw, Link2, Info, ArrowLeft } from 'lucide-react';

export default function SystemSettings({ navigateTo }) {
  const [settings, setSettings] = useState({
    taxTableUrl: ''
  });
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const current = getSettings();
    setSettings(current);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveSettings(settings);
    setMessage({ type: 'success', text: '設定を保存しました。' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReset = () => {
    if (window.confirm('参照URLを初期設定（2026年分）に戻しますか？')) {
      const defaultUrl = 'https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf';
      const updated = { ...settings, taxTableUrl: defaultUrl };
      setSettings(updated);
      saveSettings(updated);
      setMessage({ type: 'success', text: '設定を初期値に戻しました。' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          className="btn btn-secondary btn-sm"
          onClick={() => navigateTo('admin-dashboard')}
          style={{ padding: '8px' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="page-title">システム設定</h1>
      </div>

      {message && (
        <div style={{ 
          padding: '12px 16px', 
          borderRadius: '6px', 
          backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2', 
          color: message.type === 'success' ? '#15803d' : '#b91c1c',
          marginBottom: '20px',
          fontWeight: 500,
          border: `1px solid ${message.type === 'success' ? '#bbf7d0' : '#fecaca'}`
        }}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="card">
        <h2 className="card-title">給与所得の源泉徴収税額表 設定</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label htmlFor="taxTableUrl" style={{ fontWeight: 600 }}>税額表の参照URL（PDF等）</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                id="taxTableUrl"
                name="taxTableUrl"
                type="url"
                className="form-control"
                style={{ flex: 1 }}
                value={settings.taxTableUrl}
                onChange={handleChange}
                required
                placeholder="https://example.com/tax-table.pdf"
              />
              {settings.taxTableUrl && (
                <a 
                  href={settings.taxTableUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                  title="新しいウィンドウで開く"
                >
                  <Link2 size={16} />
                  <span>開く</span>
                </a>
              )}
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              ※ 毎年変更される国税庁公式の「源泉徴収税額表」PDFや公式ウェブサイトのURLを指定してください。
            </span>
          </div>

          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            backgroundColor: 'var(--bg-light)', 
            padding: '16px', 
            borderRadius: '8px', 
            border: '1px solid var(--border)' 
          }}>
            <div style={{ color: 'var(--accent-sky)', flexShrink: 0 }}>
              <Info size={20} />
            </div>
            <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-main)' }}>
              <strong>自動計算プログラムについて:</strong>
              <p style={{ margin: '4px 0 0 0' }}>
                システムは現在、2026年版の源泉徴収税額表データに基づき所得税の自動計算（甲欄・乙欄・扶養人数対応）を行っています。
                ここでURLを変更すると、給与明細作成画面や明細詳細画面で表示される「参照元リンク」が更新され、手動での確認や調整がスムーズに行えるようになります。
              </p>
            </div>
          </div>

          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginTop: '10px',
            borderTop: '1px solid var(--border)',
            paddingTop: '20px'
          }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleReset}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw size={16} />
              <span>初期設定に戻す</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <Save size={16} />
              <span>設定を保存</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
