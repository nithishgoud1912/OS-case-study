import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const ROOT = 'C:/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild';
const SKILL_DIR = 'C:/Users/HP/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const RUNTIME_PYTHON = 'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const PRIVATE = path.join(ROOT, 'private_build');
const OUTPUT = path.join(ROOT, 'output');
const FONT = 'Arial';
const C = {
  navy: '#17324D', ink: '#1D2B36', teal: '#087E8B', aqua: '#DDF1F2',
  paper: '#F7F9FA', white: '#FFFFFF', slate: '#536675', line: '#CCD7DE',
  coral: '#C84C4C', paleCoral: '#F8E8E6', paleGreen: '#E6F3EC', green: '#1F7A4D',
  gold: '#E5B54A', terminal: '#101820', terminalText: '#E7F0F3', terminalGreen: '#8FE3B0'
};
const W = 1280, H = 720;

function addShape(slide, name, geometry, x, y, w, h, fill='none', lineFill='none', lineWidth=0) {
  return slide.shapes.add({
    geometry, name,
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: 'solid', fill: lineFill, width: lineWidth },
  });
}
function addText(slide, name, text, x, y, w, h, opts={}) {
  const sh = addShape(slide, name, 'textbox', x, y, w, h, opts.boxFill ?? 'none', opts.lineFill ?? 'none', opts.lineWidth ?? 0);
  sh.text = text;
  sh.text.style = {
    typeface: opts.font ?? FONT,
    fontSize: opts.size ?? 22,
    color: opts.color ?? C.ink,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    alignment: opts.align ?? 'left',
    verticalAlignment: opts.valign ?? 'top',
    autoFit: 'shrinkText',
    wrap: 'square',
    insets: opts.insets ?? 0,
  };
  return sh;
}
function addCode(slide, name, text, x, y, w, h, opts={}) {
  addShape(slide, `${name}-background`, 'rect', x, y, w, h, opts.fill ?? C.navy, opts.line ?? 'none', opts.lineWidth ?? 0);
  return addText(slide, `${name}-text`, text, x + 20, y + 16, w - 40, h - 32, {
    font: 'Consolas', size: opts.size ?? 20, color: opts.color ?? C.white,
    valign: 'middle', insets: 0,
  });
}
function addBase(title, page, notes) {
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  addShape(slide, `accent-${page}`, 'rect', 62, 60, 7, 48, C.teal);
  addText(slide, `title-${page}`, title, 88, 54, 1120, 62, { size: 42, color: C.navy, bold: true, valign: 'middle' });
  addShape(slide, `footer-line-${page}`, 'rect', 64, 662, 1152, 1, C.line);
  addText(slide, `footer-label-${page}`, 'CASE STUDY 14  |  OPERATING SYSTEMS', 64, 675, 600, 18, { size: 13, color: C.slate, bold: true, valign: 'middle' });
  addText(slide, `footer-page-${page}`, String(page).padStart(2, '0'), 1150, 675, 66, 18, { size: 13, color: C.slate, align: 'right', valign: 'middle' });
  slide.speakerNotes.text = notes;
  return slide;
}
function addSimpleList(slide, entries, x, y, w, lineGap=82) {
  entries.forEach((item, i) => {
    const yy = y + i * lineGap;
    addShape(slide, `list-mark-${i}-${yy}`, 'rect', x, yy + 7, 6, 42, C.teal);
    addText(slide, `list-text-${i}-${yy}`, item, x + 24, yy, w - 24, 58, { size: 23, color: C.ink });
  });
}
function styleTable(table, rows, cols, opts={}) {
  table.borders.assign({ style: 'solid', fill: C.line, width: 1 });
  for (let r=0; r<rows; r++) {
    if (table.rows?.[r]) table.rows[r].height = opts.rowHeights?.[r] ?? (r === 0 ? 58 : 64);
    for (let c=0; c<cols; c++) {
      const cell = table.getCell(r,c);
      cell.fill = r === 0 ? C.navy : (r % 2 === 0 ? C.white : '#EEF3F5');
      cell.text.style = {
        typeface: FONT,
        fontSize: r === 0 ? (opts.headerSize ?? 18) : (opts.bodySize ?? 17),
        color: r === 0 ? C.white : C.ink,
        bold: r === 0,
        verticalAlignment: 'middle',
        autoFit: 'shrinkText',
        wrap: 'square',
        insets: { top: 7, right: 9, bottom: 7, left: 9 },
      };
    }
  }
}

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.navy;
  addShape(slide, 'cover-accent', 'rect', 70, 116, 8, 396, C.teal);
  addText(slide, 'cover-kicker', 'CASE STUDY 14', 108, 116, 560, 32, { size: 22, color: '#8FE3E8', bold: true });
  addText(slide, 'cover-title', 'Race Condition in\nxv6 Shared Data', 108, 170, 695, 178, { size: 62, color: C.white, bold: true });
  addText(slide, 'cover-subtitle', 'A runnable free-list example\nRace reproduced, spinlock applied', 110, 376, 670, 74, { size: 27, color: '#DDE8EC' });
  addText(slide, 'cover-institution', 'Operating Systems  |  Department of CSE\nChaitanya Bharathi Institute of Technology', 110, 506, 690, 58, { size: 18, color: '#C2D2DA' });
  addText(slide, 'cover-team', 'L Nithish Kumar Goud  |  G Ishan  |  Santhosh  |  Venkat', 110, 586, 1050, 32, { size: 18, color: C.white });
  // Editable data-structure motif: three pages in the xv6 free list.
  addText(slide, 'cover-head-label', 'freelist', 850, 264, 290, 28, { size: 18, color: '#8FE3E8', bold: true, align: 'center' });
  for (let i=0; i<3; i++) {
    const x = 835 + i*125;
    addShape(slide, `cover-page-${i}`, 'rect', x, 310, 92, 68, i===0 ? C.teal : '#294B66', '#88B3C2', 2);
    addText(slide, `cover-page-label-${i}`, `P${i}`, x, 327, 92, 36, { size: 25, color: C.white, bold: true, align: 'center', valign: 'middle' });
    if (i<2) addShape(slide, `cover-link-${i}`, 'rect', x+92, 341, 33, 4, '#88B3C2');
  }
  addText(slide, 'cover-note', 'shared physical-page list', 830, 402, 405, 26, { size: 17, color: '#C2D2DA', align: 'center' });
  slide.speakerNotes.text = 'Open with the selected shared structure. The free-list motif is an editable illustration. Team names come from the supplied case-study materials.';
}

