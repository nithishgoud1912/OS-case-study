import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const pptxPath = 'C:/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild/output/Case_Study_14_Race_Condition_Presentation.pptx';
const outDir = 'C:/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild/private_build/final-render';
const deck = await PresentationFile.importPptx(await FileBlob.load(pptxPath));
for (let i=0;i<deck.slides.items.length;i++) {
  const slide = deck.slides.items[i];
  const blob = await deck.export({ slide, format: 'png', scale: 1 });
  await fs.writeFile(`${outDir}/slide-${String(i+1).padStart(2,'0')}.png`, new Uint8Array(await blob.arrayBuffer()));
}
console.log(`Rendered ${deck.slides.items.length} final slides from ${pptxPath}`);
