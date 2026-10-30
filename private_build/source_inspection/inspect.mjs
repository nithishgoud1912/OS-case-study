import fs from 'node:fs/promises';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const root = 'C:/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild';
const source = `${root}/finalppt.pptx`;
const out = `${root}/private_build/source_inspection`;
const p = await PresentationFile.importPptx(await FileBlob.load(source));
console.log('SLIDES', p.slides.items.length);
const snap = await p.inspect({select:'$.slides[*]',include:['index','title','layout','elements.text','elements.kind','elements.position'],fileName:'source-inspect.ndjson'});
await fs.writeFile(`${out}/source-inspect.ndjson`, snap.ndjson, 'utf8');
for (let i=0; i<p.slides.items.length; i++) {
 const png = await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(`${out}/slide-${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await png.arrayBuffer()));
}
const montage=await p.export({format:'webp',montage:true,scale:0.32});
await fs.writeFile(`${out}/montage.webp`,new Uint8Array(await montage.arrayBuffer()));
console.log('Rendered',p.slides.items.length,'slides');
