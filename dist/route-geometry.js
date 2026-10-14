globalThis.RouteGeometry={
 at(coords,position){const i=Math.min(Math.floor(position),coords.length-2),t=position-i;return coords[i].map((v,j)=>v+(coords[i+1][j]-v)*t);},
 nearest(coords,point){
  const scale=Math.cos(point[0]*Math.PI/180);let best={distance:Infinity};
  for(let i=0;i<coords.length-1;i++){const a=coords[i],b=coords[i+1],x=(b[1]-a[1])*scale,y=b[0]-a[0],px=(point[1]-a[1])*scale,py=point[0]-a[0];const t=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1)));const distance=Math.hypot(px-t*x,py-t*y);if(distance<best.distance)best={position:i+t,coordinate:a.map((v,j)=>v+(b[j]-v)*t),distance};}
  return best;
 },
 slice(coords,start,end){return [this.at(coords,start),...coords.filter((_,i)=>i>start&&i<end),this.at(coords,end)];},
 parts(coords,base,sections){
  const end=coords.length-1,bounds=[...new Set([0,end,...sections.flatMap(s=>[s.start_pos,s.end_pos])])].sort((a,b)=>a-b);
  return bounds.slice(0,-1).map((start,i)=>{const finish=bounds[i+1],mid=(start+finish)/2,section=[...sections].reverse().find(s=>mid>=Math.min(s.start_pos,s.end_pos)&&mid<=Math.max(s.start_pos,s.end_pos));return {start,end:finish,status:section?.status||base,section,coordinates:this.slice(coords,start,finish)};});
 }
};
