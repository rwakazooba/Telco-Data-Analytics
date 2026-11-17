export interface TelcoRow {
  customerID: string;
  gender: string;
  SeniorCitizen: number;
  Partner: string;
  Dependents: string;
  tenure: number;
  PhoneService: string;
  MultipleLines: string;
  InternetService: string;
  OnlineSecurity: string;
  OnlineBackup: string;
  DeviceProtection: string;
  TechSupport: string;
  StreamingTV: string;
  StreamingMovies: string;
  Contract: string;
  PaperlessBilling: string;
  PaymentMethod: string;
  MonthlyCharges: number;
  TotalCharges: number;
  Churn: string;
}

export interface MatrixGroup {
  name: string;
  count: number;
  rawCount: number;
}

export interface ContractStackItem {
  name: string;
  value: number;
  rawCount: number;
  color: string;
  text: string;
}

export interface ContractSummaryRow {
  contract: string;
  n: number;
  share: number;
  churnRate: number;
  churnMrr: number;
  medianTenure: number;
}

export interface DriverComparisonRow {
  item: string;
  retained: number;
  churned: number;
}

export interface TenureHazardPoint {
  bandIdx: number;
  label: string;
  churnRate: number;
  retainedRate: number;
  n: number;
  churned: number;
}

export interface TenureMilestone {
  id: string;
  pos: number;
  date: string;
  short: string;
  title: string;
  summary: string;
  why: string;
}

export interface TenureRevenueBand {
  year: string;
  m2m: number;
  one: number;
  two: number;
  total: number;
  est: boolean;
}

export interface HeatmapRow {
  sector: string;
  vals: number[];
}

export interface ScatterCohortPoint {
  id: number;
  label: string;
  sector: string;
  score: number;
  bps: number;
  n: number;
  avgMonthly: number;
}

export interface SegmentIndexRow {
  segment: string;
  contract: string;
  internet: string;
  payment: string;
  n: number;
  churned: number;
  churnRate: number;
  avgMonthly: number;
  mrrAtRisk: number;
  avgTenure: number;
  trend: number[];
}

