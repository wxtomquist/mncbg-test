// csv-parser.js — RFC 4180-style CSV parsing for APN beverage data
(function (global) {
  'use strict';

  function parse(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;
    const input = String(text || '').replace(/^\uFEFF/, '');

    for (let i = 0; i < input.length; i++) {
      const ch = input[i];

      if (inQuotes) {
        if (ch === '"') {
          if (input[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += ch;
        }
        continue;
      }

      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (ch !== '\r') {
        field += ch;
      }
    }

    if (field.length || row.length) {
      row.push(field);
      rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .trim()
      .toLowerCase();
  }

  function headerMap(headerRow) {
    const map = Object.create(null);
    (headerRow || []).forEach((header, index) => {
      map[normalizeHeader(header)] = index;
    });
    return map;
  }

  function value(row, map, names, fallbackIndex) {
    const candidates = Array.isArray(names) ? names : [names];
    let index;

    for (const name of candidates) {
      const key = normalizeHeader(name);
      if (Object.prototype.hasOwnProperty.call(map, key)) {
        index = map[key];
        break;
      }
    }

    if (index === undefined) index = fallbackIndex;
    return String((row || [])[index] ?? '').trim();
  }

  global.APNCsv = { parse, headerMap, value };
})(window);
