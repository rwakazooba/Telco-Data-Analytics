import type { TelcoRow } from './telcoData';

export type ModelKey = 'gb' | 'logreg';
export type CampaignOfferKey = 'contract_security' | 'autopay_support' | 'two_year_bundle';

export interface CampaignOfferSpec {
  key: CampaignOfferKey;
  label: string;
  shortLabel: string;
  monthlyIncentiveCost: number;
  contractMonths: number;
  description: string;
}

export const CAMPAIGN_OFFERS: CampaignOfferSpec[] = [
  {
    key: 'contract_security',
    label: '1-Yr Term + Security Bundle ($10/mo credit)',
    shortLabel: '1-Yr + Security',
    monthlyIncentiveCost: 10,
    contractMonths: 12,
    description: 'Migrates month-to-month subscribers to a 1-year agreement with Online Security included.',
  },
  {
    key: 'autopay_support',
    label: 'Auto-Pay + Tech Support ($5/mo credit)',
    shortLabel: 'Auto-Pay + Support',
    monthlyIncentiveCost: 5,
    contractMonths: 12,
    description: 'Converts manual/electronic-check billing to automatic payment paired with Tech Support.',
  },
  {
    key: 'two_year_bundle',
    label: '2-Yr Lock-in + Full Protection ($15/mo credit)',
    shortLabel: '2-Yr Lock-in',
    monthlyIncentiveCost: 15,
    contractMonths: 12,
    description: 'Deep retention offer moving high-MRR Fiber subscribers to a 2-year term with security & support.',
  },
];

export interface ModelMetrics {
  key: ModelKey;
  name: string;
  sklearnClass: string;
  hyperparams: string;
  rocAuc: number;
  prAuc: number;
  logLoss: number;
  brier: number;
  topDecileLift: number;
  top20Capture: number;
  trainTimeMs: number;
}

export interface DecilePoint {
  decile: number; // 1..10
  pctPop: number; // 10..100
  n: number;
  churners: number;
  churnRate: number;
  decileLift: number;
  cumLift: number;
  cumCapture: number; // % of total churners captured
}

export interface UpliftCurvePoint {
  pctPop: number; // 0..100
  upliftIncrementalSaves: number; // cumulative expected incremental retained accounts when ranked by uplift
  riskIncrementalSaves: number;   // cumulative expected incremental retained accounts when ranked by churn risk alone
  randomIncrementalSaves: number; // linear random baseline
}

export interface FeatureDriver {
  feature: string;
  gbImportance: number; // 0..100%
  logRegCoef: number;   // standardized log-odds coefficient
  oddsRatio: number;
  direction: 'risk' | 'protective';
}

export interface ScoredCustomer {
  customerID: string;
  contract: string;
  internet: string;
  payment: string;
  tenure: number;
  monthlyCharges: number;
  totalCharges: number;
  actualChurn: boolean;
  onlineSecurity: string;
  techSupport: string;
  probGb: number;
  probLogReg: number;
  probEnsemble: number;
  // Counterfactual treated probabilities under each offer
  upliftGb: Record<CampaignOfferKey, number>;
  upliftLogReg: Record<CampaignOfferKey, number>;
}

export interface TelcoMlResult {
  trainCount: number;
  testCount: number;
  baseChurnRate: number;
  models: Record<ModelKey, ModelMetrics>;
  deciles: Record<ModelKey, DecilePoint[]>;
  upliftCurves: Record<ModelKey, Record<CampaignOfferKey, UpliftCurvePoint[]>>;
  featureDrivers: FeatureDriver[];
  customers: ScoredCustomer[];
}

const FEATURE_LABELS = [
  'Tenure (months)',
  'Monthly charges ($)',
  'Total charges ($)',
  'Active add-on count',
  'Senior citizen (65+)',
  'Has partner',
  'Has dependents',
  'Contract: One year',
  'Contract: Two year',
  'Internet: Fiber optic',
  'Internet: No service',
  'Online security: Yes',
  'Online backup: Yes',
  'Device protection: Yes',
  'Tech support: Yes',
  'Streaming bundle: Yes',
  'Paperless billing: Yes',
  'Payment: Electronic check',
  'Payment: Auto-pay',
];

const NUM_FEATURES = FEATURE_LABELS.length;
const NUMERIC_INDICES = [0, 1, 2, 3];

