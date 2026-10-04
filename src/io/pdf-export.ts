/**
 * pdf-export — a minimal, dependency-free PDF writer that embeds a single JPEG as
 * one page. PDF natively supports JPEG (DCTDecode), so we can wrap the design's
 * raster into a valid, printable PDF with ~60 lines and no library. The page is
 * sized to the image so it prints 1:1.
 *
 * (A full vector PDF would need a big dependency; embedding a @2x JPEG is sharp,
 * tiny, and universally openable — the honest trade for "Export PDF".)
 */

export function pdfFromJpeg(jpeg: Uint8Array, imgW: number, imgH: number): Uint8Array {
  // Page size in PDF points (72dpi). Assume the raster is @2x, so halve to CSS px.
  const pageW = imgW / 2;
  const pageH = imgH / 2;

  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    parts.push(bytes);
    length += bytes.length;
  };
  const obj = (n: number, body: string) => { offsets[n] = length; push(`${n} 0 obj\n${body}\nendobj\n`); };

  push("%PDF-1.4\n%\xff\xff\xff\xff\n");

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] ` +
         `/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);

  // image XObject (JPEG = DCTDecode)
  offsets[4] = length;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
       `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg);
  push("\nendstream\nendobj\n");

  // content stream: draw the image to fill the page
  const content = `q\n${pageW.toFixed(2)} 0 0 ${pageH.toFixed(2)} 0 0 cm\n/Im0 Do\nQ\n`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}endstream`);

  // xref
  const xrefStart = length;
  const count = 6;
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let i = 1; i < count; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  push(xref);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  // concat
  const out = new Uint8Array(length);
  let p = 0;
  for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
}
