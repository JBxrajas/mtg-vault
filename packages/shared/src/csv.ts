/**
 * Minimal RFC 4180 CSV reader: quoted fields, doubled quotes, commas and line breaks inside
 * quotes, CRLF or LF, a leading byte-order mark. Blank lines are skipped. Returns the rows as
 * arrays of strings (no header handling).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    // A line with a single empty field is a blank line.
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
    row = [];
  };

  for (; i < text.length; i++) {
    const c = text[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"' && field === "") {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\r") {
      if (text[i + 1] === "\n") i++;
      endRow();
    } else if (c === "\n") {
      endRow();
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

/** Quotes a field when it holds a comma, a quote or a line break. */
const csvField = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Writes rows as RFC 4180 CSV (CRLF line breaks, no trailing break). The reverse of `parseCsv`. */
export function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvField).join(",")).join("\r\n");
}
