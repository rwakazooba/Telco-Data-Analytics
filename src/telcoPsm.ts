import type { TelcoRow } from './telcoData';

export type PsmSpecKey = 'full' | 'household';
export type CaliperKey = '0.10' | '0.20' | '0.50';

export interface RosenbaumCitation {
  id: string;
  authors: string;
  year: string;
  title: string;
  venue: string;
  concept: string;
}

export const ROSENBAUM_CITATIONS: RosenbaumCitation[] = [
  {
    id: 'rr1983',
    authors: 'Rosenbaum, P. R., & Rubin, D. B.',
    year: '1983',
    title: 'The central role of the propensity score in observational studies for causal effects',
    venue: 'Biometrika, 70(1), 41–55',
    concept: 'Balancing theorem: conditional on scalar e(X) = Pr(Z=1|X), treated and control covariates share the same distribution under strong ignorability.',
  },
  {
    id: 'rr1985',
    authors: 'Rosenbaum, P. R., & Rubin, D. B.',
    year: '1985',
    title: 'Constructing a control group using multivariate matched sampling methods that incorporate the propensity score',
    venue: 'The American Statistician, 39(1), 33–38',
    concept: 'Nearest-available caliper matching on logit propensity scores within 0.20 × SD removes over 99% of bias due to measured confounders.',
  },
  {
    id: 'ros2002',
    authors: 'Rosenbaum, P. R.',
    year: '2002',
    title: 'Observational Studies (2nd ed.)',
    venue: 'Springer Series in Statistics, New York',
    concept: 'Ch. 4 Primal Sensitivity Analysis: quantifies how large an unmeasured confounder (odds ratio Γ ≥ 1) must be to overturn matched-pair inference.',
  },
  {
    id: 'ros2010',
    authors: 'Rosenbaum, P. R.',
    year: '2010 / 2020',
    title: 'Design of Observational Studies (1st & 2nd eds.)',
    venue: 'Springer Series in Statistics, New York',
    concept: 'Design an observational study as a substitute for a randomized experiment; exclude post-treatment consequences (Ch. 18) and audit balance via Love plots.',
  },
  {
    id: 'ros2017',
    authors: 'Rosenbaum, P. R.',
    year: '2017',
    title: 'Observation and Experiment: An Introduction to Causal Inference',
    venue: 'Harvard University Press, Cambridge, MA',
    concept: 'Distinguishes overt selection bias (removed by matching on X) from hidden bias Γ and introduces design sensitivity to evaluate study robustness.',
  },
];

export interface CovariateBalanceRow {
  key: string;
  label: string;
  inSpec: boolean;
  preTreatedMean: number;
  preControlMean: number;
  preSmd: number;
  postTreatedMean: number;
  postControlMean: number;
  postSmd: number;
  biasReductionPct: number;
}

export interface OverlapBin {
  binLabel: string;
  binMid: number;
  rawTreated: number;
  rawControl: number;
  matchedTreated: number;
  matchedControl: number;
  matchedPairs: number;
}

export interface RosenbaumGammaRow {
  gamma: number;
  churnUpperP: number;
  churnLowerP: number;
  netRevUpperP: number;
  netRevLowerP: number;
  churnSignificantAt05: boolean;
  netRevSignificantAt05: boolean;
}

export interface MatchedPairRecord {
  pairIndex: number;
  treatedId: string;
  controlId: string;
  propensityTreated: number;
  propensityControl: number;
  logitDiff: number;
  treatedChurned: boolean;
  controlChurned: boolean;
  treatedMrr: number;
  controlMrr: number;
  treatedTenure: number;
  controlTenure: number;
  treatedRev1Yr: number;
  controlRev1Yr: number;
  netProfit1Yr: number;
}