function sigmoid(z: number): number {
  if (z >= 0) {
    const ez = Math.exp(-z);
    return 1 / (1 + ez);
  }
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function encodeRawFeatureVector(r: TelcoRow, out: Float64Array, offset: number): void {
  let svcCount = 0;
  if (r.PhoneService === 'Yes') svcCount++;
  if (r.MultipleLines === 'Yes') svcCount++;
  if (r.OnlineSecurity === 'Yes') svcCount++;
  if (r.OnlineBackup === 'Yes') svcCount++;
  if (r.DeviceProtection === 'Yes') svcCount++;
  if (r.TechSupport === 'Yes') svcCount++;
  if (r.StreamingTV === 'Yes') svcCount++;
  if (r.StreamingMovies === 'Yes') svcCount++;

  out[offset + 0] = r.tenure;
  out[offset + 1] = r.MonthlyCharges;
  out[offset + 2] = r.TotalCharges;
  out[offset + 3] = svcCount;
  out[offset + 4] = r.SeniorCitizen === 1 ? 1 : 0;
  out[offset + 5] = r.Partner === 'Yes' ? 1 : 0;
  out[offset + 6] = r.Dependents === 'Yes' ? 1 : 0;
  out[offset + 7] = r.Contract === 'One year' ? 1 : 0;
  out[offset + 8] = r.Contract === 'Two year' ? 1 : 0;
  out[offset + 9] = r.InternetService === 'Fiber optic' ? 1 : 0;
  out[offset + 10] = r.InternetService === 'No' ? 1 : 0;
  out[offset + 11] = r.OnlineSecurity === 'Yes' ? 1 : 0;
  out[offset + 12] = r.OnlineBackup === 'Yes' ? 1 : 0;
  out[offset + 13] = r.DeviceProtection === 'Yes' ? 1 : 0;
  out[offset + 14] = r.TechSupport === 'Yes' ? 1 : 0;
  out[offset + 15] = r.StreamingTV === 'Yes' || r.StreamingMovies === 'Yes' ? 1 : 0;
  out[offset + 16] = r.PaperlessBilling === 'Yes' ? 1 : 0;
  out[offset + 17] = r.PaymentMethod === 'Electronic check' ? 1 : 0;
  out[offset + 18] = r.PaymentMethod.includes('automatic') ? 1 : 0;
}

function makeCounterfactualRow(r: TelcoRow, offer: CampaignOfferKey, monthlyCost: number): TelcoRow {
  const next: TelcoRow = { ...r };
  if (offer === 'contract_security') {
    if (next.Contract === 'Month-to-month') next.Contract = 'One year';
    if (next.InternetService !== 'No') next.OnlineSecurity = 'Yes';
    next.MonthlyCharges = Math.max(18, r.MonthlyCharges - monthlyCost);
  } else if (offer === 'autopay_support') {
    if (!next.PaymentMethod.includes('automatic')) next.PaymentMethod = 'Credit card (automatic)';
    if (next.InternetService !== 'No') next.TechSupport = 'Yes';
    next.MonthlyCharges = Math.max(18, r.MonthlyCharges - monthlyCost);
  } else if (offer === 'two_year_bundle') {
    next.Contract = 'Two year';
    if (next.InternetService !== 'No') {
      next.OnlineSecurity = 'Yes';
      next.TechSupport = 'Yes';
    }
    if (!next.PaymentMethod.includes('automatic')) next.PaymentMethod = 'Bank transfer (automatic)';
    next.MonthlyCharges = Math.max(18, r.MonthlyCharges - monthlyCost);
  }
  return next;
}

function solveLinearSystem(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const M = new Float64Array(n * (n + 1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      M[i * (n + 1) + j] = A[i * n + j];
    }
    M[i * (n + 1) + n] = b[i];
  }

  for (let col = 0; col < n; col++) {
    let pivot = col;
    let maxVal = Math.abs(M[col * (n + 1) + col]);
    for (let row = col + 1; row < n; row++) {
      const v = Math.abs(M[row * (n + 1) + col]);
      if (v > maxVal) {
        maxVal = v;
        pivot = row;
      }
    }
    if (pivot !== col) {
      for (let k = col; k <= n; k++) {
        const tmp = M[col * (n + 1) + k];
        M[col * (n + 1) + k] = M[pivot * (n + 1) + k];
        M[pivot * (n + 1) + k] = tmp;
      }
    }
    const diag = M[col * (n + 1) + col] || 1e-9;
    for (let row = col + 1; row < n; row++) {
      const factor = M[row * (n + 1) + col] / diag;
      if (factor === 0) continue;
      for (let k = col; k <= n; k++) {
        M[row * (n + 1) + k] -= factor * M[col * (n + 1) + k];
      }
    }
  }

  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i * (n + 1) + n];
    for (let j = i + 1; j < n; j++) {
      s -= M[i * (n + 1) + j] * x[j];
    }
    x[i] = s / (M[i * (n + 1) + i] || 1e-9);
  }
  return x;
}

