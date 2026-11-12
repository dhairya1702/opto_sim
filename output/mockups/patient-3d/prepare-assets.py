"""Bake a local visual study from the CC0 MakeHuman assets. No clinical geometry."""
from pathlib import Path
import json, math, re

ROOT = Path(__file__).parent / 'assets'

def obj(name):
    vertices, uvs, faces, groups = [], [], [], {}
    group = ''
    for line in (ROOT / name).read_text().splitlines():
        s = line.split()
        if not s: continue
        if s[0] == 'v': vertices.append(list(map(float, s[1:4])))
        elif s[0] == 'vt': uvs.append(list(map(float, s[1:3])))
        elif s[0] == 'g': group = s[1]
        elif s[0] == 'f':
            f = [tuple(int(x)-1 for x in item.split('/')[:2]) for item in s[1:]]
            faces.append((group, f))
            groups.setdefault(group, set()).update(x[0] for x in f)
    return vertices, uvs, faces, groups

base, uv, faces, groups = obj('base.obj')
original = [v[:] for v in base]
for target in ['male.target', 'male-build.target']:
    for line in (ROOT / target).read_text().splitlines():
        s = line.split()
        if len(s) == 4 and s[0].isdigit():
            for axis in range(3): base[int(s[0])][axis] += float(s[axis+1])

closed = [v[:] for v in base]
for suffix,vertices,strength in [('open',base,1.8),('close',closed,1.0)]:
    for side in ['left','right']:
        for line in (ROOT/f'eye-{side}-{suffix}.target').read_text().splitlines():
            s=line.split()
            if len(s)==4 and s[0].isdigit():
                for axis in range(3): vertices[int(s[0])][axis]+=float(s[axis+1])*strength

# Broaden each lid opening laterally, with a soft falloff into the surrounding
# face. Apply the same mapping to the closed shape so blinking remains aligned.
for vertices in [base,closed]:
    for v in vertices:
        x,y,z=v
        if z>1.05 and 8.45<y<9.23 and .08<abs(x)<.60:
            dx=abs(x)-.29313
            weight=math.exp(-((y-8.862)/.24)**4-(dx/.29)**4)
            v[0]+=(1 if x>0 else -1)*dx*.14*weight

# Rebuild the visible lid contour against explicit oval curves. The old mesh
# has a flat lower margin and an asymmetric upper rim; widening alone retained
# those features. Blend the contour displacement into neighbouring lid folds.
upper=[(.15,8.855),(.19,8.887),(.22,8.900),(.26,8.914),(.30,8.926),(.345,8.930),(.386,8.923),(.425,8.903),(.45,8.875)]
lower=[(.15,8.835),(.19,8.806),(.22,8.798),(.26,8.794),(.30,8.790),(.357,8.791),(.40,8.794),(.43,8.807),(.45,8.855)]
def curve(points,x):
    for (a,ya),(b,yb) in zip(points,points[1:]):
        if a<=x<=b:return ya+(yb-ya)*(x-a)/(b-a)
    return points[0][1] if x<points[0][0] else points[-1][1]
for i in groups['body']:
    x,y,z=base[i];a=abs(x)
    if .14<a<.46 and 8.64<y<9.12 and z>1.32:
        u=max(-1,min(1,(a-.30)/.155))
        oval=math.sqrt(max(0,1-u*u))
        top=curve(upper,a);bottom=curve(lower,a)
        middle=(top+bottom)*.5
        old=top if y>=middle else bottom
        target=8.856+(.065*oval if y>=middle else -.080*oval**1.35)
        weight=math.exp(-((y-old)/.085)**2)
        # Preserve depth and inner eye geometry; reshape the textured lid skin.
        base[i][1]+=(target-old)*weight

# Relax the folded corner topology, rather than stretching the whole aperture.
# Adjacency smoothing blends the canthi into the surrounding upper/lower lids.
adjacency={i:set() for i in groups['body']}
for group,face in faces:
    if group!='body':continue
    ids=[v for v,t in face]
    for a,b in zip(ids,ids[1:]+ids[:1]):
        adjacency[a].add(b);adjacency[b].add(a)
corner_weights={}
for i in groups['body']:
    x,y,z=base[i];dx=abs(abs(x)-.30)
    if z>1.30 and .075<dx<.225 and abs(y-8.856)<.19:
        corner_weights[i]=.42*math.exp(-((dx-.145)/.075)**4-((y-8.856)/.15)**4)