export interface PsmStudyResult {
  specKey: PsmSpecKey;
  specLabel: string;
  caliperMultiplier: number;
  caliperLogitRadius: number;
  campaignCostPerUpgrade: number;
  totalBroadband: number;
  rawTreatedCount: number;
  rawControlCount: number;
  matchedPairsCount: number;
  supportRetentionPct: number;
  unmatchedTreatedCount: number;
  maxAbsSmdPre: number;
  maxAbsSmdPost: number;
  meanAbsSmdPre: number;
  meanAbsSmdPost: number;
  balancedUnder010Count: number;
  totalCovariatesCount: number;
  naive: {
    treatedChurnRate: number;
    controlChurnRate: number;
    churnDiffPp: number;
    treatedAvgMrr: number;
    controlAvgMrr: number;
    mrrDiff: number;
    treatedRev1Yr: number;
    controlRev1Yr: number;
    netProfitPerUpgrade: number;
    roiPct: number;
  };
  matched: {
    treatedChurnRate: number;
    controlChurnRate: number;
    attChurnPp: number;
    discordantB_TreatedOnlyChurn: number;
    discordantC_ControlOnlyChurn: number;
    concordantBothChurn: number;
    concordantBothRetained: number;
    mcnemarChi2: number;
    mcnemarP: number;
    treatedAvgMrr: number;
    controlAvgMrr: number;
    attMrrLift: number;
    treatedRev1Yr: number;
    controlRev1Yr: number;
    grossRevLift1Yr: number;
    netProfitPerUpgrade: number;
    totalCampaignCostK: number;
    totalNetProfitK: number;
    roiPct: number;
  };
  balanceRows: CovariateBalanceRow[];
  overlapBins: OverlapBin[];
  sensitivityRows: RosenbaumGammaRow[];
  criticalGammaChurn: number;
  criticalGammaNetRev: number;
  samplePairs: MatchedPairRecord[];
}

interface CovariateDef {
  key: string;
  label: string;
  isBinary: boolean;
  extract: (r: TelcoRow) => number;
}

const ALL_COVARIATES: CovariateDef[] = [
  { key: 'multipleLines', label: 'Multiple lines', isBinary: true, extract: (r) => (r.MultipleLines === 'Yes' ? 1 : 0) },
  { key: 'echeck', label: 'Pay: Electronic check', isBinary: true, extract: (r) => (r.PaymentMethod === 'Electronic check' ? 1 : 0) },
  { key: 'paperless', label: 'Paperless billing', isBinary: true, extract: (r) => (r.PaperlessBilling === 'Yes' ? 1 : 0) },
  { key: 'onlineSec', label: 'Online security', isBinary: true, extract: (r) => (r.OnlineSecurity === 'Yes' ? 1 : 0) },
  { key: 'techSupport', label: 'Tech support', isBinary: true, extract: (r) => (r.TechSupport === 'Yes' ? 1 : 0) },
  { key: 'senior', label: 'Senior citizen (65+)', isBinary: true, extract: (r) => (r.SeniorCitizen === 1 ? 1 : 0) },
  { key: 'm2m', label: 'Contract: Month-to-month', isBinary: true, extract: (r) => (r.Contract === 'Month-to-month' ? 1 : 0) },
  { key: 'streamTv', label: 'Streaming TV', isBinary: true, extract: (r) => (r.StreamingTV === 'Yes' ? 1 : 0) },
  { key: 'streamMovies', label: 'Streaming movies', isBinary: true, extract: (r) => (r.StreamingMovies === 'Yes' ? 1 : 0) },
  { key: 'dependents', label: 'Has dependents', isBinary: true, extract: (r) => (r.Dependents === 'Yes' ? 1 : 0) },
  { key: 'partner', label: 'Has partner', isBinary: true, extract: (r) => (r.Partner === 'Yes' ? 1 : 0) },
  { key: 'tenure', label: 'Tenure (months)', isBinary: false, extract: (r) => r.tenure },
];

const HOUSEHOLD_KEYS = new Set([
  'multipleLines',
  'paperless',
  'senior',
  'streamTv',
  'streamMovies',
  'dependents',
  'partner',
  'tenure',
]);

function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const ez = Math.exp(z);
  return ez / (1 + ez);
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