/** L2-regularized Logistic Regression solved via damped Newton-Raphson (IRLS) matching sklearn LogisticRegression(C=1.0) */
function fitLogisticRegression(
  X: Float64Array,
  y: Uint8Array,
  trainIdx: number[],
  C = 1.0
): { weights: Float64Array; bias: number; predictRow: (vec: Float64Array, offset: number) => number } {
  const dim = NUM_FEATURES + 1; // index 0 is bias
  const w = new Float64Array(dim);
  const lambda = 1.0 / C;
  const nTrain = trainIdx.length;

  const H = new Float64Array(dim * dim);
  const g = new Float64Array(dim);

  for (let iter = 0; iter < 12; iter++) {
    H.fill(0);
    g.fill(0);

    for (let k = 0; k < nTrain; k++) {
      const idx = trainIdx[k];
      const base = idx * NUM_FEATURES;
      let z = w[0];
      for (let f = 0; f < NUM_FEATURES; f++) {
        z += w[f + 1] * X[base + f];
      }
      const p = sigmoid(z);
      const wt = Math.max(1e-6, p * (1 - p));
      const err = y[idx] - p;

      g[0] += err;
      H[0] += wt;
      for (let i = 0; i < NUM_FEATURES; i++) {
        const xi = X[base + i];
        if (xi === 0) continue;
        g[i + 1] += err * xi;
        H[(i + 1) * dim + 0] += wt * xi;
        H[0 * dim + (i + 1)] += wt * xi;
        for (let j = i; j < NUM_FEATURES; j++) {
          const xj = X[base + j];
          if (xj === 0) continue;
          const v = wt * xi * xj;
          H[(i + 1) * dim + (j + 1)] += v;
          if (i !== j) H[(j + 1) * dim + (i + 1)] += v;
        }
      }
    }

    // L2 penalty gradient & Hessian (do not penalize bias w[0])
    for (let f = 1; f < dim; f++) {
      g[f] -= lambda * w[f];
      H[f * dim + f] += lambda;
    }
    H[0] += 1e-6;

    const delta = solveLinearSystem(H, g, dim);
    let maxStep = 0;
    for (let f = 0; f < dim; f++) {
      w[f] += delta[f];
      if (Math.abs(delta[f]) > maxStep) maxStep = Math.abs(delta[f]);
    }
    if (maxStep < 1e-5) break;
  }

  const weights = w.slice(1);
  const bias = w[0];
  return {
    weights,
    bias,
    predictRow: (vec: Float64Array, offset: number) => {
      let z = bias;
      for (let f = 0; f < NUM_FEATURES; f++) z += weights[f] * vec[offset + f];
      return sigmoid(z);
    },
  };
}

interface TreeNode {
  leaf: boolean;
  value: number;
  feature: number;
  threshold: number;
  left?: TreeNode;
  right?: TreeNode;
}

