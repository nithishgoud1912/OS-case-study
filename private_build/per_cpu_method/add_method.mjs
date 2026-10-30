import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';

const root = 'C:/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild';
const skillDir = 'C:/Users/HP/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const runtimePython = 'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES = 'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sourcePath = path.join(root, 'finalppt.pptx');
const finalPath = path.join(root, 'output', 'Case_Study_14_Race_Conditions_Finalppt_With_Per_CPU_Method_v2.pptx');
const buildDir = path.join(root, 'private_build', 'per_cpu_method');
const previewDir = path.join(buildDir, 'candidate_previews');
const finalRenderDir = path.join(buildDir, 'final_render');
const candidatePath = path.join(buildDir, 'candidate.pptx');
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(finalRenderDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
try { await fs.access(finalPath); throw new Error(`Refusing to overwrite existing output: ${finalPath}`); }
catch (e) { if (e.code !== 'ENOENT') throw e; }

const C = {
  navy: '#17324D', ink: '#1D2B36', teal: '#087E8B', green: '#16A85B',
  slate: '#536675', line: '#CCD7DE', light: '#F2F4F6', pale: '#EDF1F5',
  white: '#FFFFFF',
};
const p = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
if (p.slides.items.length !== 20) throw new Error(`Expected 20 original slides, found ${p.slides.items.length}`);

const before = await p.inspect({
  select: '$.slides[*]',
  include: ['index', 'elements.text'],
});
const originalSignatures = before.records.map(s => (s.elements ?? []).map(e => e.text ?? '').join('\n'));

function addShape(slide, name, geometry, x, y, w, h, fill='none', lineFill='none', lineWidth=0) {
  return slide.shapes.add({
    geometry, name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
}
function addText(slide, name, text, x, y, w, h, opts={}) {
  const sh = addShape(slide, name, 'textbox', x, y, w, h, opts.fill ?? 'none', opts.line ?? 'none', opts.lineWidth ?? 0);
  sh.text = text;
  sh.text.style = {
    typeface: opts.font ?? 'Arial',
    fontSize: opts.size ?? 24,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    alignment: opts.align ?? 'left',
    verticalAlignment: opts.valign ?? 'top',
    autoFit: 'shrinkText',
    wrap: 'square',
    insets: opts.insets ?? 0,
  };
  return sh;
}
function addBase(title, page, notes) {
  const slide = p.slides.add();
  slide.background.fill = C.white;
  addText(slide, `title-${page}`, title, 72, 42, 1136, 92, { size: 42, color: C.navy, bold: true, valign: 'middle' });
  addText(slide, `page-${page}`, String(page), 1152, 673, 56, 25, { size: 17, color: '#66727E', align: 'right', valign: 'middle' });
  slide.speakerNotes.text = notes;
  return slide;
}
function styleTable(table, rows, cols, headerSize=21, bodySize=20) {
  table.borders.assign({ style: 'solid', fill: '#D2DBE4', width: 1 });
  for (let r = 0; r < rows; r++) {
    if (table.rows[r]) table.rows[r].height = r === 0 ? 54 : (rows === 5 ? 66 : 66);
    for (let c = 0; c < cols; c++) {
      const cell = table.getCell(r, c);
      cell.fill = r === 0 ? C.pale : (r % 2 === 0 ? '#F8FAFC' : C.white);
      cell.text.style = {
        typeface: 'Arial',
        fontSize: r === 0 ? headerSize : bodySize,
        color: C.ink,
        bold: r === 0,
        alignment: 'left',
        verticalAlignment: 'middle',
        autoFit: 'shrinkText',
        wrap: 'square',
        insets: { top: 8, right: 10, bottom: 8, left: 10 },
      };
    }
  }
}

// Slide 21 — explain how the new method changes the allocator organization.
{
  const slide = addBase(
    '9. Additional Method — Per-CPU Free Lists',
    21,
    'This section expands the per-CPU free-list idea named on slide 20. Source: xv6-riscv/kernel/kalloc.c. Each list operation remains protected by its own xv6 spinlock.',
  );
  addText(slide, 's21-lead',
    'Each CPU uses its own locked free list for the common allocation path.',
    72, 154, 1136, 48, { size: 27, color: C.ink });
  const table = slide.tables.add({
    rows: 5, columns: 3, left: 72, top: 224, width: 1136, height: 330,
    columnWidths: [210, 436, 490],
    values: [
      ['Design', 'Global spinlock', 'Per-CPU free lists'],
      ['Page storage', 'One shared list', 'One list for each CPU'],
      ['Normal allocation', 'All CPUs contend for one lock', 'Pop from the current CPU list'],
      ['When a list is empty', 'Not applicable', 'Check donor lists under their locks'],
      ['Trade-off', 'Simple; one lock can be contended', 'Less local contention; more balancing code'],
    ],
  });
  styleTable(table, 5, 3, 20, 20);
  addText(slide, 's21-takeaway',
    'The local path avoids one global lock while preserving mutual exclusion for every list update.',
    72, 585, 1100, 52, { size: 24, color: C.green, bold: true, valign: 'middle' });
}

// Slide 22 — show the actual local critical section and fallback behavior.
{
  const slide = addBase(
    '9. Implementation — Per-CPU Allocation',
    22,
    'Source: xv6-riscv/kernel/kalloc.c. The excerpt shows the local kalloc() critical section. The production code then checks donor lists one at a time if the local list is empty. kfree() pushes to the current CPU list under the same CPU-local lock.',
  );
  addText(slide, 's22-subtitle',
    'kalloc() selects the current CPU and protects its head update.',
    72, 151, 1090, 42, { size: 25, color: C.green });
  addShape(slide, 's22-code-bg', 'rect', 72, 208, 700, 350, C.light, '#D5DDE4', 1);
  addText(slide, 's22-code',
    'push_off();\nint cpu = cpuid();\nacquire(&kmem[cpu].lock);\nr = kmem[cpu].freelist;\nif (r)\n  kmem[cpu].freelist = r->next;\nrelease(&kmem[cpu].lock);\npop_off();',
    90, 224, 666, 318, { font: 'Consolas', size: 19, color: '#17202A', valign: 'middle' });
  addText(slide, 's22-local-label', 'Local path', 820, 221, 340, 38, { size: 24, color: C.navy, bold: true });
  addText(slide, 's22-local-body',
    'A successful local pop reads and advances one list head while holding that CPU’s lock.',
    820, 268, 348, 116, { size: 23, color: C.ink });
  addText(slide, 's22-fallback-label', 'Empty local list', 820, 405, 340, 38, { size: 24, color: C.navy, bold: true });
  addText(slide, 's22-fallback-body',
    'kalloc() checks other CPUs one at a time and removes a page under the donor lock.',
    820, 452, 348, 100, { size: 23, color: C.ink });
  addText(slide, 's22-source', 'Source: xv6-riscv/kernel/kalloc.c', 72, 600, 960, 34, { size: 18, color: C.slate });
}

// Slide 23 — show the deterministic test setup and keep evidence status explicit.
{
  const slide = addBase(
    '9. Demonstration — Per-CPU Case',
    23,
    'Source: xv6-riscv/kernel/racecheck.c and xv6-riscv/user/racetest.c. This table shows the updated test mode’s starting lists and expected local pops. The saved QEMU evidence predates this mode. The test case does not exercise production donor stealing because both workers start with a nonempty local list.',
  );
  addText(slide, 's23-lead',
    'The added racetest mode gives each pinned hart a separate local list.',
    72, 151, 1136, 44, { size: 25, color: C.ink });
  const table = slide.tables.add({
    rows: 3, columns: 4, left: 72, top: 220, width: 1136, height: 210,
    columnWidths: [150, 350, 265, 371],
    values: [
      ['Hart', 'Starting test list', 'Page returned', 'List after pop'],
      ['CPU 0', 'P0 → P2', 'P0', 'P2'],
      ['CPU 1', 'P1', 'P1', 'EMPTY'],
    ],
  });
  styleTable(table, 3, 4, 21, 23);
  addText(slide, 's23-audit-label', 'Expected ownership audit', 72, 465, 430, 38, { size: 24, color: C.navy, bold: true });
  addText(slide, 's23-audit',
    'P0, P1 and P2 each appear exactly once across the two allocations and the remaining local list. No page is returned twice.',
    72, 508, 1110, 58, { size: 22, color: C.green, bold: true });
  addText(slide, 's23-evidence-note',
    'Expected from the updated source; the saved QEMU capture does not yet include this case.',
    72, 601, 1080, 32, { size: 17, color: C.slate });
}

if (p.slides.items.length !== 23) throw new Error(`Expected 23 slides after adding the method, got ${p.slides.items.length}`);
const after = await p.inspect({ select: '$.slides[*]', include: ['index', 'elements.text'] });
const afterSignatures = after.records.map(s => (s.elements ?? []).map(e => e.text ?? '').join('\n'));
for (let i = 0; i < originalSignatures.length; i++) {
  if (originalSignatures[i] !== afterSignatures[i])
    throw new Error(`Original slide ${i + 1} changed while adding the new section`);
}
for (let i = 20; i < 23; i++) {
  const png = await p.export({ slide: p.slides.items[i], format: 'png', scale: 1 });
  await fs.writeFile(path.join(previewDir, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}
const candidateMontage = await p.export({ format: 'webp', montage: true, scale: 0.32 });
await fs.writeFile(path.join(previewDir, 'montage.webp'), new Uint8Array(await candidateMontage.arrayBuffer()));
await (await PresentationFile.exportPptx(p)).save(candidatePath);

const sourceSha256 = createHash('sha256').update(await fs.readFile(sourcePath)).digest('hex');
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const result = await finalizePresentation({
  explicitTotalSlideCount: 23,
  requiredNativeTableOwnerSlides: [21, 23],
  requiredNativeChartOwnerSlides: [],
  workspaceDir: root,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: [
    '--expected-slide-size-emu', '12192000,6858000',
    '--validate-bullet-geometry',
    '--validate-heading-fit',
    '--require-native-table-slide', '21',
    '--require-native-table-slide', '23',
  ],
  fontPolicy: {
    basis: 'reference',
    families: ['Arial', 'Consolas'],
    referencePath: sourcePath,
    referenceSha256: sourceSha256,
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, 'validation_v2.json'),
});

const final = await PresentationFile.importPptx(await FileBlob.load(finalPath));
if (final.slides.items.length !== 23) throw new Error('Final PPTX did not import with 23 slides');
const finalContent = await final.inspect({ select: '$.slides[*]', include: ['index', 'elements.text'] });
const finalSignatures = finalContent.records.map(s => (s.elements ?? []).map(e => e.text ?? '').join('\n'));
for (let i = 0; i < 20; i++) {
  if (originalSignatures[i] !== finalSignatures[i])
    throw new Error(`Final PPTX content differs on original slide ${i + 1}`);
}
for (let i = 0; i < final.slides.items.length; i++) {
  const png = await final.export({ slide: final.slides.items[i], format: 'png', scale: 1 });
  await fs.writeFile(path.join(finalRenderDir, `slide-${String(i + 1).padStart(2, '0')}.png`), new Uint8Array(await png.arrayBuffer()));
}
const finalMontage = await final.export({ format: 'webp', montage: true, scale: 0.32 });
await fs.writeFile(path.join(finalRenderDir, 'montage.webp'), new Uint8Array(await finalMontage.arrayBuffer()));
console.log(JSON.stringify({
  finalPath,
  slideCount: final.slides.items.length,
  originalSlidesTextPreserved: true,
  validation: result,
  previews: previewDir,
  finalRenders: finalRenderDir,
}, null, 2));


