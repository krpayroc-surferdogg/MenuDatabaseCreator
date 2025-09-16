import "./globals.css";
export const metadata = {
  title: "Menu2onePOS",
  description: "Extract a PDF menu and export a onePOS-ready Excel workbook"
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
