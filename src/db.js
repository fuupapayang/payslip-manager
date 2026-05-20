// 明治屋クリエイト - Database Layer (Firebase Firestore with LocalStorage Mock & Cache)
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, doc, setDoc, getDocs, getDoc, deleteDoc } from 'firebase/firestore';

// Web Crypto SHA-256 Hashing helper
export async function hashPassword(password) {
  if (!password) return '';
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Storage Keys
const KEY_EMPLOYEES = 'payslip_employees';
const KEY_PAYSLIPS = 'payslip_payslips';
const KEY_SESSION = 'payslip_session';
const KEY_SETTINGS = 'payslip_settings';

// Default system settings
const DEFAULT_SETTINGS = {
  taxTableUrl: 'https://www.nta.go.jp/publication/pamph/gensen/zeigakuhyo2026/data/01-07.pdf'
};

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
};

let db = null;
let useFirebase = false;

// Memory cache variables
let cachedEmployees = [];
let cachedPayslips = [];
let cachedSettings = { ...DEFAULT_SETTINGS };

// Check if configuration is valid and initialize Firebase
const isConfigValid = firebaseConfig.projectId && firebaseConfig.projectId !== "YOUR_PROJECT_ID" && firebaseConfig.projectId.trim() !== "";
if (isConfigValid) {
  try {
    const apps = getApps();
    const app = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
    db = getFirestore(app);
    useFirebase = true;
    console.log("Firebase initialized successfully with project ID:", firebaseConfig.projectId);
  } catch (e) {
    console.error("Firebase initialization failed, falling back to localStorage:", e);
    useFirebase = false;
  }
} else {
  console.log("Firebase configuration is not configured. Running in LocalStorage mock mode.");
}

// --- LocalStorage Wrappers ---
function readData(key, fallback = []) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage`, e);
    return fallback;
  }
}

function writeData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage`, e);
  }
}