/** Binomial Gradient Boosted Decision Trees matching sklearn GradientBoostingClassifier(n_estimators=45, max_depth=3, learning_rate=0.1) */
function fitGradientBoosting(
  X: Float64Array,
  y: Uint8Array,
  trainIdx: number[],
  nEstimators = 45,
  maxDepth = 3,
  learningRate = 0.1,
  minSamplesLeaf = 25
) {
  const nTrain = trainIdx.length;
  let posCount = 0;
  for (let i = 0; i < nTrain; i++) posCount += y[trainIdx[i]];
  const p0 = Math.min(0.999, Math.max(0.001, posCount / Math.max(1, nTrain)));
  const f0 = Math.log(p0 / (1 - p0));

  // Candidate thresholds per feature (binned quantiles for numeric, 0.5 for binary)
  const candidates: Float64Array[] = [];
  for (let f = 0; f < NUM_FEATURES; f++) {
    if (NUMERIC_INDICES.includes(f)) {
      const vals = new Float64Array(nTrain);
      for (let i = 0; i < nTrain; i++) vals[i] = X[trainIdx[i] * NUM_FEATURES + f];
      vals.sort();
      const ths: number[] = [];
      const bins = 14;
      for (let b = 1; b < bins; b++) {
        const v = vals[Math.floor((b / bins) * nTrain)];
        if (ths.length === 0 || v - ths[ths.length - 1] > 1e-6) ths.push(v);
      }
      candidates.push(new Float64Array(ths));
    } else {
      candidates.push(new Float64Array([0.5]));
    }
  }

  const F = new Float64Array(nTrain);
  F.fill(f0);
  const residuals = new Float64Array(nTrain);
  const hessians = new Float64Array(nTrain);
  const featureGain = new Float64Array(NUM_FEATURES);
  const trees: TreeNode[] = [];

  function buildTree(posList: Int32Array, depth: number): TreeNode {
    const nNode = posList.length;
    let sumR = 0;
    let sumH = 0;
    for (let i = 0; i < nNode; i++) {
      const p = posList[i];
      sumR += residuals[p];
      sumH += hessians[p];
    }
    const leafVal = sumR / (sumH + 1.0);

    if (depth >= maxDepth || nNode < minSamplesLeaf * 2) {
      return { leaf: true, value: leafVal, feature: -1, threshold: 0 };
    }

    let bestGain = 1e-6;
    let bestFeat = -1;
    let bestThresh = 0;
    const parentScore = (sumR * sumR) / nNode;

    for (let f = 0; f < NUM_FEATURES; f++) {
      const ths = candidates[f];
      for (let t = 0; t < ths.length; t++) {
        const th = ths[t];
        let leftCount = 0;
        let leftSumR = 0;
        for (let i = 0; i < nNode; i++) {
          const pos = posList[i];
          const rowIdx = trainIdx[pos];
          if (X[rowIdx * NUM_FEATURES + f] <= th) {
            leftCount++;
            leftSumR += residuals[pos];
          }
        }
        const rightCount = nNode - leftCount;
        if (leftCount < minSamplesLeaf || rightCount < minSamplesLeaf) continue;
        const rightSumR = sumR - leftSumR;
        const gain = (leftSumR * leftSumR) / leftCount + (rightSumR * rightSumR) / rightCount - parentScore;
        if (gain > bestGain) {
          bestGain = gain;
          bestFeat = f;
          bestThresh = th;
        }
      }
    }

    if (bestFeat === -1) {
      return { leaf: true, value: leafVal, feature: -1, threshold: 0 };
    }

    featureGain[bestFeat] += bestGain;

    let lCount = 0;
    for (let i = 0; i < nNode; i++) {
      if (X[trainIdx[posList[i]] * NUM_FEATURES + bestFeat] <= bestThresh) lCount++;
    }
    const leftArr = new Int32Array(lCount);
    const rightArr = new Int32Array(nNode - lCount);
    let li = 0;
    let ri = 0;
    for (let i = 0; i < nNode; i++) {
      const p = posList[i];
      if (X[trainIdx[p] * NUM_FEATURES + bestFeat] <= bestThresh) leftArr[li++] = p;
      else rightArr[ri++] = p;
    }

    return {
      leaf: false,
      value: leafVal,
      feature: bestFeat,
      threshold: bestThresh,
      left: buildTree(leftArr, depth + 1),
      right: buildTree(rightArr, depth + 1),
    };
  }

  function evalTree(node: TreeNode, vec: Float64Array, offset: number): number {
    let cur: TreeNode = node;
    while (!cur.leaf) {
      cur = vec[offset + cur.feature] <= cur.threshold ? cur.left! : cur.right!;
    }
    return cur.value;
  }

  const allPos = new Int32Array(nTrain);
  for (let i = 0; i < nTrain; i++) allPos[i] = i;

  for (let m = 0; m < nEstimators; m++) {
    for (let i = 0; i < nTrain; i++) {
      const p = sigmoid(F[i]);
      residuals[i] = y[trainIdx[i]] - p;
      hessians[i] = Math.max(1e-6, p * (1 - p));
    }
    const tree = buildTree(allPos, 0);
    trees.push(tree);
    for (let i = 0; i < nTrain; i++) {
      F[i] += learningRate * evalTree(tree, X, trainIdx[i] * NUM_FEATURES);
    }
  }

  const totalGain = featureGain.reduce((a, b) => a + b, 0) || 1;
  const importances = Array.from(featureGain).map((g) => (g / totalGain) * 100);

  return {
    importances,
    predictRow: (vec: Float64Array, offset: number) => {
      let s = f0;
      for (let m = 0; m < trees.length; m++) {
        s += learningRate * evalTree(trees[m], vec, offset);
      }
      return sigmoid(s);
    },
  };
}

