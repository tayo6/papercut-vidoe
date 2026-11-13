import base64, os, sys
root = sys.argv[1]; out = sys.argv[2]
FACES = [
 ('Bowlby One','bowlby-one',[400]),('Anton','anton',[400]),('Abril Fatface','abril-fatface',[400]),
 ('Rubik Mono One','rubik-mono-one',[400]),('Pacifico','pacifico',[400]),('Lobster','lobster',[400]),
 ('Permanent Marker','permanent-marker',[400]),('Chewy','chewy',[400]),('Rye','rye',[400]),
 ('Bebas Neue','bebas-neue',[400]),('Special Elite','special-elite',[400]),('Courier Prime','courier-prime',[400,700]),
 ('Playfair Display','playfair-display',[400,900]),('Old Standard TT','old-standard-tt',[400,700]),
 ('UnifrakturCook','unifrakturcook',[700]),('Libre Baskerville','libre-baskerville',[400,700]),
 ('DM Serif Display','dm-serif-display',[400]),('Oswald','oswald',[500]),('Alfa Slab One','alfa-slab-one',[400]),
 ('Roboto Slab','roboto-slab',[700]),('Lora','lora',[400,700]),('Cormorant Garamond','cormorant-garamond',[700]),
 ('IBM Plex Sans','ibm-plex-sans',[400,500,600]),('IBM Plex Mono','ibm-plex-mono',[400,500]),
]
css=[]; total=0
for fam, pkg, ws in FACES:
    for w in ws:
        p=os.path.join(root,'node_modules','@fontsource',pkg,'files','%s-latin-%d-normal.woff2'%(pkg,w))
        b=open(p,'rb').read(); total+=len(b)
        css.append("@font-face{font-family:'%s';font-style:normal;font-weight:%d;font-display:block;src:url(data:font/woff2;base64,%s) format('woff2')}"%(fam,w,base64.b64encode(b).decode()))
open(out,'w').write('\n'.join(css))
print('faces',len(css),'bytes',total,'css',os.path.getsize(out))
