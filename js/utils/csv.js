/**
 * Exportação de dados para CSV
 */

export function rowsToCSV(rows, columns) {
  const header = columns.map((c) => c.label).join(';');
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        let val = row[c.key];
        if (val === null || val === undefined) val = '';
        val = String(val).replace(/"/g, '""');
        if (val.includes(';') || val.includes('"') || val.includes('\n')) {
          return `"${val}"`;
        }
        return val;
      })
      .join(';')
  );
  return '\uFEFF' + [header, ...lines].join('\n');
}

export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