function computeRocAuc(probs: number[], labels: number[]): number {
  const pairs = probs.map((p, i) => ({ p, y: labels[i] })).sort((a, b) => b.p - a.p);
  const totalPos = labels.reduce((a, b) => a + b, 0);
  const totalNeg = labels.length - totalPos;
  if (totalPos === 0 || totalNeg === 0) return 0.5;
  let tp = 0;
  let fp = 0;
  let prevTp = 0;
  let prevFp = 0;
  let auc = 0;
  let i = 0;
  while (i < pairs.length) {
    const score = pairs[i].p;
    while (i < pairs.length && pairs[i].p === score) {
      if (pairs[i].y === 1) tp++;
      else fp++;
      i++;
    }
    auc += ((fp - prevFp) * (tp + prevTp)) / 2;
    prevTp = tp;
    prevFp = fp;
  }
  return auc / (totalPos * totalNeg);
}

function computePrAuc(probs: number[], labels: number[]): number {
  const pairs = probs.map((p, i) => ({ p, y: labels[i] })).sort((a, b) => b.p - a.p);
  const totalPos = labels.reduce((a, b) => a + b, 0);
  if (totalPos === 0) return 0;
  let tp = 0;
  let ap = 0;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].y === 1) {
      tp++;
      ap += tp / (i + 1);
    }
  }
  return ap / totalPos;
}

function computeDeciles(probs: number[], labels: number[]): DecilePoint[] {
  const nTotal = probs.length;
  const totalChurn = labels.reduce((a, b) => a + b, 0) || 1;
  const baseRate = totalChurn / Math.max(1, nTotal);
  const order = probs.map((p, i) => ({ p, y: labels[i] })).sort((a, b) => b.p - a.p);

  const out: DecilePoint[] = [];
  let cumChurn = 0;
  for (let d = 0; d < 10; d++) {
    const start = Math.floor((d / 10) * nTotal);
    const end = Math.floor(((d + 1) / 10) * nTotal);
    const slice = order.slice(start, end);
    const ch = slice.reduce((a, b) => a + b.y, 0);
    cumChurn += ch;
    const rate = ch / Math.max(1, slice.length);
    const cumRate = cumChurn / Math.max(1, end);
    out.push({
      decile: d + 1,
      pctPop: (d + 1) * 10,
      n: slice.length,
      churners: ch,
      churnRate: Math.round(rate * 1000) / 10,
      decileLift: Math.round((rate / Math.max(1e-6, baseRate)) * 100) / 100,
      cumLift: Math.round((cumRate / Math.max(1e-6, baseRate)) * 100) / 100,
      cumCapture: Math.round((cumChurn / totalChurn) * 1000) / 10,
    });
  }
  return out;
}

function computeUpliftCurve(
  customers: ScoredCustomer[],
  modelKey: ModelKey,
  offerKey: CampaignOfferKey
): UpliftCurvePoint[] {
  const n = customers.length || 1;
  const getRisk = (c: ScoredCustomer) => (modelKey === 'gb' ? c.probGb : c.probLogReg);
  const getUplift = (c: ScoredCustomer) => (modelKey === 'gb' ? c.upliftGb[offerKey] : c.upliftLogReg[offerKey]);

  const byUplift = [...customers].sort((a, b) => getUplift(b) - getUplift(a));
  const byRisk = [...customers].sort((a, b) => getRisk(b) - getRisk(a));
  const totalUpliftSaves = customers.reduce((acc, c) => acc + Math.max(0, getUplift(c)), 0);

  const pts: UpliftCurvePoint[] = [{ pctPop: 0, upliftIncrementalSaves: 0, riskIncrementalSaves: 0, randomIncrementalSaves: 0 }];
  for (let pct = 10; pct <= 100; pct += 10) {
    const k = Math.floor((pct / 100) * n);
    let uSum = 0;
    let rSum = 0;
    for (let i = 0; i < k; i++) {
      uSum += Math.max(0, getUplift(byUplift[i]));
      rSum += Math.max(0, getUplift(byRisk[i]));
    }
    pts.push({
      pctPop: pct,
      upliftIncrementalSaves: Math.round(uSum),
      riskIncrementalSaves: Math.round(rSum),
      randomIncrementalSaves: Math.round((pct / 100) * totalUpliftSaves),
    });
  }
  return pts;
}

