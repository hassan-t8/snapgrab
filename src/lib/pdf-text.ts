/**
 * Text helpers for PDFs drawn with pdf-lib's standard fonts (Helvetica / Times), which only cover
 * WinAnsi. Same rules as the CV Maker: unsupported characters are replaced so a build never throws,
 * and text is word-wrapped by measured width.
 */
import type { PDFFont } from "pdf-lib";

const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

/** Common characters outside WinAnsi, keyed by code point, with readable stand-ins. */
const PDF_REPLACE = new Map<number, string>([
  [0x20a8, "Rs"], // rupee sign
  [0x20b9, "Rs"], // Indian rupee sign
  [0x2010, "-"], // hyphens & minus
  [0x2011, "-"],
  [0x2012, "-"],
  [0x2015, "-"],
  [0x2212, "-"],
  [0x2032, "'"], // primes
  [0x2033, '"'],
  [0x2192, "->"], // arrows
  [0x2190, "<-"],
  [0x2264, "<="],
  [0x2265, ">="],
  [0x2713, "v"], // check marks
  [0x2714, "v"],
  [0x00a0, " "], // no-break space
]);

const isWinAnsi = (c: number, ch: string) => (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || WIN_ANSI_EXTRA.includes(ch);

/** Make any user text drawable with the standard fonts so the PDF build never throws. */
export function pdfSafe(input: string): string {
  let out = "";
  for (const ch of input) {
    const c = ch.codePointAt(0) ?? 0;
    const rep = PDF_REPLACE.get(c);
    if (rep !== undefined) {
      out += rep;
      continue;
    }
    if (c === 9) {
      out += "    ";
      continue;
    }
    if (isWinAnsi(c, ch)) {
      out += ch;
      continue;
    }
    // control chars, zero-width joiners, variation selectors, BOM: drop silently
    if (c < 0x20 || (c >= 0x7f && c < 0xa0) || (c >= 0x200b && c <= 0x200f) || c === 0xfeff || (c >= 0xfe00 && c <= 0xfe0f)) continue;
    // emoji & pictographs: drop rather than litter the CV with "?"
    if (c >= 0x1f000 || (c >= 0x2600 && c <= 0x27bf) || (c >= 0x2b00 && c <= 0x2bff)) continue;
    if (c >= 0x2000 && c <= 0x200a) {
      out += " ";
      continue;
    }
    // accented Latin letters outside Latin-1 (e.g. ą, ş) → base letter
    const base = [...ch.normalize("NFKD")]
      .filter((b) => {
        const k = b.codePointAt(0) ?? 0;
        return k < 0x300 || k > 0x36f;
      })
      .join("");
    if (base && base !== ch && [...base].every((b) => isWinAnsi(b.codePointAt(0) ?? 0, b))) {
      out += base;
      continue;
    }
    out += "?";
  }
  return out;
}

/**
 * Word-wrap by measured width. `firstWidth` lets the first line be narrower (e.g. after a bold label).
 * Over-long words (URLs) are broken so nothing ever runs off the page.
 */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number, firstWidth = maxWidth): string[] {
  const width = (s: string) => font.widthOfTextAtSize(s, size);
  const lines: string[] = [];
  const limit = () => (lines.length === 0 ? firstWidth : maxWidth);
  for (const raw of text.split(/\r\n|\r|\n/)) {
    const para = pdfSafe(raw);
    const words = para.split(/ +/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (width(test) <= limit()) {
        line = test;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      let w = word;
      while (w && width(w) > limit()) {
        if (lines.length === 0 && firstWidth < maxWidth) {
          lines.push(""); // the narrow first line can't take it — start on the next line
          continue;
        }
        let n = Math.max(1, w.length - 1);
        while (n > 1 && width(w.slice(0, n)) > limit()) n--;
        lines.push(w.slice(0, n));
        w = w.slice(n);
      }
      line = w;
    }
    if (line) lines.push(line);
  }
  return lines;
}