// 2. Assignment focus
{
  const slide = addBase('Assignment focus: one shared list, one lock', 2,
    'Source: Case Study 14 assignment brief supplied by the user. The project narrows the demonstration to the physical-page free list and one synchronization method, a spinlock.');
  addText(slide, 's2-lead', 'The question is whether two CPUs can update the same free-list head at once.', 86, 148, 1085, 70, { size: 31, color: C.navy, bold: true });
  addShape(slide, 's2-divider', 'rect', 640, 255, 2, 295, C.line);
  addText(slide, 's2-left-head', 'Shared data', 92, 266, 490, 40, { size: 27, color: C.teal, bold: true });
  addSimpleList(slide, [
    'xv6 physical-page free list',
    'Head pointer: kmem.freelist',
    'Operations: kalloc() and kfree()',
  ], 96, 330, 480, 65);
  addText(slide, 's2-right-head', 'Demonstration', 690, 266, 490, 40, { size: 27, color: C.teal, bold: true });
  addSimpleList(slide, [
    'Force two workers to read P0',
    'Observe the duplicate allocation',
    'Repeat the pop with a spinlock',
  ], 694, 330, 480, 65);
  addText(slide, 's2-bottom', 'Invariant: every page belongs to exactly one place: the free list or one allocation.', 92, 585, 1095, 42, { size: 22, color: C.navy, bold: true, valign: 'middle' });
}

// 3. Free list in xv6
{
  const slide = addBase('The free list must assign each page once', 3,
    'Source: local xv6-riscv kernel/kalloc.c at commit ae7cff64d1cd1153e98794d19c46235ead934cf2. kalloc() removes the head under kmem.lock; kfree() inserts under the same lock.');
  addText(slide, 's3-left-label', 'xv6 kalloc() critical section', 88, 148, 500, 34, { size: 23, color: C.teal, bold: true });
  addCode(slide, 's3-kalloc-code', 'acquire(&kmem.lock);\nr = kmem.freelist;\nif (r)\n    kmem.freelist = r->next;\nrelease(&kmem.lock);', 88, 194, 590, 300, { size: 22 });
  addText(slide, 's3-right-label', 'The allocator invariant', 732, 148, 450, 34, { size: 23, color: C.teal, bold: true });
  addText(slide, 's3-invariant', 'Each free page appears once in the list.\n\nEach allocated page has one owner.\n\nThe head read and update form one critical section.', 732, 202, 448, 250, { size: 26, color: C.ink });
  addShape(slide, 's3-note-bar', 'rect', 732, 502, 5, 75, C.gold);
  addText(slide, 's3-note', 'kfree() also holds kmem.lock while linking a page at the list head.', 756, 502, 440, 75, { size: 20, color: C.slate, valign: 'middle' });
}

