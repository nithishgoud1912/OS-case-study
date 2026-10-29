import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const root=process.cwd();
const file=path.join(root,'case_study_14_rebuild','output','Case_Study_14_Race_Conditions_xv6_Updated_Formatted_Workflows.pptx');
const dir=path.join(root,'case_study_14_rebuild','private_build','updated_workflows','final_render');
const p=await PresentationFile.importPptx(await FileBlob.load(file));
for(let i=0;i<p.slides.items.length;i++){
 const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(path.join(dir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await b.arrayBuffer()));
}
const m=await p.export({format:'webp',montage:true,scale:0.4});
await fs.writeFile(path.join(dir,'montage.webp'),new Uint8Array(await m.arrayBuffer()));
const q=await p.inspect({select:'$.slides[*]',include:['id','index','layout','title','elements.id','elements.kind','elements.name','elements.text','elements.position','elements.style','notes.text'],fileName:'workflows-final.ndjson'});
await fs.writeFile(path.join(dir,'workflows-final.ndjson'),q.ndjson,'utf8');
console.log(JSON.stringify({slideCount:p.slides.items.length,renderDirectory:dir,inspectRecordCount:q.recordCount},null,2));