// --- Seeder and Sync ---
export async function seedDatabase() {
  if (useFirebase && db) {
    try {
      console.log("Fetching latest database records from Cloud Firestore...");
      
      // 1. Fetch employees
      const empSnap = await getDocs(collection(db, "employees"));
      const employeesList = [];
      empSnap.forEach(d => {
        employeesList.push(d.data());
      });

      // 2. Fetch payslips
      const psSnap = await getDocs(collection(db, "payslips"));
      const payslipsList = [];
      psSnap.forEach(d => {
        payslipsList.push(d.data());
      });

      // 3. Fetch settings
      const settingsDoc = await getDoc(doc(db, "settings", "system"));
      let loadedSettings = DEFAULT_SETTINGS;
      if (settingsDoc.exists()) {
        loadedSettings = settingsDoc.data();
      }

      // If Firebase Firestore has zero employees, seed initial default datasets
      if (employeesList.length === 0) {
        console.log("Firestore is empty. Seeding initial data package to the cloud...");
        const seededEmployees = [
          {
            id: 'admin',
            name: '管理者 太郎',
            furigana: 'カンリシャ タロウ',
            email: 'admin@payslip.jp',
            role: 'admin',
            passwordHash: await hashPassword('admin123'),
            department: '管理部',
            employmentType: '正社員',
            hireDate: '2020-04-01',
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
            taxCategory: 'ko',
            dependentsCount: 0,
            bankName: '',
            branchName: '',
            accountType: '普通',
            accountNumber: '',
            status: '在籍中'
          },
          {
            id: 'EMP001',
            name: '山田 太郎',
            furigana: 'ヤマダ タロウ',
            email: 'yamada@payslip.jp',
            role: 'employee',
            passwordHash: await hashPassword('yamada123'),
            department: '開発部',
            employmentType: '正社員',
            hireDate: '2022-10-01',
            baseSalary: 350000,
            commuteAllowance: 15000,
            titleAllowance: 20000,
            otherFixedAllowance: 5000,
            fixedHealthInsurance: 17500,
            fixedCareInsurance: 0,
            fixedWelfarePension: 32000,
            fixedLaborInsurance: 2100,
            fixedContribution: 0,
            fixedResidentTax: 15000,
            taxCategory: 'ko',
            dependentsCount: 0,
            bankName: '三井住友銀行',
            branchName: '渋谷支店',
            accountType: '普通',
            accountNumber: '1234567',
            status: '在籍中'
          },
          {
            id: 'EMP002',
            name: '田中 花子',
            furigana: 'タナカ ハナコ',
            email: 'tanaka@payslip.jp',
            role: 'employee',
            passwordHash: await hashPassword('tanaka123'),
            department: '総務部',
            employmentType: '正社員',
            hireDate: '2023-04-01',
            baseSalary: 280000,
            commuteAllowance: 10000,
            titleAllowance: 10000,
            otherFixedAllowance: 0,
            fixedHealthInsurance: 14000,
            fixedCareInsurance: 2500,
            fixedWelfarePension: 25600,
            fixedLaborInsurance: 1680,
            fixedContribution: 500,
            fixedResidentTax: 11000,
            taxCategory: 'ko',
            dependentsCount: 1,
            bankName: '三菱UFJ銀行',
            branchName: '新宿支店',
            accountType: '普通',
            accountNumber: '7654321',
            status: '在籍中'
          },
          {
            id: 'EMP003',
            name: '佐藤 健太',
            furigana: 'サトウ ケンタ',
            email: 'sato@payslip.jp',
            role: 'employee',
            passwordHash: await hashPassword('sato123'),
            department: '営業部',
            employmentType: 'アルバイト',
            hireDate: '2024-01-15',
            baseSalary: 250000,
            commuteAllowance: 12000,
            titleAllowance: 0,
            otherFixedAllowance: 8000,
            fixedHealthInsurance: 0,
            fixedCareInsurance: 0,
            fixedWelfarePension: 0,
            fixedLaborInsurance: 1500,
            fixedContribution: 0,
            fixedResidentTax: 0,
            taxCategory: 'otsu',
            dependentsCount: 0,
            bankName: 'みずほ銀行',
            branchName: '東京中央支店',
            accountType: '普通',
            accountNumber: '9876543',
            status: '在籍中'
          }
        ];

        const seededSlips = [
          {
            id: 'EMP001-2026-04',
            employeeId: 'EMP001',
            employeeName: '山田 太郎',
            department: '開発部',
            employmentType: '正社員',
            targetYearMonth: '2026-04',
            paymentDate: '2026-04-25',
            status: 'confirmed',
            workDays: 20,
            absenceDays: 0,
            paidLeaveDays: 1,
            overtimeHours: 15,
            midnightHours: 2,
            holidayWorkDays: 0,
            baseSalary: 350000,
            titleAllowance: 20000,
            commuteAllowance: 15000,
            overtimeAllowance: 32000,
            midnightAllowance: 5000,
            holidayAllowance: 0,
            otherAllowance: 5000,
            healthInsurance: 17500,
            careInsurance: 0,
            welfarePension: 32000,
            employmentInsurance: 2100,
            contribution: 0,
            incomeTax: 8800,
            residentTax: 15000,
            otherDeduction: 0
          },
          {
            id: 'EMP001-2026-05',
            employeeId: 'EMP001',
            employeeName: '山田 太郎',
            department: '開発部',
            employmentType: '正社員',
            targetYearMonth: '2026-05',
            paymentDate: '2026-05-25',
            status: 'draft',
            workDays: 18,
            absenceDays: 0,
            paidLeaveDays: 2,
            overtimeHours: 8,
            midnightHours: 0,
            holidayWorkDays: 0,
            baseSalary: 350000,
            titleAllowance: 20000,
            commuteAllowance: 15000,
            overtimeAllowance: 17000,
            midnightAllowance: 0,
            holidayAllowance: 0,
            otherAllowance: 5000,
            healthInsurance: 17500,
            careInsurance: 0,
            welfarePension: 32000,
            employmentInsurance: 2100,
            contribution: 0,
            incomeTax: 8100,
            residentTax: 15000,
            otherDeduction: 0
          },
          {
            id: 'EMP002-2026-04',
            employeeId: 'EMP002',
            employeeName: '田中 花子',
            department: '総務部',
            employmentType: '正社員',
            targetYearMonth: '2026-04',
            paymentDate: '2026-04-25',
            status: 'confirmed',
            workDays: 21,
            absenceDays: 0,
            paidLeaveDays: 0,
            overtimeHours: 5,
            midnightHours: 0,
            holidayWorkDays: 0,
            baseSalary: 280000,
            titleAllowance: 10000,
            commuteAllowance: 10000,
            overtimeAllowance: 8500,
            midnightAllowance: 0,
            holidayAllowance: 0,
            otherAllowance: 0,
            healthInsurance: 14000,
            careInsurance: 2500,
            welfarePension: 25600,
            employmentInsurance: 1680,
            contribution: 500,
            incomeTax: 5800,
            residentTax: 11000,
            otherDeduction: 0
          }
        ];

        // Seeding Firestore asynchronously
        for (const emp of seededEmployees) {
          await setDoc(doc(db, "employees", emp.id), emp);
        }
        for (const ps of seededSlips) {
          await setDoc(doc(db, "payslips", ps.id), ps);
        }
        await setDoc(doc(db, "settings", "system"), DEFAULT_SETTINGS);

        cachedEmployees = seededEmployees;
        cachedPayslips = seededSlips;
        cachedSettings = DEFAULT_SETTINGS;
      } else {
        cachedEmployees = employeesList;
        cachedPayslips = payslipsList;
        cachedSettings = loadedSettings;
      }

      // Sync to localstorage to ensure offline compatibility
      writeData(KEY_EMPLOYEES, cachedEmployees);
      writeData(KEY_PAYSLIPS, cachedPayslips);
      localStorage.setItem(KEY_SETTINGS, JSON.stringify(cachedSettings));
      
      console.log("Memory database loaded from Cloud Firestore successfully.");
      return;
    } catch (err) {
      console.error("Firestore loading error. Falling back to local storage cache...", err);
      // Fall through to LocalStorage
    }
  }

  // LocalStorage Fallback logic
  let employees = readData(KEY_EMPLOYEES);
  let payslips = readData(KEY_PAYSLIPS);
  let settings = DEFAULT_SETTINGS;
  try {
    const val = localStorage.getItem(KEY_SETTINGS);
    if (val) {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(val) };
    }
  } catch (e) {}

  // Schema migrations for local storage records if needed
  let migratedEmployees = false;
  if (employees.length > 0) {
    const updatedEmployees = employees.map(emp => {
      let changed = false;
      if (!('fixedHealthInsurance' in emp)) {
        emp.fixedHealthInsurance = 0;
        emp.fixedCareInsurance = 0;
        emp.fixedWelfarePension = 0;
        emp.fixedLaborInsurance = 0;
        emp.fixedContribution = 0;
        emp.fixedResidentTax = 0;
        changed = true;
      }
      if (!('taxCategory' in emp)) {
        emp.taxCategory = 'ko';
        changed = true;
      }
      if (!('dependentsCount' in emp)) {
        emp.dependentsCount = 0;
        changed = true;
      }
      if (changed) {
        migratedEmployees = true;
      }
      return emp;
    });

    if (migratedEmployees) {
      writeData(KEY_EMPLOYEES, updatedEmployees);
      employees = updatedEmployees;
    }
  }

  if (employees.length === 0) {
    const seededEmployees = [
      {
        id: 'admin',
        name: '管理者 太郎',
        furigana: 'カンリシャ タロウ',
        email: 'admin@payslip.jp',
        role: 'admin',
        passwordHash: await hashPassword('admin123'),
        department: '管理部',
        employmentType: '正社員',
        hireDate: '2020-04-01',
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
        taxCategory: 'ko',
        dependentsCount: 0,
        bankName: '',
        branchName: '',
        accountType: '普通',
        accountNumber: '',
        status: '在籍中'
      },
      {
        id: 'EMP001',
        name: '山田 太郎',
        furigana: 'ヤマダ タロウ',
        email: 'yamada@payslip.jp',
        role: 'employee',
        passwordHash: await hashPassword('yamada123'),
        department: '開発部',
        employmentType: '正社員',
        hireDate: '2022-10-01',
        baseSalary: 350000,
        commuteAllowance: 15000,
        titleAllowance: 20000,
        otherFixedAllowance: 5000,
        fixedHealthInsurance: 17500,
        fixedCareInsurance: 0,
        fixedWelfarePension: 32000,
        fixedLaborInsurance: 2100,
        fixedContribution: 0,
        fixedResidentTax: 15000,
        taxCategory: 'ko',
        dependentsCount: 0,
        bankName: '三井住友銀行',
        branchName: '渋谷支店',
        accountType: '普通',
        accountNumber: '1234567',
        status: '在籍中'
      },
      {
        id: 'EMP002',
        name: '田中 花子',
        furigana: 'タナカ ハナコ',
        email: 'tanaka@payslip.jp',
        role: 'employee',
        passwordHash: await hashPassword('tanaka123'),
        department: '総務部',
        employmentType: '正社員',
        hireDate: '2023-04-01',
        baseSalary: 280000,
        commuteAllowance: 10000,
        titleAllowance: 10000,
        otherFixedAllowance: 0,
        fixedHealthInsurance: 14000,
        fixedCareInsurance: 2500,
        fixedWelfarePension: 25600,
        fixedLaborInsurance: 1680,
        fixedContribution: 500,
        fixedResidentTax: 11000,
        taxCategory: 'ko',
        dependentsCount: 1,
        bankName: '三菱UFJ銀行',
        branchName: '新宿支店',
        accountType: '普通',
        accountNumber: '7654321',
        status: '在籍中'
      },
      {
        id: 'EMP003',
        name: '佐藤 健太',
        furigana: 'サトウ ケンタ',
        email: 'sato@payslip.jp',
        role: 'employee',
        passwordHash: await hashPassword('sato123'),
        department: '営業部',
        employmentType: 'アルバイト',
        hireDate: '2024-01-15',
        baseSalary: 250000,
        commuteAllowance: 12000,
        titleAllowance: 0,
        otherFixedAllowance: 8000,
        fixedHealthInsurance: 0,
        fixedCareInsurance: 0,
        fixedWelfarePension: 0,
        fixedLaborInsurance: 1500,
        fixedContribution: 0,
        fixedResidentTax: 0,
        taxCategory: 'otsu',
        dependentsCount: 0,
        bankName: 'みずほ銀行',
        branchName: '東京中央支店',
        accountType: '普通',
        accountNumber: '9876543',
        status: '在籍中'
      }
    ];
    writeData(KEY_EMPLOYEES, seededEmployees);
    employees = seededEmployees;
  }

  cachedEmployees = employees;
  cachedPayslips = payslips;
  cachedSettings = settings;
  console.log("Memory database loaded from LocalStorage fallback.");
}

