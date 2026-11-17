# Telco Churn Analytics & Causal Evaluation Dashboard

Telco Data Analysis using open source IBM telco data  
Building dashboards with aistudio  
Adding bespoke analytics to IBM data

## Live Dashboard Preview

- **Instant Preview (Hosted App):** [Open Live Dashboard Preview](https://ais-pre-7hba6m4vd4eapr76hw6szo-101029925171.europe-west2.run.app)
- **GitHub Pages Preview (Your Fork / Repo):** After pushing this repository to GitHub, enable **Settings → Pages → Build and deployment → Source: GitHub Actions**. The included workflow (`.github/workflows/deploy-pages.yml`) automatically builds `dist/` with relative asset paths (`base: './'`) and publishes an interactive preview URL at `https://<your-username>.github.io/<repo-name>/` (also surfaced in GitHub's **Deployments / Environments** sidebar).

## Local Build & Preview

```bash
npm install
npm run build
npm run preview
```

For local development with hot reload on port 3000:

```bash
npm run dev
```

## Dashboard Sections & Analytics

- **Sections 01–10 — Portfolio Churn Diagnostics (`Telco-Customer-Churn.csv`, n = 7,043):** Churn Value vs. Churn Volume (`MRR` at risk vs. account count), contract/tenure cliffs, service driver rankings, and interactive segment filters.
- **Section 11 — ML Lift & Counterfactual Uplift:** Browser-side L2 Logistic Regression and Gradient Boosting (`45` depth-3 trees) with ROC-AUC, Lift/Gains/Uplift curves, customer targeting table, CSV export, and equivalent `scikit-learn` Python pipeline export.
- **Section 12 — Observational Study & Propensity Score Matching (PSM):** Retroactive 1-year evaluation of management's Fiber upgrade campaign (`1:1` logit caliper matching), covariate balance Love plot, 1-year net ROI breakdown, Rosenbaum $\Gamma$ sensitivity bounds, plain-language executive takeaways, and downloadable **Summary PDF / Print-Friendly Report**.