function solveSymmetricLinearSystem(A: Float64Array, b: Float64Array, n: number): Float64Array {
  const M = new Float64Array(A);
  const rhs = new Float64Array(b);
  for (let i = 0; i < n; i++) {
    let pivotRow = i;
    let maxVal = Math.abs(M[i * n + i]);
    for (let r = i + 1; r < n; r++) {
      const v = Math.abs(M[r * n + i]);
      if (v > maxVal) {
        maxVal = v;
        pivotRow = r;
      }
    }
    if (pivotRow !== i) {
      for (let c = i; c < n; c++) {
        const tmp = M[i * n + c];
        M[i * n + c] = M[pivotRow * n + c];
        M[pivotRow * n + c] = tmp;
      }
      const tb = rhs[i];
      rhs[i] = rhs[pivotRow];
      rhs[pivotRow] = tb;
    }
    const diag = Math.abs(M[i * n + i]) < 1e-12 ? 1e-12 : M[i * n + i];
    for (let r = i + 1; r < n; r++) {
      const f = M[r * n + i] / diag;
      if (f === 0) continue;
      for (let c = i; c < n; c++) {
        M[r * n + c] -= f * M[i * n + c];
      }
      rhs[r] -= f * rhs[i];
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = rhs[i];
    for (let c = i + 1; c < n; c++) s -= M[i * n + c] * x[c];
    x[i] = s / (Math.abs(M[i * n + i]) < 1e-12 ? 1e-12 : M[i * n + i]);
  }
  return x;
}

function fitPropensityLogit(X: Float64Array, zTreat: Uint8Array, n: number, pFeat: number): Float64Array {
  const d = pFeat + 1; // bias + pFeat
  const weights = new Float64Array(d);
  const grad = new Float64Array(d);
  const hess = new Float64Array(d * d);
  const lambda = 1.0;

  let tCount = 0;
  for (let i = 0; i < n; i++) tCount += zTreat[i];
  const baseP = Math.max(1e-4, Math.min(1 - 1e-4, tCount / Math.max(1, n)));
  weights[0] = Math.log(baseP / (1 - baseP));

  for (let iter = 0; iter < 30; iter++) {
    grad.fill(0);
    hess.fill(0);

    for (let i = 0; i < n; i++) {
      const off = i * pFeat;
      let eta = weights[0];
      for (let j = 0; j < pFeat; j++) eta += weights[j + 1] * X[off + j];
      const p = sigmoid(eta);
      const diff = p - zTreat[i];
      const w = Math.max(p * (1 - p), 1e-6);

      grad[0] += diff;
      hess[0] += w;
      for (let j = 0; j < pFeat; j++) {
        const xj = X[off + j];
        grad[j + 1] += diff * xj;
        const hj = w * xj;
        hess[(j + 1) * d + 0] += hj;
        hess[0 * d + (j + 1)] += hj;
        for (let k = j; k < pFeat; k++) {
          const val = hj * X[off + k];
          hess[(j + 1) * d + (k + 1)] += val;
          if (k !== j) hess[(k + 1) * d + (j + 1)] += val;
        }
      }
    }

    hess[0] += 1e-6;
    for (let j = 1; j < d; j++) {
      grad[j] += lambda * weights[j];
      hess[j * d + j] += lambda;
    }

    const delta = solveSymmetricLinearSystem(hess, grad, d);
    let maxStep = 0;
    for (let j = 0; j < d; j++) {
      weights[j] -= delta[j];
      const a = Math.abs(delta[j]);
      if (a > maxStep) maxStep = a;
    }
    if (maxStep < 1e-6) break;
  }

  const propensities = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const off = i * pFeat;
    let eta = weights[0];
    for (let j = 0; j < pFeat; j++) eta += weights[j + 1] * X[off + j];
    const p = Math.min(0.999, Math.max(0.001, sigmoid(eta)));
    propensities[i] = p;
  }
  return propensities;
}

/**
 * 1-Year Realized Revenue per subscriber accounting for observed churn outcome:
 * Retained subscribers realize a full 12 months of MonthlyCharges;
 * Churned subscribers realize an average 6-month (half-year) partial billing window before exiting.
 */
