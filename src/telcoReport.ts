import type { TelcoDashboardData } from './telcoData';
import type { TelcoMlResult } from './telcoMl';
import { ROSENBAUM_CITATIONS, type PsmStudyResult } from './telcoPsm';

export interface ReportPayload {
  data: TelcoDashboardData;
  psm: PsmStudyResult;
  ml: TelcoMlResult | null;
  includePortfolioAndMl: boolean;
  generatedAt: string;
}

export interface ReportSectionsContent {
  title: string;
  subtitle: string;
  generatedAt: string;
  specSummary: string;
  kpis: Array<{ label: string; value: string; note: string }>;
  churnTakeaway: { title: string; body: string };
  roiTakeaway: { title: string; body: string };
  gammaTakeaway: { title: string; body: string };
  roiComparisonRows: Array<[string, string, string]>;
  sensitivityRows: Array<[string, string, string, string]>;
  balanceRows: Array<[string, string, string, string]>;
  portfolioKpis: Array<{ label: string; value: string; note: string }>;
  portfolioTakeaways: string[];
  mlHighlights: string[];
  citations: Array<{ citation: string; note: string }>;
}

const fmt = (val: number, dec = 0): string =>
  new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(val);

function formatP(p: number): string {
  if (p < 0.0001) return '< 0.0001';
  if (p < 0.01) return p.toFixed(4);
  return p.toFixed(3);
}

