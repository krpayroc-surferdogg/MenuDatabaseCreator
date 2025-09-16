'use client';
import React, { useRef, useState } from 'react';
import { create } from 'zustand';
import * as XLSX from 'xlsx';
import { PlusCircle, FileDown, Upload } from 'lucide-react';

// Lazy import pdfjs only in browser
let pdfjsLib: any = null;
if (typeof window !== 'undefined') {
  // @ts-ignore
  pdfjsLib = require('pdfjs-dist');
  // @ts-ignore
  const worker = require('pdfjs-dist/build/pdf.worker.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker;
}

const Tesseract = typeof window !== 'undefined' ? require('tesseract.js') : null;

// --- Minimal data model
type Row = { section: string; item_name: string; description?: string; price?: string; notes?: string; };
type ExtractState = {
  rows: Row[];
  setRows: (r: Row[]) => void;
};
const useStore = create<ExtractState>((set) => ({ rows: [], setRows: (rows)=>set({rows}) }));

// --- Helpers
function parseLinesToRows(text: string): Row[] {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const rows: Row[] = [];
  let currentSection = '';
  const priceRe = /(?:^| )([$]?\d{1,3}(?:[.,]\d{2})?)(?!\S)/;

  for (const line of lines) {
    // Section heuristic: ALL CAPS and no price
    if (/^[A-Z0-9 &\-]{3,}$/.test(line) && !priceRe.test(line)) {
      currentSection = line;
      continue;
    }
    const match = line.match(priceRe);
    if (match) {
      const price = match[1];
      const before = line.slice(0, match.index).trim().replace(/\.+\s*$/, '');
      let name = before;
      let desc = '';
      // split "Name - description" or "Name: description"
      const dash = before.indexOf(' - ');
      const colon = before.indexOf(': ');
      const idx = dash >= 0 ? dash : (colon >= 0 ? colon : -1);
      if (idx >= 0) {
        name = before.slice(0, idx).trim();
        desc = before.slice(idx+2).trim();
      }
      rows.push({ section: currentSection, item_name: name, description: desc, price });
    } else {
      // Orphan line, attach as description to last row
      if (rows.length) {
        rows[rows.length-1].description = (rows[rows.length-1].description ? rows[rows.length-1].description + ' ' : '') + line;
      }
    }
  }
  return rows;
}

async function pdfToText(file: File): Promise<string> {
  if (!pdfjsLib) throw new Error('pdfjs not available');
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let aggregate = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(' ');
    aggregate += text + '\n';
  }
  // If the PDF has no text layer (likely scanned), fallback to OCR of first page
  if (aggregate.trim().length < 10 && Tesseract) {
    const page = await (await pdf.getPage(1)).render({ canvasContext: getCanvasCtx(), viewport: (await (await pdf.getPage(1))).getViewport({ scale: 2 })});
    // The above render already drew into global canvas; OCR that
  }
  return aggregate;
}

function getCanvasCtx(): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  // Stash globally for debug
  // @ts-ignore
  window.__menuCanvas = canvas;
  return ctx;
}

// Minimal Excel builder based on a data dictionary
function buildWorkbook(rows: Row[]) {
  // Define sheets
  const ws_items = XLSX.utils.json_to_sheet(rows.map((r, i) => ({
    ItemID: `ITEM-${i+1}`,
    ItemName: r.item_name,
    ShortName: r.item_name.slice(0,24),
    Section: r.section,
    Description: r.description || '',
    BasePrice: r.price || '',
    SalesDept: '',
    SalesCategory: '',
    ItemType: '',
    Course: '',
    TaxProfile: '',
    KDSRoute: '',
    PrintHeaderName: '',
    LabelOnly: 'No',
    Consolidate: 'Yes',
    Nutrients: '',
    Allergens: ''
  })));
  const ws_screengroups = XLSX.utils.aoa_to_sheet([
    ['ScreenGroupID','Name','IsModifier','IsSide','HeaderName','Cols','Rows','Sort']
  ]);
  const ws_links = XLSX.utils.aoa_to_sheet([
    ['ItemID','LinkOrder','ScreenGroupID','IsModifier','IsSide','Force','MultipleSelect','BaseCharge','AutoSelect']
  ]);
  const ws_sales = XLSX.utils.aoa_to_sheet([['SalesDepartment','SalesCategory']]);
  const ws_pricelevels = XLSX.utils.aoa_to_sheet([['PriceLevelName','Notes']]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws_items, 'Items');
  XLSX.utils.book_append_sheet(wb, ws_screengroups, 'Screen_Groups');
  XLSX.utils.book_append_sheet(wb, ws_links, 'Item_Links');
  XLSX.utils.book_append_sheet(wb, ws_sales, 'Sales');
  XLSX.utils.book_append_sheet(wb, ws_pricelevels, 'Price_Levels');
  return wb;
}

export default function MenuExtractor() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { rows, setRows } = useStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files || !files[0]) return;
    setBusy(true);
    setError(null);
    try {
      const text = await pdfToText(files[0]);
      const parsed = parseLinesToRows(text);
      setRows(parsed);
    } catch (e:any) {
      setError(e.message || 'Failed to process PDF');
    } finally {
      setBusy(false);
    }
  }

  function exportExcel() {
    const wb = buildWorkbook(rows);
    XLSX.writeFile(wb, 'onepos_menu_template.xlsx');
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Menu2onePOS</h1>
        <p className="text-slate-600">Upload a PDF menu, review extracted items, and export a structured Excel workbook ready for onePOS data entry.</p>
      </header>

      <section className="mb-6">
        <div className="border-2 border-dashed rounded-xl p-8 bg-white text-center">
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e)=>onFiles(e.target.files)} />
          <button onClick={()=>inputRef.current?.click()} className="inline-flex gap-2 items-center px-4 py-2 rounded-lg border bg-slate-100 hover:bg-slate-200">
            <Upload size={18}/> Choose a PDF Menu
          </button>
          {busy && <p className="mt-3 animate-pulse">Extracting text…</p>}
          {error && <p className="mt-3 text-red-600">{error}</p>}
        </div>
      </section>

      {!!rows.length && (
        <section className="mb-6 bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-semibold">Preview ({rows.length} items)</h2>
            <button onClick={exportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-black text-white rounded-lg">
              <FileDown size={18}/> Export Excel
            </button>
          </div>
          <div className="overflow-auto max-h-[50vh] text-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-2 border">Section</th>
                  <th className="p-2 border">Item</th>
                  <th className="p-2 border">Description</th>
                  <th className="p-2 border">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, idx) => (
                  <tr key={idx} className="odd:bg-white even:bg-slate-50">
                    <td className="p-2 border">{r.section}</td>
                    <td className="p-2 border">{r.item_name}</td>
                    <td className="p-2 border">{r.description}</td>
                    <td className="p-2 border">{r.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-slate-600">
            Tip: After export, complete SalesDept, SalesCategory, ItemType, Course, and routing details in Excel before building in onePOS.
          </p>
        </section>
      )}

      {!rows.length && (
        <div className="text-slate-500 text-sm">
          <p><strong>How it works:</strong> We attempt to read the PDF text layer. If it&#39;s a scanned image, switch to an OCR-based approach in a future update.</p>
          <ul className="list-disc pl-6 mt-2">
            <li>Heuristics detect SECTION headers and lines that end with a price.</li>
            <li>Export creates multi-sheet Excel (Items, Screen_Groups, Item_Links, Sales, Price_Levels).</li>
          </ul>
        </div>
      )}
    </main>
  );
}
