// 특수기물 SVG 원본입니다. 실행: node scripts/generate-special-art.cjs
// 외부 폰트·이모지·글자 배지 없이 경로로 조각 형태를 그립니다.
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const pieces = JSON.parse(fs.readFileSync(path.join(root, 'data/special-pieces.json'), 'utf8')).pieces;
const P = (d, cls = '') => `<path d="${d}"${cls ? ` class="${cls}"` : ''}/>`;
const C = (x,y,r,cls='') => `<circle cx="${x}" cy="${y}" r="${r}"${cls ? ` class="${cls}"` : ''}/>`;
const E = (x,y,rx,ry,cls='') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}"${cls ? ` class="${cls}"` : ''}/>`;
const R = (x,y,w,h,rx=2,cls='') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"${cls ? ` class="${cls}"` : ''}/>`;
const crown = (x,y,s=1) => `<g transform="translate(${x} ${y}) scale(${s})">${P('M-15 7 -19-8 -8-2 0-15 8-2 19-8 15 7Z','gold')}${P('M-14 12H14','detail')}</g>`;
const head = (x=48,y=28,r=11) => C(x,y,r)+P(`M${x-r+2} ${y-3}Q${x} ${y-11} ${x+r-2} ${y-3}`,'detail');
const coat = () => P('M35 43Q48 37 61 43L71 81H25Z')+P('M37 43 48 59 59 43M48 59V79','detail');
const horse = () => P('M16 76Q11 62 24 52L48 50 56 35 68 22 72 12 78 24 88 34 84 45 72 43 66 59Q72 70 66 80L61 91H50L54 75 36 75 30 91H19L23 73')+P('M18 56Q9 49 10 68M57 36 64 47M71 29 76 32M37 57Q46 63 57 58','detail')+C(78,33,1.4,'ink');
const knight = () => P('M25 84Q22 64 42 51L32 49 20 53 17 40 42 21 50 11 54 25Q74 29 75 48L67 81Z')+P('M44 27 36 40M56 34Q68 49 54 61M24 43 30 43','detail')+C(45,35,2,'ink');
const rook = (x=48,y=23,s=1) => `<g transform="translate(${x} ${y}) scale(${s})">${P('M-20 0H-11V9H-4V0H4V9H11V0H20V24H14L18 58H-18L-14 24H-20Z')}${P('M-17 24H17M-15 48H15','detail')}</g>`;
const king = () => P('M44 12V6H52V12H59V20H52V28H44V20H37V12Z','gold')+P('M30 37Q48 23 66 37L61 48H35Z')+P('M37 48H59L64 77H32Z')+P('M33 81H63L68 90H28Z')+P('M38 55H58','detail');
const shapes = {
  mounted_king: horse()+P('M34 35Q40 27 47 35L49 52 39 59 30 53Z')+C(39,24,7)+crown(39,14,.48)+P('M45 39 61 42M35 51 29 67','detail'),
  mounted_king_mk2: horse()+P('M26 53 47 49 63 58 55 73 30 74Z')+P('M31 55 35 71M40 53 44 71M49 53 53 69','detail')+P('M33 33 45 29 53 38 49 52 35 52Z')+C(40,23,7)+crown(40,12,.5)+P('M17 51V12M17 14H33L25 22H17','gold'),
  black_hole: P('M40 83 44 71H52L56 83Z')+E(48,47,34,13,'orbit')+E(48,47,21,29,'orbit')+E(48,47,31,21,'halo')+C(48,47,19,'void')+P('M30 44Q43 27 65 40M34 58Q53 67 67 49','gold-line')+C(15,44,3,'gold')+C(70,24,3,'gold'),
  golden_pawn: C(48,26,14,'gold')+P('M36 42H60L55 54 62 82H34L41 54Z','gold')+E(48,45,15,4)+P('M44 17 39 25 45 25M42 58 38 76','shine')+C(48,70,6,'gold'),
  banker: head(44,24)+coat()+P('M36 42 44 52 51 42M44 53V71','detail')+C(59,64,20)+C(59,64,14,'inset')+P('M59 53V75M48 64H70','gold-line')+C(59,64,4,'gold')+P('M27 57 19 72 36 76','detail'),
  tax_accountant: head(42,25)+coat()+R(42,45,33,39,3)+P('M48 53H68M48 59H58M49 44V82','detail')+R(19,52,22,29,2,'gold')+R(23,56,14,7,1,'inset')+C(25,69,1,'ink')+C(34,69,1,'ink')+C(25,75,1,'ink')+C(34,75,1,'ink'),
  stock_broker: head(48,25)+coat()+P('M27 48 17 63 33 72M64 49 78 60 68 69','detail')+R(23,55,53,28,3)+P('M29 76 38 67 47 71 59 61 69 63M60 58 70 59 69 68','gold-line')+P('M34 43 42 47M55 43 63 47','detail'),
  factory: P('M16 83V49L36 39V51L56 40V53L78 44V83Z')+P('M23 43V17H35V40M58 43V11H70V43')+P('M22 24H35M58 18H70','gold-line')+R(24,61,10,12,1,'inset')+R(43,61,10,12,1,'inset')+R(63,61,9,22,1,'inset')+P('M28 10Q22 5 32 3M64 5Q57 1 67 1','detail'),
  suicide_pawn: C(45,28,11)+P('M35 42H56L51 57 57 82H29L36 57Z')+C(61,62,21,'bomb')+P('M64 41 65 32 74 26','detail')+P('M74 18V24M81 23 77 26M81 31 77 29M68 20 71 24','gold-line')+P('M52 48Q43 51 44 59','shine'),
  bodyguard: head(45,26)+P('M29 44Q45 36 61 44L69 81H22Z')+P('M35 28H55M39 33H49','detail')+P('M48 51 75 43 81 61Q78 81 62 88 46 77 45 64Z')+P('M62 53V76M53 64H72','gold-line')+P('M20 46V83','detail'),
  ghost: P('M24 81V42Q24 14 48 14T72 42V81L62 72 53 83 44 73 35 83Z')+E(39,42,4,7,'ink')+E(58,42,4,7,'ink')+P('M43 60Q48 56 53 60M32 29Q27 39 29 52','detail')+E(48,89,28,3,'halo'),
  magnet: P('M19 22H36V56Q36 72 48 72T60 56V22H77V58Q77 91 48 91T19 58Z')+R(19,22,17,17,1,'gold')+R(60,22,17,17,1,'gold')+P('M13 48 7 52M83 48 89 52M41 25 48 17 55 25M48 10V16','detail'),
  warp_bishop: E(48,50,28,38,'halo')+P('M31 77 40 53Q24 43 40 23L48 12 57 25Q72 43 56 53L65 77Z')+P('M48 19 40 36M36 79H62','detail')+P('M13 39 20 29 23 40M81 60 76 71 70 61','gold-line')+C(48,14,3,'gold'),
  sniper: P('M28 41Q25 16 45 15 65 16 61 40Z')+P('M31 37 25 76 67 82 59 38Z')+P('M36 30H53M40 34H49','detail')+P('M27 73 73 29 78 34 36 81Z','rifle')+P('M58 33 64 39M72 28 80 20M65 25 71 31','detail')+C(76,20,8,'scope')+P('M76 12V28M68 20H84','gold-line'),
  taxi: P('M15 60 25 41H68L80 60V81H15Z')+P('M29 42 34 31H60L65 42Z')+R(37,22,20,9,2,'gold')+P('M29 47H64L70 60H23Z','glass')+R(20,65,12,7,1,'gold')+R(63,65,12,7,1,'gold')+P('M38 70H56M17 77H78','detail')+C(27,82,6,'ink')+C(68,82,6,'ink'),
  cavalry: P('M21 85 27 66 23 50 42 29 49 18 55 29Q74 34 72 49L64 82Z')+P('M29 49 43 43 50 50M56 35Q65 45 57 55','detail')+C(46,38,2,'ink')+P('M17 83V15L21 8 25 15V82','gold')+P('M24 17H44L36 26H24')+P('M53 60 74 53 78 68 67 82 52 72Z')+P('M65 60V73','gold-line'),
  fortress: P('M15 83V31H22V41H30V31H38V54H59V27H66V37H74V27H82V83Z')+P('M38 55V18H43V27H51V18H59V55')+P('M39 83V67Q48 55 58 67V83Z','inset')+P('M44 66V82M52 66V82M41 72H55M20 55H32M64 51H77','detail'),
  fake_king: king()+P('M31 53 48 47 65 53 61 67Q48 78 35 67Z','mask')+P('M38 57 44 59M52 59 58 57M43 67Q48 70 53 67','detail'),
  judge: head(44,28)+P('M30 24Q23 13 32 13Q35 7 41 12Q47 7 52 12Q61 9 61 20L57 35 53 28H34L31 35Z')+P('M29 46 42 41 57 46 64 83H22Z')+P('M38 45 43 61 48 45M43 61V80','detail')+P('M58 70 77 29','gold-line')+`<g transform="rotate(25 75 31)">${R(60,23,28,13,3)}${P('M64 23V36M83 23V36','detail')}</g>`+R(62,78,22,6,2),
  pirate: P('M23 30Q23 17 36 18L48 10 59 18Q73 16 74 31L61 28H36Z')+head(48,39,12)+P('M36 35H61M45 34 55 44','detail')+P('M35 53 48 49 60 53 70 81H24Z')+P('M35 57 59 76M42 56 37 81','detail')+P('M67 63Q86 46 82 32 91 56 72 73Z','gold')+P('M65 66 74 74','detail')+C(42,38,3,'ink'),
  vampire: P('M24 41 43 53 48 44 54 53 73 41 65 64 78 85H18L31 64Z')+head(48,30,12)+P('M37 22 47 28 59 22M42 39 44 45 46 39M51 39 53 45 55 39','detail')+P('M39 58 48 66 58 58M48 66V83','gold-line'),
  swapper: rook(30,38,.65)+rook(65,38,.65)+P('M18 31Q42 9 70 28M63 18 72 28 59 30M79 81Q52 97 26 81M35 80 25 80 28 91','gold-line')+P('M34 24 44 17M53 89 63 86','detail'),
  mirror: P('M40 81 43 69H53L56 81Z')+E(48,41,27,34)+E(48,41,21,28,'glass')+P('M36 46 52 21M43 59 62 30','shine')+P('M19 39V52Q23 71 39 72M77 39V52Q73 71 57 72','gold-line')+C(48,7,3,'gold'),
  wall: P('M17 84V24H79V84Z')+P('M17 39H79M17 54H79M17 69H79M35 24V39M59 24V39M46 39V54M30 54V69M63 54V69M45 69V84','detail')+R(13,18,70,8,2)+P('M23 30H28M65 76H72','shine'),
  rental_house: P('M20 45 48 18 77 45Z')+P('M26 45H70V83H26Z')+R(51,55,12,15,1,'glass')+R(35,61,12,22,1,'inset')+P('M61 30V18H70V39','detail')+C(77,66,7,'gold')+P('M77 73V88M77 82H83M77 87H81','gold-line'),
  bankrupt_queen: P('M25 21 36 30 43 18 51 30 65 23 60 44H32Z')+P('M34 45H60L54 56 64 83H29L40 56Z')+P('M54 19 59 11 65 15 70 9M48 45 42 54 49 63 42 75','detail')+P('M25 86 22 71 11 65 17 78Z','gold')+C(34,24,2,'gold')+C(44,19,2,'gold'),
  credit_card_knight: knight()+R(47,51,37,29,4)+P('M48 60H83','ink-line')+R(53,66,9,7,1,'gold')+P('M67 72H77M56 66V73','detail')+P('M29 68 40 57','detail'),
  venture_knight: knight()+P('M54 61 57 47 69 37 81 32 77 45 67 57Z','gold')+C(72,41,3,'glass')+P('M56 53 47 55 51 64M66 58 64 69 57 63M49 67 42 78M54 71 49 81','gold-line')+P('M19 25 23 17 27 25 23 33Z','gold'),
  short_seller: P('M28 33 24 23Q28 16 34 21L40 25 58 25 65 20Q73 18 74 27L69 36 73 49 63 58 67 82H29L33 58 23 49Z')+P('M36 39 42 42M55 42 61 39M40 52 48 56 57 51','detail')+P('M20 61 35 55 47 65 60 59 78 77M65 77H79V64','gold-line')+E(48,47,6,4,'ink'),
  chaebol_king: crown(48,20,.9)+C(48,43,11)+P('M34 57 47 52 62 57 69 84H26Z')+P('M38 56 48 69 58 56M48 69V81','detail')+R(61,63,23,20,3,'gold')+P('M67 63V58H77V63M62 72H83','detail')+C(25,74,9,'gold')+P('M20 75H30','detail'),
};
const output = path.join(root, 'assets/pieces/special');
fs.mkdirSync(output, { recursive: true });
for (const id of Object.keys(pieces)) {
  if (!shapes[id]) throw new Error(`누락된 특수기물 그림: ${id}`);
  for (const color of ['w', 'b']) {
    const light = color === 'w';
    const colors = light ? ['#fffbed','#d7ceb8','#37362f','#766f5d','#d7a943','#f6da85'] : ['#4b525d','#171c25','#bac0c6','#b8c0cc','#a68944','#d4b76f'];
    const [top,bottom,edge,detail,gold,goldTop] = colors;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 112" role="img"><title>${pieces[id].name}</title><defs><linearGradient id="piece" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient><linearGradient id="gold" x2=".8" y2="1"><stop stop-color="${goldTop}"/><stop offset="1" stop-color="${gold}"/></linearGradient></defs><style>.detail{fill:none;stroke:${detail};stroke-width:2.3}.gold{fill:url(#gold)}.gold-line{fill:none;stroke:${gold};stroke-width:3.5}.ink{fill:${light?'#343b42':'#dce1e6'};stroke:none}.ink-line{fill:none;stroke:${light?'#343b42':'#dce1e6'};stroke-width:5}.inset{fill:${light?'#a9a18c':'#0b1018'}}.glass{fill:${light?'#b5d3da':'#466975'}}.shine{fill:none;stroke:${light?'#fffef6':'#aebfc9'};stroke-width:2.7}.halo{fill:none;stroke:${light?'#8d9fa7':'#7c9aa9'};stroke-width:3}.orbit{fill:none;stroke:${gold};stroke-width:4}.void,.bomb{fill:#18212c}.scope{fill:none;stroke:${gold};stroke-width:2.5}.mask{fill:${light?'#e2cf9b':'#847447'}}.rifle{fill:${light?'#716a5d':'#a5a6a3'}}</style><g fill="url(#piece)" stroke="${edge}" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round">${E(48,103,35,5,'inset')}${shapes[id]}${P('M25 84H71L75 92H21Z')}${R(16,92,64,9,3)}${P('M23 95H69','detail')}</g></svg>\n`;
    fs.writeFileSync(path.join(output, `${id}-${color}.svg`), svg, 'utf8');
  }
}
const cards = Object.keys(pieces).map(id => `<article><h2>${pieces[id].name}</h2><div class="pair"><div class="light"><img src="${id}-w.svg" alt="백 ${pieces[id].name}"></div><div class="dark"><img src="${id}-b.svg" alt="흑 ${pieces[id].name}"></div></div><small>${id}</small></article>`).join('\n');
fs.writeFileSync(path.join(output,'preview.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>특수기물 조각 미리보기</title><style>body{margin:0;padding:28px;background:#252a31;color:#f7f2e5;font-family:system-ui}h1{font-size:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:16px}article{background:#353c46;border:1px solid #5b626b;border-radius:12px;padding:12px}h2{font-size:15px;margin:0 0 10px}.pair{display:flex;border-radius:8px;overflow:hidden}.pair>div{width:50%;display:grid;place-items:center;height:124px}.light{background:#e9e3d4}.dark{background:#7a8079}img{width:88px;height:106px}small{display:block;margin-top:8px;color:#b9c0c7;font-size:10px}</style><h1>특수기물 30종 · 백 / 흑</h1><main>${cards}</main></html>\n`, 'utf8');
console.log(`특수기물 ${Object.keys(pieces).length}종, 백·흑 SVG ${Object.keys(pieces).length * 2}개 생성 완료`);