// --- Authentication API ---
export async function authenticateUser(usernameOrId, password) {
  const hash = await hashPassword(password);
  
  // Find employee matching email or id in cache
  const user = cachedEmployees.find(
    emp => (emp.id === usernameOrId || emp.email === usernameOrId) && emp.passwordHash === hash
  );

  if (user) {
    // Session includes basic user information, NO passwordHash
    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      employmentType: user.employmentType || '',
      position: user.position || '',
      taxCategory: user.taxCategory || 'ko',
      dependentsCount: user.dependentsCount || 0,
      status: user.status
    };
    writeData(KEY_SESSION, session);
    return session;
  }
  return null;
}

export function getCurrentSession() {
  return readData(KEY_SESSION, null);
}

export function clearSession() {
  localStorage.removeItem(KEY_SESSION);
}

// --- Employees CRUD API ---
export function getEmployees() {
  // Exclude admin from employee listings
  return cachedEmployees.filter(emp => emp.role !== 'admin');
}

export function getEmployee(id) {
  return cachedEmployees.find(emp => emp.id === id);
}

export async function saveEmployee(employeeData) {
  const idx = cachedEmployees.findIndex(emp => emp.id === employeeData.id);
  let employee = { ...employeeData };

  // If plainTextPassword is provided, hash it
  if (employee.plainTextPassword) {
    employee.passwordHash = await hashPassword(employee.plainTextPassword);
    delete employee.plainTextPassword;
  }

  if (idx > -1) {
    // Preserve old passwordHash if not changing password
    if (!employee.passwordHash) {
      employee.passwordHash = cachedEmployees[idx].passwordHash;
    }
    cachedEmployees[idx] = employee;
  } else {
    // Generate default password if not provided
    if (!employee.passwordHash) {
      employee.passwordHash = await hashPassword('temp123'); // Default password
    }
    cachedEmployees.push(employee);
  }
  
  writeData(KEY_EMPLOYEES, cachedEmployees);

  // Sync with Firestore asynchronously
  if (useFirebase && db) {
    setDoc(doc(db, "employees", employee.id), employee).catch(err => {
      console.error("Failed to sync employee save to Firestore:", err);
    });
  }

  return employee;
}