function computeRealized1YrRev(r: TelcoRow): number {
  return r.Churn === 'Yes' ? 6 * r.MonthlyCharges : 12 * r.MonthlyCharges;
}

function rosenbaumMcNemarUpperP(b: number, c: number, gamma: number): { upperP: number; lowerP: number } {
  const td = b + c;
  if (td === 0) return { upperP: 1, lowerP: 1 };
  const larger = Math.max(b, c);
  const pPlus = gamma / (1 + gamma);
  const pMinus = 1 / (1 + gamma);

  const zUpper = (larger - 0.5 - td * pPlus) / Math.sqrt(td * pPlus * (1 - pPlus));
  const zLower = (larger - 0.5 - td * pMinus) / Math.sqrt(td * pMinus * (1 - pMinus));
  return {
    upperP: Math.min(1, Math.max(0, 1 - normalCdf(zUpper))),
    lowerP: Math.min(1, Math.max(0, 1 - normalCdf(zLower))),
  };
}

function rosenbaumWilcoxonBounds(pairDiffs: number[], gamma: number): { upperP: number; lowerP: number } {
  // Rosenbaum (2002) Ch. 4.3 normal approximation to Wilcoxon signed-rank upper/lower p-value bounds
  const nonzero = pairDiffs.filter((d) => Math.abs(d) > 1e-6);
  const m = nonzero.length;
  if (m < 5) return { upperP: 1, lowerP: 1 };

  const ranked = nonzero
    .map((d) => ({ abs: Math.abs(d), pos: d > 0 }))
    .sort((a, b) => a.abs - b.abs);

  let tStat = 0;
  let sumRank = 0;
  let sumRankSq = 0;

  let idx = 0;
  while (idx < m) {
    let end = idx + 1;
    while (end < m && Math.abs(ranked[end].abs - ranked[idx].abs) < 1e-6) end++;
    const avgRank = (idx + 1 + end) / 2;
    for (let k = idx; k < end; k++) {
      if (ranked[k].pos) tStat += avgRank;
      sumRank += avgRank;
      sumRankSq += avgRank * avgRank;
    }
    idx = end;
  }

  const pPlus = gamma / (1 + gamma);
  const pMinus = 1 / (1 + gamma);

  // Two-sided direction aligned with sign of observed mean excess over null (sumRank / 2)
  const favorPositive = tStat >= sumRank * 0.5;
  const meanPlus = (favorPositive ? pPlus : pMinus) * sumRank;
  const meanMinus = (favorPositive ? pMinus : pPlus) * sumRank;
  const sdPlus = Math.sqrt(pPlus * (1 - pPlus) * sumRankSq) || 1e-9;

  const zUpper = favorPositive
    ? (tStat - 0.5 - meanPlus) / sdPlus
    : (meanPlus - (tStat + 0.5)) / sdPlus;
  const zLower = favorPositive
    ? (tStat - 0.5 - meanMinus) / sdPlus
    : (meanMinus - (tStat + 0.5)) / sdPlus;

  return {
    upperP: Math.min(1, Math.max(0, 1 - normalCdf(zUpper))),
    lowerP: Math.min(1, Math.max(0, 1 - normalCdf(zLower))),
  };
}

function findCriticalGamma(testFn: (g: number) => number): number {
  if (testFn(1.0) > 0.05) return 1.0;
  let lo = 1.0;
  let hi = 12.0;
  if (testFn(hi) <= 0.05) return hi;
  for (let i = 0; i < 24; i++) {
    const mid = 0.5 * (lo + hi);
    if (testFn(mid) <= 0.05) lo = mid;
    else hi = mid;
  }
  return Math.round(lo * 100) / 100;
}

