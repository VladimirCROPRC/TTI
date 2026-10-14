"""Import static map data and embedded assets: python scripts/import_kmz.py input.kmz"""
import sys, json, zipfile, re, html
from pathlib import Path
import xml.etree.ElementTree as ET
from html.parser import HTMLParser

ROOT = Path(__file__).resolve().parents[1]
NS = {'k': 'http://www.opengis.net/kml/2.2'}
def value(node, path, default=''):
    return node.findtext(path, default, NS)
class Description(HTMLParser):
    def __init__(self):
        super().__init__(); self.text=[]; self.photos=[]; self.caption=False
    def handle_starttag(self, tag, attrs):
        attrs=dict(attrs)
        if tag=='img': self.photos.append({'src':attrs.get('src',''), 'caption':''})
        if tag=='small': self.caption=True
        if tag in ('br','hr','p'): self.text.append('\n')
    def handle_endtag(self, tag):
        if tag=='small': self.caption=False
    def handle_data(self,data):
        if self.caption and self.photos: self.photos[-1]['caption']+=data
        else: self.text.append(data)
def run(source):
    dest=ROOT/'dist'; dest.mkdir(exist_ok=True)
    with zipfile.ZipFile(source) as z:
        kml=next(n for n in z.namelist() if n.lower().endswith('.kml'))
        root=ET.fromstring(z.read(kml))
        for name in z.namelist():
            p=Path(name)
            if p.is_absolute() or '..' in p.parts: raise ValueError('Unsafe archive path')
            if name.lower().endswith(('.jpg','.jpeg','.png','.webp','.gif')):
                target=dest/p; target.parent.mkdir(parents=True,exist_ok=True); target.write_bytes(z.read(name))
    parents={c:p for p in root.iter() for c in p}
    styles={e.get('id'):e for e in root.iter() if e.tag.split('}')[-1] in ('Style','StyleMap') and e.get('id')}
    def style(node):
        s=node.find('k:Style',NS)
        if s is None: s=styles.get(value(node,'k:styleUrl').lstrip('#'))
        seen=set()
        while s is not None and s.tag.endswith('StyleMap'):
            key=s.get('id');
            if key in seen: break
            seen.add(key)
            pairs=s.findall('k:Pair',NS)
            pair=next((p for p in pairs if value(p,'k:key')=='normal'),None)
            s=styles.get(value(pair,'k:styleUrl').lstrip('#')) if pair is not None else None
        if s is None: return {}
        color=value(s,'k:LineStyle/k:color','ff3388ff')
        return {'color':'#'+color[6:8]+color[4:6]+color[2:4], 'opacity':int(color[:2],16)/255, 'width':float(value(s,'k:LineStyle/k:width','3')), 'icon':value(s,'k:IconStyle/k:Icon/k:href').replace('http://','https://'), 'scale':float(value(s,'k:IconStyle/k:scale','1')), 'hotspot': (s.find('k:IconStyle/k:hotSpot',NS).attrib if s.find('k:IconStyle/k:hotSpot',NS) is not None else {})}
    categories=[]; items=[]; unsupported=[]
    for folder in root.findall('.//k:Folder',NS):
        if folder.find('k:Placemark/k:Point',NS) is not None:
            name=value(folder,'k:name','Puncte')
            if name not in categories: categories.append(name)
    for idx,p in enumerate(root.findall('.//k:Placemark',NS)):
        path=[]; ancestor=parents.get(p)
        while ancestor is not None:
            if ancestor.tag.endswith('Folder'): path.insert(0,value(ancestor,'k:name'))
            ancestor=parents.get(ancestor)
        d=Description(); d.feed(value(p,'k:description'))
        for photo in d.photos:
            if not (dest/photo['src']).is_file(): raise ValueError('Missing photo '+photo['src'])
        base={'id':str(idx),'name':value(p,'k:name','Fără nume'),'category':path[-1] if path else 'Puncte','path':path,'style':style(p),'description':''.join(d.text).strip(),'photos':d.photos}
        found=False
        for geom in p.iter():
            typ=geom.tag.split('}')[-1]
            if typ not in ('Point','LineString'): continue
            coords=[[float(v) for v in c.split(',')[:2]][::-1] for c in value(geom,'k:coordinates').split()]
            if not coords: continue
            items.append(dict(base,id=f'{idx}-{len(items)}',type=typ,coordinates=coords[0] if typ=='Point' else coords)); found=True
        if not found: unsupported.append(base['name'])
    result={'categories':categories,'features':items,'unsupported':unsupported}
    (dest/'data.json').write_text(json.dumps(result,ensure_ascii=False),encoding='utf-8')
    print(json.dumps({'points':sum(f['type']=='Point' for f in items),'cables':sum(f['type']=='LineString' for f in items),'photos':sum(len(f['photos']) for f in items),'categories':categories,'unsupported':unsupported},ensure_ascii=False))
if __name__=='__main__': run(sys.argv[1])
