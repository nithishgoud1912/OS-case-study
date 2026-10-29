import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const workspaceDir = process.cwd();
const rebuildDir = path.join(workspaceDir, 'case_study_14_rebuild');
const skillDir = 'C:/Users/HP/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const runtimePython = 'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES = 'C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sourcePath = path.join(rebuildDir, 'Case_Study_14_Race_Conditions_xv6_Updated.pptx');
const referencePath = path.join(rebuildDir, 'osCase_Study_14_Race_Conditions_xv6_Final_v13.pptx');
const buildDir = path.join(rebuildDir, 'private_build', 'updated_formatted');
const previewDir = path.join(buildDir, 'candidate_previews');
const finalPath = path.join(rebuildDir, 'output', 'Case_Study_14_Race_Conditions_xv6_Updated_Formatted.pptx');
const candidatePath = path.join(buildDir, 'candidate.pptx');
await fs.mkdir(previewDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
async function writeBlob(target, blob) { await fs.writeFile(target, new Uint8Array(await blob.arrayBuffer())); }
function getShape(slide, name) { const shape = slide.shapes.items.find(item => item.name === name); if (!shape) throw new Error(`Missing ${name} on slide`); return shape; }
function setPosition(shape, left, top, width, height) { shape.position = { left, top, width, height }; }
const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
if (presentation.slides.items.length !== 20) throw new Error(`Expected 20 source slides, found ${presentation.slides.items.length}`);
{
  const slide = presentation.slides.items[0];
  const caseTitle = getShape(slide, 'TextBox 1');
  caseTitle.text.style = { fontSize: 56, typeface: 'Arial', color: '#12304A', bold: true, alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
  setPosition(caseTitle, 72, 112, 1136, 76);
  const subject = getShape(slide, 'TextBox 2');
  subject.text.style = { fontSize: 51, typeface: 'Arial', color: '#12304A', bold: true, alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
  setPosition(subject, 72, 190, 1136, 82);
  const subtitle = getShape(slide, 'TextBox 3');
  subtitle.text.style = { fontSize: 28, typeface: 'Arial', color: '#53616E', alignment: 'left', verticalAlignment: 'top', autoFit: 'shrinkText', insets: 0 };
  setPosition(subtitle, 72, 326, 1050, 90);
  const platform = getShape(slide, 'TextBox 4');
  platform.text.style = { fontSize: 22, typeface: 'Arial', color: '#53616E', alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
  setPosition(platform, 72, 594, 1136, 40);
  getShape(slide, 'Rectangle 5').text = '';
}
for (let i = 1; i < presentation.slides.items.length; i++) {
  const slide = presentation.slides.items[i];
  const title = slide.shapes.items.find(item => item.name === 'Rectangle 1');
  if (title) {
    title.text.style = { fontSize: 42, typeface: 'Arial', color: '#12304A', bold: true, alignment: 'left', verticalAlignment: 'top', autoFit: 'shrinkText', wrap: 'square', insets: 0 };
    setPosition(title, 72, 42, 1136, 92);
  }
  const page = slide.shapes.items.find(item => item.name === 'Rectangle 2');
  if (page) {
    page.text.style = { fontSize: 17, typeface: 'Arial', color: '#66727E', alignment: 'right', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
    setPosition(page, 1152, 673, 56, 25);
  }
}
{
  const slide = presentation.slides.items[4];
  for (const [name, top] of [['Rectangle 3', 160], ['Rectangle 4', 216], ['Rectangle 5', 272]]) setPosition(getShape(slide, name), 72, top, 1136, 46);
  setPosition(getShape(slide, 'TextBox 6'), 72, 340, 1136, 34);
  const table = slide.tables.items[0];
  table.position = { left: 72, top: 381, width: 1136, height: 234 };
  for (let r = 0; r < 4; r++) table.rows[r].height = 58.5;
}
{
  const slide = presentation.slides.items[7];
  const nodes = [
    ['racetest.c (user)', 'Calls raceinit() to reset the test list'],
    ['fork() × 2', 'Creates two child processes (one per CPU)'],
    ['raceworker(id)', 'Each child enters the kernel and pops from the test list'],
    ['wait() × 2', 'Parent waits for both children to finish'],
    ['racereport()', 'Kernel audits and prints the results'],
  ];
  const xs = [72, 302, 532, 762, 992];
  for (let i = 0; i < nodes.length; i++) {
    const shape = getShape(slide, `Rectangle ${i + 3}`);
    shape.text = `${nodes[i][0]}\n${nodes[i][1]}`;
    shape.geometry = 'rect'; shape.fill = '#F0F2F4';
    shape.line = { style: 'solid', fill: '#647B92', width: 2 };
    shape.text.style = { fontSize: 18.5, typeface: 'Arial', color: '#12304A', bold: true, alignment: 'center', verticalAlignment: 'middle', autoFit: 'shrinkText', wrap: 'square', insets: { top: 12, right: 9, bottom: 12, left: 9 } };
    setPosition(shape, xs[i], 198, 200, 142);
  }
  for (let i = 0; i < 4; i++) slide.shapes.add({
    geometry: 'textbox', name: `Workflow arrow ${i + 1}`,
    position: { left: 275 + i * 230, top: 252, width: 27, height: 34 },
    fill: 'none', line: { style: 'solid', fill: 'none', width: 0 },
    text: { text: '→', style: { fontSize: 25, typeface: 'Arial', color: '#647B92', bold: true, alignment: 'center', verticalAlignment: 'middle', insets: 0 } },
  });
  const repeat = getShape(slide, 'Rectangle 8');
  repeat.text = 'Repeat the SPINLOCK case with a fresh list';
  repeat.text.style = { fontSize: 24, typeface: 'Arial', color: '#17202A', bold: true, alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
  setPosition(repeat, 72, 390, 1136, 44);
  const note = getShape(slide, 'Rectangle 9');
  note.text.style = { fontSize: 20, typeface: 'Arial', color: '#53616E', alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', insets: 0 };
  setPosition(note, 72, 634, 1020, 34);
}
{
  const slide = presentation.slides.items[19];
  [160, 211, 262, 313].forEach((top, i) => setPosition(getShape(slide, `Rectangle ${i + 3}`), 72, top, 1136, 43));
  setPosition(getShape(slide, 'TextBox 7'), 72, 366, 1136, 34);
  const table = slide.tables.items[0];
  table.position = { left: 72, top: 407, width: 1136, height: 174 };
  for (let r = 0; r < 4; r++) table.rows[r].height = 43.5;
  setPosition(getShape(slide, 'Rectangle 9'), 72, 605, 1020, 42);
}
{
  const code = getShape(presentation.slides.items[8], 'Rectangle 4');
  code.text = 'acquire(&kmem.lock);           // Step 1: Acquire the lock\nr = kmem.freelist;             // Step 2: Read the head pointer\nif (r)\n    kmem.freelist = r->next;   // Step 3: Advance the head\nrelease(&kmem.lock);           // Step 4: Release the lock';
  code.text.style = { fontSize: 17.33, typeface: 'Consolas', color: '#17202A', alignment: 'left', verticalAlignment: 'middle', autoFit: 'shrinkText', wrap: 'square', insets: { top: 6, right: 9.6, bottom: 4.8, left: 12 } };
}
const tableSpecs = [
  { slideIndex: 4, rows: 4, cols: 3, header: 24, body: 22.5 },
  { slideIndex: 11, rows: 6, cols: 3, header: 24, body: 23 },
  { slideIndex: 13, rows: 9, cols: 3, header: 21.5, body: 20 },
  { slideIndex: 17, rows: 8, cols: 3, header: 22, body: 20.5 },
  { slideIndex: 19, rows: 4, cols: 3, header: 22, body: 21 },
];
for (const spec of tableSpecs) {
  const table = presentation.slides.items[spec.slideIndex].tables.items[0];
  if (!table) throw new Error(`Missing table on slide ${spec.slideIndex + 1}`);
  table.borders.assign({ style: 'solid', fill: '#D2DBE4', width: 1 });
  for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) {
    const cell = table.getCell(r, c);
    cell.fill = r === 0 ? '#EDF1F5' : (r % 2 === 0 ? '#F8FAFC' : '#FFFFFF');
    cell.text.style = { fontSize: r === 0 ? spec.header : spec.body, typeface: 'Arial', color: '#17202A', bold: r === 0, alignment: 'left', verticalAlignment: 'middle' };
  }
}
for (let i = 0; i < presentation.slides.items.length; i++) {
  await writeBlob(path.join(previewDir, `slide-${String(i + 1).padStart(2, '0')}.png`), await presentation.export({ slide: presentation.slides.items[i], format: 'png', scale: 1 }));
}
await writeBlob(path.join(previewDir, 'montage.webp'), await presentation.export({ format: 'webp', montage: true, scale: 0.4 }));
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
const { finalizePresentation } = await import(pathToFileURL(path.join(skillDir, 'container_tools/artifact_tool_utils.mjs')).href);
const referenceSha256 = createHash('sha256').update(await fs.readFile(referencePath)).digest('hex');
const tableOwners = [5, 12, 14, 18, 20];
const result = await finalizePresentation({
  explicitTotalSlideCount: 20,
  requiredNativeTableOwnerSlides: tableOwners,
  requiredNativeChartOwnerSlides: [],
  workspaceDir: rebuildDir,
  candidatePath,
  finalPath,
  pythonExecutable: runtimePython,
  integrityValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_package_integrity.py'),
  layoutValidatorPath: path.join(skillDir, 'container_tools/inspect_presentation_layout_geometry.py'),
  layoutArgs: ['--expected-slide-size-emu', '12192000,6858000', '--validate-bullet-geometry', '--validate-heading-fit', ...tableOwners.flatMap(number => ['--require-native-table-slide', String(number)])],
  fontPolicy: { basis: 'design', families: ['Arial', 'Consolas'] },
  verifyArtifactToolImport: true,
  receiptPath: path.join(buildDir, 'validation.json'),
});
console.log(JSON.stringify({ finalPath, candidatePath, validation: result }, null, 2));




