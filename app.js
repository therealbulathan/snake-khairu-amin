// Snake — Khairu & Amin Edition (mobile-first PWA)
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const restartBtn = document.getElementById('restartBtn');
  const soundBtn = document.getElementById('soundBtn');
  const wrapBtn = document.getElementById('wrapBtn');

  const STATE = {
    grid: 24,
    cell: 16,
    speedMs: 140,
    speedMin: 70,
    wrap: false,
    running: false,
    paused: false,
    lastTs: 0,
    acc: 0,
    dir: {x:1,y:0},
    nextDir: {x:1,y:0},
    lockTurn: false,
    snake: [],
    apple: {x: 0,y: 0},
    score: 0,
    best: Number(localStorage.getItem('snake_high_v2')||0),
    sound: false,
    rngSeed: Date.now() & 0xffffffff,
  };
  bestEl.textContent = STATE.best;

  function seedRand() { let x = STATE.rngSeed>>>0; x^=x<<13; x^=x>>>17; x^=x<<5; STATE.rngSeed=x>>>0; return (STATE.rngSeed&0xffffffff)/0x100000000; }
  function vibrate(ms){ try{ if (navigator.vibrate) navigator.vibrate(ms);}catch(e){} }
  function playBeep(freq=520, dur=50){
    if (!STATE.sound || !window.AudioContext) return;
    const actx = playBeep._ctx || (playBeep._ctx = new AudioContext());
    const o = actx.createOscillator(); const g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.type = 'square'; o.frequency.value = freq; g.gain.value = 0.02;
    o.start(); setTimeout(()=>{o.stop();}, dur);
  }

  function resize() {
    const vw = Math.min(window.innerWidth, 800);
    const vh = window.innerHeight - 160;
    const size = Math.min(vw*0.96, vh*0.96);
    STATE.cell = Math.floor(size / STATE.grid);
    const dim = STATE.cell * STATE.grid;
    canvas.width = dim; canvas.height = dim;
    draw();
  }
  window.addEventListener('resize', resize);

  function reset(seed = Date.now()) {
    STATE.rngSeed = seed & 0xffffffff;
    STATE.speedMs = 140;
    STATE.dir = {x:1,y:0};
    STATE.nextDir = {x:1,y:0};
    STATE.lockTurn = false;
    STATE.score = 0;
    scoreEl.textContent = '0';
    const mid = Math.floor(STATE.grid/2);
    STATE.snake = [{x:mid-2,y:mid},{x:mid-1,y:mid},{x:mid,y:mid}];
    placeApple();
    draw();
  }
  function placeApple() {
    let x,y; do { x = Math.floor(seedRand()*STATE.grid); y = Math.floor(seedRand()*STATE.grid); }
    while (STATE.snake.some(s => s.x===x && s.y===y));
    STATE.apple = {x,y};
  }
  function setDir(nx, ny) {
    if (STATE.lockTurn) return;
    if (nx === -STATE.dir.x && ny === -STATE.dir.y) return;
    STATE.nextDir = {x:nx, y:ny};
    STATE.lockTurn = true;
  }

  // Touch
  let touchStart = null;
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStart = {x:e.touches[0].clientX, y:e.touches[0].clientY};
  }, {passive:true});
  canvas.addEventListener('touchmove', (e) => {
    if (!touchStart) return;
    const dx = e.touches[0].clientX - touchStart.x;
    const dy = e.touches[0].clientY - touchStart.y;
    const ax = Math.abs(dx), ay = Math.abs(dy);
    const thresh = 18;
    if (ax < thresh && ay < thresh) return;
    if (ax > ay) setDir(Math.sign(dx), 0);
    else setDir(0, Math.sign(dy));
    touchStart = null;
  }, {passive:true});
  canvas.addEventListener('touchend', ()=>{ touchStart = null; }, {passive:true});

  // Keyboard
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') setDir(-1,0);
    else if (e.key === 'ArrowRight') setDir(1,0);
    else if (e.key === 'ArrowUp') setDir(0,-1);
    else if (e.key === 'ArrowDown') setDir(0,1);
    else if (e.key.toLowerCase() === 'p') togglePause();
    else if (e.key.toLowerCase() === 'r') restart();
  });

  startBtn.addEventListener('click', () => { overlay.classList.remove('show'); start(); });
  pauseBtn.addEventListener('click', () => togglePause());
  restartBtn.addEventListener('click', () => restart());
  soundBtn.addEventListener('click', () => {
    STATE.sound = !STATE.sound;
    soundBtn.setAttribute('aria-pressed', String(STATE.sound));
  });
  wrapBtn.addEventListener('click', () => {
    STATE.wrap = !STATE.wrap;
    wrapBtn.setAttribute('aria-pressed', String(STATE.wrap));
    wrapBtn.textContent = 'Без стен: ' + (STATE.wrap ? 'вкл' : 'выкл');
  });

  function togglePause(){
    if (!STATE.running) return;
    STATE.paused = !STATE.paused;
    pauseBtn.setAttribute('aria-pressed', String(STATE.paused));
    if (!STATE.paused) {
      STATE.lastTs = performance.now();
      requestAnimationFrame(loop);
    } else {
      overlay.classList.add('show');
      overlay.querySelector('h1').textContent = 'Пауза';
      overlay.querySelector('p').textContent = 'Свайп — чтобы продолжить движение.';
      startBtn.textContent = 'Продолжить';
    }
  }
  function restart(){
    reset();
    overlay.classList.add('show');
    overlay.querySelector('h1').textContent = 'Snake';
    overlay.querySelector('p').textContent = 'Свайпы для управления. Не разворачивайся на 180°.';
    startBtn.textContent = 'Начать';
    STATE.running = false; STATE.paused = false;
    pauseBtn.setAttribute('aria-pressed', 'false');
  }
  function start(){
    if (STATE.running && STATE.paused) { togglePause(); return; }
    if (!STATE.running){ reset(); STATE.running = true; }
    STATE.paused = false; STATE.lastTs = performance.now();
    requestAnimationFrame(loop);
  }
  function step(){
    STATE.dir = STATE.nextDir;
    const head = STATE.snake[STATE.snake.length-1];
    let nx = head.x + STATE.dir.x;
    let ny = head.y + STATE.dir.y;

    if (STATE.wrap){ nx = (nx + STATE.grid) % STATE.grid; ny = (ny + STATE.grid) % STATE.grid; }
    else { if (nx < 0 || ny < 0 || nx >= STATE.grid || ny >= STATE.grid){ gameOver(); return; } }

    if (STATE.snake.some(s => s.x===nx && s.y===ny)){ gameOver(); return; }

    STATE.snake.push({x:nx, y:ny}); STATE.lockTurn = false;

    if (nx === STATE.apple.x && ny === STATE.apple.y){
      STATE.score += 1; scoreEl.textContent = String(STATE.score);
      playBeep(600, 60); vibrate(15); placeApple();
      STATE.speedMs = Math.max(STATE.speedMin, STATE.speedMs - 4);
    } else { STATE.snake.shift(); }
  }
  function draw(){
    const dim = STATE.cell * STATE.grid;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#121315'; ctx.fillRect(0,0,dim,dim);
    ctx.strokeStyle = '#1a1b1c'; ctx.lineWidth = 1;
    const step = STATE.cell;
    ctx.beginPath();
    for (let i=1;i<STATE.grid;i++){
      const p = i*step + .5;
      ctx.moveTo(p,0); ctx.lineTo(p,dim);
      ctx.moveTo(0,p); ctx.lineTo(dim,p);
    }
    ctx.stroke();

    const ax = STATE.apple.x*STATE.cell, ay = STATE.apple.y*STATE.cell;
    const r = Math.floor(STATE.cell*0.42);
    ctx.fillStyle = '#7fdba7';
    ctx.beginPath(); ctx.arc(ax + STATE.cell/2, ay + STATE.cell/2, r, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = '#e6e1d5';
    for (let i=0;i<STATE.snake.length;i++){
      const s = STATE.snake[i];
      const x = s.x*STATE.cell, y = s.y*STATE.cell;
      const pad = Math.max(2, Math.floor(STATE.cell*0.12));
      const w = STATE.cell - pad*2;
      const h = w;
      roundRect(ctx, x+pad, y+pad, w, h, Math.min(10, pad+4));
    }
    const head = STATE.snake[STATE.snake.length-1];
    const hx = head.x*STATE.cell + STATE.cell/2;
    const hy = head.y*STATE.cell + STATE.cell/2;
    ctx.fillStyle = '#c9c3b6';
    ctx.beginPath(); ctx.arc(hx, hy, Math.max(2, STATE.cell*0.08), 0, Math.PI*2); ctx.fill();
  }
  function roundRect(ctx,x,y,w,h,r){
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();
    ctx.fill();
  }
  function loop(ts){
    if (!STATE.running || STATE.paused) return;
    const dt = ts - STATE.lastTs; STATE.lastTs = ts;
    STATE.acc += dt;
    while (STATE.acc >= STATE.speedMs){ STATE.acc -= STATE.speedMs; step(); }
    draw();
    requestAnimationFrame(loop);
  }
  function gameOver(){
    playBeep(220, 180); vibrate(60);
    STATE.running = false;
    overlay.classList.add('show');
    overlay.querySelector('h1').textContent = 'Игра окончена';
    overlay.querySelector('p').textContent = 'Счёт: ' + STATE.score;
    startBtn.textContent = 'Сыграть ещё';
    if (STATE.score > STATE.best){
      STATE.best = STATE.score;
      localStorage.setItem('snake_high_v2', String(STATE.best));
      bestEl.textContent = String(STATE.best);
    }
  }
  resize(); reset();
})();