for vertices in [base,closed]:
    for iteration in range(5):
        updates={}
        for i,w in corner_weights.items():
            neighbours=adjacency[i]
            updates[i]=[vertices[i][a]*(1-w)+sum(vertices[j][a] for j in neighbours)/len(neighbours)*w for a in range(3)]
        for i,v in updates.items():vertices[i]=v
# Clear only skin that intrudes into the intended oval in front of the globe.
# The closed blink target is deliberately not projected away from the eye.
for i in groups['body']:
    x,y,z=base[i];dx=abs(x)-.30;dy=y-8.856
    if abs(dx)<.155 and abs(dy)<.085:
        radius=math.sqrt((dx/.155)**2+(dy/.074)**2)
        if .10<radius<1 and z>1.32:
            base[i][0]=(1 if x>0 else -1)*(.30+dx/radius)
            base[i][1]=8.856+dy/radius

# Use mirrored counterparts for the eyelid patch and its blink target. Pair
# against the undeformed mesh so successive edits cannot change correspondence.
positive=[i for i in groups['body'] if .10<base[i][0]<.52 and 8.60<base[i][1]<9.15 and base[i][2]>1.2]
negative=[i for i in groups['body'] if -.52<base[i][0]<-.10 and 8.60<base[i][1]<9.15 and base[i][2]>1.2]
for i in negative:
    ref=original[i]
    j=min(positive,key=lambda j:(original[j][0]+ref[0])**2+(original[j][1]-ref[1])**2+(original[j][2]-ref[2])**2)
    if sum((original[j][k]-(-ref[k] if k==0 else ref[k]))**2 for k in range(3))<.0001:
        for vertices in [base,closed]:vertices[i]=[-vertices[j][0],vertices[j][1],vertices[j][2]]

def fit(name):
    scale = [1,1,1]; mapped = []; active = False
    for line in (ROOT / name).read_text().splitlines():
        s = line.split()
        if not s or s[0].startswith('#'): continue
        if s[0] in ['x_scale','y_scale','z_scale']:
            a = 'xyz'.index(s[0][0]); scale[a] = abs(base[int(s[1])][a]-base[int(s[2])][a])/float(s[3])
        elif s[0] == 'verts': active = True
        elif s[0] == 'delete_verts': break
        elif active and s[0].isdigit():
            if len(s) == 1: mapped.append(base[int(s[0])][:])
            elif len(s) == 9:
                mapped.append([sum(base[int(s[j])][a]*float(s[j+3]) for j in range(3))+float(s[a+6])*scale[a] for a in range(3)])
    return mapped

def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)

def joint(name):
    ids=groups['joint-l-'+name]
    return [sum(base[i][a] for i in ids)/len(ids) for a in range(3)]

def sub(a,b): return [a[i]-b[i] for i in range(3)]
def dot(a,b): return sum(a[i]*b[i] for i in range(3))
def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def unit(v):
    length=math.sqrt(dot(v,v));return [x/length for x in v]
def rotate_between(p,a,b):
    a,b=unit(a),unit(b); axis=cross(a,b);c=dot(a,b)
    k=cross(axis,p); kk=cross(axis,k)
    return [p[i]+k[i]+kk[i]/(1+c) for i in range(3)]

shoulder=joint('shoulder');elbow=joint('elbow');hand=joint('hand')
new_elbow=[2.55,3.78,.45];new_hand=[2.30,3.6,2.9]

def arm(v):
    side=1 if v[0]>0 else -1;p=[abs(v[0]),v[1],v[2]]
    upper=rotate_between(sub(p,shoulder),sub(elbow,shoulder),sub(new_elbow,shoulder))
    upper=[upper[i]+shoulder[i] for i in range(3)]
    lower=rotate_between(sub(p,elbow),sub(hand,elbow),sub(new_hand,new_elbow))
    lower=[lower[i]+new_elbow[i] for i in range(3)]
    w=smooth(3.3,4.05,p[0]); weight=smooth(1.65,2.35,p[0])
    q=[upper[i]*(1-w)+lower[i]*w for i in range(3)]
    q=[p[i]*(1-weight)+q[i]*weight for i in range(3)];q[0]*=side
    return q