export function trainTelcoMlModels(rows: TelcoRow[]): TelcoMlResult {
  const n = rows.length;
  const Xraw = new Float64Array(n * NUM_FEATURES);
  const y = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    encodeRawFeatureVector(rows[i], Xraw, i * NUM_FEATURES);
    y[i] = rows[i].Churn === 'Yes' ? 1 : 0;
  }

  // Deterministic stratified 80/20 split (every 5th churned & every 5th retained goes to holdout test)
  const trainIdx: number[] = [];
  const testIdx: number[] = [];
  let posSeen = 0;
  let negSeen = 0;
  for (let i = 0; i < n; i++) {
    if (y[i] === 1) {
      if (posSeen % 5 === 4) testIdx.push(i);
      else trainIdx.push(i);
      posSeen++;
    } else {
      if (negSeen % 5 === 4) testIdx.push(i);
      else trainIdx.push(i);
      negSeen++;
    }
  }

  // Fit StandardScaler on training split ONLY (zero data leakage)
  const means = new Float64Array(NUM_FEATURES);
  const stds = new Float64Array(NUM_FEATURES);
  stds.fill(1);

  for (const f of NUMERIC_INDICES) {
    let sum = 0;
    for (let k = 0; k < trainIdx.length; k++) {
      sum += Xraw[trainIdx[k] * NUM_FEATURES + f];
    }
    const mean = sum / Math.max(1, trainIdx.length);
    means[f] = mean;
    let sq = 0;
    for (let k = 0; k < trainIdx.length; k++) {
      const d = Xraw[trainIdx[k] * NUM_FEATURES + f] - mean;
      sq += d * d;
    }
    stds[f] = Math.sqrt(sq / Math.max(1, trainIdx.length)) || 1;
  }

  const X = new Float64Array(Xraw.length);
  for (let i = 0; i < n; i++) {
    const base = i * NUM_FEATURES;
    for (let f = 0; f < NUM_FEATURES; f++) {
      X[base + f] = NUMERIC_INDICES.includes(f) ? (Xraw[base + f] - means[f]) / stds[f] : Xraw[base + f];
    }
  }

  // 1. Fit LogisticRegression(C=1.0)
  const t0Log = performance.now();
  const logReg = fitLogisticRegression(X, y, trainIdx, 1.0);
  const logTrainMs = Math.round(performance.now() - t0Log);

  // 2. Fit GradientBoostingClassifier(n_estimators=45, max_depth=3, lr=0.1)
  const t0Gb = performance.now();
  const gb = fitGradientBoosting(X, y, trainIdx, 45, 3, 0.1, 25);
  const gbTrainMs = Math.round(performance.now() - t0Gb);

  // Holdout validation evaluation
  const testLabels = testIdx.map((idx) => y[idx]);
  const testProbsLog = testIdx.map((idx) => logReg.predictRow(X, idx * NUM_FEATURES));
  const testProbsGb = testIdx.map((idx) => gb.predictRow(X, idx * NUM_FEATURES));

  const evalMetrics = (key: ModelKey, name: string, sklearnClass: string, hyperparams: string, probs: number[], trainMs: number): { metrics: ModelMetrics; deciles: DecilePoint[] } => {
    let ll = 0;
    let brier = 0;
    for (let i = 0; i < probs.length; i++) {
      const p = Math.min(1 - 1e-6, Math.max(1e-6, probs[i]));
      const yi = testLabels[i];
      ll -= yi * Math.log(p) + (1 - yi) * Math.log(1 - p);
      brier += (p - yi) * (p - yi);
    }
    const dec = computeDeciles(probs, testLabels);
    return {
      metrics: {
        key,
        name,
        sklearnClass,
        hyperparams,
        rocAuc: Math.round(computeRocAuc(probs, testLabels) * 1000) / 1000,
        prAuc: Math.round(computePrAuc(probs, testLabels) * 1000) / 1000,
        logLoss: Math.round((ll / Math.max(1, probs.length)) * 1000) / 1000,
        brier: Math.round((brier / Math.max(1, probs.length)) * 1000) / 1000,
        topDecileLift: dec[0].cumLift,
        top20Capture: dec[1].cumCapture,
        trainTimeMs: trainMs,
      },
      deciles: dec,
    };
  };

  const evalLog = evalMetrics(
    'logreg',
    'Logistic Regression (L2)',
    'sklearn.linear_model.LogisticRegression',
    'C=1.0, solver=lbfgs / IRLS',
    testProbsLog,
    logTrainMs
  );
  const evalGb = evalMetrics(
    'gb',
    'Gradient Boosting',
    'sklearn.ensemble.GradientBoostingClassifier',
    'n_estimators=45, max_depth=3, lr=0.1',
    testProbsGb,
    gbTrainMs
  );

  // Feature importance + standardized LogReg coefficients
  const featureDrivers: FeatureDriver[] = FEATURE_LABELS.map((feature, f): FeatureDriver => {
    const coef = logReg.weights[f];
    return {
      feature,
      gbImportance: Math.round(gb.importances[f] * 10) / 10,
      logRegCoef: Math.round(coef * 100) / 100,
      oddsRatio: Math.round(Math.exp(coef) * 100) / 100,
      direction: coef >= 0 ? 'risk' : 'protective',
    };
  }).sort((a, b) => b.gbImportance - a.gbImportance);

  // Score all 7,043 accounts + evaluate counterfactual treatment response across all 3 retention offers
  const cfVec = new Float64Array(NUM_FEATURES);
  const customers: ScoredCustomer[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const r = rows[i];
    const base = i * NUM_FEATURES;
    const pLog = logReg.predictRow(X, base);
    const pGb = gb.predictRow(X, base);

    const upliftGb = {} as Record<CampaignOfferKey, number>;
    const upliftLogReg = {} as Record<CampaignOfferKey, number>;

    for (const offer of CAMPAIGN_OFFERS) {
      const cfRow = makeCounterfactualRow(r, offer.key, offer.monthlyIncentiveCost);
      encodeRawFeatureVector(cfRow, cfVec, 0);
      for (const f of NUMERIC_INDICES) {
        cfVec[f] = (cfVec[f] - means[f]) / stds[f];
      }
      const pLogTreat = logReg.predictRow(cfVec, 0);
      const pGbTreat = gb.predictRow(cfVec, 0);
      upliftLogReg[offer.key] = Math.max(0, pLog - pLogTreat);
      upliftGb[offer.key] = Math.max(0, pGb - pGbTreat);
    }

    customers[i] = {
      customerID: r.customerID,
      contract: r.Contract,
      internet: r.InternetService === 'No' ? 'No internet' : r.InternetService,
      payment: r.PaymentMethod.replace(' (automatic)', ' (auto)'),
      tenure: r.tenure,
      monthlyCharges: r.MonthlyCharges,
      totalCharges: r.TotalCharges,
      actualChurn: r.Churn === 'Yes',
      onlineSecurity: r.OnlineSecurity,
      techSupport: r.TechSupport,
      probGb: pGb,
      probLogReg: pLog,
      probEnsemble: 0.5 * (pGb + pLog),
      upliftGb,
      upliftLogReg,
    };
  }

  const upliftCurves: Record<ModelKey, Record<CampaignOfferKey, UpliftCurvePoint[]>> = {
    gb: {
      contract_security: computeUpliftCurve(customers, 'gb', 'contract_security'),
      autopay_support: computeUpliftCurve(customers, 'gb', 'autopay_support'),
      two_year_bundle: computeUpliftCurve(customers, 'gb', 'two_year_bundle'),
    },
    logreg: {
      contract_security: computeUpliftCurve(customers, 'logreg', 'contract_security'),
      autopay_support: computeUpliftCurve(customers, 'logreg', 'autopay_support'),
      two_year_bundle: computeUpliftCurve(customers, 'logreg', 'two_year_bundle'),
    },
  };

  const churnTotal = rows.filter((r) => r.Churn === 'Yes').length;

  return {
    trainCount: trainIdx.length,
    testCount: testIdx.length,
    baseChurnRate: Math.round((churnTotal / Math.max(1, n)) * 1000) / 10,
    models: {
      gb: evalGb.metrics,
      logreg: evalLog.metrics,
    },
    deciles: {
      gb: evalGb.deciles,
      logreg: evalLog.deciles,
    },
    upliftCurves,
    featureDrivers,
    customers,
  };
}