export interface TelcoDashboardData {
  kpis: {
    totalCustomers: number;
    churnedCount: number;
    retainedCount: number;
    churnRate: number;
    mrrAtRiskK: number;
    totalMrrK: number;
    mrrAtRiskPct: number;
    avgTenureChurn: number;
    avgTenureRetained: number;
    tenureGap: number;
    churnedM2mPct: number;
    churnedEcheckPct: number;
    churnedNoSecPct: number;
    avgMrrChurn: number;
    avgMrrRetained: number;
    arpuGap: number;
  };
  sections: Array<{ id: string; num: string; short: string; folioL: string; folioR: string }>;
  palette: string[];
  heroMatrix: {
    total: number;
    rawTotal: number;
    totalMrr: number;
    scaleUnit: number;
    mrrScaleUnit: number;
    churn: MatrixGroup[];
    contract: MatrixGroup[];
    internet: MatrixGroup[];
    churnValue: MatrixGroup[];
    contractValue: MatrixGroup[];
    internetValue: MatrixGroup[];
  };
  churnValueVsVolume: {
    internet: Array<{
      label: string;
      churnedCount: number;
      volumeShare: number;
      churnMrr: number;
      valueShare: number;
      skewPp: number;
      avgChurnedArpu: number;
    }>;
    spend: Array<{
      label: string;
      churnedCount: number;
      volumeShare: number;
      churnMrr: number;
      valueShare: number;
      skewPp: number;
      avgChurnedArpu: number;
    }>;
    contract: Array<{
      label: string;
      churnedCount: number;
      volumeShare: number;
      churnMrr: number;
      valueShare: number;
      skewPp: number;
      avgChurnedArpu: number;
    }>;
  };
  contractStack: ContractStackItem[];
  contractSummary: ContractSummaryRow[];
  drivers: DriverComparisonRow[];
  contractByInternet: {
    maxAll: number;
    labels: string[];
    colors: string[];
    services: Record<string, { n: number; churnRate: number; values: number[] }>;
  };
  tenureLine: TenureHazardPoint[];
  tenureMilestones: TenureMilestone[];
  mrrByTenure: {
    series: Array<{ key: 'm2m' | 'one' | 'two'; label: string; color: string }>;
    years: TenureRevenueBand[];
  };
  heatmap: {
    cols: string[];
    rows: HeatmapRow[];
  };
  waffle: Record<string, { churned: number; m2mRetained: number; termRetained: number }>;
  lifecycleBars: Array<{ id: number; text: string; vals: [number, number, number, number, number] }>;
  scatter: {
    sectors: Array<{ name: string; color: string; shape: string }>;
    deals: ScatterCohortPoint[];
  };
  riskSummaryBars: {
    maxAll: number;
    labels: string[];
    colors: string[];
    values: number[];
    amountsK: number[];
  };
  segments: SegmentIndexRow[];
  rawRows: TelcoRow[];
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function allocateScaledCounts(rawCounts: Array<{ name: string; rawCount: number }>, targetTotal: number): MatrixGroup[] {
  const rawSum = rawCounts.reduce((a, b) => a + b.rawCount, 0) || 1;
  const exact = rawCounts.map((item) => {
    const floatVal = (item.rawCount / rawSum) * targetTotal;
    const floored = Math.floor(floatVal);
    return { ...item, floored, rem: floatVal - floored };
  });
  let diff = targetTotal - exact.reduce((a, b) => a + b.floored, 0);
  const byRem = [...exact].sort((a, b) => b.rem - a.rem);
  for (let i = 0; i < diff; i++) {
    byRem[i % byRem.length].floored += 1;
  }
  return exact.map((e) => ({ name: e.name, count: e.floored, rawCount: e.rawCount }));
}

export function parseTelcoCsv(text: string): TelcoRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: TelcoRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(',');
    if (cols.length < headers.length) continue;
    const rec: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      rec[headers[j]] = (cols[j] ?? '').trim();
    }
    const parsedTotal = Number.parseFloat(rec.TotalCharges || '0');
    rows.push({
      customerID: rec.customerID || '',
      gender: rec.gender || '',
      SeniorCitizen: Number.parseInt(rec.SeniorCitizen || '0', 10) || 0,
      Partner: rec.Partner || 'No',
      Dependents: rec.Dependents || 'No',
      tenure: Number.parseInt(rec.tenure || '0', 10) || 0,
      PhoneService: rec.PhoneService || 'No',
      MultipleLines: rec.MultipleLines || 'No',
      InternetService: rec.InternetService || 'No',
      OnlineSecurity: rec.OnlineSecurity || 'No',
      OnlineBackup: rec.OnlineBackup || 'No',
      DeviceProtection: rec.DeviceProtection || 'No',
      TechSupport: rec.TechSupport || 'No',
      StreamingTV: rec.StreamingTV || 'No',
      StreamingMovies: rec.StreamingMovies || 'No',
      Contract: rec.Contract || 'Month-to-month',
      PaperlessBilling: rec.PaperlessBilling || 'No',
      PaymentMethod: rec.PaymentMethod || 'Electronic check',
      MonthlyCharges: Number.parseFloat(rec.MonthlyCharges || '0') || 0,
      TotalCharges: Number.isFinite(parsedTotal) ? parsedTotal : 0,
      Churn: rec.Churn || 'No',
    });
  }
  return rows;
}

