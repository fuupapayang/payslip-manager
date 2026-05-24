import { isDuplicatePayslip, getEmployee } from './db';
import { TAX_BRACKETS_2026 } from './taxBrackets2026';

// --- Formatters ---

// Formats number to Japanese Yen string (e.g. 320,000)
export function fmt(value) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('ja-JP');
}

// Formats YYYY-MM to YYYY年MM月
export function fmtYearMonth(ymStr) {
  if (!ymStr) return '';
  const [year, month] = ymStr.split('-');
  return `${year}年${month}月`;
}

// Formats YYYY-MM-DD to YYYY年MM月DD日
export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${year}年${month}月${day}日`;
}

// Helper to safely parse inputs to numeric values >= 0
export function parseNum(value) {
  const num = parseInt(value, 10);
  return isNaN(num) || num < 0 ? 0 : num;
}

export function parseDecimal(value) {
  const num = parseFloat(value);
  return isNaN(num) || num < 0 ? 0 : num;
}

// --- Math & Calculations ---

export function calcEarningsTotal(slip) {
  if (!slip) return 0;
  return (
    parseNum(slip.baseSalary) +
    parseNum(slip.titleAllowance) +
    parseNum(slip.commuteAllowance) +
    parseNum(slip.overtimeAllowance) +
    parseNum(slip.midnightAllowance) +
    parseNum(slip.holidayAllowance) +
    parseNum(slip.otherAllowance)
  );
}

export function calcDeductionsTotal(slip) {
  if (!slip) return 0;
  const health = parseNum(slip.healthInsurance) || 0;
  const care = parseNum(slip.careInsurance) || 0;
  const welfare = parseNum(slip.welfarePension) || 0;
  const empIns = parseNum(slip.employmentInsurance) || 0;
  const incomeTax = parseNum(slip.incomeTax) || 0;
  const residentTax = parseNum(slip.residentTax) || 0;
  const contribution = parseNum(slip.contribution) || 0;
  const other = parseNum(slip.otherDeduction) || 0;
  
  // 年末調整過不足税額 (YEA Adjustment). Positive = deduction (追加徴収), Negative = refund (還付)
  const yea = parseNum(slip.yearEndTaxAdjustment) || 0;

  return health + care + welfare + empIns + incomeTax + residentTax + contribution + other + yea;
}

export function calcNetPayout(slip) {
  if (!slip) return 0;
  return calcEarningsTotal(slip) - calcDeductionsTotal(slip);
}

// --- 2026 Income Tax Automatic Calculation Helpers ---

const TAX_BASE_740K = [71680, 65210, 58750, 52290, 45810, 39350, 32890, 26410];
const TAX_BASE_790K = [81890, 75420, 68960, 62500, 56020, 49560, 43100, 36620];
const TAX_BASE_960K = [121820, 115340, 108880, 102420, 95940, 89480, 83020, 76540];
const TAX_BASE_1710K = [374520, 368040, 361580, 355120, 348640, 342180, 335720, 329240];
const TAX_BASE_2130K = [549440, 542970, 536500, 530040, 523570, 517110, 510640, 504170];
const TAX_BASE_2170K = [571220, 564750, 558280, 551820, 545350, 538880, 532420, 525950];
const TAX_BASE_2210K = [593000, 586520, 580060, 573600, 567120, 560660, 554200, 547730];
const TAX_BASE_2250K = [614770, 608300, 601840, 595380, 588900, 582440, 575980, 569500];
const TAX_BASE_3500K = [1125270, 1118800, 1112340, 1105880, 1099400, 1092940, 1086480, 1080000];

function getBaseTax(baseArray, dependentsCount) {
  const dep = Math.max(0, parseInt(dependentsCount, 10) || 0);
  if (dep <= 7) {
    return baseArray[dep];
  } else {
    return Math.max(0, baseArray[7] - 1610 * (dep - 7));
  }
}

// --- Year-End Adjustment Auto-Calculation Engine ---
export function calculateYearEndAdjustment(employeeId, targetYear, allPayslips, yearEndData) {
  // 1. Gather all payslips for this employee in the target year
  const empPayslips = allPayslips.filter(p => p.employeeId === employeeId && p.targetYearMonth.startsWith(String(targetYear)));
  
  if (empPayslips.length === 0) {
    return { grossRevenue: 0, withheldTax: 0, finalTax: 0, difference: 0 };
  }

  // 2. Sum up totals
  let grossRevenue = 0;
  let withheldTax = 0;
  let socialInsurancePaid = 0;

  empPayslips.forEach(slip => {
    grossRevenue += calcTaxableEarningsTotal(slip);
    withheldTax += parseNum(slip.incomeTax);
    socialInsurancePaid += calcSocialInsuranceTotal(slip);
  });

  // 3. Salary Income Deduction (給与所得控除)
  let salaryIncomeDeduction = 0;
  if (grossRevenue <= 1625000) salaryIncomeDeduction = 550000;
  else if (grossRevenue <= 1800000) salaryIncomeDeduction = grossRevenue * 0.4 - 100000;
  else if (grossRevenue <= 3600000) salaryIncomeDeduction = grossRevenue * 0.3 + 80000;
  else if (grossRevenue <= 6600000) salaryIncomeDeduction = grossRevenue * 0.2 + 440000;
  else if (grossRevenue <= 8500000) salaryIncomeDeduction = grossRevenue * 0.1 + 1100000;
  else salaryIncomeDeduction = 1950000;

  let totalIncome = Math.max(0, grossRevenue - salaryIncomeDeduction);

  // 4. Calculate Other Deductions (所得控除)
  let totalDeductions = socialInsurancePaid; // Social Insurance Deducted from Payslips

  // Add mutual enterprise/iDeCo from YEA
  if (yearEndData?.insuranceDeclaration?.smallEnterpriseMutual) {
    totalDeductions += parseNum(yearEndData.insuranceDeclaration.smallEnterpriseMutual);
  }

  // Basic Deduction (基礎控除) - Max 480k, decreases if income > 24M (ignoring high earner edge case for now)
  totalDeductions += 480000;

  if (yearEndData?.dependentDeclaration) {
    const dep = yearEndData.dependentDeclaration;
    
    // Spouse Deduction (配偶者控除) - Max 380k
    if (dep.spouse?.name) {
      totalDeductions += 380000;
    }
    
    // Dependents Deduction (扶養控除) - 380k per person (ignoring age specific bumps for simplicity)
    const numDeps = (dep.dependents || []).length;
    totalDeductions += (numDeps * 380000);

    // Disability/Single Parent (障害者・ひとり親・寡婦等) - Typically 270k
    if (dep.disabilityType && dep.disabilityType !== 'none') totalDeductions += 270000;
    if (dep.singleParent || dep.widow) totalDeductions += 270000;
  }

  // Life Insurance / Earthquake (simplified)
  if (yearEndData?.insuranceDeclaration) {
    const ins = yearEndData.insuranceDeclaration;
    
    let lifeInsAmount = 0;
    (ins.lifeInsurance || []).forEach(i => lifeInsAmount += parseNum(i.amount));
    if (lifeInsAmount > 0) {
      // Simplified life insurance deduction (Max 120k total for all categories, simplified to max 40k per category)
      let lifeDeduct = 0;
      if (lifeInsAmount <= 20000) lifeDeduct = lifeInsAmount;
      else if (lifeInsAmount <= 40000) lifeDeduct = (lifeInsAmount * 0.5) + 10000;
      else if (lifeInsAmount <= 80000) lifeDeduct = (lifeInsAmount * 0.25) + 20000;
      else lifeDeduct = 40000; // Assuming only 'general' for now.
      totalDeductions += lifeDeduct;
    }

    let eqInsAmount = 0;
    (ins.earthquakeInsurance || []).forEach(i => eqInsAmount += parseNum(i.amount));
    if (eqInsAmount > 0) {
      // Simplified earthquake insurance deduction (Max 50k)
      totalDeductions += Math.min(50000, eqInsAmount);
    }
  }

  // 5. Taxable Net Income (課税所得金額) - rounded down to nearest 1,000 yen
  let taxableNetIncome = Math.max(0, totalIncome - totalDeductions);
  taxableNetIncome = Math.floor(taxableNetIncome / 1000) * 1000;

  // 6. Calculate Standard Income Tax (算出所得税額)
  let standardTax = 0;
  if (taxableNetIncome <= 1949000) standardTax = taxableNetIncome * 0.05;
  else if (taxableNetIncome <= 3299000) standardTax = taxableNetIncome * 0.10 - 97500;
  else if (taxableNetIncome <= 6949000) standardTax = taxableNetIncome * 0.20 - 427500;
  else if (taxableNetIncome <= 8999000) standardTax = taxableNetIncome * 0.23 - 636000;
  else if (taxableNetIncome <= 17999000) standardTax = taxableNetIncome * 0.33 - 1536000;
  else if (taxableNetIncome <= 39999000) standardTax = taxableNetIncome * 0.40 - 2796000;
  else standardTax = taxableNetIncome * 0.45 - 4796000;

  // 7. Calculate Final Annual Tax (年調年税額) including 復興特別所得税 (2.1%)
  let finalTax = Math.floor(standardTax * 1.021);
  // Round down to nearest 100 yen
  finalTax = Math.floor(finalTax / 100) * 100;

  // 8. Difference (過不足額) = Withheld - Final
  // Positive means refund (還付), Negative means additional charge (追加徴収)
  const difference = withheldTax - finalTax;

  return {
    grossRevenue,
    withheldTax,
    finalTax,
    difference,
    taxableNetIncome
  };
}

// Calculate Social Insurance Deductions total
export function calcSocialInsuranceTotal(slip) {
  if (!slip) return 0;
  return (
    parseNum(slip.healthInsurance) +
    parseNum(slip.careInsurance) +
    parseNum(slip.welfarePension) +
    parseNum(slip.employmentInsurance)
  );
}

// Calculate Taxable Earnings total (commute allowance is non-taxable under Japanese tax law)
export function calcTaxableEarningsTotal(slip) {
  if (!slip) return 0;
  return (
    parseNum(slip.baseSalary) +
    parseNum(slip.titleAllowance) +
    parseNum(slip.overtimeAllowance) +
    parseNum(slip.midnightAllowance) +
    parseNum(slip.holidayAllowance) +
    parseNum(slip.otherAllowance)
  );
}

// Calculate Social Insurance Deducted Salary (社会保険料等控除後の給与等の金額)
export function calcTaxableIncome(slip) {
  const taxableEarnings = calcTaxableEarningsTotal(slip);
  const socialInsurance = calcSocialInsuranceTotal(slip);
  return Math.max(0, taxableEarnings - socialInsurance);
}

// Main 2026 withholding tax calculator
export function calcIncomeTax(taxableIncome, taxCategory = 'ko', dependentsCount = 0) {
  const inc = Math.max(0, taxableIncome);
  const dep = Math.max(0, parseInt(dependentsCount, 10) || 0);
  const cat = taxCategory === 'otsu' ? 'otsu' : 'ko';

  if (cat === 'ko') {
    // Under 105,000 yen: 0 tax
    if (inc < 105000) {
      return 0;
    }
    // 105,000 to 740,000 yen: lookup table
    if (inc < 740000) {
      const bracket = TAX_BRACKETS_2026.find(b => inc >= b.min && inc < b.max);
      if (bracket) {
        return getBaseTax(bracket.ko, dep);
      }
      return 0; // Fallback
    }
    // Formulas for higher incomes
    if (inc < 790000) {
      const base = getBaseTax(TAX_BASE_740K, dep);
      return Math.round(base + (inc - 740000) * 0.2042);
    }
    if (inc < 960000) {
      const base = getBaseTax(TAX_BASE_790K, dep);
      return Math.round(base + (inc - 790000) * 0.23483);
    }
    if (inc < 1710000) {
      const base = getBaseTax(TAX_BASE_960K, dep);
      return Math.round(base + (inc - 960000) * 0.33693);
    }
    if (inc < 2130000) {
      const base = getBaseTax(TAX_BASE_1710K, dep);
      return Math.round(base + (inc - 1710000) * 0.4084);
    }
    if (inc < 2170000) {
      const base = getBaseTax(TAX_BASE_2130K, dep);
      return Math.round(base + (inc - 2130000) * 0.4084);
    }
    if (inc < 2210000) {
      const base = getBaseTax(TAX_BASE_2170K, dep);
      return Math.round(base + (inc - 2170000) * 0.4084);
    }
    if (inc < 2250000) {
      const base = getBaseTax(TAX_BASE_2210K, dep);
      return Math.round(base + (inc - 2210000) * 0.4084);
    }
    if (inc < 3500000) {
      const base = getBaseTax(TAX_BASE_2250K, dep);
      return Math.round(base + (inc - 2250000) * 0.4084);
    }
    // 3,500,000 yen and above
    const base = getBaseTax(TAX_BASE_3500K, dep);
    return Math.round(base + (inc - 3500000) * 0.45945);

  } else {
    // OTSU (乙欄)
    let tax = 0;
    // Under 105,000 yen: 3.063% of salary
    if (inc < 105000) {
      tax = Math.round(inc * 0.03063);
    } else if (inc < 740000) {
      const bracket = TAX_BRACKETS_2026.find(b => inc >= b.min && inc < b.max);
      tax = bracket ? bracket.otsu : 0;
    } else if (inc < 1710000) {
      tax = Math.round(259200 + (inc - 740000) * 0.4084);
    } else {
      tax = Math.round(655400 + (inc - 1710000) * 0.45945);
    }

    // Deduction for dependents (secondary salary dependent declaration)
    if (dep > 0) {
      tax = Math.max(0, tax - 1610 * dep);
    }
    return tax;
  }
}

// --- Validator ---

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmployee(emp, allEmployees, isEdit = false) {
  const errors = {};

  if (!emp.id || !emp.id.trim()) {
    errors.id = '社員番号は必須です';
  } else if (!isEdit && allEmployees.some(e => e.id === emp.id.trim())) {
    errors.id = 'この社員番号は既に登録されています';
  }

  if (!emp.name || !emp.name.trim()) {
    errors.name = '氏名は必須です';
  }

  if (!emp.email || !emp.email.trim()) {
    errors.email = 'メールアドレスは必須です';
  } else if (!EMAIL_REGEX.test(emp.email.trim())) {
    errors.email = '有効なメールアドレスを入力してください';
  } else if (allEmployees.some(e => e.email === emp.email.trim() && (!isEdit || e.id !== emp.id))) {
    errors.email = 'このメールアドレスは既に登録されています';
  }

  // Allowances & fixed deductions non-negative checks
  const monetaryFields = [
    'baseSalary', 'commuteAllowance', 'titleAllowance', 'otherFixedAllowance',
    'fixedHealthInsurance', 'fixedCareInsurance', 'fixedWelfarePension',
    'fixedLaborInsurance', 'fixedContribution', 'fixedResidentTax'
  ];
  monetaryFields.forEach(field => {
    if (emp[field] !== undefined && Number(emp[field]) < 0) {
      errors[field] = '金額は0以上で入力してください';
    }
  });

  // Dependents & Tax Category checks
  if (emp.dependentsCount !== undefined) {
    const dep = Number(emp.dependentsCount);
    if (isNaN(dep) || dep < 0 || !Number.isInteger(dep)) {
      errors.dependentsCount = '扶養人数は0以上の整数で入力してください';
    }
  }
  if (emp.taxCategory !== undefined) {
    if (emp.taxCategory !== 'ko' && emp.taxCategory !== 'otsu') {
      errors.taxCategory = '源泉徴収区分が正しくありません';
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

export function validatePayslip(slip, editingSlipId = null) {
  const errors = {};

  if (!slip.employeeId) {
    errors.employeeId = '従業員を選択してください';
  }

  if (!slip.targetYearMonth) {
    errors.targetYearMonth = '対象年月を選択してください';
  }

  if (!slip.paymentDate) {
    errors.paymentDate = '支給日を入力してください';
  }

  // Duplicate check
  if (slip.employeeId && slip.targetYearMonth) {
    if (isDuplicatePayslip(slip.employeeId, slip.targetYearMonth, editingSlipId)) {
      errors.targetYearMonth = 'この従業員・対象年月の給与明細は既に存在します';
    }
  }

  // Check positive values for all attendance, earnings, deductions
  const numericFields = [
    'workDays', 'absenceDays', 'paidLeaveDays', 'overtimeHours', 'midnightHours', 'holidayWorkDays',
    'baseSalary', 'titleAllowance', 'commuteAllowance', 'overtimeAllowance', 'midnightAllowance', 'holidayAllowance', 'otherAllowance',
    'healthInsurance', 'careInsurance', 'welfarePension', 'employmentInsurance', 'contribution', 'incomeTax', 'residentTax', 'otherDeduction'
  ];

  numericFields.forEach(field => {
    if (slip[field] !== undefined && Number(slip[field]) < 0) {
      errors[field] = '0以上の値を入力してください';
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}
