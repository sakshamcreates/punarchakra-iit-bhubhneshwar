# Codex Build Prompts

Use these prompts one at a time. Do not ask Codex to build the entire frontend in one shot.

## Prompt 1 — Project audit and foundation

You are working inside an existing React + Vite frontend called ReValue.

Goal:
Build a premium consumer-facing recommerce and e-waste platform for India.

Core user journey:
Home → Sell Item → Upload device → AI/device detection → Dynamic condition questions → AI analysis → Best Route recommendation → Dashboard.

Before changing code:
1. Inspect the existing project structure.
2. Identify reusable components and missing dependencies.
3. Keep the existing visual direction unless a change materially improves usability.
4. Do not introduce a heavy UI library unless necessary.
5. Prefer reusable React components and mock data separated from UI.
6. Keep the app fully responsive.

For this step only:
- Clean up the global layout.
- Improve typography, spacing, button hierarchy and navigation.
- Create a consistent design token system using CSS variables.
- Create reusable Button, Card, Badge and SectionHeader components.
- Do not build new pages yet.
- Show me exactly which files you changed.

## Prompt 2 — Premium homepage

Build the ReValue consumer homepage.

Requirements:
- Sticky navbar.
- Large hero with message: users can find the highest-value route for old electronics.
- Search bar.
- Primary CTA: Sell a Device.
- Secondary CTA: Scrap Pickup.
- Four action cards: Sell Electronics, Auctions, Scrap Pickup, Browse Products.
- Popular categories.
- AI assistant entry point with sample questions.
- A visually strong “AI Route Optimizer” preview card showing an example recommendation.
- Responsive mobile layout.
- Use subtle motion/hover states but no excessive animation.
- Avoid generic SaaS dashboard aesthetics.
- Keep the interface consumer-friendly, modern and trustworthy.
- Use mock data only.

After implementation:
- Explain the component structure.
- List all changed files.

## Prompt 3 — Sell item wizard

Build a multi-step Sell Item wizard.

Steps:
1. Upload photos.
2. Detect/confirm category and device.
3. Ask dynamic condition questions.
4. Show AI analysis animation.
5. Navigate to results.

Requirements:
- Step progress indicator.
- Multi-photo upload with previews.
- Simulate AI detection after upload.
- Example detection: Lenovo IdeaPad Gaming 3, confidence 92%.
- Allow the user to correct category/device.
- Questions must come from a configuration object keyed by category.
- Laptop questions: powers on, display condition, battery condition, storage, RAM, charger availability.
- Phone questions: powers on, display damage, battery health, camera, storage, network lock.
- Keep answers in one sellItem state object.
- Save state in React Context or a small custom hook.
- No real backend yet.
- Add smooth transitions between steps.
- The flow should feel polished enough for a hackathon demo.

Do not implement valuation calculations yet.

## Prompt 4 — AI analysis screen

Create an AI analysis transition screen for the Sell Item flow.

It should sequentially show:
- Identifying device.
- Checking condition.
- Estimating resale demand.
- Evaluating component value.
- Comparing repair economics.
- Checking auction demand.
- Calculating scrap value.

Also show live-looking metrics:
- Market demand.
- Repairability.
- Parts value.
- Scrap value.

Requirements:
- Simulated progress only.
- Duration roughly 3–5 seconds.
- No loading spinner as the primary visual.
- Use animated status transitions.
- At completion route to /sell/results.

## Prompt 5 — Recommendation results page

This is the most important screen in the demo.

Build a high-impact Best Route recommendation page.

Example device:
Lenovo IdeaPad Gaming 3
Damaged display
Working motherboard

Main recommendation:
Sell Components
Estimated value: ₹15,800

Alternatives:
Sell Whole ₹12,500
Repair + Sell ₹14,200
Auction ₹13,000–17,000
Scrap ₹2,300
Donate — Social Impact

Requirements:
- Recommended route must be visually dominant.
- Show estimated time to sell.
- Show AI confidence.
- Show why this route was selected.
- Include component breakdown:
  SSD ₹2,700
  RAM ₹3,100
  Motherboard ₹6,800
  Battery ₹1,400
  Keyboard ₹900
  Chassis ₹900
- Show “Whole device value ₹12,500” and “Potential additional recovery +₹3,300”.
- Add expandable “Why?” explanation.
- Add CTA buttons for each route.
- Design the comparison so a judge understands the business model in under 10 seconds.

## Prompt 6 — Dashboard

Build the consumer dashboard shell.

Sidebar sections:
Overview
My Listings
Scrap Locker
Auctions
Pickup Tracking
Saved Products
Transactions
Green Impact
Settings

Overview cards:
₹18,450 total value recovered
3 active listings
1 pickup scheduled
8.4 kg e-waste diverted

Add:
- Recent activity.
- Listing status cards.
- Scrap Locker progress to free pickup at 10 kg.
- Green Impact summary.
- Pickup status.

Use mock data and make all dashboard widgets reusable.

## Prompt 7 — Scrap Locker

Build the Scrap Locker page.

Purpose:
Users can accumulate small e-waste items until pickup becomes economically viable.

Display:
Estimated scrap value ₹1,840
Total weight 6.8 kg
Free pickup threshold 10 kg

Contents:
Old chargers 1.4 kg
Cables 0.8 kg
Dead phones 1.2 kg
PCBs 0.6 kg
Batteries 2.8 kg

Requirements:
- Strong progress indicator toward 10 kg.
- Add Item CTA.
- Schedule Pickup CTA.
- Show why bundling increases user payout / reduces pickup cost.
- Keep it consumer-friendly, not warehouse-like.

## Prompt 8 — Auction experience

Build a live-auction experience.

Cards should show:
- Product image placeholder.
- Current bid.
- Number of bids.
- Countdown timer.
- Condition.
- Seller trust indicator.
- Place Bid CTA.

Create auction detail page with:
- Bid history.
- Minimum next bid.
- Countdown.
- Product condition summary.
- Pickup/shipping information.

Use mock data only.

## Prompt 9 — Marketplace

Build a recommerce marketplace.

Requirements:
- Search.
- Category filters.
- Price filter.
- Condition filter.
- Seller type filter: User, Refurbisher, Kabadi Partner.
- Product cards.
- Saved/favorite state.
- Product detail page.
- Trust indicators.
- Clearly label refurbished, used and component-only listings.

## Prompt 10 — Final polish

Audit the entire ReValue frontend as a senior product designer and senior frontend engineer.

Fix:
- Inconsistent spacing.
- Poor typography hierarchy.
- Weak button hierarchy.
- Mobile issues.
- Accessibility problems.
- Missing loading/empty/error states.
- Repeated code.
- Unnecessary components.
- Broken routes.
- Poor demo flow.

Then optimize specifically for a 3-minute hackathon demo.

The ideal demo path is:
Home → Sell Device → Upload → Dynamic Questions → AI Analysis → Best Route → Dashboard → Scrap Locker.

Do not add random features. Improve clarity and impact.