export function buildTelcoDashboardData(rows: TelcoRow[]): TelcoDashboardData {
  const total = rows.length;
  const churned = rows.filter((r) => r.Churn === 'Yes');
  const retained = rows.filter((r) => r.Churn === 'No');

  const totalMrr = rows.reduce((a, r) => a + r.MonthlyCharges, 0);
  const churnMrr = churned.reduce((a, r) => a + r.MonthlyCharges, 0);
  const avgTenureChurn = churned.reduce((a, r) => a + r.tenure, 0) / Math.max(1, churned.length);
  const avgTenureRetained = retained.reduce((a, r) => a + r.tenure, 0) / Math.max(1, retained.length);

  // 1. Unit matrix (1 square = 20 accounts or ~$1.3k MRR -> ~352 squares)
  const scaleUnit = 20;
  const matrixTotal = Math.round(total / scaleUnit);
  const mrrScaleUnit = Math.round(totalMrr / Math.max(1, matrixTotal));

  const churnGroups = allocateScaledCounts(
    [
      { name: 'Retained', rawCount: retained.length },
      { name: 'Churned', rawCount: churned.length },
    ],
    matrixTotal
  );
  const churnValueGroups = allocateScaledCounts(
    [
      { name: 'Retained', rawCount: Math.round(totalMrr - churnMrr) },
      { name: 'Churned', rawCount: Math.round(churnMrr) },
    ],
    matrixTotal
  );

  const contractOrder = ['Month-to-month', 'One year', 'Two year'];
  const contractGroups = allocateScaledCounts(
    contractOrder.map((c) => ({
      name: c,
      rawCount: rows.filter((r) => r.Contract === c).length,
    })),
    matrixTotal
  );
  const contractValueGroups = allocateScaledCounts(
    contractOrder.map((c) => ({
      name: c,
      rawCount: Math.round(rows.filter((r) => r.Contract === c).reduce((a, r) => a + r.MonthlyCharges, 0)),
    })),
    matrixTotal
  );

  const internetOrder = [
    { raw: 'Fiber optic', label: 'Fiber optic' },
    { raw: 'DSL', label: 'DSL' },
    { raw: 'No', label: 'No internet' },
  ];
  const internetGroups = allocateScaledCounts(
    internetOrder.map((it) => ({
      name: it.label,
      rawCount: rows.filter((r) => r.InternetService === it.raw).length,
    })),
    matrixTotal
  );
  const internetValueGroups = allocateScaledCounts(
    internetOrder.map((it) => ({
      name: it.label,
      rawCount: Math.round(rows.filter((r) => r.InternetService === it.raw).reduce((a, r) => a + r.MonthlyCharges, 0)),
    })),
    matrixTotal
  );

  // 2v. Churn Value (%) vs Churn Volume (%) comparison across dimensions
  const buildValueVol = (specs: Array<{ label: string; fn: (r: TelcoRow) => boolean }>) => {
    const totChVol = Math.max(1, churned.length);
    const totChVal = Math.max(1, churnMrr);
    return specs.map((sp) => {
      const subCh = churned.filter(sp.fn);
      const mrr = subCh.reduce((a, r) => a + r.MonthlyCharges, 0);
      const volShare = round1((subCh.length / totChVol) * 100);
      const valShare = round1((mrr / totChVal) * 100);
      return {
        label: sp.label,
        churnedCount: subCh.length,
        volumeShare: volShare,
        churnMrr: Math.round(mrr),
        valueShare: valShare,
        skewPp: round1(valShare - volShare),
        avgChurnedArpu: subCh.length ? round1(mrr / subCh.length) : 0,
      };
    });
  };

  const churnValueVsVolume = {
    internet: buildValueVol([
      { label: 'Fiber optic', fn: (r) => r.InternetService === 'Fiber optic' },
      { label: 'DSL', fn: (r) => r.InternetService === 'DSL' },
      { label: 'No internet', fn: (r) => r.InternetService === 'No' },
    ]),
    spend: buildValueVol([
      { label: 'High ARPU ($90+)', fn: (r) => r.MonthlyCharges >= 90 },
      { label: 'Premium ($70–89)', fn: (r) => r.MonthlyCharges >= 70 && r.MonthlyCharges < 90 },
      { label: 'Standard ($35–69)', fn: (r) => r.MonthlyCharges >= 35 && r.MonthlyCharges < 70 },
      { label: 'Low (<$35)', fn: (r) => r.MonthlyCharges < 35 },
    ]),
    contract: buildValueVol([
      { label: 'Month-to-month', fn: (r) => r.Contract === 'Month-to-month' },
      { label: 'One year', fn: (r) => r.Contract === 'One year' },
      { label: 'Two year', fn: (r) => r.Contract === 'Two year' },
    ]),
  };

  // 2a. Stacked bar: Contract & Churn outcome composition (100%)
  const m2mChurn = rows.filter((r) => r.Contract === 'Month-to-month' && r.Churn === 'Yes').length;
  const m2mRet = rows.filter((r) => r.Contract === 'Month-to-month' && r.Churn === 'No').length;
  const oneYrAll = rows.filter((r) => r.Contract === 'One year').length;
  const twoYrAll = rows.filter((r) => r.Contract === 'Two year').length;

  const pct = (n: number) => round1((n / Math.max(1, total)) * 100);
  const p1 = pct(m2mChurn);
  const p2 = pct(m2mRet);
  const p3 = pct(oneYrAll);
  const p4 = round1(100 - p1 - p2 - p3);

  const contractStack: ContractStackItem[] = [
    { name: 'M2M Churned', value: p1, rawCount: m2mChurn, color: 'var(--vermilion)', text: 'var(--on-vermilion)' },
    { name: 'M2M Retained', value: p2, rawCount: m2mRet, color: 'var(--violet)', text: 'var(--on-violet)' },
    { name: 'One-year', value: p3, rawCount: oneYrAll, color: 'var(--magenta)', text: 'var(--on-magenta)' },
    { name: 'Two-year', value: p4, rawCount: twoYrAll, color: 'var(--ink)', text: 'var(--paper)' },
  ];

  // 2b. Contract summary table
  const contractSummary: ContractSummaryRow[] = contractOrder.map((c) => {
    const sub = rows.filter((r) => r.Contract === c);
    const ch = sub.filter((r) => r.Churn === 'Yes');
    const tenSorted = sub.map((r) => r.tenure).sort((a, b) => a - b);
    const medT = tenSorted.length ? tenSorted[Math.floor(tenSorted.length / 2)] : 0;
    return {
      contract: c,
      n: sub.length,
      share: round1((sub.length / Math.max(1, total)) * 100),
      churnRate: round1((ch.length / Math.max(1, sub.length)) * 100),
      churnMrr: Math.round(ch.reduce((a, r) => a + r.MonthlyCharges, 0)),
      medianTenure: medT,
    };
  });

  // 3. Dumbbell: Retained vs Churned attribute prevalence (%)
  const driverDefs: Array<{ item: string; fn: (r: TelcoRow) => boolean }> = [
    { item: 'Month-to-month contract', fn: (r) => r.Contract === 'Month-to-month' },
    { item: 'No online security', fn: (r) => r.OnlineSecurity === 'No' },
    { item: 'No tech support', fn: (r) => r.TechSupport === 'No' },
    { item: 'Paperless billing', fn: (r) => r.PaperlessBilling === 'Yes' },
    { item: 'Fiber optic internet', fn: (r) => r.InternetService === 'Fiber optic' },
    { item: 'Electronic check billing', fn: (r) => r.PaymentMethod === 'Electronic check' },
    { item: 'Has partner', fn: (r) => r.Partner === 'Yes' },
    { item: 'Two-year contract', fn: (r) => r.Contract === 'Two year' },
  ];
  const drivers: DriverComparisonRow[] = driverDefs.map((d) => ({
    item: d.item,
    retained: Math.round((retained.filter(d.fn).length / Math.max(1, retained.length)) * 100),
    churned: Math.round((churned.filter(d.fn).length / Math.max(1, churned.length)) * 100),
  }));

  // 4. Contract mix by Internet Service Tier
  const svcKeys = [
    { label: 'All Accounts', filter: () => true },
    { label: 'Fiber optic', filter: (r: TelcoRow) => r.InternetService === 'Fiber optic' },
    { label: 'DSL', filter: (r: TelcoRow) => r.InternetService === 'DSL' },
    { label: 'No internet', filter: (r: TelcoRow) => r.InternetService === 'No' },
  ];
  const services: Record<string, { n: number; churnRate: number; values: number[] }> = {};
  svcKeys.forEach((sk) => {
    const sub = rows.filter(sk.filter);
    const m2mP = Math.round((sub.filter((r) => r.Contract === 'Month-to-month').length / Math.max(1, sub.length)) * 100);
    const oneP = Math.round((sub.filter((r) => r.Contract === 'One year').length / Math.max(1, sub.length)) * 100);
    const twoP = 100 - m2mP - oneP;
    const chP = round1((sub.filter((r) => r.Churn === 'Yes').length / Math.max(1, sub.length)) * 100);
    services[sk.label] = { n: sub.length, churnRate: chP, values: [m2mP, oneP, twoP] };
  });

  // 5. Tenure Churn Curve (7 bands mapped across 0..6 years)
  const tenureSpecs = [
    { bandIdx: 0, label: '0–6 mo', min: 0, max: 6 },
    { bandIdx: 1, label: '7–12 mo', min: 7, max: 12 },
    { bandIdx: 2, label: '13–24 mo', min: 13, max: 24 },
    { bandIdx: 3, label: '25–36 mo', min: 25, max: 36 },
    { bandIdx: 4, label: '37–48 mo', min: 37, max: 48 },
    { bandIdx: 5, label: '49–60 mo', min: 49, max: 60 },
    { bandIdx: 6, label: '61–72 mo', min: 61, max: 72 },
  ];
  const tenureLine: TenureHazardPoint[] = tenureSpecs.map((spec) => {
    const sub = rows.filter((r) => r.tenure >= spec.min && r.tenure <= spec.max);
    const ch = sub.filter((r) => r.Churn === 'Yes').length;
    const cRate = round1((ch / Math.max(1, sub.length)) * 100);
    return {
      bandIdx: spec.bandIdx,
      label: spec.label,
      churnRate: cRate,
      retainedRate: round1(100 - cRate),
      n: sub.length,
      churned: ch,
    };
  });

  const statBand = (min: number, max: number) => {
    const sub = rows.filter((r) => r.tenure >= min && r.tenure <= max);
    const ch = sub.filter((r) => r.Churn === 'Yes');
    const rate = round1((ch.length / Math.max(1, sub.length)) * 100);
    const mrr = Math.round(ch.reduce((a, r) => a + r.MonthlyCharges, 0) / 1000);
    return { n: sub.length, ch: ch.length, rate, mrr };
  };
  const b0 = statBand(0, 6);
  const b1 = statBand(7, 12);
  const b2 = statBand(13, 24);
  const b3 = statBand(25, 36);
  const b4 = statBand(37, 48);
  const b5 = statBand(49, 60);
  const b6 = statBand(61, 72);

  const tenureMilestones: TenureMilestone[] = [
    {
      id: 'mo-0-6',
      pos: 0.25,
      date: '0–6 mo',
      short: 'Onboarding cliff',
      title: 'Over half of early-tenure accounts leave within 6 months',
      summary: `In the opening 6-month cohort (${b0.n.toLocaleString()} accounts), ${b0.ch.toLocaleString()} subscribers churned—a ${b0.rate}% hazard rate accounting for $${b0.mrr}k/mo in lost recurring billing.`,
      why: 'Month-to-month fiber and electronic-check sign-ups concentrate heavily in this opening window.',
    },
    {
      id: 'mo-7-12',
      pos: 1.0,
      date: '7–12 mo',
      short: 'First-year mark',
      title: 'Year-one retention improves as early churners exit',
      summary: `Between months 7 and 12 (${b1.n.toLocaleString()} accounts), churn moderates to ${b1.rate}% (${b1.ch} accounts, $${b1.mrr}k/mo at risk) as promotional cycles settle.`,
      why: 'Year-1 accounts still represent 39.2% of total churn volume across the entire portfolio.',
    },
    {
      id: 'mo-13-24',
      pos: 2.0,
      date: '13–24 mo',
      short: 'Year 2 migration',
      title: 'One-year contract migrations begin flattening the hazard curve',
      summary: `Accounts reaching 13–24 months (${b2.n.toLocaleString()} customers) exhibit a ${b2.rate}% churn rate (${b2.ch} exits), dropping more than 24 percentage points from the onboarding cliff.`,
      why: 'Multi-service bundling and automatic bank/card billing start compounding switching costs.',
    },
    {
      id: 'mo-25-36',
      pos: 3.0,
      date: '25–36 mo',
      short: 'Mid-tenure base',
      title: 'Mid-tenure attrition narrows to roughly one in five accounts',
      summary: `At 25–36 months (${b3.n.toLocaleString()} accounts), churn stabilizes at ${b3.rate}% (${b3.ch} exits, $${b3.mrr}k/mo lost), signaling durable product fit.`,
      why: 'Technical support and online security adoption rises steadily above 40% among multi-year accounts.',
    },
    {
      id: 'mo-37-48',
      pos: 4.0,
      date: '37–48 mo',
      short: 'Term lock-in',
      title: 'Sub-20% churn threshold crossed in Year 4',
      summary: `Only ${b4.ch} of ${b4.n.toLocaleString()} accounts in the 37–48 month bracket churned (${b4.rate}%), while locked-in term contracts surpass month-to-month share.`,
      why: 'Reaching 3+ years cuts monthly attrition probability by nearly two-thirds vs Year 1.',
    },
    {
      id: 'mo-49-60',
      pos: 5.0,
      date: '49–60 mo',
      short: '5-year cohort',
      title: 'Five-year loyalty locks in high recurring lifetime value',
      summary: `In the 49–60 month cohort (${b5.n.toLocaleString()} customers), churn drops to ${b5.rate}% (${b5.ch} exits), preserving stable auto-pay and bundled internet revenue.`,
      why: 'Nearly half of five-year subscribers hold two-year contract protections.',
    },
    {
      id: 'mo-61-72',
      pos: 6.0,
      date: '61–72 mo',
      short: 'Mature core',
      title: 'Mature 6-year subscribers sustain a 93.4% retention rate',
      summary: `Among ${b6.n.toLocaleString()} customers with 61–72 months tenure, only ${b6.ch} churned (${b6.rate}%), anchoring $${b6.mrr}k/mo churn exposure against over $106k/mo in steady MRR.`,
      why: 'Two-year agreements and security add-ons drive the portfolio’s lowest churn floor.',
    },
  ];

  // 6. Scrollytelling Monthly Revenue ($k) across 6 Tenure Years by Contract
  const yearBands = [
    { label: '0–12 mo', min: 0, max: 12, est: false },
    { label: '13–24 mo', min: 13, max: 24, est: false },
    { label: '25–36 mo', min: 25, max: 36, est: false },
    { label: '37–48 mo', min: 37, max: 48, est: false },
    { label: '49–60 mo', min: 49, max: 60, est: false },
    { label: '61–72 mo', min: 61, max: 72, est: false },
  ];
  const mrrYears: TenureRevenueBand[] = yearBands.map((yb) => {
    const sub = rows.filter((r) => r.tenure >= yb.min && r.tenure <= yb.max);
    const m2m = round1(sub.filter((r) => r.Contract === 'Month-to-month').reduce((a, r) => a + r.MonthlyCharges, 0) / 1000);
    const one = round1(sub.filter((r) => r.Contract === 'One year').reduce((a, r) => a + r.MonthlyCharges, 0) / 1000);
    const two = round1(sub.filter((r) => r.Contract === 'Two year').reduce((a, r) => a + r.MonthlyCharges, 0) / 1000);
    return {
      year: yb.label,
      m2m,
      one,
      two,
      total: round1(m2m + one + two),
      est: yb.est,
    };
  });

  // 7. Heatmap: 10 risk/service factors x 4 Payment Methods + Overall
  const pms = ['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)'];
  const hmCols = ['Electronic check', 'Mailed check', 'Bank transfer', 'Credit card', 'Overall'];
  const hmSegs: Array<{ name: string; fn: (r: TelcoRow) => boolean }> = [
    { name: 'Month-to-month contract', fn: (r) => r.Contract === 'Month-to-month' },
    { name: 'Fiber optic internet', fn: (r) => r.InternetService === 'Fiber optic' },
    { name: 'No online security', fn: (r) => r.OnlineSecurity === 'No' },
    { name: 'No tech support', fn: (r) => r.TechSupport === 'No' },
    { name: 'Senior citizen (65+)', fn: (r) => r.SeniorCitizen === 1 },
    { name: 'No online backup', fn: (r) => r.OnlineBackup === 'No' },
    { name: 'Paperless billing', fn: (r) => r.PaperlessBilling === 'Yes' },
    { name: 'Single (no partner)', fn: (r) => r.Partner === 'No' },
    { name: 'DSL internet', fn: (r) => r.InternetService === 'DSL' },
    { name: 'Term contract (1–2 yr)', fn: (r) => r.Contract !== 'Month-to-month' },
  ];
  const hmRows: HeatmapRow[] = hmSegs.map((seg) => {
    const subAll = rows.filter(seg.fn);
    const allRate = Math.round((subAll.filter((r) => r.Churn === 'Yes').length / Math.max(1, subAll.length)) * 100);
    const colVals = pms.map((pm) => {
      const sub = subAll.filter((r) => r.PaymentMethod === pm);
      return sub.length ? Math.round((sub.filter((r) => r.Churn === 'Yes').length / sub.length) * 100) : 0;
    });
    return { sector: seg.name, vals: [...colVals, allRate] };
  });

  // 8a. Waffle: 3-way split per 100 accounts (Churned / M2M Retained / Term Retained)
  const waffle: Record<string, { churned: number; m2mRetained: number; termRetained: number }> = {};
  svcKeys.forEach((sk) => {
    const sub = rows.filter(sk.filter);
    const ch = Math.round((sub.filter((r) => r.Churn === 'Yes').length / Math.max(1, sub.length)) * 100);
    const termRet = Math.round((sub.filter((r) => r.Churn === 'No' && r.Contract !== 'Month-to-month').length / Math.max(1, sub.length)) * 100);
    const m2mRet = 100 - ch - termRet;
    waffle[sk.label] = { churned: ch, m2mRetained: m2mRet, termRetained: termRet };
  });

  // 8b. Diverging 5-part Customer Outcome Profile Bars
  const lifeDefs: Array<{ id: number; text: string; fn: (r: TelcoRow) => boolean }> = [
    { id: 1, text: 'Electronic check payers (n = 2,365)', fn: (r) => r.PaymentMethod === 'Electronic check' },
    { id: 2, text: 'No online security add-on (n = 3,498)', fn: (r) => r.OnlineSecurity === 'No' },
    { id: 3, text: 'Fiber optic subscribers (n = 3,096)', fn: (r) => r.InternetService === 'Fiber optic' },
    { id: 4, text: 'Senior citizens 65+ (n = 1,142)', fn: (r) => r.SeniorCitizen === 1 },
    { id: 5, text: 'DSL internet subscribers (n = 2,421)', fn: (r) => r.InternetService === 'DSL' },
    { id: 6, text: 'Automatic payment (bank / card, n = 3,066)', fn: (r) => r.PaymentMethod.includes('automatic') },
    { id: 7, text: 'Accounts with online security (n = 2,019)', fn: (r) => r.OnlineSecurity === 'Yes' },
  ];
  const lifecycleBars = lifeDefs.map((ld) => {
    const sub = rows.filter(ld.fn);
    const n = Math.max(1, sub.length);
    const c1 = Math.round((sub.filter((r) => r.Churn === 'Yes' && r.tenure <= 12).length / n) * 100);
    const c2 = Math.round((sub.filter((r) => r.Churn === 'Yes' && r.tenure > 12).length / n) * 100);
    const c3 = Math.round((sub.filter((r) => r.Churn === 'No' && r.Contract === 'Month-to-month').length / n) * 100);
    const c4 = Math.round((sub.filter((r) => r.Churn === 'No' && r.Contract === 'One year').length / n) * 100);
    const c5 = Math.max(0, 100 - c1 - c2 - c3 - c4);
    return { id: ld.id, text: ld.text, vals: [c1, c2, c3, c4, c5] as [number, number, number, number, number] };
  });

  // 9. Scatter + Live OLS: 10 7-month tenure brackets x 3 Internet Service tiers = 30 cohorts
  const scatterSectors = [
    { name: 'Fiber optic', color: 'var(--vermilion)', shape: 'square' },
    { name: 'DSL', color: 'var(--violet)', shape: 'circle' },
    { name: 'No internet', color: 'var(--magenta)', shape: 'triangle' },
  ];
  const deals: ScatterCohortPoint[] = [];
  let ptId = 1;
  for (let b = 0; b < 10; b++) {
    const lo = b * 7 + (b === 0 ? 0 : 1);
    const hi = b === 9 ? 72 : (b + 1) * 7;
    [
      { raw: 'Fiber optic', label: 'Fiber optic' },
      { raw: 'DSL', label: 'DSL' },
      { raw: 'No', label: 'No internet' },
    ].forEach((svc) => {
      const sub = rows.filter((r) => r.InternetService === svc.raw && r.tenure >= lo && r.tenure <= hi);
      if (sub.length > 0) {
        const avgTen = sub.reduce((a, r) => a + r.tenure, 0) / sub.length;
        const avgChg = sub.reduce((a, r) => a + r.MonthlyCharges, 0) / sub.length;
        const chRate = (sub.filter((r) => r.Churn === 'Yes').length / sub.length) * 100;
        deals.push({
          id: ptId++,
          label: `${svc.label} (${lo}–${hi} mo)`,
          sector: svc.label,
          score: round1(avgTen),
          bps: round1(chRate),
          n: sub.length,
          avgMonthly: round1(avgChg),
        });
      }
    });
  }

  // 10a. Churned MRR Share (%) by Contract
  const mrrM2mCh = churned.filter((r) => r.Contract === 'Month-to-month').reduce((a, r) => a + r.MonthlyCharges, 0);
  const mrrOneCh = churned.filter((r) => r.Contract === 'One year').reduce((a, r) => a + r.MonthlyCharges, 0);
  const mrrTwoCh = churned.filter((r) => r.Contract === 'Two year').reduce((a, r) => a + r.MonthlyCharges, 0);
  const mrrDen = Math.max(1, churnMrr);
  const pM2mCh = Math.round((mrrM2mCh / mrrDen) * 100);
  const pOneCh = Math.round((mrrOneCh / mrrDen) * 100);
  const pTwoCh = Math.max(0, 100 - pM2mCh - pOneCh);

  // 10b. 36 Micro-Segments (Contract x InternetService x PaymentMethod)
  const segments: SegmentIndexRow[] = [];
  contractOrder.forEach((c) => {
    ['Fiber optic', 'DSL', 'No'].forEach((net) => {
      pms.forEach((pm) => {
        const sub = rows.filter((r) => r.Contract === c && r.InternetService === net && r.PaymentMethod === pm);
        if (sub.length > 0) {
          const ch = sub.filter((r) => r.Churn === 'Yes');
          const mrr = sub.reduce((a, r) => a + r.MonthlyCharges, 0);
          const chMrr = ch.reduce((a, r) => a + r.MonthlyCharges, 0);
          const avgTen = sub.reduce((a, r) => a + r.tenure, 0) / sub.length;
          const netLabel = net === 'No' ? 'No internet' : net;
          const pmShort = pm.replace(' (automatic)', ' (auto)');
          // 6-year churn curve sparkline (0-12m..61-72m)
          const curve = [0, 1, 2, 3, 4, 5].map((y) => {
            const lo = y * 12 + (y === 0 ? 0 : 1);
            const hi = (y + 1) * 12;
            const yrSub = sub.filter((r) => r.tenure >= lo && r.tenure <= hi);
            return yrSub.length ? round1((yrSub.filter((r) => r.Churn === 'Yes').length / yrSub.length) * 100) : 0;
          });
          segments.push({
            segment: `${netLabel} · ${pmShort}`,
            contract: c,
            internet: netLabel,
            payment: pmShort,
            n: sub.length,
            churned: ch.length,
            churnRate: round1((ch.length / sub.length) * 100),
            avgMonthly: round1(mrr / sub.length),
            mrrAtRisk: Math.round(chMrr),
            avgTenure: round1(avgTen),
            trend: curve,
          });
        }
      });
    });
  });

  const churnedM2mPct = round1((churned.filter((r) => r.Contract === 'Month-to-month').length / Math.max(1, churned.length)) * 100);
  const churnedEcheckPct = round1((churned.filter((r) => r.PaymentMethod === 'Electronic check').length / Math.max(1, churned.length)) * 100);
  const churnedNoSecPct = round1((churned.filter((r) => r.OnlineSecurity === 'No').length / Math.max(1, churned.length)) * 100);

  const avgMrrChurn = churnMrr / Math.max(1, churned.length);
  const avgMrrRetained = (totalMrr - churnMrr) / Math.max(1, retained.length);

  return {
    kpis: {
      totalCustomers: total,
      churnedCount: churned.length,
      retainedCount: retained.length,
      churnRate: round1((churned.length / Math.max(1, total)) * 100),
      mrrAtRiskK: round1(churnMrr / 1000),
      totalMrrK: round1(totalMrr / 1000),
      mrrAtRiskPct: round1((churnMrr / Math.max(1, totalMrr)) * 100),
      avgTenureChurn: round1(avgTenureChurn),
      avgTenureRetained: round1(avgTenureRetained),
      tenureGap: round1(avgTenureRetained - avgTenureChurn),
      churnedM2mPct,
      churnedEcheckPct,
      churnedNoSecPct,
      avgMrrChurn: round1(avgMrrChurn),
      avgMrrRetained: round1(avgMrrRetained),
      arpuGap: round1(avgMrrChurn - avgMrrRetained),
    },
    sections: [
      { id: 's01', num: '01', short: 'Overview', folioL: '002', folioR: '003' },
      { id: 's02', num: '02', short: 'Contracts', folioL: '010', folioR: '011' },
      { id: 's03', num: '03', short: 'Drivers', folioL: '018', folioR: '019' },
      { id: 's04', num: '04', short: 'Service Mix', folioL: '026', folioR: '027' },
      { id: 's05', num: '05', short: 'Tenure Curve', folioL: '034', folioR: '035' },
      { id: 's06', num: '06', short: 'MRR Cohorts', folioL: '042', folioR: '043' },
      { id: 's07', num: '07', short: 'Risk Heatmap', folioL: '050', folioR: '051' },
      { id: 's08', num: '08', short: 'Retention Split', folioL: '058', folioR: '059' },
      { id: 's09', num: '09', short: 'Tenure OLS', folioL: '066', folioR: '067' },
      { id: 's10', num: '10', short: 'Segment Index', folioL: '074', folioR: '075' },
      { id: 's11', num: '11', short: 'ML & Uplift', folioL: '082', folioR: '083' },
      { id: 's12', num: '12', short: 'PSM Study', folioL: '090', folioR: '091' },
    ],
    palette: ['var(--violet)', 'var(--vermilion)', 'var(--magenta)', 'var(--ink)', 'var(--neutral-data)'],
    heroMatrix: {
      total: matrixTotal,
      rawTotal: total,
      totalMrr: Math.round(totalMrr),
      scaleUnit,
      mrrScaleUnit,
      churn: churnGroups,
      contract: contractGroups,
      internet: internetGroups,
      churnValue: churnValueGroups,
      contractValue: contractValueGroups,
      internetValue: internetValueGroups,
    },
    churnValueVsVolume,
    contractStack,
    contractSummary,
    drivers,
    contractByInternet: {
      maxAll: 72,
      labels: ['Month-to-month', 'One year', 'Two year'],
      colors: ['var(--vermilion)', 'var(--violet)', 'var(--magenta)'],
      services,
    },
    tenureLine,
    tenureMilestones,
    mrrByTenure: {
      series: [
        { key: 'm2m', label: 'Month-to-month', color: 'var(--vermilion)' },
        { key: 'one', label: 'One year', color: 'var(--violet)' },
        { key: 'two', label: 'Two year', color: 'var(--magenta)' },
      ],
      years: mrrYears,
    },
    heatmap: {
      cols: hmCols,
      rows: hmRows,
    },
    waffle,
    lifecycleBars,
    scatter: {
      sectors: scatterSectors,
      deals,
    },
    riskSummaryBars: {
      maxAll: 92,
      labels: ['Month-to-month', 'One year', 'Two year'],
      colors: ['var(--vermilion)', 'var(--violet)', 'var(--magenta)'],
      values: [pM2mCh, pOneCh, pTwoCh],
      amountsK: [round1(mrrM2mCh / 1000), round1(mrrOneCh / 1000), round1(mrrTwoCh / 1000)],
    },
    segments,
    rawRows: rows,
  };
}

export async function loadTelcoDashboardData(csvUrl = './assets/aistudio/Telco-Customer-Churn_16320c9c.csv'): Promise<TelcoDashboardData> {
  const res = await fetch(csvUrl);
  if (!res.ok) {
    throw new Error(`Unable to load Telco CSV (${res.status})`);
  }
  const text = await res.text();
  const rows = parseTelcoCsv(text);
  return buildTelcoDashboardData(rows);
}
