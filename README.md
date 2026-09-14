# ♻️ ReValue — AI-Powered Circular Economy Platform

> **Turning discarded electronics into recovered value — Resale, Repair, Component Harvesting, or Recycling, decided by AI instead of guesswork.**

---

## 📌 Executive Summary

India generates large and rapidly growing volumes of electronic waste, but very little of it is actually "recycled" in a value-conscious way — most of it is sold as undifferentiated scrap, priced by weight, regardless of whether the device inside is resellable, repairable, or genuinely at end-of-life. India already has the network to handle this at scale: a vast, decentralized system of local waste collectors (*kabadiwalas*) who touch nearly every discarded device at some point. What that network lacks isn't reach — it's information. There's no shared way to assess a device's condition, no visibility into its resale or component value, and no digital trail for anyone who needs one.

**ReValue** is an AI-assisted platform that looks at a discarded electronic device and estimates which recovery path actually recovers the most value from it, instead of defaulting every device into the same scrap pipeline. It's built to sit on top of the existing kabadiwala network and give it — and the people selling into it — better information, not to replace it.

---

## 🌍 Problem

A phone with a cracked screen but a healthy battery, and a phone that's genuinely dead, both get sold the same way today: as scrap, by weight. Nobody in that chain — the person discarding the device, the local collector, or the eventual recycler — has a reliable, fast way to tell whether an item is worth reselling, repairing, or stripping for parts before it's dumped into undifferentiated scrap. Value that could have been recovered through resale or repair gets destroyed at the very first handoff, simply because nobody involved had the information to make a better routing decision in that moment.

## 🇮🇳 Why This Matters in India

India's e-waste volumes are large and increasing, and the country's informal collection network is already doing the hard part — physically reaching almost every discarded device through kabadiwalas. The bottleneck isn't collection, it's decision-making at the point of collection: pricing and routing run on visual inspection and experience rather than any shared assessment of condition or value.

This is the gap **Problem Statement 5 (AI for Public Good)** of the official hackathon brief is aimed at: using AI to give underserved, income-constrained actors — here, informal waste workers and the micro-entrepreneurs around them — better information and market access, rather than building AI that only serves people who already have both. ReValue's target community fits the brief's own framing of workers "making high-impact decisions with limited resources and incomplete information."

## 💡 Solution

ReValue is not another classifieds listing app for scrap. It's an **AI-driven routing engine** that evaluates a discarded electronic device and dynamically points it toward its highest-value destination: **Resale, Repair, Component Harvesting, B2B Auction, or Certified Recycling.**

## ⚡ How ReValue Works — The Core Workflow

```
[ Upload Asset ]
        │
        ▼
[ AI Image Classification (MobileNetV3 Small → ONNX Runtime) ]
        │
        ▼
[ Multi-Tier Valuation Engine ]
   ├── 1. Direct Resale Value
   ├── 2. Repair + Resale Margin
   ├── 3. Component / Harvesting Value
   └── 4. Material Scrap Value
        │
        ▼
[ Optimal Route Decision ]
   ├── Whole Device Resale (C2B / P2P)
   ├── Component Harvesting (Local Repair Shops)
   ├── Enterprise Bulk Auction (SMEs / Refurbishers)   — roadmap
   └── Certified E-Waste Recycling                      — roadmap
        │
        ▼
[ Local Logistics & Settlement (Kabadiwala Pickups + Escrow) ]  — roadmap
```