export function buildReportContent(payload: ReportPayload): ReportSectionsContent {
  const { data, psm, ml, generatedAt } = payload;
  const m = psm.matched;
  const n = psm.naive;
  const removed = n.churnDiffPp - m.attChurnPp;
  const absAtt = Math.abs(m.attChurnPp);
  const per100 = Math.round(absAtt);
  const breakEvenCost = Math.round(m.grossRevLift1Yr);
  const signStr = `${m.attChurnPp >= 0 ? '+' : '−'}${fmt(absAtt, 1)} pp`;
  const moreOrLess = m.attChurnPp >= 0 ? 'MORE' : 'LESS';
  const biasShare = n.churnDiffPp > 0 ? Math.round((removed / n.churnDiffPp) * 100) : 0;

  const chPct = Math.round((psm.criticalGammaChurn - 1) * 100);
  const rvPct = Math.round((psm.criticalGammaNetRev - 1) * 100);
  const np = m.netProfitPerUpgrade;
  const isPos = np > 0;

  const k = data.kpis;
  const fiberVv = data.churnValueVsVolume.internet.find((r) => r.label === 'Fiber optic');
  const m2mSummary = data.contractSummary.find((r) => r.contract === 'Month-to-month');
  const twoYrSummary = data.contractSummary.find((r) => r.contract === 'Two year');

  return {
    title: 'Telecom Churn Analytics & Fiber Campaign Causal Evaluation',
    subtitle: 'Executive Summary Report · Focus: Section 12 Propensity Score Matching & Rosenbaum Sensitivity',
    generatedAt,
    specSummary: `${psm.specLabel} · Caliper ${psm.caliperMultiplier.toFixed(2)} SD (${fmt(psm.caliperLogitRadius, 3)} logit) · $${fmt(psm.campaignCostPerUpgrade)} upgrade cost · ${fmt(psm.matchedPairsCount)}/${fmt(psm.rawTreatedCount)} Fiber pairs matched`,
    kpis: [
      {
        label: 'Apples-to-Apples Twins',
        value: `${fmt(psm.matchedPairsCount)} pairs`,
        note: `${fmt(psm.supportRetentionPct, 1)}% Fiber support · ${psm.balancedUnder010Count}/${psm.totalCovariatesCount} traits < 0.10 SMD`,
      },
      {
        label: 'True Churn Impact (ATT)',
        value: signStr,
        note: `${fmt(m.treatedChurnRate, 1)}% Fiber vs ${fmt(m.controlChurnRate, 1)}% DSL (~${per100} MORE exits/100)`,
      },
      {
        label: '1-Yr Net Profit & ROI',
        value: `${np >= 0 ? '+' : '−'}$${fmt(Math.abs(np), 0)} (${m.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(m.roiPct), 0)}%)`,
        note: `${m.totalNetProfitK >= 0 ? '+' : '−'}$${fmt(Math.abs(m.totalNetProfitK), 1)}k net · break-even ~$${fmt(breakEvenCost)}`,
      },
      {
        label: 'Rosenbaum Breakdown Γ*',
        value: `${fmt(psm.criticalGammaChurn, 2)} / ${fmt(psm.criticalGammaNetRev, 2)}`,
        note:
          psm.criticalGammaNetRev > 1.01
            ? `Needs +${rvPct}% hidden odds skew to doubt ROI`
            : 'Near financial break-even at current cost',
      },
    ],
    churnTakeaway: {
      title: `1. What ${signStr} churn means: ${moreOrLess} churn, not ${m.attChurnPp >= 0 ? 'less' : 'more'}`,
      body:
        `"${signStr}" (percentage points) means Fiber upgrades experienced ${fmt(absAtt, 1)} percentage points ${moreOrLess} churn than statistically identical DSL customers—` +
        `${fmt(m.treatedChurnRate, 1)}% of upgraded Fiber accounts cancelled within a year vs ${fmt(m.controlChurnRate, 1)}% of matched DSL twins. ` +
        `In plain business terms, for every 100 customers upgraded to Fiber, roughly ${per100} ${moreOrLess} exited than if they had stayed on DSL. ` +
        `Importantly, raw unadjusted data overstated this gap at +${fmt(n.churnDiffPp, 1)} pp (${fmt(n.treatedChurnRate, 1)}% vs ${fmt(n.controlChurnRate, 1)}%): ` +
        `${biasShare}% of that headline alarm (${fmt(removed, 1)} pp) came from pitching higher-risk month-to-month and electronic-check accounts, not Fiber itself.`,
    },
    roiTakeaway: {
      title: isPos
        ? `2. Positive 1-Yr ROI (+${fmt(m.roiPct, 0)}%) despite higher attrition`
        : np === 0
          ? '2. Campaign sits right at 1-Yr financial break-even'
          : `2. Negative 1-Yr ROI (−${fmt(Math.abs(m.roiPct), 0)}%) at $${fmt(psm.campaignCostPerUpgrade)} upgrade cost`,
      body:
        `Matched Fiber subscribers pay +$${fmt(m.attMrrLift, 2)}/month more ($${fmt(m.treatedAvgMrr, 1)} vs $${fmt(m.controlAvgMrr, 1)}/mo). Even after accounting for early exits, ` +
        `each Fiber upgrade generated $${fmt(m.treatedRev1Yr, 0)} in 1-year realized billing vs $${fmt(m.controlRev1Yr, 0)} for its DSL twin—a +$${fmt(m.grossRevLift1Yr, 0)} gross lift. ` +
        (isPos
          ? `Subtracting the $${fmt(psm.campaignCostPerUpgrade)} upgrade cost yields +$${fmt(np, 0)} net profit per upgrade (+$${fmt(m.totalNetProfitK, 1)}k total across ${fmt(psm.matchedPairsCount)} pairs). The campaign stays profitable whenever upgrade costs stay below $${fmt(breakEvenCost)}/account.`
          : `Because $${fmt(psm.campaignCostPerUpgrade)} upgrade cost exceeds the +$${fmt(m.grossRevLift1Yr, 0)} gross revenue lift, the campaign loses −$${fmt(Math.abs(np), 0)} per upgrade (−$${fmt(Math.abs(m.totalNetProfitK), 1)}k total). Bringing upgrade costs below $${fmt(breakEvenCost)} restores positive ROI.`),
    },
    gammaTakeaway: {
      title: `3. What Rosenbaum Γ bounds (${fmt(psm.criticalGammaChurn, 2)} / ${fmt(psm.criticalGammaNetRev, 2)}) mean to management`,
      body:
        `Because management launched the Fiber push without an RCT, unrecorded factors (local competitor Fiber offers, speed complaints, or credit tier) might exist outside the CRM data. ` +
        `Rosenbaum’s Γ (Gamma) is a stress test asking: "How skewed would a hidden factor have to be before our conclusions turn into a mirage?" ` +
        `Γ = 1.00 assumes zero hidden bias. Here, Γ* = ${fmt(psm.criticalGammaChurn, 2)} (churn) and Γ* = ${fmt(psm.criticalGammaNetRev, 2)} (1-year net revenue) show ` +
        (psm.criticalGammaNetRev > 1.05
          ? `an unmeasured factor would have to shift a customer’s odds of getting Fiber by +${chPct}% to +${rvPct}%—even after matching on all ${psm.totalCovariatesCount} observed traits—to push worst-case p⁺(Γ) above 0.05. Small hidden gaps cannot overturn this ROI verdict, though bundling security or 1-year terms (Section 11) is recommended to reduce the residual +${fmt(absAtt, 1)} pp churn.`
          : `at $${fmt(psm.campaignCostPerUpgrade)}/upgrade, 1-year net profit is too close to break-even (Γ* = ${fmt(psm.criticalGammaNetRev, 2)}) to survive even minor hidden bias.`),
    },
    roiComparisonRows: [
      ['Sample Size (Fiber vs DSL)', `${fmt(psm.rawTreatedCount)} vs ${fmt(psm.rawControlCount)}`, `${fmt(psm.matchedPairsCount)} vs ${fmt(psm.matchedPairsCount)} pairs`],
      ['Max Covariate Imbalance |SMD|', fmt(psm.maxAbsSmdPre, 3), `${fmt(psm.maxAbsSmdPost, 3)} (${psm.balancedUnder010Count}/${psm.totalCovariatesCount} < 0.10)`],
      ['Churn Rate (Fiber vs DSL)', `${fmt(n.treatedChurnRate, 1)}% vs ${fmt(n.controlChurnRate, 1)}%`, `${fmt(m.treatedChurnRate, 1)}% vs ${fmt(m.controlChurnRate, 1)}%`],
      ['Excess Churn Effect (Fiber − DSL)', `+${fmt(n.churnDiffPp, 1)} pp`, `${signStr} (McNemar p = ${formatP(m.mcnemarP)})`],
      ['Discordant Pairs (b / c)', 'Unpaired', `b=${fmt(m.discordantB_TreatedOnlyChurn)} / c=${fmt(m.discordantC_ControlOnlyChurn)} (χ²=${fmt(m.mcnemarChi2, 1)})`],
      ['Monthly ARPU Lift ($/mo)', `+$${fmt(n.mrrDiff, 2)}`, `+$${fmt(m.attMrrLift, 2)}`],
      ['1-Yr Realized Revenue Lift / Acct', `+$${fmt(n.treatedRev1Yr - n.controlRev1Yr, 2)}`, `+$${fmt(m.grossRevLift1Yr, 2)}`],
      ['Net 1-Yr Profit / Upgrade', `${n.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(n.netProfitPerUpgrade), 2)}`, `${m.netProfitPerUpgrade >= 0 ? '+' : '−'}$${fmt(Math.abs(m.netProfitPerUpgrade), 2)}`],
      ['1-Year Net Campaign ROI (%)', `${n.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(n.roiPct), 1)}%`, `${m.roiPct >= 0 ? '+' : '−'}${fmt(Math.abs(m.roiPct), 1)}%`],
      ['Total Matched Cohort Net ($k)', 'Unadjusted', `${m.totalNetProfitK >= 0 ? '+' : '−'}$${fmt(Math.abs(m.totalNetProfitK), 1)}k on $${fmt(m.totalCampaignCostK, 1)}k cost`],
    ],
    sensitivityRows: psm.sensitivityRows.map((sr) => {
      const skewPct = Math.round((sr.gamma - 1) * 100);
      const skewDesc = sr.gamma === 1 ? 'No hidden bias' : `+${skewPct}% hidden skew`;
      const verdict =
        sr.churnSignificantAt05 && sr.netRevSignificantAt05
          ? `${skewDesc}: Both churn & ROI hold`
          : sr.churnSignificantAt05
            ? `${skewDesc}: Churn holds; ROI in doubt`
            : sr.netRevSignificantAt05
              ? `${skewDesc}: 1-Yr ROI holds; churn in doubt`
              : `${skewDesc}: Both could be bias artifacts`;
      return [sr.gamma.toFixed(2), formatP(sr.churnUpperP), formatP(sr.netRevUpperP), verdict];
    }),
    balanceRows: psm.balanceRows.slice(0, 8).map((b) => [
      b.inSpec ? b.label : `${b.label} (unadj.)`,
      fmt(Math.abs(b.preSmd), 3),
      fmt(Math.abs(b.postSmd), 3),
      `${b.biasReductionPct >= 0 ? '' : '−'}${fmt(Math.abs(b.biasReductionPct), 1)}%`,
    ]),
    portfolioKpis: [
      {
        label: 'Total Portfolio',
        value: fmt(k.totalCustomers),
        note: `${fmt(k.churnedCount)} churned (${fmt(k.churnRate, 1)}% volume)`,
      },
      {
        label: 'Monthly Revenue at Risk',
        value: `$${fmt(k.mrrAtRiskK, 1)}k/mo`,
        note: `${fmt(k.mrrAtRiskPct, 1)}% of $${fmt(k.totalMrrK, 1)}k MRR ($${fmt(k.avgMrrChurn, 1)} vs $${fmt(k.avgMrrRetained, 1)} avg)`,
      },
      {
        label: 'Tenure Gap',
        value: `${fmt(k.avgTenureChurn, 1)} vs ${fmt(k.avgTenureRetained, 1)} mo`,
        note: `Exits leave ${fmt(k.tenureGap, 1)} months earlier`,
      },
      {
        label: 'Contract Risk Skew',
        value: `${fmt(k.churnedM2mPct, 1)}% M2M`,
        note: `${fmt(k.churnedNoSecPct, 1)}% lacked security · ${fmt(k.churnedEcheckPct, 1)}% e-check`,
      },
    ],
    portfolioTakeaways: [
      `Churn Value vs. Churn Volume: Churned subscribers carried higher bills ($${fmt(k.avgMrrChurn, 1)}/mo vs $${fmt(k.avgMrrRetained, 1)}/mo retained), putting ${fmt(k.mrrAtRiskPct, 1)}% of total revenue at risk despite ${fmt(k.churnRate, 1)}% account churn.` +
        (fiberVv
          ? ` Fiber optic alone accounts for ${fmt(fiberVv.volumeShare, 1)}% of exited accounts yet ${fmt(fiberVv.valueShare, 1)}% ($${fmt(fiberVv.churnMrr)}/mo) of lost billing (+${fmt(fiberVv.skewPp, 1)} pp value skew).`
          : ''),
      `Contract & Onboarding Cliffs: Month-to-month contracts represent ${fmt(m2mSummary?.share ?? 55, 1)}% of subscribers but drive ${fmt(k.churnedM2mPct, 1)}% of exits (${fmt(m2mSummary?.churnRate ?? 42.7, 1)}% churn), compared with just ${fmt(twoYrSummary?.churnRate ?? 2.8, 1)}% on two-year terms. Early onboarding (0–6 mo) sees 52.9% attrition before stabilizing below 7% after Year 5.`,
    ],
    mlHighlights: ml
      ? [
          `Predictive Lift (80/20 stratified holdout, n = ${fmt(ml.testCount)}): Gradient Boosting achieves ${fmt(ml.models.gb.rocAuc, 3)} ROC-AUC (${fmt(ml.models.gb.topDecileLift, 2)}x top-decile lift; ${fmt(ml.models.gb.top20Capture, 1)}% churn captured in top 20%), alongside L2 Logistic Regression at ${fmt(ml.models.logreg.rocAuc, 3)} ROC-AUC (${fmt(ml.models.logreg.topDecileLift, 2)}x top-decile lift).`,
          `Counterfactual Uplift Strategy (Recommended for Fiber Retention): Targeting persuadable month-to-month Fiber subscribers with 1-Year Term + Online Security ($10/mo credit) or Auto-Pay + Tech Support ($5/mo credit) converts high-ARPU Fiber upgrades from fragile monthly billing to sticky term relationships.`,
        ]
      : [
          'ML Targeting Models: Gradient Boosting and L2 Logistic Regression rank subscribers by both baseline churn risk (Lift) and counterfactual offer responsiveness (Uplift).',
        ],
    citations: ROSENBAUM_CITATIONS.map((c) => ({
      citation: `${c.authors} (${c.year}). ${c.title}. ${c.venue}.`,
      note: c.concept,
    })),
  };
}

