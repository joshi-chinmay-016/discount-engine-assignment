# Opptra Discount Engine — Base Implementation


It features a deterministic multi-tier discount engine, strict CSV and PDF cart ingestion, AI-powered natural language discount rule creation, and a unified Express production service.

## Running locally

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm (v9.0.0 or higher)

### Setup & Installation

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional, for AI rule generation)
# Create a .env file in the root directory:
GEMINI_API_KEY=your_gemini_api_key_here
# or OPENAI_API_KEY=your_openai_api_key_here
# LLM_PROVIDER=gemini
# PORT=3001
```

### Development Mode

Run the frontend and backend in development mode:

```bash
# Start backend API server (port 3001)
npm run server

# In a separate terminal, start Vite frontend dev server (port 5173)
npm run dev
```

Open **http://localhost:5173** in your browser. Vite proxies `/api/*` requests to the Express backend on port 3001.

### Testing

Run the automated test suite:

```bash
npm test
```

## Deploying

The application is architected for single-service production deployment where Express serves both the compiled React frontend and the backend API on one origin and port:

```bash
# 1. Build the production frontend bundle
npm run build

# 2. Start the unified production server
npm run server
```

The production server starts on port `3001` (or the port defined by `process.env.PORT`).

### Deployment Target Notes
- **Full-Stack Hosting (Recommended)**: Deploy to platforms like Render, Railway, Fly.io, or AWS App Runner as a Node.js web service running `npm run build && npm run server`. This enables all features, including AI natural language rule generation.
- **Static Hosting (Vercel / Netlify)**: The core discount engine, CSV parser, and PDF parser run entirely in the browser client and function independently without a server. If deploying statically from `dist/`, connect a hosted backend URL or serverless function for the `/api/rules/interpret` route.

The live deployment URL must be in your README before submission.

## How to use

1. **Input Rules**:
   - Upload `sample-data/rules.csv` or `sample-data/advanced-retailer/advanced-rules.csv` via the Rules CSV uploader.
   - Or describe discount offers in plain English using the AI Rule Creator (e.g. *"Give 10% off on all Natura Casa products"* or *"Flat ₹500 off on cart totals above ₹5,000"*).
2. **Input Cart**:
   - Upload `sample-data/cart.csv` (or `sample-data/advanced-retailer/advanced-cart.csv`) via the Cart CSV uploader.
   - Or upload a cart PDF (`sample-data/cart.pdf` or `sample-data/advanced-retailer/advanced-cart.pdf`) via the PDF Cart Uploader. Review the parsed items in the confirmation modal before adding them to your cart.
3. **Automatic Recalculation**:
   - Discounts recalculate automatically whenever cart items, active rules, or confirmed PDF items change.
4. **Review Results**:
   - Inspect the interactive results table displaying base price, applied discount rules, item-level savings, cart-level savings, and the final net payable amount.

## Project structure

```
discount-engine-assignment/
├── src/
│   ├── engine/
│   │   ├── discountEngine.js       ← Pure discount calculation engine (item & cart level)
│   │   ├── csvParser.js            ← Strict CSV parser with all-or-nothing validation
│   │   └── pdfParser.js            ← PDF text extractor & table tokenizer (4-col & 5-col)
│   ├── components/
│   │   ├── CsvUploader.jsx         ← CSV file uploader component
│   │   ├── PdfUploader.jsx         ← PDF cart uploader with extraction status
│   │   ├── CartPreviewModal.jsx    ← Modal for reviewing extracted PDF cart items
│   │   ├── RuleCreator.jsx         ← Natural language AI rule generation input
│   │   ├── DataTable.jsx           ← Searchable, paginated, responsive data table
│   │   └── ErrorBanner.jsx         ← User-friendly error message display
│   ├── App.jsx                     ← Main UI, state management & reactive recalculation
│   └── main.jsx                    ← React DOM entry point
├── server/
│   ├── index.js                    ← Express 5 production server & SPA static handler
│   ├── routes/
│   │   └── ruleRoutes.js           ← /api/rules/interpret endpoint
│   ├── services/
│   │   └── llmRuleParser.js        ← LLM integration service (Gemini / OpenAI / mock)
│   └── validators/
│       └── discountRuleSchema.js   ← Strict validator for interpreted rule structures
├── sample-data/
│   ├── rules.csv                   ← Baseline sample discount rules
│   ├── cart.csv                    ← Baseline sample 6-item cart
│   ├── cart.pdf                    ← Baseline sample cart PDF
│   └── advanced-retailer/          ← 50-item realistic retailer dataset with 10 rules
│       ├── advanced-cart.csv
│       ├── advanced-rules.csv
│       ├── advanced-cart.pdf
│       └── advanced-test-scenarios.md
├── test/                           ← Comprehensive native Node.js test suite
├── package.json
└── vite.config.js
```

## CSV formats

**rules.csv**

| Column     | Type              | Example          | Notes |
|------------|-------------------|------------------|-------|
| rule_id    | string            | RULE-01          | Unique identifier |
| scope      | brand \| platform \| cart | platform | Target scope |
| applies_to | string            | Amazon India     | Brand name, platform name, or cart |
| type       | percentage \| flat| percentage       | Discount calculation type |
| value      | number            | 15               | Percentage (1–100) or flat rupee amount |
| stackable  | true \| false     | false            | Whether rule can combine with others |
| min_spend  | number (optional) | 4000             | Minimum cart spend threshold (cart rules) |

**cart.csv**

| Column     | Type   | Example      | Notes |
|------------|--------|--------------|-------|
| item_id    | string | ITEM-01      | Unique product identifier |
| product    | string | Cushion Cover| Product name |
| brand      | string | Natura Casa  | Brand name |
| platform   | string | Amazon India | E-commerce channel |
| base_price | number | 1299         | Base price in Indian Rupees |

**PDF Cart Format**

The PDF parser supports both:
1. **Assignment Brief 4-Column Layout**: `Product | Brand | Platform | Base Price`. Unique, collision-safe item IDs (`ITEM-01`, `ITEM-02`, etc.) are automatically generated upon extraction.
2. **5-Column Layout**: `Item ID | Product | Brand | Platform | Base Price`. Existing item IDs are preserved.

## Discount logic

- **Item-Level Rules**:
  - When multiple non-stackable rules match an item, the rule yielding the **largest savings in rupees** is applied. If savings are identical, rule declaration order breaks the tie.
  - Rules marked `stackable: true` apply sequentially in declaration order on top of the winning non-stackable discounted price.
  - Item final price cannot drop below ₹0.
  - If no rules match an item, the base price is preserved with a *"No offers available"* note.
- **Cart-Level Rules**:
  - Cart rules are evaluated against the post-item-discount cart subtotal.
  - A cart rule only qualifies if the post-discount subtotal meets its `min_spend` threshold.
  - The highest-saving non-stackable cart rule is selected, and qualifying stackable cart rules are applied sequentially in declaration order.
  - The cart payable amount cannot drop below ₹0.

## Expected results for the sample data

| Item    | Base Price | Final Price | Reasoning                              |
|---------|-----------|-------------|----------------------------------------|
| ITEM-01 | Rs.1,299  | Rs.1,104    | Platform offer: 15% off (beats Rs.150) |
| ITEM-02 | Rs.849    | Rs.629      | Brand offer: Rs.150 off + Platform 10% |
| ITEM-03 | Rs.599    | Rs.509      | Platform offer: 15% off                |
| ITEM-04 | Rs.2,499  | Rs.2,499    | No offers available                    |
| ITEM-05 | Rs.449    | Rs.382      | Platform offer: 15% off                |
| ITEM-06 | Rs.899    | Rs.809      | Platform offer: 10% off                |
