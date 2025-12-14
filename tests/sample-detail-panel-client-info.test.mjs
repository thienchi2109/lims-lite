// Regression test: Sample detail panel shows enriched client information (migrations 039/040).
// Run with: node tests/sample-detail-panel-client-info.test.mjs

import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';

const panelPath = path.join(process.cwd(), 'src', 'components', 'sample-detail-panel.tsx');
const content = await readFile(panelPath, 'utf8');

assert.ok(
  content.includes('getClientClient'),
  'SampleDetailPanel should fetch linked client info via getClientClient()'
);

for (const label of ['CCCD/CMND', 'Ngày sinh', 'Giới tính', 'Số điện thoại']) {
  assert.ok(content.includes(label), `SampleDetailPanel should display client label: ${label}`);
}

console.log('✓ sample detail panel displays enriched client info');

