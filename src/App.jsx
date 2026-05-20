import React, { useState, useEffect } from 'react';
import { seedDatabase, getCurrentSession } from './db';
import Sidebar from './components/Sidebar';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import EmployeeList from './components/EmployeeList';
import EmployeeEdit from './components/EmployeeEdit';
import PayslipCreate from './components/PayslipCreate';
import PayslipList from './components/PayslipList';
import PayslipDetail from './components/PayslipDetail';
import SystemSettings from './components/SystemSettings';

export default function App() {
  const [session, setSession] = useState(null);
  const [currentView, setCurrentView] = useState('login');
  const [isDbReady, setIsDbReady] = useState(false);

  // Router parameters
  const [params, setParams] = useState({
    employeeId: null,      // For editing employee
    payslipId: null,       // For viewing payslip detail
    editingPayslipId: null // For editing/drafting a payslip
  });

  // Seeding and session loading
  useEffect(() => {
    async function initApp() {
      await seedDatabase();
      setIsDbReady(true);
      const activeSession = getCurrentSession();
      if (activeSession) {
        setSession(activeSession);
        if (activeSession.role === 'admin') {
          setCurrentView('admin-dashboard');
        } else {
          setCurrentView('employee-payslips');
        }
      } else {
        setCurrentView('login');
      }
    }
    initApp();
  }, []);

  const handleLoginSuccess = (userSession) => {
    setSession(userSession);
    if (userSession.role === 'admin') {
      setCurrentView('admin-dashboard');
    } else {
      setCurrentView('employee-payslips');
    }
  };

  const handleLogout = () => {
    setSession(null);
    setCurrentView('login');
    setParams({ employeeId: null, payslipId: null, editingPayslipId: null });
  };

  const navigateTo = (view, newParams = {}) => {
    // Route guard checks
    if (!session && view !== 'login') {
      setCurrentView('login');
      return;
    }

    // Role safety checks
    if (session && session.role !== 'admin') {
      // Employees are ONLY allowed to see 'employee-payslips' and 'payslip-detail' (only if it belongs to them)
      if (view !== 'employee-payslips' && view !== 'payslip-detail') {
        setCurrentView('employee-payslips');
        return;
      }
    }

    setParams(prev => ({ ...prev, ...newParams }));
    setCurrentView(view);
  };

  if (!isDbReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>明治屋クリエイト</h2>
          <p style={{ marginTop: '10px', color: '#94a3b8' }}>初期データを読み込み中...</p>
        </div>
      </div>
    );
  }

  // Hide sidebar for login and print layouts
  const showSidebar = session && currentView !== 'login';

  return (
    <div className="app-container">
      {showSidebar && (
        <Sidebar 
          session={session} 
          currentView={currentView} 
          navigateTo={navigateTo} 
          onLogout={handleLogout} 
        />
      )}
      
      <main className={`main-content ${!showSidebar ? 'no-sidebar' : ''}`}>
        {currentView === 'login' && (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
        
        {currentView === 'admin-dashboard' && (
          <AdminDashboard navigateTo={navigateTo} />
        )}
        
        {currentView === 'employee-list' && (
          <EmployeeList navigateTo={navigateTo} />
        )}
        
        {currentView === 'employee-edit' && (
          <EmployeeEdit 
            employeeId={params.employeeId} 
            navigateTo={navigateTo} 
          />
        )}
        
        {currentView === 'payslip-list' && (
          <PayslipList 
            navigateTo={navigateTo} 
            session={session}
          />
        )}
        
        {currentView === 'employee-payslips' && (
          <PayslipList 
            navigateTo={navigateTo} 
            session={session}
            employeeMode={true}
          />
        )}
        
        {currentView === 'payslip-create' && (
          <PayslipCreate 
            editingPayslipId={params.editingPayslipId}
            navigateTo={navigateTo} 
          />
        )}
        
        {currentView === 'payslip-detail' && (
          <PayslipDetail 
            payslipId={params.payslipId} 
            navigateTo={navigateTo} 
            session={session}
          />
        )}

        {currentView === 'system-settings' && (
          <SystemSettings 
            navigateTo={navigateTo} 
          />
        )}
      </main>
    </div>
  );
}