// 4. Race timeline, native editable table
{
  const slide = addBase('Two stale reads can return the same page', 4,
    'Possible source-level interleaving based on xv6 kernel/kalloc.c. The sequence is illustrative. The host C demo forces this schedule; it is not a hardware trace from xv6.');
  addText(slide, 's4-sub', 'Starting list: P0 -> P1 -> P2', 90, 132, 1000, 34, { size: 23, color: C.slate, bold: true });
  const table = slide.tables.add({
    rows: 6, columns: 4, left: 80, top: 184, width: 1120, height: 390,
    columnWidths: [95, 330, 330, 365],
    values: [
      ['Step', 'CPU 0', 'CPU 1', 'Shared state'],
      ['1', 'Read head P0', '', 'Head = P0'],
      ['2', '', 'Read head P0', 'Both hold stale P0'],
      ['3', 'Store head P1', '', 'Head = P1'],
      ['4', '', 'Store head P1', 'Head remains P1'],
      ['5', 'Return P0', 'Return P0', 'P0 has two owners'],
    ],
  });
  styleTable(table, 6, 4, { bodySize: 18, headerSize: 19, rowHeights: [54, 61, 61, 61, 61, 72] });
  addText(slide, 's4-callout', 'The head moved, but both callers received the same page.', 90, 599, 1100, 34, { size: 23, color: C.coral, bold: true });
}

// 5. C demo, unlocked path
{
  const slide = addBase('The C program reproduces the bad schedule', 5,
    'Source: src/race_demo.c. The two-party pthread barrier is test instrumentation that forces both workers to read P0 before either head update. Atomic pointer loads and stores keep this user-space demonstration defined; they do not protect the full pop operation.');
  addText(slide, 's5-code-title', 'Unlocked worker: read, wait, then update', 88, 146, 1000, 36, { size: 23, color: C.teal, bold: true });
  addCode(slide, 's5-code', 'struct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);\nstruct run *next = page ? page->next : NULL;\npthread_barrier_wait(&both_cpus_loaded);\nif (page != NULL)\n    __atomic_store_n(&freelist, next, __ATOMIC_RELAXED);\nallocated[cpu] = page;', 88, 198, 1104, 254, { size: 17 });
  addText(slide, 's5-left', 'The barrier aligns the two reads.', 90, 495, 492, 54, { size: 24, color: C.navy, bold: true });
  addText(slide, 's5-right', 'The pointer operations are individually atomic. The compound pop still has no lock.', 640, 492, 540, 72, { size: 22, color: C.ink });
}

// 6. Spinlock correction
{
  const slide = addBase('A spinlock protects the complete list pop', 6,
    'Source: local xv6-riscv kernel/kalloc.c and kernel/spinlock.c at commit ae7cff64d1cd1153e98794d19c46235ead934cf2. The spinlock covers the read and head update, matching the scope of xv6 kmem.lock.');
  addText(slide, 's6-code-title', 'Corrected worker', 88, 146, 1000, 36, { size: 23, color: C.teal, bold: true });
  addCode(slide, 's6-code', 'acquire(&kmem_lock);\nstruct run *page = __atomic_load_n(&freelist, __ATOMIC_RELAXED);\nif (page != NULL)\n    __atomic_store_n(&freelist, page->next, __ATOMIC_RELAXED);\nrelease(&kmem_lock);', 88, 198, 704, 300, { size: 18 });
  addText(slide, 's6-p1', 'CPU 0 acquires the lock and advances the head from P0 to P1.', 840, 224, 340, 86, { size: 23, color: C.ink });
  addShape(slide, 's6-sep', 'rect', 840, 330, 310, 2, C.line);
  addText(slide, 's6-p2', 'CPU 1 enters after release and reads P1.', 840, 362, 340, 70, { size: 23, color: C.ink });
  addText(slide, 's6-takeaway', 'One critical section preserves one page, one owner.', 90, 548, 1070, 44, { size: 25, color: C.navy, bold: true });
}

// 7. Actual command and captured output
{
  const slide = addBase('The recorded run shows the difference', 7,
    'Source: evidence/run_output.txt. This output was captured by running make run in WSL Ubuntu 24.04 with GCC 13.3.0 on the project source.');
  addText(slide, 's7-command-label', 'Build and run', 86, 146, 220, 30, { size: 20, color: C.teal, bold: true });
  addCode(slide, 's7-command', 'make run', 86, 184, 370, 70, { size: 23 });
  addText(slide, 's7-env', 'WSL Ubuntu 24.04\nGCC 13.3.0\nTwo worker threads', 86, 288, 340, 108, { size: 21, color: C.slate });
  const output = [
    'UNLOCKED RUN',
    'read head: P0 / P0',
    'allocations: P0 / P0',
    'exactly once: 2 / 3',
    'State: INCONSISTENT',
    '',
    'SPINLOCK RUN',
    'allocations: P0 / P1',
    'exactly once: 3 / 3',
    'State: CONSISTENT',
    '',
    'DEMONSTRATION CHECK: PASS',
  ].join('\n');
  addCode(slide, 's7-output', output, 500, 146, 692, 446, { size: 20, fill: C.terminal, color: C.terminalText });
  addText(slide, 's7-output-caption', 'Selected lines from the captured console output', 500, 610, 692, 25, { size: 16, color: C.slate, italic: true });
}