def pose(v):
    x,y,z=v; side=1 if x>0 else -1
    # A seated visual pose, deliberately independent from simulator anchors.
    if y < 1.6 and abs(x)<3:
        hip=1.515; knee=-2.684
        if y >= knee:
            yy=hip+(z+.04); zz=.0+(hip-y)
        else:
            yy=hip+(y-knee); zz=(hip-knee)+z-.319
        w=1-smooth(.7,2.0,y)
        y,z=y*(1-w)+yy*w,z*(1-w)+zz*w
        x*=.88
    elif abs(x)>1.7 and y<6.9:
        x,y,z=arm(v)
    return [round(x*.1,6),round(y*.1+.55,6),round(z*.1,6)]

clothing_text=(ROOT/'male_casualsuit04.mhclo').read_text().split('delete_verts')[1]
deleted=set()
for match in re.finditer(r'(\d+)(?:\s*-\s*(\d+))?',clothing_text):
    a=int(match[1]); b=int(match[2] or a); deleted.update(range(a,b+1))

def mesh(name, vertices, texcoords, fs, texture, center=None):
    points=[]; tex=[]; indices=[]; lookup={};blink=[]
    for _,face in fs:
        ids=[]
        for pair in face:
            if pair not in lookup:
                lookup[pair]=len(points)//3
                p=pose(vertices[pair[0]])
                if center: p=[p[a]-center[a] for a in range(3)]
                points.extend(p);tex.extend(texcoords[pair[1]])
                if name=='skin': blink.extend(pose(closed[pair[0]]))
            ids.append(lookup[pair])
        for i in range(1,len(ids)-1): indices.extend([ids[0],ids[i],ids[i+1]])
    return dict(name=name,positions=points,uvs=tex,indices=indices,texture=texture,center=center,blink=blink)

result=[mesh('skin',base,uv,[(g,f) for g,f in faces if g=='body' and not all(v in deleted for v,t in f)],'young_lightskinned_male_diffuse.png')]
for name,source,proxy,texture in [('clothes','male_casualsuit04.obj','male_casualsuit04.mhclo','male_casualsuit04_diffuse.png'),('hair','short04.obj','short04.mhclo','short04_diffuse.png'),('brows','eyebrow001.obj','eyebrow001.mhclo','eyebrow001.png')]:
    v,t,f,g=obj(source); mapped=fit(proxy)
    assert len(v)==len(mapped),(name,len(v),len(mapped))
    if name=='brows':
        # Thin each brow around its local centreline, then lift it off the lid.
        for side in [-1,1]:
            selected=[p for p in mapped if p[0]*side>0]
            mid=sum(p[1] for p in selected)/len(selected)
            midx=sum(p[0] for p in selected)/len(selected)
            for p in selected:
                p[0]=midx+(p[0]-midx)*.75
                p[1]=mid+(p[1]-mid)*.60+.085
                # Follow the forehead surface at the raised position instead
                # of retaining the deeper original brow-ridge placement.
                candidates=[v for v in base[:13380] if v[2]>.8 and abs(v[0]-p[0])<.25 and abs(v[1]-p[1])<.25]
                near=sorted(candidates,key=lambda v:(v[0]-p[0])**2+(v[1]-p[1])**2)[:4]
                if near:
                    weights=[1/max(.00001,(v[0]-p[0])**2+(v[1]-p[1])**2) for v in near]
                    p[2]=max(v[2] for v in near)+.075
    result.append(mesh(name,mapped,t,f,texture))
v,t,f,g=obj('eyes.obj'); mapped=fit('eyes.mhclo')
assert len(v)==len(mapped)
for side,label in [(1,'OS'),(-1,'OD')]:
    ids=groups['joint-l-eye' if side==1 else 'joint-r-eye']
    center=pose([sum(base[i][a] for i in ids)/len(ids) for a in range(3)])
    # The source's outer corneal shell samples a blue mask island. Omit that
    # shell rather than rendering it as an opaque layer over the iris.
    visible=[(g,face) for g,face in f if mapped[face[0][0]][0]*side>0 and not all(t[ti][0]>.85 and t[ti][1]<.16 for vi,ti in face)]
    result.append(mesh(label,mapped,t,visible,'eye.png',center))
(ROOT/'patient.json').write_text(json.dumps(result,separators=(',',':')))
print([(m['name'],len(m['indices'])//3,m['center']) for m in result])
