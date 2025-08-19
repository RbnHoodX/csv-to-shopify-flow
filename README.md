# Product Variation Generator

The **Product Variation Generator** is a data-driven app that automatically creates fully-formatted Shopify CSV product listings from a single product catalog and a set of rule files.It eliminates manual entry for hundreds of product variations, ensuring accuracy, consistency, and compliance with Shopify import rules.

---

## ✨ Features

- \
  **Automatic Variant Expansion**Expands one product style into dozens of variants (metals, sizes, qualities) using rule books.
- \
  **Rule-Driven Logic**Uses three rule files (`Natural.csv`, `Labgrown.csv`, `No Stones.csv`) to generate variations according to whether the product has natural diamonds, lab-grown diamonds, or no stones.
- **Accurate Calculations**
  - Total carat weights (center + sides).
  - Grams weight per metal using Weight Index.
  - Diamond and metal cost, labor, markup, and margin.
  - Shopify-ready variant price and compare-at price.
- \
  **Shopify CSV Compliance**Parent/child row structure, blanking of required fields, option naming, inventory, fulfillment, and Google Shopping fields are filled exactly as expected.
- \
  **Deterministic Order**Products and variants are generated in the same order as the input file and rule books.

---

## 📂 Project Files

- **Input test.csv** — The main product list (core inventory).
- **Natural Rules.csv** — Rule book for natural diamond products.
- **Labgrown Rules.csv** — Rule book for lab-grown diamond products.
- **No Stones Rules.csv** — Rule book for products with no stones (e.g. plain wedding bands).
- **Output Test.csv** — A golden reference output file (for validation only).
- **08-12 Simplified Specifications.pdf** — Specification document that defines the column logic.

---

## ⚙️ Workflow

1. **Upload Input Files**
   - `Input test.csv` (main product list)
   - The three rule files (`Natural.csv`, `Labgrown.csv`, `No Stones.csv`)
2. **Process Each Product**
   - Determine if the product core number is **Unique** or **Repeating**.
   - Check the **Diamond Type** (Natural, Labgrown, No Stones).
   - Select the correct rule book.
   - Apply the correct scenario:
     - Unique with center → use Metals (G) × Center sizes (H) × Qualities (I).
     - Unique without center → use Metals (J) × Qualities (K).
     - Repeating → same as above, per input row.
     - No Stones → Metals only.
3. **Generate Variants**
   - Create all combinations in **exact rule order**.
   - Calculate total carat weight, grams, cost, price, and markup.
   - Assign Shopify option values (Metal, Carat, Quality).
4. **Build Shopify Output**
   - First row (parent) includes product metadata (`Title`, `Body`, `Tags`, etc.).
   - All child rows share the same `Handle` but leave parent-only fields blank.
   - Output saved as `Output.csv`.

---

## ✅ Validation Checklist

When testing, compare the generated `Output.csv` against `Output Test.csv`:

- Products are processed **in input order**.
- Variant counts match (`15338` Natural+Center must have **77 variants**).
- Titles show **min-max TCW** and **all shapes** (e.g., _“1.55-2.70 CT Round & Princess Cut - Bridal Set”_).
- Tags include category, subcategory, shapes, and **bucketed TCW ranges**.
- Carat math correct (sum of sides + current center).
- Grams differ by metal via Weight Index.
- Inventory/fulfillment fields match spec: `Qty=1`, `Policy=Continue`, `Manual` capitalized, etc.
- Prices calculated correctly with margin multipliers.
- Parent/child blanking correct.

---

## 🛠️ Tech Stack

- **Frontend**: Lovable web UI (file upload + output download).
- **Backend**: Node.js + TypeScript (variant expansion and CSV generation).
- **CSV Parsing**: Papaparse / csv-parse.
- **Output**: Shopify-compliant `.csv`.

---

## 🚀 Usage

1. Open the app in the browser.
2. Upload the four required CSV files.
3. Click **Generate Output**.
4. Download the `Output.csv`.
5. Validate against `Output Test.csv` for QA.
6. Import into Shopify.

---

## 🔍 Debugging & Testing

- Run the validator script (if included) to check: counts, order, titles, tags, and field compliance.
- Compare random rows manually with `Output Test.csv`.
- Use the **client’s checklist** as the source of truth.

---

## 📜 License

Proprietary; not for public distribution.

---
