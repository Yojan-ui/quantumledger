import "server-only";
/**
 * A tiny PDF writer for text reports: PDF 1.4, the built-in Courier font, A4, 60 lines a page, as
 * many pages as needed. No library: the report is lines of text, which is all this does.
 */
const esc = (s: string) =>
  s
    .replace(/[‐-―]/g, "-")
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/[\\()]/g, (c) => `\\${c}`);

export function textPdf(lines: string[]): Buffer {
  const PER_PAGE = 60;
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(1, lines.length); i += PER_PAGE)
    pages.push(lines.slice(i, i + PER_PAGE));
  const objs: string[] = [];
  const add = (body: string) => objs.push(body) - 1 + 1; // 1-based object number
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");
  const kids: number[] = [];
  for (const page of pages) {
    const stream = `BT /F1 9 Tf 12 TL 40 800 Td\n${page.map((l) => `(${esc(l.slice(0, 100))}) '`).join("\n")}\nET`;
    const content = add(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
    kids.push(
      add(
        `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
      ),
    );
  }
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objs[pagesObj - 1] =
    `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