/**
 * Maps Unicode typographic glyphs cleanly into WinAnsi/ASCII-safe text for Type1 Helvetica PDF output.
 */
function toPdfText(raw: string): string {
  const mapped = raw
    .replace(/Γ/g, 'Gamma')
    .replace(/χ²/g, 'chi^2')
    .replace(/χ/g, 'chi')
    .replace(/[−–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/×/g, 'x')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/⁺/g, '+')
    .replace(/⁻/g, '-')
    .replace(/ê/g, 'e')
    .replace(/·/g, '|')
    .replace(/•/g, '*')
    .replace(/[↓↑→←↗]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
  return mapped.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += ` ${w}`;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Pure TypeScript PDF 1.4 multi-page vector writer (Helvetica / Helvetica-Bold / Courier).
 * Requires zero external packages and zero browser popups.
 */
export function generateExecutivePdfBytes(content: ReportSectionsContent, includePortfolioAndMl: boolean): Uint8Array {
  const pageW = 612; // US Letter width in pt
  const pageH = 792; // US Letter height in pt
  const marginX = 48;
  const contentW = pageW - marginX * 2;
  const topY = pageH - 50;
  const bottomY = 54;

  const pages: string[][] = [[]];
  let curY = topY;

  const pushCmd = (cmd: string) => {
    pages[pages.length - 1].push(cmd);
  };

  const newPage = () => {
    pages.push([]);
    curY = topY;
    pushCmd(`BT /F1 8 Tf 0.42 0.40 0.45 rg ${marginX} ${pageH - 30} Td (${toPdfText('FOLIO TELCO ANALYTICS  |  EXECUTIVE SUMMARY & SECTION 12 PSM REPORT')}) Tj ET`);
    pushCmd(`0.72 w 0.75 0.74 0.78 RG ${marginX} ${pageH - 36} m ${pageW - marginX} ${pageH - 36} l S`);
  };

  const ensureSpace = (neededPt: number) => {
    if (curY - neededPt < bottomY) newPage();
  };

  const drawRule = (thick = 0.6, dark = false) => {
    ensureSpace(10);
    pushCmd(`${thick} w ${dark ? '0.07 0.07 0.09' : '0.74 0.73 0.78'} RG ${marginX} ${curY} m ${pageW - marginX} ${curY} l S`);
    curY -= 12;
  };

  const drawTextLine = (
    text: string,
    x: number,
    y: number,
    opts: { font?: 'F1' | 'F2' | 'F3'; size?: number; rgb?: string } = {}
  ) => {
    const f = opts.font ?? 'F1';
    const s = opts.size ?? 10;
    const rgb = opts.rgb ?? '0.09 0.09 0.11';
    pushCmd(`BT /${f} ${s} Tf ${rgb} rg ${x.toFixed(1)} ${y.toFixed(1)} Td (${toPdfText(text)}) Tj ET`);
  };

  const drawHeading = (kicker: string, title: string) => {
    ensureSpace(34);
    drawTextLine(kicker.toUpperCase(), marginX, curY, { font: 'F2', size: 8, rgb: '0.35 0.23 0.90' });
    curY -= 14;
    drawTextLine(title, marginX, curY, { font: 'F2', size: 13, rgb: '0.07 0.07 0.09' });
    curY -= 8;
    drawRule(0.9, true);
  };

  const drawParagraph = (text: string, size = 9.5, leading = 13.5, maxChars = 94, rgb = '0.24 0.23 0.27') => {
    const lines = wrapLines(text, maxChars);
    for (const line of lines) {
      ensureSpace(leading + 4);
      drawTextLine(line, marginX, curY, { font: 'F1', size, rgb });
      curY -= leading;
    }
    curY -= 4;
  };

  const drawSubSection = (heading: string, body: string) => {
    const lines = wrapLines(body, 94);
    ensureSpace(24 + lines.length * 13);
    drawTextLine(heading, marginX, curY, { font: 'F2', size: 10.5, rgb: '0.07 0.07 0.09' });
    curY -= 14;
    for (const line of lines) {
      drawTextLine(line, marginX, curY, { font: 'F1', size: 9.2, rgb: '0.24 0.23 0.27' });
      curY -= 12.8;
    }
    curY -= 6;
  };

  const drawKpiGrid = (items: Array<{ label: string; value: string; note: string }>) => {
    const rowH = 44;
    ensureSpace(rowH + 14);
    const colW = contentW / 2;
    for (let i = 0; i < items.length; i += 2) {
      ensureSpace(rowH + 8);
      for (let c = 0; c < 2 && i + c < items.length; c++) {
        const it = items[i + c];
        const bx = marginX + c * colW;
        pushCmd(`0.96 0.96 0.98 rg ${bx.toFixed(1)} ${(curY - rowH + 10).toFixed(1)} ${(colW - 8).toFixed(1)} ${rowH} re f`);
        pushCmd(`0.6 w 0.78 0.77 0.82 RG ${bx.toFixed(1)} ${(curY - rowH + 10).toFixed(1)} ${(colW - 8).toFixed(1)} ${rowH} re S`);
        drawTextLine(it.label.toUpperCase(), bx + 8, curY - 2, { font: 'F2', size: 7.5, rgb: '0.36 0.34 0.40' });
        drawTextLine(it.value, bx + 8, curY - 16, { font: 'F2', size: 12.5, rgb: '0.07 0.07 0.09' });
        const noteLines = wrapLines(it.note, 46);
        drawTextLine(noteLines[0] || '', bx + 8, curY - 28, { font: 'F1', size: 7.8, rgb: '0.32 0.30 0.36' });
      }
      curY -= rowH + 8;
    }
    curY -= 4;
  };

  const drawTable = (headers: string[], rows: string[][], colXOffsets: number[]) => {
    const rowH = 16;
    ensureSpace(rowH * 3);
    pushCmd(`0.93 0.92 0.96 rg ${marginX} ${(curY - 12).toFixed(1)} ${contentW} 16 re f`);
    headers.forEach((h, idx) => {
      drawTextLine(h, marginX + colXOffsets[idx], curY - 7, { font: 'F2', size: 8, rgb: '0.12 0.11 0.16' });
    });
    curY -= 16;
    pushCmd(`0.8 w 0.07 0.07 0.09 RG ${marginX} ${curY + 2} m ${pageW - marginX} ${curY + 2} l S`);

    for (const r of rows) {
      ensureSpace(rowH + 6);
      r.forEach((cell, idx) => {
        const trimmed = cell.length > 58 && idx === r.length - 1 ? `${cell.slice(0, 56)}..` : cell;
        drawTextLine(trimmed, marginX + colXOffsets[idx], curY - 9, {
          font: idx === 0 ? 'F2' : 'F1',
          size: 8.3,
          rgb: '0.18 0.17 0.22',
        });
      });
      curY -= rowH;
      pushCmd(`0.4 w 0.82 0.81 0.86 RG ${marginX} ${curY + 2} m ${pageW - marginX} ${curY + 2} l S`);
    }
    curY -= 10;
  };

  // --- PAGE 1 HEADER ---
  pushCmd(`0.42 0.31 0.96 rg ${marginX} ${curY - 18} ${contentW} 24 re f`);
  drawTextLine('FOLIO  |  TELCO CUSTOMER CHURN ANALYTICS (N = 7,043)', marginX + 10, curY - 9, { font: 'F2', size: 9, rgb: '1 1 1' });
  curY -= 38;
  drawTextLine(content.title, marginX, curY, { font: 'F2', size: 16, rgb: '0.07 0.07 0.09' });
  curY -= 15;
  drawTextLine(content.subtitle, marginX, curY, { font: 'F1', size: 9.5, rgb: '0.35 0.23 0.90' });
  curY -= 13;
  drawTextLine(`Generated: ${content.generatedAt}   |   ${content.specSummary}`, marginX, curY, { font: 'F3', size: 7.5, rgb: '0.36 0.34 0.40' });
  curY -= 10;
  drawRule(1.0, true);

  // --- SECTION 12 PRIMARY FOCUS ---
  drawHeading('Section 12 · Causal Observational Study (No RCT Counterfactual)', 'Propensity Score Matching & 1-Year Fiber Campaign Verdict');
  drawKpiGrid(content.kpis);
  drawSubSection(content.churnTakeaway.title, content.churnTakeaway.body);
  drawSubSection(content.roiTakeaway.title, content.roiTakeaway.body);
  drawSubSection(content.gammaTakeaway.title, content.gammaTakeaway.body);

  // --- TABLES 12A & 12B ---
  drawHeading('Table 12A · Counterfactual Outcome Audit', 'Naive Unadjusted Comparison vs. 1:1 Propensity-Matched ATT');
  drawTable(['Metric', 'Naive (No Match)', 'PSM Matched (ATT)'], content.roiComparisonRows, [4, 215, 355]);

  drawHeading('Table 12B · Hidden-Bias Stress Test', 'Rosenbaum (2002) Primal Sensitivity Bounds (Gamma = 1.00 .. 3.00)');
  drawTable(['Gamma', 'Churn p+(G)', '1-Yr Rev p+(G)', 'Business Interpretation (alpha = 0.05)'], content.sensitivityRows, [4, 66, 148, 238]);

  drawHeading('Table 12C · Top Balanced Covariates', 'Pre-Match vs. Post-Match Imbalance |SMD| (Target < 0.10)');
  drawTable(['Covariate', 'Pre |SMD|', 'Post |SMD|', 'Bias Reduction'], content.balanceRows, [4, 215, 315, 415]);

  if (includePortfolioAndMl) {
    drawHeading('Sections 01–11 · Portfolio & ML Context', 'Churn Value vs. Churn Volume & Predictive Uplift Highlights');
    drawKpiGrid(content.portfolioKpis);
    for (const p of content.portfolioTakeaways) drawParagraph(p, 9.2, 13, 94);
    for (const mLine of content.mlHighlights) drawParagraph(mLine, 9.2, 13, 94);
  }

  drawHeading('Methodological References', 'Paul R. Rosenbaum & Donald B. Rubin on Observational Studies');
  for (const cite of content.citations) {
    drawSubSection(cite.citation, cite.note);
  }

  // Footer page numbers
  pages.forEach((cmds, idx) => {
    cmds.push(`0.6 w 0.74 0.73 0.78 RG ${marginX} 38 m ${pageW - marginX} 38 l S`);
    cmds.push(`BT /F1 8 Tf 0.40 0.38 0.45 rg ${marginX} 26 Td (${toPdfText(`Source: Telco-Customer-Churn.csv (n=7,043)  |  Page ${idx + 1} of ${pages.length}`)}) Tj ET`);
  });

  // Assemble PDF 1.4 objects with exact byte offsets
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];

  // 1: Catalog, 2: Pages, 3: F1 Helvetica, 4: F2 Helvetica-Bold, 5: F3 Courier
  objects.push(''); // placeholder 1
  objects.push(''); // placeholder 2
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>');

  for (let i = 0; i < pages.length; i++) {
    const streamStr = pages[i].join('\n');
    const contentNum = objects.length + 1;
    contentObjNums.push(contentNum);
    objects.push(`<< /Length ${streamStr.length} >>\nstream\n${streamStr}\nendstream`);

    const pageNum = objects.length + 1;
    pageObjNums.push(pageNum);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentNum} 0 R >>`
    );
  }

  objects[0] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[1] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;

  const chunks: string[] = ['%PDF-1.4\n'];
  const offsets: number[] = [0];
  let bytePos = chunks[0].length;

  for (let i = 0; i < objects.length; i++) {
    offsets.push(bytePos);
    const objStr = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    chunks.push(objStr);
    bytePos += objStr.length;
  }

  const xrefStart = bytePos;
  chunks.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i <= objects.length; i++) {
    chunks.push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const fullStr = chunks.join('');
  const out = new Uint8Array(fullStr.length);
  for (let i = 0; i < fullStr.length; i++) out[i] = fullStr.charCodeAt(i) & 0xff;
  return out;
}
