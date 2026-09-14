# ReValue Tasks C + D — Minimal Codex Prompts

Use only these two main prompts. Run the app after each one.
Only use the optional repair prompt if something breaks.

---

# PROMPT 1 — Task C: Kabadiwala Operations Dashboard

You are extending my existing ReValue React + Vite frontend.

IMPORTANT:
- Do not recreate the app.
- Preserve all existing Consumer, Marketplace and Auction routes.
- Inspect the current project before editing.
- Reuse shared low-level components only where appropriate.
- Visually, this dashboard must look clearly different from the consumer interface.
- It should feel like a compact field-operations dashboard for a kabadiwala / collection partner.
- Keep the code ready for a real backend later.

ARCHITECTURE REQUIREMENT:
Do NOT hardcode business data directly inside JSX.
Create a small feature data/service layer such as:

src/services/kabadiwalaService.js
src/data/kabadiwalaMockData.js

Components/pages should receive data through functions such as:
getKabadiwalaOverview()
getNearbyPickups()
getInventory()
getRoutePlan()

For now these functions may return mock data / Promises.
Later I should be able to replace their internals with fetch()/API calls without rewriting the UI.

Create these routes:

/partner
/partner/pickups
/partner/inventory
/partner/routes

Create a visually distinct partner shell/navigation.

MAIN DASHBOARD

Show:

Today's Earnings        ₹3,420
Available Pickups       8
Inventory Value         ₹28,700

Suggested Material:
Copper
High Demand

Also include compact operational sections for:
- next pickup
- inventory snapshot
- material demand suggestion
- today's route

PICKUP OPPORTUNITIES

Show nearby pickup cards/list:

2.1 km — Broken Laptop
₹800–₹1,200

1.4 km — 12kg Mixed Metal
₹600

3.2 km — Batteries
₹1,400

Each pickup should have:
- item/material
- estimated value
- distance
- approximate weight if available
- pickup area
- Accept Pickup button

Do NOT integrate a real map SDK.
Create a map-like visual panel using CSS/simple markers or a list+map split.
Keep pickup data structured so latitude/longitude can be added later.

Accept Pickup should work locally:
- update status from available → accepted
- reflect it in the UI
- do not call a real API yet

ROUTE PLANNER

Show a clear route:

Pickup 1
↓
Pickup 2
↓
Pickup 3
↓
Warehouse

12.4 km
₹110 estimated fuel

Represent route stops as structured data, not JSX strings.

INVENTORY

Show:

Copper       42 kg
Aluminium    31 kg
Laptops      8
Batteries    22
PCB          18 kg

Include an AI suggestion panel:

"Copper demand is 18% higher this week. Consider holding aluminium and selling copper."

Inventory rows should use structured fields:
id
material
quantity
unit
estimatedValue
demandTrend

DESIGN DIRECTION

This should NOT look like the consumer marketplace.

Use:
- denser layout
- operational tables/cards
- strong status indicators
- compact typography
- clear numbers
- practical field-worker usability
- desktop + tablet + mobile responsive design

Avoid:
- consumer shopping cards
- oversized marketing hero sections
- decorative animations

BACKEND-READY RULES

1. No hardcoded arrays inside page components.
2. No repeated data across pages.
3. Put mock data in data files.
4. Put access functions in service files.
5. Use stable object IDs.
6. Keep Accept Pickup logic isolated so it can later become POST /pickups/:id/accept.
7. Add loading and empty states where appropriate.
8. Do not add Redux.

After implementation:
- list all routes added
- list all files changed
- explain where I would later connect backend endpoints
- confirm existing frontend routes still work.

---

# PROMPT 2 — Task D: Business / Enterprise Dashboard

Extend the same existing ReValue React + Vite application.

IMPORTANT:
- Do not recreate the app.
- Preserve all existing routes.
- Task D must look like enterprise software, clearly different from both consumer and kabadiwala interfaces.
- Reuse the existing application foundation but create a dedicated business dashboard shell.
- Keep all data backend-ready.

ARCHITECTURE REQUIREMENT:

Create:

src/services/businessService.js
src/data/businessMockData.js

UI components must get data through service functions such as:

getBusinessOverview()
uploadAssetBatch(file)
getAssetClassification()
getSellingStrategy()
getCSRMetrics()
searchProcurement(request)

For now these functions may return mock Promises.
Do not hardcode result arrays directly inside JSX.
Later these service functions should be replaceable with real API requests.

Create routes:

/business
/business/assets
/business/strategy
/business/csr
/business/procurement

BUSINESS SHELL

Use an enterprise-style left navigation:
Overview
Asset Upload
Selling Strategy
CSR Impact
Procurement

Use a clean, information-dense enterprise layout.

ASSET UPLOAD PAGE

Show four visual actions:

Upload CSV
Upload Excel
Upload Images
Connect ERP

CSV / Excel / Images should use real frontend file inputs.
Do not parse large files unless simple.
It is enough to:
- accept the file
- show file name
- simulate upload progress
- call the mock service function
- display result

ERP connection can be a clearly labelled prototype modal:
"ERP connector demo"

After upload show:

Assets Uploaded: 500

Working          280
Repairable       110
Part Harvest      60
Recycle           30
Donation          20

Represent categories as structured data:
category
count
percentage

SELLING STRATEGY PAGE

Show:

Recommended Strategy

Sell              280
Repair + Sell     110
Part-out           60
Donate             20
Recycle            30

Expected Recovery:
₹18.4 lakh

Also add a compact visual breakdown such as bars or progress rows.
Do not use a chart library unless already installed.

CSR PAGE

Show:

Devices Donated       120
Students Impacted     480
E-waste Diverted      1.8 tonnes
CO₂ Avoided           14.2 tonnes

Add one compact impact summary/trend section.
Keep metrics structured and ready for API responses.

PROCUREMENT PAGE

This is an important demo screen.

Create an input:

"What do you need?"

Example:
Need 500 laptop SSDs

Button:
Find Supply

Return aggregated supply:

Supplier A      120
Supplier B       85
Kabadiwala C     40
Repair Shop D   150
Supplier E      105

Total available: 500

Also show:
- requested quantity
- matched quantity
- fulfillment percentage
- supplier type
- location if useful

Procurement results must come from searchProcurement(request), not hardcoded inside the component.

Make it visually clear that ReValue is aggregating fragmented supply from multiple source types.

BACKEND-READY RULES

1. No result arrays directly inside JSX.
2. Use data + service layers.
3. File-upload UI should pass File objects to the service function.
4. Procurement search should pass a structured request object such as:
   {
     query: "laptop SSD",
     quantity: 500,
     location: "Delhi NCR"
   }
5. Use stable IDs.
6. Add loading, success, error and empty states.
7. Make service functions asynchronous even if mocked.
8. No fake API URLs.
9. No Redux unless already present.
10. Keep components modular enough that backend integration only changes service functions.

DESIGN DIRECTION

Enterprise software:
- clean sidebar
- muted surfaces
- compact cards
- tables
- clear hierarchy
- restrained animations
- professional typography
- responsive

Do NOT make this look like OLX or the consumer homepage.

After implementation:
- list routes added
- list files changed
- explain backend integration points
- confirm all prior routes still work.

---

# OPTIONAL REPAIR PROMPT — use only if needed

Inspect the current ReValue frontend after the latest change.

Do not add features and do not redesign.

Fix only:
- compile/runtime errors
- broken imports
- broken routes
- React warnings
- obvious responsive layout failures
- state bugs

Preserve all existing working functionality.

Keep data access through the existing service/data layers.