The core, working part of this pipeline today is the top half: photo → classification → valuation → routing recommendation. The bottom half — actually connecting that recommendation to a real pickup, bulk auction, or settlement — is where the project is headed next (see [Roadmap](#-roadmap)); it isn't live yet, and this README doesn't claim otherwise.

## 🤖 AI/ML Layer

This is the technically deepest part of the project, so it's worth being precise about what's actually running in production:

- **Model:** MobileNetV3 Small, trained for device/scrap image classification.
- **Inference runtime:** ONNX Runtime — the trained model is exported to ONNX and served through ONNX Runtime. Production inference does **not** run directly through PyTorch.
- **Pipeline:** image upload → preprocessing → ONNX inference → top-k predictions with confidence scores.
- **Output:** predicted device/scrap category and a confidence score, which feeds the valuation engine below it.
- **Price prediction:** handled by a separate ML service downstream of classification — a targeted valuation model, not a generative/LLM component, feeding into the routing logic.

## 🌟 Key Features

### 1. 🤖 AI-Based Asset Understanding
- **Image classification:** upload a photo of the device; MobileNetV3 Small (via ONNX Runtime) identifies the device/scrap category with a confidence score.
- **Condition-aware assessment:** classification output is used as the basis for value estimation, rather than treating every device identically.

### 2. 📊 Multi-Tier Valuation
Estimates value across multiple possible outcomes for the same device:

$$\text{Best Value} = \max\Big(\text{Resale},\ (\text{Repaired Resale} - \text{Repair Cost}),\ \sum \text{Component Parts},\ \text{Scrap Material}\Big)$$

The valuation model consumes the classification output to produce this estimate; repair-cost and component-level pricing depth is part of ongoing work rather than a fully mature, market-calibrated system yet.

### 3. 🔄 Intelligent Asset Routing (Core Differentiator)
Instead of pushing every device onto a single generic listing, ReValue recommends a route:
- **Sell Whole** — high residual-value consumer devices.
- **Repair First** — devices where a small repair meaningfully increases resale value.
- **Sell as Parts** — broken devices with valuable functional components (SSDs, RAM, displays).
- **B2B Bulk Auction** *(roadmap)* — SME/enterprise IT asset liquidation.
- **Certified Recycling** *(roadmap)* — routing genuinely end-of-life devices to authorized recyclers.

### 4. 🛵 Kabadiwala-Aligned Logistics *(in development)*
- Designed to integrate existing local waste collectors into a digital flow rather than bypass them.
- Planned: route-optimized pickup leads, transparent spot pricing, digital inventory tracking for collectors.

### 5. 🏢 Enterprise & CSR Layer *(roadmap)*
- **Asset Disposition (ITAD):** digital audit trail and chain-of-custody tracking for enterprise device disposal.
- **CSR facilitation:** refurbish → certify → donate → reporting flow for corporate donation programs.
- This layer is a future direction based on the platform's architecture, not a currently implemented feature.

## 🎯 Problem Statement Alignment

**Official challenge (Problem Statement 5 — AI for Public Good):** build an AI solution that improves an underserved community's access to information, decision-making, livelihoods, or economic opportunities, with attention to local languages, digital literacy, affordability, and limited connectivity.

ReValue's target community is the informal waste-collection workforce (kabadiwalas) and the individuals who sell devices to them — a group that fits the brief's own examples of "micro-entrepreneurs" and workers making high-impact decisions with incomplete information.

| Problem Statement Requirement | ReValue Response |
|---|---|
| Serve an underserved/marginalized community with limited access to information | Targets kabadiwalas and device owners, who currently price devices by weight/guesswork rather than actual resale or repair value |
| Improve decision-making under incomplete information | AI classification + value estimation gives a condition- and category-aware recommendation instead of a flat scrap price |
| Improve livelihoods / economic opportunity | Routing toward resale/repair/component-harvesting recovers value that pure scrap pricing currently destroys, for the same collectors already doing the work |
| Affordability / accessibility considerations | Photo-based input (no specialized hardware); designed to sit on top of existing informal collection workflows rather than replace them |

This mapping is intentionally narrow — ReValue is a value-routing tool for an underserved workforce, not a full public-services or welfare-access platform, and this README doesn't claim otherwise.

## 💼 Business Model & Financial Analysis

> These figures are illustrative business-planning estimates prepared for hackathon pitch purposes — they are **not** measured outcomes from a live, revenue-generating deployment.

### 🎯 Market Framing
- **TAM:** India's secondary electronics resale, scrap, and refurbishment market as a whole.
- **SAM:** Urban electronics hubs, repair-shop networks, and IT-heavy corporate clusters.
- **SOM:** A single dense metro area as an initial launch geography.

### 💰 Potential Revenue Streams
1. **Marketplace take rate** — commission on completed transactions.
2. **Auction & bidding fees** — enterprise asset liquidation and bulk scrap bidding (roadmap feature).
3. **B2B SaaS subscriptions** — verified-repairer memberships and enterprise ITAD dashboards (roadmap feature).
4. **Data & analytics API** — component/commodity price feeds (roadmap feature).

### 📈 Illustrative Unit Economics
| Metric | Assumption |
|---|---|
| Avg. recovered value / transaction | ₹5,000 |
| Platform take rate | 10% (₹500) |
| Variable cost / transaction | ₹200 (logistics, verification, support, payment gateway) |
| Contribution margin | ₹300 (60%) |
| Illustrative annual fixed cost | ~₹65 Lakhs |
| Break-even target | ~21,700 transactions/year (~1,800/month) |

| Stage | Transactions (target) | Platform Revenue (target) |
|---|:---:|:---:|
| Pilot | 750 | ₹3.75 Lakhs |
| City-scale | 10,000 | ₹50 Lakhs |
| Multi-city | 30,000 | ₹1.5 Crore |

These are planning assumptions, not achieved numbers — no transactions, revenue, or users have been reported yet.

## 🏗️ System Architecture

```
Frontend (React + Vite + Tailwind, PWA)
        │
        ▼
Backend API (Node.js / Python)
        │
        ▼
ML Service (MobileNetV3 Small → ONNX Runtime)
        │
        ▼
PostgreSQL (data) + Redis (cache)
```

## 🔄 End-to-End Workflow

1. User photographs a discarded device.
2. Image is sent to the ML service for classification (device/scrap category + confidence).
3. Backend combines classification output with valuation logic to estimate recovery value.
4. System recommends a routing decision: resell, repair, harvest components, or recycle.
5. *(Roadmap)* Recommendation is connected to an actual collector, buyer, or recycler for pickup/settlement.

## 👥 Stakeholders

- **Device owners** — individuals or small offices discarding electronics, currently underpaid because scrap pricing ignores resale/repair value.
- **Kabadiwalas / local collectors** — the existing informal network ReValue is built to support with better information, not replace.
- **Repair shops** — potential buyers of components or repairable units.
- **Recyclers** — end destination for devices with no recoverable resale/repair value.

## 🌱 Environmental & Economic Impact

Routing more devices toward reuse, resale, and repair — rather than defaulting everything to scrap or recycling — keeps functional devices and components in circulation longer, which reduces the volume of e-waste that needs processing and reduces demand for new raw materials. No specific impact figures (tonnes diverted, ₹ recovered, users served) are claimed here, since none have been measured yet at this stage of the project.

## 🛠️ Technology Stack

- **Frontend:** React, Vite, Tailwind CSS, PWA
- **Backend:** Node.js / Python API services
- **AI / ML:**
  - MobileNetV3 Small — device/scrap image classification model
  - ONNX Runtime — production inference engine (model exported to ONNX; not served via raw PyTorch)
  - Image preprocessing pipeline for classifier input
  - Confidence-scored, top-k prediction output
  - Downstream price-prediction ML service for valuation
- **Database & Cache:** PostgreSQL, Redis
- **Planned integrations:** geolocation/routing APIs, escrow payment gateway *(roadmap)*

## 🚀 Deployment

- **Frontend:** Netlify
- **Backend:** Render
- **ML service:** Render

*(Full deployment guide — environment variables, deploy order, and local verification steps — lives in `DEPLOYMENT.md`.)*

## 🗺️ Implementation Roadmap

- **Phase 1 — Foundation & MVP:** AI image classification (MobileNetV3 Small / ONNX), multi-tier valuation logic, routing recommendation, and the web frontend for upload + assessment. **This is the current state of the project.**
- **Phase 2 — Pilot & Validation:** connect routing recommendations to real collector pickups, add a resale/component listing surface, begin closing the loop between recommendation and an actual transaction.
- **Phase 3 — Marketplace Depth:** spare-parts marketplace for repair shops, live auction engine for enterprise/bulk liquidation, onboarding SME clients.
- **Phase 4 — Enterprise & Automation:** enterprise ITAD dashboard, chain-of-custody tracking, certified data-destruction records, automated CSR compliance reporting, commodity/component pricing API.
- **Phase 5 — Scale:** expansion beyond the initial pilot geography.

Phase 1 items are implemented; Phases 2–5 are planned direction, not current functionality.

## 📊 Current Project Status

ReValue is a working prototype: the AI classification pipeline and value-routing logic are implemented and deployed. The logistics, payments, and enterprise-facing layers described in earlier planning documents are not yet built and are listed above as roadmap items, not current features.

## 👨‍💻 Developer

**Saksham Singh**
AXIS COLLEGES KANPUR
