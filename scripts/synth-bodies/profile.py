import numpy as np, math, sys
d=np.load(sys.argv[1]); V=d['V'].astype(float); armw=d['armw'].astype(float); F=d['F']
e=set()
for f in F:
    for k in range(4):
        a,b=f[k],f[(k+1)%4]; e.add((min(a,b),max(a,b)))
E=np.array(sorted(e)); ok=(armw[E[:,0]]<.5)&(armw[E[:,1]]<.5)
def sl(z):
    m=((V[E[:,0],2]-z)*(V[E[:,1],2]-z)<0)&ok; EE=E[m]; a=V[EE[:,0]];b=V[EE[:,1]]; t=((z-a[:,2])/(b[:,2]-a[:,2]))[:,None]; return a+t*(b-a)
def hull(P):
    P=sorted(set(map(tuple,np.round(P,6))))
    cr=lambda o,a,b:(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lo=[]
    for q in P:
        while len(lo)>=2 and cr(lo[-2],lo[-1],q)<=0: lo.pop()
        lo.append(q)
    up=[]
    for q in reversed(P):
        while len(up)>=2 and cr(up[-2],up[-1],q)<=0: up.pop()
        up.append(q)
    H=lo[:-1]+up[:-1]; return sum(math.dist(H[i],H[(i+1)%len(H)]) for i in range(len(H)))
H=V[:,2].max()
print(len(F),'quads of',H)
for z in np.arange(0.40*H,0.86*H,0.02*H):
    p=sl(z); print(round(z/H,3), round(hull(p[:,:2])*100,1), 'w',round((p[:,0].max()-p[:,0].min())*100,1),'d',round((p[:,1].max()-p[:,1].min())*100,1))
