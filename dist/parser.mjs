// PDF layout matching uses only explicit text and image positions; it never infers identities.
export function imageBoxes(ops, OPS, viewport, transform) {
  let matrix=[1,0,0,1,0,0], stack=[], boxes=[];
  for(let i=0;i<ops.fnArray.length;i++) {
    const op=ops.fnArray[i], a=ops.argsArray[i];
    if(op===OPS.save) stack.push([...matrix]);
    else if(op===OPS.restore) matrix=stack.pop()||[1,0,0,1,0,0];
    else if(op===OPS.transform) matrix=transform(matrix,a);
    else if(op===OPS.paintImageXObject || op===OPS.paintInlineImageXObject || op===OPS.paintImageXObjectRepeat) {
      const m=transform(viewport.transform,matrix);
      const corners=[[0,0],[1,0],[0,1],[1,1]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
      const xs=corners.map(p=>p[0]),ys=corners.map(p=>p[1]);
      const b={x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
      if(b.w>18&&b.h>18&&b.w<viewport.width*.65&&b.h<viewport.height*.45&&!boxes.some(q=>Math.abs(q.x-b.x)<2&&Math.abs(q.y-b.y)<2)) boxes.push(b);
    }
  }
  return boxes.sort((a,b)=>Math.abs(a.y-b.y)<8?a.x-b.x:a.y-b.y);
}
export function matchCards(boxes,items,width,height) {
  return boxes.map((b,i)=>{
    const cx=b.x+b.w/2;
    const row=boxes.filter(q=>Math.abs(q.y-b.y)<Math.max(8,b.h*.25));
    const left=row.filter(q=>q.x<b.x-4).sort((a,b)=>b.x-a.x)[0];
    const right=row.filter(q=>q.x>b.x+4).sort((a,b)=>a.x-b.x)[0];
    const x0=left?(left.x+left.w/2+cx)/2:Math.max(0,b.x-b.w*.7);
    const x1=right?(right.x+right.w/2+cx)/2:Math.min(width,b.x+b.w*1.7);
    const next=boxes.filter(q=>q.y>b.y+b.h*.7&&q.x+q.w/2>x0&&q.x+q.w/2<x1).sort((a,b)=>a.y-b.y)[0];
    const bottom=next?next.y-3:Math.min(height-25,b.y+b.h+Math.max(75,b.h*1.7));
    const text=items.filter(t=>t.text.trim()&&t.cx>=x0&&t.cx<x1&&t.y>b.y+b.h-2&&t.y<bottom).sort((a,b)=>Math.abs(a.y-b.y)<3?a.x-b.x:a.y-b.y);
    const lines=[];
    for(const t of text){const last=lines.at(-1);if(last&&Math.abs(last.y-t.y)<3)last.text+=' '+t.text;else lines.push({text:t.text,y:t.y});}
    const raw=lines.map(l=>l.text.trim()).filter(Boolean);
    if(!raw.length) return null;
    let split=raw.findIndex((s,j)=>j>0&&(/\s\/\s|^(major|school|degree|program|class|year|department)\s*:/i.test(s)||/^(freshman|sophomore|junior|senior|graduate|professional|not set|year \d)/i.test(s)));
    if(split<0)split=1;
    const originalName=raw.slice(0,split).join(' ');
    const comma=originalName.indexOf(',');
    const name=comma>=0?`${originalName.slice(comma+1).trim()} ${originalName.slice(0,comma).trim()}`:originalName;
    const details=raw.slice(split);let program='',year='',pronouns='',major='',other=[];
    for(const s of details){
      if(/^major\s*:/i.test(s))major=s.replace(/^major\s*:\s*/i,'');
      else if(/\b(freshman|sophomore|junior|senior|graduate|professional|semester|year \d|not set)\b/i.test(s))year=s;
      else if(/\b(he|him|his|she|her|hers|they|them|their|female|male)\b/i.test(s))pronouns=s;
      else if(!program) program=s.replace(/^(program|school|degree)\s*:\s*/i,'');
      else other.push(s);
    }
    return {name,program,year,pronouns,major,notes:other.join('\n'),source:raw.join('\n'),box:b};
  }).filter(Boolean);
}
