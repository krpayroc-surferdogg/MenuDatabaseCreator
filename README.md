# Menu2onePOS

Extract a PDF image/text of a restaurant menu and export a structured Excel workbook aligned to onePOS menu programming workflow.

## Quick Start
```bash
npm i
npm run dev
```
Then open http://localhost:3000

## What you get
- PDF text extraction via `pdfjs-dist` (basic)
- Simple heuristics to parse `SECTION • Item … Price` lines
- Excel export via `xlsx` with worksheets:
  - `Items` – core item list with placeholders for SalesDept/Category, ItemType, Course, taxes, routing
  - `Screen_Groups` – define on-screen groups (incl. IsModifier/IsSide)
  - `Item_Links` – map items to modifier/side screens with Force / Multiple / BaseCharge flags
  - `Sales` – departments & categories
  - `Price_Levels` – price level names and notes

## Next steps
- Add OCR fallback for scanned PDFs (Tesseract.js)
- Add visual line-editor to fix parser mistakes
- Add timed pricing and dining-area specific price logic
- Add printer routing and KDS mapping editors
- Optional: serverless endpoint to pre-process PDFs
