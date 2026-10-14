/* Read GPS locally. All TIFF offsets are bounded to the EXIF chunk. */
globalThis.photoGPS=function(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),ascii=(p,n)=>String.fromCharCode(...bytes.subarray(p,p+n));
 function tiff(start,end){try{
  if(ascii(start,6)==='Exif\0\0')start+=6;
  const le=ascii(start,2)==='II';if(!le&&ascii(start,2)!=='MM')return null;
  const bounds=(p,n)=>{if(p<start||p+n>end||!Number.isSafeInteger(p))throw Error('bounds');};
  const u16=p=>{bounds(p,2);return view.getUint16(p,le);},u32=p=>{bounds(p,4);return view.getUint32(p,le);};if(u16(start+2)!==42)return null;
  function entries(offset){const p=start+offset,count=u16(p);if(count>512)throw Error('count');bounds(p+2,count*12);return Array.from({length:count},(_,i)=>p+2+i*12);}
  const gps=entries(u32(start+4)).find(p=>u16(p)===0x8825);if(!gps||u16(gps+2)!==4||u32(gps+4)!==1)return null;
  const tags=new Map(entries(u32(gps+8)).map(p=>[u16(p),p]));
  function ref(tag){const p=tags.get(tag);if(p===undefined||u16(p+2)!==2||u32(p+4)!==2)return null;bounds(p+8,2);return ascii(p+8,1);}
  function coord(tag){const p=tags.get(tag);if(p===undefined||u16(p+2)!==5||u32(p+4)!==3)return null;const offset=start+u32(p+8);bounds(offset,24);const d=[0,8,16].map(n=>{const denom=u32(offset+n+4);if(!denom)throw Error('denominator');return u32(offset+n)/denom;});if(d[1]>=60||d[2]>=60)return null;return d[0]+d[1]/60+d[2]/3600;}
  let latitude=coord(2),longitude=coord(4);const ns=ref(1),ew=ref(3);if(latitude===null||longitude===null||!['N','S'].includes(ns)||!['E','W'].includes(ew))return null;
  if(ns==='S')latitude=-latitude;if(ew==='W')longitude=-longitude;if(Math.abs(latitude)>90||Math.abs(longitude)>180)return null;return {latitude,longitude};
 }catch{return null;}}
 try{
  if(bytes[0]===255&&bytes[1]===216){let p=2;while(p+4<=bytes.length){if(bytes[p++]!==255)return null;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===0xda||marker===0xd9)break;if(marker===1||(marker>=0xd0&&marker<=0xd7))continue;const length=view.getUint16(p);if(length<2||p+length>bytes.length)return null;if(marker===0xe1&&ascii(p+2,6)==='Exif\0\0'){const result=tiff(p+2,p+length);if(result)return result;}p+=length;}}
  else if(bytes[0]===137&&ascii(1,3)==='PNG'){let p=8;while(p+12<=bytes.length){const n=view.getUint32(p);if(p+12+n>bytes.length)return null;if(ascii(p+4,4)==='eXIf')return tiff(p+8,p+8+n);p+=12+n;}}
  else if(ascii(0,4)==='RIFF'&&ascii(8,4)==='WEBP'){let p=12;while(p+8<=bytes.length){const n=view.getUint32(p+4,true);if(p+8+n>bytes.length)return null;if(ascii(p,4)==='EXIF')return tiff(p+8,p+8+n);p+=8+n+(n%2);}}
 }catch{}return null;
};
