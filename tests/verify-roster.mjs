import fs from 'node:fs';
import {createRequire} from 'node:module';
import {imageBoxes,matchCards} from '../dist/parser.mjs';
const require=createRequire(process.env.FACEFOLIO_NODE_MODULES ? process.env.FACEFOLIO_NODE_MODULES + '/' : import.meta.url);
const {DOMMatrix,ImageData,Path2D}=require('@napi-rs/canvas');
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
Uint8Array.prototype.toHex ??= function(){return Buffer.from(this).toString('hex')};
const pdfjs=await import('../dist/vendor/pdf.mjs');
const task=pdfjs.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2])),useSystemFonts:true});
const pdf=await task.promise;
let cards=[];
for(let n=1;n<=pdf.numPages;n++){
 const p=await pdf.getPage(n),v=p.getViewport({scale:1}),txt=await p.getTextContent(),ops=await p.getOperatorList();
 const items=txt.items.filter(i=>i.str).map(i=>{const t=pdfjs.Util.transform(v.transform,i.transform);return {text:i.str,x:t[4],cx:t[4]+i.width/2,y:t[5],h:i.height}});
 const boxes=imageBoxes(ops,pdfjs.OPS,v,pdfjs.Util.transform),found=matchCards(boxes,items,v.width,v.height);
 console.log('Page',n,'images',boxes.length,'cards',found.length);
 cards.push(...found);
}
const expected=Number(process.argv[3]||113);
if(cards.length!==expected)throw Error(`Expected ${expected}, got ${cards.length}`);
if(cards.some(c=>!c.program||!c.year||/HCOL|GSAS|HGSE/.test(c.name)))throw Error('Unparsed fields or name contamination');
console.log(`PASS: ${cards.length} cards, program and class year on all cards.`);
await task.destroy();