export function deleteEmployee(id) {
  cachedEmployees = cachedEmployees.filter(emp => emp.id !== id);
  writeData(KEY_EMPLOYEES, cachedEmployees);

  // Also remove their payslips from memory cache
  const payslipsToDelete = cachedPayslips.filter(ps => ps.employeeId === id);
  cachedPayslips = cachedPayslips.filter(ps => ps.employeeId !== id);
  writeData(KEY_PAYSLIPS, cachedPayslips);

  // Sync deletions with Firestore asynchronously
  if (useFirebase && db) {
    deleteDoc(doc(db, "employees", id)).catch(err => {
      console.error("Failed to delete employee from Firestore:", err);
    });
    
    payslipsToDelete.forEach(ps => {
      deleteDoc(doc(db, "payslips", ps.id)).catch(err => {
        console.error("Failed to delete employee payslip from Firestore:", err);
      });
    });
  }
}

// --- Payslips CRUD API ---
export function getPayslips(employeeId = null, role = 'admin') {
  if (role === 'admin') {
    if (employeeId) {
      return cachedPayslips.filter(ps => ps.employeeId === employeeId);
    }
    return cachedPayslips;
  } else {
    // Employees can ONLY see their own confirmed slips
    return cachedPayslips.filter(ps => ps.employeeId === employeeId && ps.status === 'confirmed');
  }
}