// 8. Comparison, native editable table
{
  const slide = addBase('The spinlock restores the page ownership invariant', 8,
    'Source: actual run saved in evidence/run_output.txt. The comparison reports this controlled demonstration only, not a statistical estimate of arbitrary xv6 schedules.');
  const table = slide.tables.add({
    rows: 3, columns: 4, left: 76, top: 182, width: 1128, height: 228,
    columnWidths: [180, 330, 260, 358],
    values: [
      ['Mode', 'Pages returned', 'Exactly once', 'State'],
      ['Unlocked', 'P0 and P0', '2 / 3', 'INCONSISTENT'],
      ['Spinlock', 'P0 and P1', '3 / 3', 'CONSISTENT'],
    ],
  });
  styleTable(table, 3, 4, { bodySize: 20, headerSize: 19, rowHeights: [62, 78, 78] });
  addText(slide, 's8-interpretation', 'The lock changed the outcome because it covered the entire read-and-update sequence.', 86, 465, 1075, 65, { size: 27, color: C.navy, bold: true });
  addText(slide, 's8-limit', 'Scope: a controlled user-space C model. It mirrors xv6 kalloc() but does not boot or modify the xv6 kernel.', 86, 557, 1065, 54, { size: 20, color: C.slate });
}

// 9. Conclusion and references
{
  const slide = addBase('Conclusion: protect the shared update as one operation', 9,
    'Sources: Case Study 14 assignment brief supplied by the user; local xv6-riscv kernel/kalloc.c and kernel/spinlock.c at commit ae7cff64d1cd1153e98794d19c46235ead934cf2; program output evidence/run_output.txt.');
  addText(slide, 's9-conclusion', 'Two stale head reads can assign P0 twice.\n\nThe spinlock serializes the full free-list pop.\n\nThe run checks that every page appears exactly once.', 90, 156, 1070, 240, { size: 29, color: C.navy, bold: true });
  addShape(slide, 's9-rule', 'rect', 90, 438, 6, 115, C.teal);
  addText(slide, 's9-limit', 'This host-side C demonstration makes one harmful interleaving reproducible. It does not measure kernel performance or prove behavior for every schedule.', 116, 438, 1025, 112, { size: 22, color: C.ink });
  addText(slide, 's9-sources', 'Sources: xv6-riscv kernel/kalloc.c and kernel/spinlock.c, local revision ae7cff64d1cd1153e98794d19c46235ead934cf2.', 90, 584, 1095, 43, { size: 15, color: C.slate });
}

await fs.mkdir(path.join(PRIVATE, 'previews'), { recursive: true });
await fs.mkdir(OUTPUT, { recursive: true });
async function writeBlob(outPath, blob) {
  await fs.writeFile(outPath, new Uint8Array(await blob.arrayBuffer()));
}
for (let i = 0; i < presentation.slides.items.length; i++) {
  const slide = presentation.slides.items[i];
  const png = await presentation.export({ slide, format: 'png', scale: 1 });
  await writeBlob(path.join(PRIVATE, 'previews', `slide-${String(i+1).padStart(2,'0')}.png`), png);
}
const montage = await presentation.export({ format: 'webp', montage: true });
await writeBlob(path.join(PRIVATE, 'previews', 'montage.webp'), montage);
const candidatePath = path.join(PRIVATE, 'candidate.pptx');
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, 'container_tools/artifact_tool_utils.mjs'),
).href);
const finalPath = path.join(OUTPUT, 'Case_Study_14_Race_Condition_Presentation.pptx');
const result = await finalizePresentation({
  explicitTotalSlideCount: 9,
  requiredNativeTableOwnerSlides: [4, 8],
  workspaceDir: ROOT,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(SKILL_DIR, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: [
    '--expected-slide-size-emu', '12192000,6858000',
    '--validate-bullet-geometry',
    '--validate-heading-fit',
    '--require-native-table-slide', '4',
    '--require-native-table-slide', '8',
  ],
  fontPolicy: { basis: 'design', families: ['Arial', 'Consolas'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(PRIVATE, 'Case_Study_14_Presentation.final-validation.json'),
});
console.log(JSON.stringify({ finalPath, slides: presentation.slides.items.length, validation: result }, null, 2));
