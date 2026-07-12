// Generates docs/pose-skeleton.svg — a visual of the MoveNet 17-keypoint pose
// using the exact normalised coordinates from the unit-test factory
// (src/features/measurements/__tests__/landmarksToMeasurements.test.ts), with
// the measurement-derivation overlays drawn on top.
const fs = require('fs');
const path = require('path');

// name → [x, y] normalised 0..1 (image space: x left→right, y top→bottom).
// NOTE: MoveNet "left/right" is the PERSON's side → mirrored in a front shot.
const KP = {
  nose:[0.50,0.08], leftEye:[0.53,0.07], rightEye:[0.47,0.07],
  leftEar:[0.56,0.09], rightEar:[0.44,0.09],
  leftShoulder:[0.66,0.22], rightShoulder:[0.34,0.22],
  leftElbow:[0.70,0.42], rightElbow:[0.30,0.42],
  leftWrist:[0.69,0.60], rightWrist:[0.31,0.60],
  leftHip:[0.60,0.55], rightHip:[0.40,0.55],
  leftKnee:[0.58,0.74], rightKnee:[0.42,0.74],
  leftAnkle:[0.56,0.93], rightAnkle:[0.44,0.93],
};
const IDX = ['nose','leftEye','rightEye','leftEar','rightEar','leftShoulder',
  'rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftHip',
  'rightHip','leftKnee','rightKnee','leftAnkle','rightAnkle'];

const W = 460, H = 620, MX = 90, MY = 30;
const SX = W - 2*MX, SY = H - 2*MY;
const px = (n)=> MX + KP[n][0]*SX;
const py = (n)=> MY + KP[n][1]*SY;
const mid = (a,b)=> [ (px(a)+px(b))/2, (py(a)+py(b))/2 ];

const BONES = [
  ['nose','leftEye'],['nose','rightEye'],['leftEye','leftEar'],['rightEye','rightEar'],
  ['leftShoulder','rightShoulder'],['leftShoulder','leftElbow'],['leftElbow','leftWrist'],
  ['rightShoulder','rightElbow'],['rightElbow','rightWrist'],
  ['leftShoulder','leftHip'],['rightShoulder','rightHip'],['leftHip','rightHip'],
  ['leftHip','leftKnee'],['leftKnee','leftAnkle'],['rightHip','rightKnee'],['rightKnee','rightAnkle'],
];

let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-sans-serif,Arial">`;
s += `<rect width="${W}" height="${H}" fill="#FAF7F2"/>`;
s += `<text x="${W/2}" y="20" text-anchor="middle" font-size="13" fill="#1a1a1a">MoveNet 17-keypoint pose — front view (person 170 cm)</text>`;

// Measurement overlays (drawn first, under the skeleton).
const line = (a,b,col,wd=4,dash='')=>`<line x1="${px(a)}" y1="${py(a)}" x2="${px(b)}" y2="${py(b)}" stroke="${col}" stroke-width="${wd}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linecap="round" opacity="0.55"/>`;
const seg = (x1,y1,x2,y2,col,wd=4,dash='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${wd}" ${dash?`stroke-dasharray="${dash}"`:''} stroke-linecap="round" opacity="0.55"/>`;

const [msx,msy]=mid('leftShoulder','rightShoulder');
const [mhx,mhy]=mid('leftHip','rightHip');
const [max_,may]=mid('leftAnkle','rightAnkle');

// scale ref: nose → mid-ankle (vertical)
s += seg(px('nose')+150, py('nose'), px('nose')+150, may, '#9aa', 2, '4 4');
s += `<text x="${px('nose')+158}" y="${(py('nose')+may)/2}" font-size="10" fill="#778">scale ref: nose→ankle = 88% height</text>`;

// shoulder width
s += line('leftShoulder','rightShoulder','#c0392b',5);
// sleeve (person's right arm = image left)
s += line('rightShoulder','rightElbow','#2e86c1',5)+line('rightElbow','rightWrist','#2e86c1',5);
// hip width
s += line('leftHip','rightHip','#8e44ad',5);
// torso (mid shoulder → mid hip)
s += seg(msx-120, msy, msx-120, mhy, '#16a085', 4)+`<text x="${msx-176}" y="${(msy+mhy)/2}" font-size="10" fill="#16a085">torso</text>`;
// inseam (mid hip → mid ankle)
s += seg(mhx-120, mhy, mhx-120, may, '#e67e22', 4)+`<text x="${mhx-176}" y="${(mhy+may)/2}" font-size="10" fill="#e67e22">inseam</text>`;

// skeleton bones
for (const [a,b] of BONES) s += `<line x1="${px(a)}" y1="${py(a)}" x2="${px(b)}" y2="${py(b)}" stroke="#444" stroke-width="2"/>`;

// keypoints
IDX.forEach((n,i)=>{
  s += `<circle cx="${px(n)}" cy="${py(n)}" r="5" fill="#1a1a1a"/>`;
  const onRight = KP[n][0] >= 0.5;
  s += `<text x="${px(n)+(onRight?9:-9)}" y="${py(n)+3}" font-size="9" fill="#1a1a1a" text-anchor="${onRight?'start':'end'}">${i} ${n}</text>`;
});

// legend
const L = [['#c0392b','shoulder width (5–6)'],['#2e86c1','sleeve  shoulder→elbow→wrist'],
  ['#8e44ad','hip width (11–12)'],['#16a085','torso  shoulder→hip'],
  ['#e67e22','inseam  hip→ankle']];
let ly = H-92;
s += `<text x="20" y="${ly-10}" font-size="10" fill="#1a1a1a">measurement overlays:</text>`;
L.forEach(([c,t],i)=>{ const y=ly+i*16; s+=`<line x1="20" y1="${y}" x2="44" y2="${y}" stroke="${c}" stroke-width="5" stroke-linecap="round"/><text x="50" y="${y+4}" font-size="10" fill="#333">${t}</text>`; });

s += `</svg>`;
const out = path.join(__dirname, '..', 'docs', 'pose-skeleton.svg');
fs.writeFileSync(out, s);
console.log('wrote', out, s.length, 'bytes');