export function getPayslip(id, currentUserId = null, role = 'admin') {
  const slip = cachedPayslips.find(ps => ps.id === id);
  if (!slip) return null;

  // Authorization check
  if (role !== 'admin' && (slip.employeeId !== currentUserId || slip.status !== 'confirmed')) {
    return null; // Not authorized or draft
  }
  return slip;
}

export function savePayslip(slipData) {
  const id = `${slipData.employeeId}-${slipData.targetYearMonth}`;
  const completeSlipData = { ...slipData, id };

  const idx = cachedPayslips.findIndex(ps => ps.id === id);
  if (idx > -1) {
    cachedPayslips[idx] = completeSlipData;
  } else {
    cachedPayslips.push(completeSlipData);
  }
  writeData(KEY_PAYSLIPS, cachedPayslips);

  // Sync with Firestore asynchronously
  if (useFirebase && db) {
    setDoc(doc(db, "payslips", id), completeSlipData).catch(err => {
      console.error("Failed to sync payslip save to Firestore:", err);
    });
  }

  return completeSlipData;
}

export function deletePayslip(id) {
  cachedPayslips = cachedPayslips.filter(ps => ps.id !== id);
  writeData(KEY_PAYSLIPS, cachedPayslips);

  // Sync with Firestore asynchronously
  if (useFirebase && db) {
    deleteDoc(doc(db, "payslips", id)).catch(err => {
      console.error("Failed to delete payslip from Firestore:", err);
    });
  }
}

// Check for duplicate payslip
export function isDuplicatePayslip(employeeId, targetYearMonth, editingSlipId = null) {
  const expectedId = `${employeeId}-${targetYearMonth}`;
  if (editingSlipId && editingSlipId === expectedId) {
    return false; // Editing the same slip, not a duplicate
  }
  return cachedPayslips.some(ps => ps.id === expectedId);
}

// --- Settings API ---
export function getSettings() {
  return cachedSettings;
}

export function saveSettings(settings) {
  cachedSettings = settings;
  try {
    localStorage.setItem(KEY_SETTINGS, JSON.stringify(settings));
  } catch (e) {
    console.error('Error writing settings', e);
  }

  // Sync with Firestore asynchronously
  if (useFirebase && db) {
    setDoc(doc(db, "settings", "system"), settings).catch(err => {
      console.error("Failed to sync settings save to Firestore:", err);
    });
  }
}
