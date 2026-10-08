/*
 * Tables — paste CSV straight in (easiest), or give columns + rows.
 *
 *   { type: 'table', title, date, project, keywords, csv: `Col A,Col B\n1,2` }
 *   { type: 'table', title, columns: ['A','B'], rows: [[1,2],[3,4]] }
 *   { type: 'table', title, rows: [{A:1,B:2}, …] }            // objects work too
 *
 * Every table is analysed automatically: totals, averages, peaks, trends,
 * category shares, outliers and empty cells. Numbers like "$12,400", "38%",
 * "1.2K" are understood.
 */

Metis.add(
);