export function generateSklearnPipelineScript(offerKey: CampaignOfferKey): string {
  const offer = CAMPAIGN_OFFERS.find((o) => o.key === offerKey) || CAMPAIGN_OFFERS[0];
  return `"""
Telco Customer Churn — Lift, Uplift & Retention Targeting Pipeline (scikit-learn)
Matches Folio Dashboard ML Pipeline (${offer.label})
"""
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, log_loss, roc_auc_score
from sklearn.model_selection import StratifiedShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

df = pd.read_csv("Telco-Customer-Churn.csv")
df["TotalCharges"] = pd.to_numeric(df["TotalCharges"], errors="coerce").fillna(0.0)
df["ServiceCount"] = (
    df[["PhoneService", "MultipleLines", "OnlineSecurity", "OnlineBackup",
        "DeviceProtection", "TechSupport", "StreamingTV", "StreamingMovies"]] == "Yes"
).sum(axis=1)

y = (df["Churn"] == "Yes").astype(int)
num_cols = ["tenure", "MonthlyCharges", "TotalCharges", "ServiceCount"]
cat_cols = [
    "SeniorCitizen", "Partner", "Dependents", "Contract", "InternetService",
    "OnlineSecurity", "OnlineBackup", "DeviceProtection", "TechSupport",
    "StreamingTV", "StreamingMovies", "PaperlessBilling", "PaymentMethod"
]

prep = ColumnTransformer([
    ("num", StandardScaler(), num_cols),
    ("cat", OneHotEncoder(drop="first", handle_unknown="ignore"), cat_cols),
])

splitter = StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(splitter.split(df, y))

logreg_pipe = Pipeline([
    ("prep", prep),
    ("clf", LogisticRegression(C=1.0, max_iter=1000)),
])
gb_pipe = Pipeline([
    ("prep", prep),
    ("clf", GradientBoostingClassifier(n_estimators=45, max_depth=3, learning_rate=0.1, min_samples_leaf=25, random_state=42)),
])

for name, pipe in [("LogisticRegression", logreg_pipe), ("GradientBoosting", gb_pipe)]:
    pipe.fit(df.iloc[train_idx], y.iloc[train_idx])
    p_test = pipe.predict_proba(df.iloc[test_idx])[:, 1]
    print(f"{name:18s} | ROC-AUC={roc_auc_score(y.iloc[test_idx], p_test):.3f} "
          f"| PR-AUC={average_precision_score(y.iloc[test_idx], p_test):.3f} "
          f"| LogLoss={log_loss(y.iloc[test_idx], p_test):.3f}")

# Counterfactual Uplift Estimation: P(churn | baseline) - P(churn | offer)
df_treated = df.copy()
offer_cost = ${offer.monthlyIncentiveCost}
if "${offer.key}" == "contract_security":
    df_treated.loc[df_treated["Contract"] == "Month-to-month", "Contract"] = "One year"
    df_treated.loc[df_treated["InternetService"] != "No", "OnlineSecurity"] = "Yes"
elif "${offer.key}" == "autopay_support":
    mask = ~df_treated["PaymentMethod"].str.contains("automatic")
    df_treated.loc[mask, "PaymentMethod"] = "Credit card (automatic)"
    df_treated.loc[df_treated["InternetService"] != "No", "TechSupport"] = "Yes"
else:
    df_treated["Contract"] = "Two year"
    df_treated.loc[df_treated["InternetService"] != "No", ["OnlineSecurity", "TechSupport"]] = "Yes"
df_treated["MonthlyCharges"] = np.maximum(18.0, df_treated["MonthlyCharges"] - offer_cost)

df["churn_prob_gb"] = gb_pipe.predict_proba(df)[:, 1]
df["churn_prob_logreg"] = logreg_pipe.predict_proba(df)[:, 1]
df["uplift_gb"] = np.maximum(0.0, df["churn_prob_gb"] - gb_pipe.predict_proba(df_treated)[:, 1])
df["expected_12m_net_roi"] = df["MonthlyCharges"] * 12 * df["uplift_gb"] - offer_cost * 12

target_list = df.sort_values("uplift_gb", ascending=False).head(int(len(df) * 0.20))
target_list[["customerID", "Contract", "InternetService", "MonthlyCharges", "churn_prob_gb", "uplift_gb", "expected_12m_net_roi"]].to_csv(
    "telco_campaign_targets.csv", index=False
)
print(f"Exported {len(target_list)} campaign target accounts to telco_campaign_targets.csv")
`;
}