export function runFiberPsmStudy(
  rows: TelcoRow[],
  options: {
    specKey?: PsmSpecKey;
    caliperMultiplier?: number;
    campaignCostPerUpgrade?: number;
  } = {}
): PsmStudyResult {
  const specKey: PsmSpecKey = options.specKey ?? 'full';
  const caliperMultiplier = options.caliperMultiplier ?? 0.2;
  const campaignCostPerUpgrade = options.campaignCostPerUpgrade ?? 150;

  // Broadband cohort: Fiber (Treated = 1) vs DSL (Control = 0)
  const broadband = rows.filter((r) => r.InternetService === 'Fiber optic' || r.InternetService === 'DSL');
  const n = broadband.length;
  const zTreat = new Uint8Array(n);
  const rawTreated: number[] = [];
  const rawControl: number[] = [];

  for (let i = 0; i < n; i++) {
    const isFiber = broadband[i].InternetService === 'Fiber optic' ? 1 : 0;
    zTreat[i] = isFiber;
    if (isFiber) rawTreated.push(i);
    else rawControl.push(i);
  }

  const activeCovariates =
    specKey === 'household'
      ? ALL_COVARIATES.filter((c) => HOUSEHOLD_KEYS.has(c.key))
      : ALL_COVARIATES;
  const pFeat = activeCovariates.length;

  // Extract raw and standardized design matrix for propensity logit
  const X = new Float64Array(n * pFeat);
  for (let j = 0; j < pFeat; j++) {
    const cov = activeCovariates[j];
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = cov.extract(broadband[i]);
      X[i * pFeat + j] = v;
      sum += v;
    }
    const mean = sum / Math.max(1, n);
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const d = X[i * pFeat + j] - mean;
      sq += d * d;
    }
    const sd = Math.sqrt(sq / Math.max(1, n)) || 1;
    for (let i = 0; i < n; i++) {
      X[i * pFeat + j] = (X[i * pFeat + j] - mean) / sd;
    }
  }

  const propensities = fitPropensityLogit(X, zTreat, n, pFeat);
  const logits = new Float64Array(n);
  let logitSum = 0;
  for (let i = 0; i < n; i++) {
    logits[i] = Math.log(propensities[i] / (1 - propensities[i]));
    logitSum += logits[i];
  }
  const logitMean = logitSum / Math.max(1, n);
  let logitSq = 0;
  for (let i = 0; i < n; i++) {
    const d = logits[i] - logitMean;
    logitSq += d * d;
  }
  const logitSd = Math.sqrt(logitSq / Math.max(1, n)) || 1;
  const caliperRadius = caliperMultiplier * logitSd;

  // 1:1 Nearest-Neighbor Caliper Matching Without Replacement (sorted treated by |logit| descending)
  const sortedTreated = [...rawTreated].sort(
    (a, b) => propensities[b] - propensities[a] || broadband[a].customerID.localeCompare(broadband[b].customerID)
  );
  const sortedControls = [...rawControl].sort((a, b) => logits[a] - logits[b]);
  const usedControl = new Uint8Array(sortedControls.length);

  const matchedPairsIdx: Array<{ tIdx: number; cIdx: number }> = [];
  for (const tIdx of sortedTreated) {
    const tLogit = logits[tIdx];
    // Binary search nearest control logit
    let lo = 0;
    let hi = sortedControls.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (logits[sortedControls[mid]] < tLogit) lo = mid + 1;
      else hi = mid;
    }
    let bestPos = -1;
    let bestDist = caliperRadius + 1e-12;

    // Scan outward left and right around insertion index until logit gap exceeds caliper
    let left = lo - 1;
    let right = lo;
    while (left >= 0 || right < sortedControls.length) {
      const dLeft = left >= 0 ? Math.abs(logits[sortedControls[left]] - tLogit) : Infinity;
      const dRight = right < sortedControls.length ? Math.abs(logits[sortedControls[right]] - tLogit) : Infinity;
      if (dLeft > caliperRadius && dRight > caliperRadius) break;
      if (dLeft <= dRight) {
        if (!usedControl[left] && dLeft < bestDist) {
          bestDist = dLeft;
          bestPos = left;
        }
        left--;
        if (dLeft >= bestDist && dRight >= bestDist) break;
      } else {
        if (!usedControl[right] && dRight < bestDist) {
          bestDist = dRight;
          bestPos = right;
        }
        right++;
        if (dLeft >= bestDist && dRight >= bestDist) break;
      }
    }

    if (bestPos !== -1) {
      usedControl[bestPos] = 1;
      matchedPairsIdx.push({ tIdx, cIdx: sortedControls[bestPos] });
    }
  }

  // Covariate Balance Table (Pre-Match vs Post-Match using pooled pre-match SD denominator per Stuart 2010)
  const matchedTreatedIndices = matchedPairsIdx.map((p) => p.tIdx);
  const matchedControlIndices = matchedPairsIdx.map((p) => p.cIdx);

  const balanceRows: CovariateBalanceRow[] = ALL_COVARIATES.map((cov) => {
    const calcStats = (indices: number[]) => {
      let s = 0;
      for (const idx of indices) s += cov.extract(broadband[idx]);
      const mean = s / Math.max(1, indices.length);
      let sq = 0;
      for (const idx of indices) {
        const d = cov.extract(broadband[idx]) - mean;
        sq += d * d;
      }
      const variance = sq / Math.max(1, indices.length - 1);
      return { mean, variance };
    };

    const preT = calcStats(rawTreated);
    const preC = calcStats(rawControl);
    const pooledSd = Math.sqrt(0.5 * (preT.variance + preC.variance)) || 1;
    const preSmd = (preT.mean - preC.mean) / pooledSd;

    const postT = calcStats(matchedTreatedIndices);
    const postC = calcStats(matchedControlIndices);
    const postSmd = (postT.mean - postC.mean) / pooledSd;

    const absPre = Math.abs(preSmd);
    const absPost = Math.abs(postSmd);
    const biasReductionPct = absPre > 1e-6 ? ((absPre - absPost) / absPre) * 100 : 0;

    return {
      key: cov.key,
      label: cov.label,
      inSpec: specKey === 'full' || HOUSEHOLD_KEYS.has(cov.key),
      preTreatedMean: preT.mean,
      preControlMean: preC.mean,
      preSmd,
      postTreatedMean: postT.mean,
      postControlMean: postC.mean,
      postSmd,
      biasReductionPct,
    };
  }).sort((a, b) => Math.abs(b.preSmd) - Math.abs(a.preSmd));

  const maxAbsSmdPre = Math.max(...balanceRows.map((r) => Math.abs(r.preSmd)));
  const maxAbsSmdPost = Math.max(...balanceRows.map((r) => Math.abs(r.postSmd)));
  const meanAbsSmdPre = balanceRows.reduce((a, r) => a + Math.abs(r.preSmd), 0) / balanceRows.length;
  const meanAbsSmdPost = balanceRows.reduce((a, r) => a + Math.abs(r.postSmd), 0) / balanceRows.length;
  const balancedUnder010Count = balanceRows.filter((r) => Math.abs(r.postSmd) < 0.1).length;

  // Propensity Overlap Histogram (10 bins)
  const overlapBins: OverlapBin[] = Array.from({ length: 10 }, (_, b) => ({
    binLabel: `${(b * 0.1).toFixed(1)}–${((b + 1) * 0.1).toFixed(1)}`,
    binMid: b * 0.1 + 0.05,
    rawTreated: 0,
    rawControl: 0,
    matchedTreated: 0,
    matchedControl: 0,
    matchedPairs: 0,
  }));
  for (const idx of rawTreated) {
    const b = Math.min(9, Math.max(0, Math.floor(propensities[idx] * 10)));
    overlapBins[b].rawTreated++;
  }
  for (const idx of rawControl) {
    const b = Math.min(9, Math.max(0, Math.floor(propensities[idx] * 10)));
    overlapBins[b].rawControl++;
  }
  for (const pair of matchedPairsIdx) {
    const bt = Math.min(9, Math.max(0, Math.floor(propensities[pair.tIdx] * 10)));
    const bc = Math.min(9, Math.max(0, Math.floor(propensities[pair.cIdx] * 10)));
    overlapBins[bt].matchedTreated++;
    overlapBins[bc].matchedControl++;
    overlapBins[bt].matchedPairs++;
  }

  // Naive Outcomes
  const calcNaiveGroup = (indices: number[]) => {
    let ch = 0;
    let mrr = 0;
    let rev1Yr = 0;
    for (const idx of indices) {
      const r = broadband[idx];
      if (r.Churn === 'Yes') ch++;
      mrr += r.MonthlyCharges;
      rev1Yr += computeRealized1YrRev(r);
    }
    const len = Math.max(1, indices.length);
    return {
      churnRate: (ch / len) * 100,
      avgMrr: mrr / len,
      avgRev1Yr: rev1Yr / len,
    };
  };
  const naiveT = calcNaiveGroup(rawTreated);
  const naiveC = calcNaiveGroup(rawControl);
  const naiveNetProfitPerUpgrade = naiveT.avgRev1Yr - naiveC.avgRev1Yr - campaignCostPerUpgrade;
  const naiveRoiPct = campaignCostPerUpgrade > 0 ? (naiveNetProfitPerUpgrade / campaignCostPerUpgrade) * 100 : 0;

  // Matched Outcomes & McNemar Discordant Pairs + 1-Yr Net Revenue Diffs
  let mTChurn = 0;
  let mCChurn = 0;
  let mTMrr = 0;
  let mCMrr = 0;
  let mTRev1 = 0;
  let mCRev1 = 0;
  let discordantB = 0; // Treated churned, Control retained
  let discordantC = 0; // Treated retained, Control churned
  let concordantBothChurn = 0;
  let concordantBothRetained = 0;

  const pairNetRevDiffs: number[] = [];
  const allPairRecords: MatchedPairRecord[] = [];

  matchedPairsIdx.forEach((pair, pIdx) => {
    const tr = broadband[pair.tIdx];
    const ct = broadband[pair.cIdx];
    const tCh = tr.Churn === 'Yes';
    const cCh = ct.Churn === 'Yes';

    if (tCh) mTChurn++;
    if (cCh) mCChurn++;
    if (tCh && !cCh) discordantB++;
    else if (!tCh && cCh) discordantC++;
    else if (tCh && cCh) concordantBothChurn++;
    else concordantBothRetained++;

    mTMrr += tr.MonthlyCharges;
    mCMrr += ct.MonthlyCharges;

    const tRev1 = computeRealized1YrRev(tr);
    const cRev1 = computeRealized1YrRev(ct);
    mTRev1 += tRev1;
    mCRev1 += cRev1;

    const netProfit1Yr = tRev1 - cRev1 - campaignCostPerUpgrade;
    pairNetRevDiffs.push(netProfit1Yr);

    allPairRecords.push({
      pairIndex: pIdx + 1,
      treatedId: tr.customerID,
      controlId: ct.customerID,
      propensityTreated: propensities[pair.tIdx],
      propensityControl: propensities[pair.cIdx],
      logitDiff: Math.abs(logits[pair.tIdx] - logits[pair.cIdx]),
      treatedChurned: tCh,
      controlChurned: cCh,
      treatedMrr: tr.MonthlyCharges,
      controlMrr: ct.MonthlyCharges,
      treatedTenure: tr.tenure,
      controlTenure: ct.tenure,
      treatedRev1Yr: tRev1,
      controlRev1Yr: cRev1,
      netProfit1Yr,
    });
  });

  const m = Math.max(1, matchedPairsIdx.length);
  const mTChurnRate = (mTChurn / m) * 100;
  const mCChurnRate = (mCChurn / m) * 100;
  const attChurnPp = mTChurnRate - mCChurnRate;
  const td = discordantB + discordantC;
  const mcnemarChi2 = td > 0 ? Math.pow(Math.max(0, Math.abs(discordantB - discordantC) - 1), 2) / td : 0;
  const mcnemarP = rosenbaumMcNemarUpperP(discordantB, discordantC, 1.0).upperP;

  const matchedAvgMrrT = mTMrr / m;
  const matchedAvgMrrC = mCMrr / m;
  const matchedRev1T = mTRev1 / m;
  const matchedRev1C = mCRev1 / m;
  const grossRevLift1Yr = matchedRev1T - matchedRev1C;
  const matchedNetProfitPerUpgrade = grossRevLift1Yr - campaignCostPerUpgrade;
  const matchedRoiPct = campaignCostPerUpgrade > 0 ? (matchedNetProfitPerUpgrade / campaignCostPerUpgrade) * 100 : 0;

  // Rosenbaum Gamma Sensitivity Table (Γ = 1.0 .. 3.0)
  const gammas = [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
  const sensitivityRows: RosenbaumGammaRow[] = gammas.map((gamma) => {
    const ch = rosenbaumMcNemarUpperP(discordantB, discordantC, gamma);
    const rv = rosenbaumWilcoxonBounds(pairNetRevDiffs, gamma);
    return {
      gamma,
      churnUpperP: ch.upperP,
      churnLowerP: ch.lowerP,
      netRevUpperP: rv.upperP,
      netRevLowerP: rv.lowerP,
      churnSignificantAt05: ch.upperP <= 0.05,
      netRevSignificantAt05: rv.upperP <= 0.05,
    };
  });

  const criticalGammaChurn = findCriticalGamma((g) => rosenbaumMcNemarUpperP(discordantB, discordantC, g).upperP);
  const criticalGammaNetRev = findCriticalGamma((g) => rosenbaumWilcoxonBounds(pairNetRevDiffs, g).upperP);

  return {
    specKey,
    specLabel:
      specKey === 'full'
        ? 'Full Selection & Channel Model (12 covariates)'
        : 'Household & Media Demand Only (8 covariates)',
    caliperMultiplier,
    caliperLogitRadius: caliperRadius,
    campaignCostPerUpgrade,
    totalBroadband: n,
    rawTreatedCount: rawTreated.length,
    rawControlCount: rawControl.length,
    matchedPairsCount: matchedPairsIdx.length,
    supportRetentionPct: (matchedPairsIdx.length / Math.max(1, rawTreated.length)) * 100,
    unmatchedTreatedCount: rawTreated.length - matchedPairsIdx.length,
    maxAbsSmdPre,
    maxAbsSmdPost,
    meanAbsSmdPre,
    meanAbsSmdPost,
    balancedUnder010Count,
    totalCovariatesCount: balanceRows.length,
    naive: {
      treatedChurnRate: naiveT.churnRate,
      controlChurnRate: naiveC.churnRate,
      churnDiffPp: naiveT.churnRate - naiveC.churnRate,
      treatedAvgMrr: naiveT.avgMrr,
      controlAvgMrr: naiveC.avgMrr,
      mrrDiff: naiveT.avgMrr - naiveC.avgMrr,
      treatedRev1Yr: naiveT.avgRev1Yr,
      controlRev1Yr: naiveC.avgRev1Yr,
      netProfitPerUpgrade: naiveNetProfitPerUpgrade,
      roiPct: naiveRoiPct,
    },
    matched: {
      treatedChurnRate: mTChurnRate,
      controlChurnRate: mCChurnRate,
      attChurnPp,
      discordantB_TreatedOnlyChurn: discordantB,
      discordantC_ControlOnlyChurn: discordantC,
      concordantBothChurn,
      concordantBothRetained,
      mcnemarChi2,
      mcnemarP,
      treatedAvgMrr: matchedAvgMrrT,
      controlAvgMrr: matchedAvgMrrC,
      attMrrLift: matchedAvgMrrT - matchedAvgMrrC,
      treatedRev1Yr: matchedRev1T,
      controlRev1Yr: matchedRev1C,
      grossRevLift1Yr,
      netProfitPerUpgrade: matchedNetProfitPerUpgrade,
      totalCampaignCostK: (matchedPairsIdx.length * campaignCostPerUpgrade) / 1000,
      totalNetProfitK: (matchedPairsIdx.length * matchedNetProfitPerUpgrade) / 1000,
      roiPct: matchedRoiPct,
    },
    balanceRows,
    overlapBins,
    sensitivityRows,
    criticalGammaChurn,
    criticalGammaNetRev,
    samplePairs: allPairRecords,
  };
}
