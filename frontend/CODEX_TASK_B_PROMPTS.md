# Codex Prompts — Task B Marketplace + Auctions

Use these sequentially. Do not paste all prompts at once.

## Prompt 1 — Audit and shared marketplace data model

You are extending my existing ReValue React + Vite frontend.

IMPORTANT:
- Do not recreate the app.
- Preserve every Task A page and route.
- Inspect the existing code before editing.
- Reuse the current design system and shared components.
- Use local mock data only.
- No backend and no WebSockets.

For this step only, create a centralized marketplace data model.

Each listing should contain:
- id
- title
- category
- type: whole | component
- saleType: fixed | auction
- condition
- conditionScore
- price
- currentBid
- location
- distanceKm
- seller
- sellerVerified
- sellerRating
- specifications
- images
- bids
- auctionEndTime

Create at least 10 realistic Indian listings across phones, laptops, SSDs, RAM, GPUs, batteries and motherboards.

Do not redesign pages yet.

After finishing:
- list changed files
- explain the schema
- confirm all existing routes still work.

## Prompt 2 — Marketplace page

Upgrade the existing /marketplace page.

Design it like a premium OLX/eBay-style recommerce marketplace while keeping the ReValue design language.

TOP:
- title
- search
- result count
- sort dropdown

FILTERS:
Category
Price
Condition
Distance
Auction / Fixed Price
Whole Device / Components

Desktop: left filter sidebar.
Mobile: filter button + drawer/modal.

PRODUCT CARDS:
- image
- product name
- condition
- AI condition score
- price OR current bid
- location
- distance
- verified seller badge
- seller rating
- fixed/auction badge
- whole/component badge
- Buy for fixed price
- Bid for auction
- favorite button

Make cards route to /marketplace/:id.

Add:
- responsive grid
- zero-results state
- strong distinction between fixed price and auction listings

Use mock data only.

## Prompt 3 — Functional filtering

Make Marketplace filters work together with local React state.

Implement:
- search title/category/specifications
- category
- min/max price
- condition
- distance
- fixed/auction
- whole/component
- sorting: Recommended, Price Low-High, Price High-Low, Distance, Ending Soon

Show:
- active filter chips
- remove individual chip
- Clear All
- live result count

Do not add Redux.

## Prompt 4 — Product detail page

Create /marketplace/:id using the selected mock listing.

LEFT:
- large image
- thumbnails
- image switching

MAIN PRODUCT INFO:
- title
- condition
- whole/component
- fixed/auction
- location
- description
- specifications

AI CONDITION SCORE:
Show a strong visual component:
AI Condition Score: 84 / 100

Subscores:
Exterior 78
Functionality 94
Battery 70
Components 91

Text:
"Based on seller photos and assessment answers."

Do not imply the AI score is an absolute guarantee.

SELLER:
- seller name
- verified
- rating
- member since
- location
- number of listings

PURCHASE PANEL:
For fixed:
₹12,500
[ Buy Now ]
[ Make Offer ]

For auction:
Current Bid ₹7,800
[ View Auction / Place Bid ]

RELATED PARTS:
Show compact cards for compatible RAM, SSD, battery, charger, etc.

Responsive layout required.

## Prompt 5 — Make Offer modal

On fixed-price Product pages implement a frontend-only Make Offer modal.

Show:
- listing price
- offer input
- quick offers: 95%, 90%, 85%
- optional message
- Submit Offer

Validation:
- not ₹0
- not above listing price
- Indian currency formatting

After submission show:
"Offer sent to seller."

No API calls.

## Prompt 6 — Auction listing page

Upgrade /auctions.

Tabs:
Live
Ending Soon
Upcoming
My Bids

Auction cards:
- image
- title
- condition
- current bid
- bidder count
- live countdown
- location
- verified seller
- Place Bid button

Create at least 6 mock auctions.

Countdown updates every second.
At zero:
- Ended
- disable bidding

Route each auction to /auctions/:id.

## Prompt 7 — Auction detail page

Create /auctions/:id.

Show:
- product gallery
- title
- condition
- seller
- location

Make these three values visually dominant:

Current Bid        ₹7,800
Time Remaining     02:14:32
Number of Bidders  16

Then:

Minimum Next Bid
₹8,000

[ BID ₹8,000 ]

Add bid increment controls:
+₹200
+₹500
+₹1,000

BID HISTORY:
A***4  ₹7,800  10 sec ago
K***2  ₹7,500  1 min ago
M***8  ₹7,200  3 min ago

Use masked bidder names.

Also show:
- bid increment rules
- payment window
- pickup/shipping terms

No backend.

## Prompt 8 — Simulated live bidding

Add frontend-only live bidding simulation to Auction Detail.

NO WEBSOCKETS.
NO BACKEND.

When user clicks BID:
1. Raise current bid.
2. Append user's bid.
3. Update minimum next bid.
4. Show "You are the highest bidder."

Then use a random setTimeout of about 3–8 seconds with a reasonable probability that another mock bidder bids one increment higher.

If mock bidder overtakes:
show "You've been outbid."

Allow user to bid again.

Keep countdown independent.

Put simulated bidding logic in a clearly separated hook/helper so it can later be replaced by real WebSockets.

Do not make mock bids constant or distracting.

## Prompt 9 — Auction polish

Review ONLY Auction Detail as a senior product designer.

Improve:
- current bid hierarchy
- countdown prominence
- BID CTA
- winning/outbid state
- bid history
- seller trust
- condition score
- responsive behavior

Add subtle reactions for:
- bid accepted
- highest bidder
- outbid
- ended

Avoid casino-like styling, flashing and excessive red/green.

## Prompt 10 — Cross-link marketplace and auctions

Connect both experiences.

Auction listings in Marketplace:
- current bid
- countdown
- Bid CTA

Fixed listings:
- price
- Buy
- Make Offer

Auction product detail pages link to full /auctions/:id.

Related products can mix fixed and auction items.

Do not duplicate the data source.

## Prompt 11 — Final Task B audit

Audit:
/marketplace
/marketplace/:id
/auctions
/auctions/:id

Fix:
- broken routes
- React warnings
- countdown cleanup
- timer leaks
- filter bugs
- invalid bids
- duplicated components
- mobile issues
- accessibility
- inconsistent price formatting
- poor empty states

Optimize this demo:
Marketplace
→ Product
→ Make Offer
→ Auction
→ Place Bid
→ Competing Bid
→ Bid Again

Do not add unrelated features.
