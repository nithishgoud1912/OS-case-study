import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FileBlob, PresentationFile } from '@oai/artifact-tool';
const workspaceDir=process.cwd();
const rebuildDir=path.join(workspaceDir,'case_study_14_rebuild');
const skillDir='C:/Users/HP/.codex/plugins/cache/openai-primary-runtime/presentations/26.1025.11240/skills/presentations';
const runtimePython='C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES='C:/Users/HP/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sourcePath=path.join(rebuildDir,'output','Case_Study_14_Race_Conditions_xv6_Updated_Formatted.pptx');
const finalPath=path.join(rebuildDir,'output','Case_Study_14_Race_Conditions_xv6_Updated_Formatted_Workflows.pptx');
const buildDir=path.join(rebuildDir,'private_build','updated_workflows');
const previewDir=path.join(buildDir,'previews');
const candidatePath=path.join(buildDir,'candidate-workflows.pptx');
await fs.mkdir(previewDir,{recursive:true});
await fs.mkdir(path.dirname(finalPath),{recursive:true});
async function writeBlob(target,blob){await fs.writeFile(target,new Uint8Array(await blob.arrayBuffer()));}
function shape(slide,name){const value=slide.shapes.items.find(x=>x.name===name);if(!value)throw new Error(`Missing ${name}`);return value;}
function pos(s,left,top,width,height){s.position={left,top,width,height};}
function setBox(s,text,left,top,width,height,options={}){
  s.text=text; s.geometry='rect'; s.fill=options.fill??'#F0F2F4';
  s.line={style:'solid',fill:options.line??'#647B92',width:options.lineWidth??2};
  s.text.style={fontSize:options.fontSize??19,typeface:'Arial',color:options.color??'#12304A',bold:options.bold??true,alignment:'center',verticalAlignment:'middle',autoFit:'shrinkText',wrap:'square',insets:options.insets??{top:10,right:10,bottom:10,left:10}};
  pos(s,left,top,width,height);
}
function addArrow(slide,name,text,left,top,width,height,fontSize=28){
  const a=slide.shapes.add({geometry:'textbox',name,position:{left,top,width,height},fill:'none',line:{style:'solid',fill:'none',width:0},text:{text,style:{fontSize,typeface:'Arial',color:'#647B92',bold:true,alignment:'center',verticalAlignment:'middle',insets:0}}});
  return a;
}
function addBox(slide,name,text,left,top,width,height,options={}){
  const s=slide.shapes.add({geometry:'rect',name,position:{left,top,width,height},fill:options.fill??'#F0F2F4',line:{style:'solid',fill:options.line??'#647B92',width:options.lineWidth??2}});
  s.text=text;
  s.text.style={fontSize:options.fontSize??19,typeface:'Arial',color:options.color??'#12304A',bold:options.bold??true,alignment:'center',verticalAlignment:'middle',autoFit:'shrinkText',wrap:'square',insets:options.insets??{top:10,right:10,bottom:10,left:10}};
  return s;
}
const p=await PresentationFile.importPptx(await FileBlob.load(sourcePath));
if(p.slides.items.length!==20)throw new Error(`Expected 20 slides, found ${p.slides.items.length}`);

// Slide 7: isolate the test module from the production allocator, then compare both lock cases.
{
 const s=p.slides.items[6];
 const intro=shape(s,'Rectangle 3');
 intro.text='Test-only kernel module mirrors the free-list pattern on two QEMU CPUs (harts).';
 intro.text.style={fontSize:23,typeface:'Arial',color:'#17202A',bold:true,alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(intro,72,150,1136,38);
 setBox(shape(s,'Rectangle 4'),'XV6 production allocator\nkept intact and safe',72,207,440,106,{fontSize:20});
 setBox(shape(s,'Rectangle 5'),'racecheck.c\nMiniature list: P0 → P1 → P2',768,207,440,106,{fontSize:20});
 addArrow(s,'Allocator-to-test flow','→',536,238,208,44,34);
 setBox(shape(s,'Rectangle 6'),'CASE 1 · UNLOCKED\nBoth CPUs pop without a lock\nInconsistent ownership',72,363,530,112,{fill:'#FBEDEC',line:'#C83E32',color:'#B8342A',fontSize:19});
 setBox(shape(s,'Rectangle 7'),'CASE 2 · SPINLOCK\nacquire()/release() protect the pop\nConsistent ownership',678,363,530,112,{fill:'#EAF5EE',line:'#2C9460',color:'#23794E',fontSize:19});
 addArrow(s,'Unlocked audit path','↓',322,478,32,34,28);
 addArrow(s,'Spinlock audit path','↓',927,478,32,34,28);
 setBox(shape(s,'Rectangle 8'),'Audit function verifies the page ownership invariant after each case',240,520,800,64,{fontSize:21});
 const foot=shape(s,'Rectangle 9');
 foot.text='The test module leaves XV6’s production allocator unchanged.';
 foot.text.style={fontSize:20,typeface:'Arial',color:'#53616E',alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(foot,72,634,1020,34);
}

// Slide 8: show the guest control flow and the two-case sequence as separate, connected lanes.
{
 const s=p.slides.items[7];
 const oldRecords=await p.inspect({select:'$.slides[7].elements[*]',include:['id','name']});
 for(const oldName of ['Workflow arrow 1','Workflow arrow 2','Workflow arrow 3','Workflow arrow 4']){const old=oldRecords.records.find(x=>x.name===oldName);if(old)p.delete(old.id);}
 const items=[
  ['USER PROGRAM\nracetest.c starts the experiment'],
  ['INITIALIZE\nraceinit() resets the test list'],
  ['FORK\nfork() × 2 creates two children'],
  ['WORKERS\nEach child enters kernel and pops from the list'],
  ['WAIT\nwait() × 2 waits for both children'],
  ['REPORT\nracereport() audits and prints results'],
 ];
 const xs=[72,265,458,651,844,1037];
 for(let i=0;i<5;i++)setBox(shape(s,`Rectangle ${i+3}`),items[i][0],xs[i],172,168,116,{fontSize:17.5});
 addBox(s,'Workflow step 6',items[5][0],xs[5],172,168,116,{fontSize:17.5});
 for(let i=0;i<5;i++)addArrow(s,`Program-flow arrow ${i+1}`,'→',241+i*193,211,24,34,25);
 setBox(shape(s,'Rectangle 8'),'CASE 1 · UNLOCKED\nRun without the lock',145,382,300,94,{fontSize:19});
 addBox(s,'Fresh-list reset','RESET LIST\nStart the second case with a fresh list',490,382,300,94,{fontSize:18.5});
 addBox(s,'Spinlock case','CASE 2 · SPINLOCK\nRepeat with acquire()/release()',835,382,300,94,{fontSize:18.5});
 addArrow(s,'Case-sequence arrow 1','→',448,412,38,34,27);
 addArrow(s,'Case-sequence arrow 2','→',793,412,38,34,27);
 const note=shape(s,'Rectangle 9');
 note.text='Both cases run automatically when the user types “racetest” at the xv6 shell.';
 note.text.style={fontSize:20,typeface:'Arial',color:'#53616E',alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(note,72,634,1020,34);
}

// Slide 9: make the lock boundary explicit beneath the existing kalloc() code.
{
 const s=p.slides.items[8];
 const steps=[
  ['1 · ACQUIRE','acquire(&kmem.lock)'],
  ['2 · READ','r = kmem.freelist'],
  ['3 · UPDATE','kmem.freelist = r->next'],
  ['4 · RELEASE','release(&kmem.lock)'],
 ];
 const xs=[72,360,648,936];
 for(let i=0;i<4;i++){
   if(i===0)setBox(shape(s,'Rectangle 5'),`${steps[i][0]}\n${steps[i][1]}`,xs[i],397,240,68,{fontSize:18});
   else addBox(s,`Critical-section step ${i+1}`,`${steps[i][0]}\n${steps[i][1]}`,xs[i],397,240,68,{fontSize:18});
 }
 for(let i=0;i<3;i++)addArrow(s,`Critical-section arrow ${i+1}`,'→',312+i*288,414,48,34,26);
 const takeaway=shape(s,'Rectangle 6');
 takeaway.text='Step 2 (read) and Step 3 (update) depend on each other.';
 takeaway.text.style={fontSize:24,typeface:'Arial',color:'#17202A',bold:true,alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(takeaway,72,488,1136,34);
 const detail=shape(s,'Rectangle 7');
 detail.text='If another CPU changes the head between those steps, Step 3 uses a stale value and the assumption breaks.';
 detail.text.style={fontSize:23,typeface:'Arial',color:'#17202A',alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(detail,72,535,1136,54);
}

// Slide 16: turn the existing setup commands into a readable host-to-guest run sequence.
{
 const s=p.slides.items[15];
 setBox(shape(s,'Rectangle 3'),'STEP 1 · OPEN WSL\nOpen Ubuntu\nwsl -d Ubuntu-24.04',72,170,320,128,{fontSize:18.5});
 addArrow(s,'Build-run arrow 1','→',397,212,38,38,28);
 addBox(s,'Navigate to xv6','STEP 2 · NAVIGATE\ncd "/mnt/c/Users/HP/Documents/OS record/OS CASE STUDY/case_study_14_rebuild/xv6-riscv"',445,170,390,128,{fontSize:17.5});
 addArrow(s,'Build-run arrow 2','→',840,212,32,38,28);
 addBox(s,'Build and boot xv6','STEP 3 · BUILD + BOOT\nmake clean\nmake -j4 DETFLAGS= qemu CPUS=2',878,170,330,128,{fontSize:18});
 addArrow(s,'Build-run turn arrow','↓',1024,307,38,38,28);
 addBox(s,'Run race test','STEP 4 · RUN TEST\nAt the xv6 shell, type:\nracetest',878,367,330,122,{fontSize:19});
 addArrow(s,'Build-run return arrow','←',840,408,32,38,28);
 addBox(s,'Exit QEMU','STEP 5 · EXIT QEMU\nPress Ctrl+A, release, then press X',445,367,390,122,{fontSize:19});
 const note=shape(s,'Rectangle 4');
 note.text='Requires: gcc-riscv64-linux-gnu and qemu-system-misc installed in WSL.';
 note.text.style={fontSize:20,typeface:'Arial',color:'#53616E',alignment:'left',verticalAlignment:'middle',autoFit:'shrinkText',insets:0};
 pos(note,72,634,1020,34);
}

for(let i=0;i<p.slides.items.length;i++){
 await writeBlob(path.join(previewDir,`slide-${String(i+1).padStart(2,'0')}.png`),await p.export({slide:p.slides.items[i],format:'png',scale:1}));
}
await writeBlob(path.join(previewDir,'montage.webp'),await p.export({format:'webp',montage:true,scale:0.4}));
await (await PresentationFile.exportPptx(p)).save(candidatePath);
const {finalizePresentation}=await import(pathToFileURL(path.join(skillDir,'container_tools/artifact_tool_utils.mjs')).href);
const owners=[5,12,14,18,20];
const validation=await finalizePresentation({
 explicitTotalSlideCount:20,
 requiredNativeTableOwnerSlides:owners,
 requiredNativeChartOwnerSlides:[],
 workspaceDir:rebuildDir,
 candidatePath,
 finalPath,
 pythonExecutable:runtimePython,
 integrityValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...owners.flatMap(n=>['--require-native-table-slide',String(n)])],
 fontPolicy:{basis:'design',families:['Arial','Consolas']},
 verifyArtifactToolImport:true,
 receiptPath:path.join(buildDir,'validation-workflows.json'),
});
console.log(JSON.stringify({finalPath,candidatePath,validation},null,2));


