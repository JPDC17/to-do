(function () {
  "use strict";

  const HIGH_SCORE_KEY = "site_board_game_highscore";

  const canvas = document.getElementById("game-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const W = canvas.width;
  const H = canvas.height;
  const GROUND_Y = 168;

  // ---------------- Pixel-art sprites ----------------

  const PAL = {
    ".": null,
    K: "#1a1712",
    Y: "#f5c518",
    y: "#d9a61c",
    G: "#3a3f45",
    g: "#5a6069",
    B: "#7fd8f7",
    b: "#2f8fbf",
    S: "#c7ccd1",
    s: "#9aa0a6",
    O: "#8a5a2b",
    o: "#5c3b1e",
    D: "#242024",
    T: "#c98a4b",
    K2: "#2e1c0f",
  };

  // Authored facing left (like a reference photo); flipped at draw time to face right,
  // since this game plays left-to-right and the dozer should face the direction of travel.
  const DOZER = [
    "................................K.......................",
    "................................K.......................",
    "................................K.......................",
    "..........................DDDDDDDDDDDDDDDDDD............",
    ".........................DGGGGGGGGGGGGGGGGGGD...........",
    ".........................DGBBBBBGGGBBBBBGGGGD...........",
    ".........................DGBBBBBGGGBBBBBGGGGD...........",
    ".........................DGBBBBBGGGBBBBBGGGGD...........",
    ".........................DGGGGGGGGGGGGGGGGGGD...........",
    "........................DDYYYYYYYYYYYYYYYYYYDD..........",
    "..................sss..DYYYYYYYYYYYYYYYYYYYYYYD.........",
    ".................sSSs.DYYYYYYYYYYYYYYYYYYYYYYYYD........",
    "................sSSSs.DYYYYYYYYYYYYYYYYYYYYYYYYYYD......",
    "...............sSSSSs.DYYYYYYYYYYYYYYYYYYYYYYYYYYYD.....",
    "..............sSSSSSs.DYYYYYYYYYYYYYYYYYYYYYYYYYYYYD....",
    ".............sSSSSSSs.DYYYYYYYYYYYYYYYYYYYYYYYYYYYYYD...",
    "............sSSSSSSSs.DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD..",
    "...........sSSSSSSSSs.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK..",
    ".................Ss.K.oo.OO.oo.OO.oo.OO.oo.OO.oo.OO.oo.K",
    "..................s.KoOOoKoOOoKoOOoKoOOoKoOOoKoOOoKoOOoK",
    ".....................KoOOoKoOOoKoOOoKoOOoKoOOoKoOOoKoOOoK",
    "................FKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.",
  ];

  const PILE_SMALL = [
    ".....TT.....",
    "....TOOT....",
    "...OOOOOO...",
    "..OOoOOoOO..",
    ".OOOooOooOO.",
    "OoOOOOOOOOoO",
    "oOOOOOOOOOOo",
  ];

  const PILE_BIG = [
    ".......TT.......",
    "......TOOT......",
    ".....OOOOOO.....",
    "....OOOOOOOO....",
    "...OOoOOOOoOO...",
    "..OOoOOOOOOoOO..",
    ".OOOooOOOOooOOO.",
    "OoOOOOOOOOOOOOoO",
    "oOOOOOOOOOOOOOOo",
  ];

  function rotateRow(row, n) {
    const k = ((n % row.length) + row.length) % row.length;
    return row.slice(k) + row.slice(0, k);
  }

  function drawSprite(pixels, ox, oy, size, flip, treadShift) {
    const rows = pixels.length;
    const cols = pixels[0].length;
    for (let r = 0; r < rows; r++) {
      const isTreadRow = treadShift !== undefined && r >= rows - 3;
      const rowStr = isTreadRow ? rotateRow(pixels[r], treadShift) : pixels[r];
      for (let c = 0; c < cols; c++) {
        const cc = flip ? cols - 1 - c : c;
        const ch = rowStr[cc];
        const color = PAL[ch];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(ox + c * size), Math.round(oy + r * size), size + 0.5, size + 0.5);
      }
    }
  }

  // ---------------- Game state ----------------

  const PLAYER_X = 70;
  const PLAYER_SIZE = 2.15;
  const PLAYER_W = DOZER[0].length * PLAYER_SIZE;
  const PLAYER_H = DOZER.length * PLAYER_SIZE;

  const GRAVITY = 2600;
  const JUMP_VELOCITY = -840;

  let state = "ready"; // ready | playing | gameover
  let playerY = 0;
  let playerVY = 0;
  let jumping = false;
  let obstacles = [];
  let speed = 300;
  let score = 0;
  let highScore = Number(localStorage.getItem(HIGH_SCORE_KEY) || 0);
  let spawnTimer = 0;
  let groundScroll = 0;
  let treadShift = 0;
  let lastTime = null;
  let rafId = null;

  function reset() {
    playerY = 0;
    playerVY = 0;
    jumping = false;
    obstacles = [];
    speed = 300;
    score = 0;
    spawnTimer = 1200;
    groundScroll = 0;
    state = "ready";
  }
  reset();

  function jump() {
    if (state === "ready") {
      state = "playing";
      lastTime = null;
    } else if (state === "gameover") {
      reset();
      state = "playing";
      lastTime = null;
      return;
    }
    if (!jumping) {
      playerVY = JUMP_VELOCITY;
      jumping = true;
    }
  }

  function spawnObstacle() {
    const big = Math.random() < 0.4;
    const pixels = big ? PILE_BIG : PILE_SMALL;
    const size = big ? 6 : 5.5;
    obstacles.push({
      x: W + 20,
      width: pixels[0].length * size,
      height: pixels.length * size,
      pixels,
      size,
    });
  }

  function endGame() {
    state = "gameover";
    if (score > highScore) {
      highScore = score;
      localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(highScore)));
    }
  }

  function update(dt) {
    // dt in seconds
    groundScroll = (groundScroll + speed * dt) % 40;
    treadShift -= dt * 14;

    if (state !== "playing") return;

    speed = Math.min(650, 300 + score * 0.12);

    playerVY += GRAVITY * dt;
    playerY += playerVY * dt;
    if (playerY > 0) {
      playerY = 0;
      playerVY = 0;
      jumping = false;
    }

    score += dt * 60;

    spawnTimer -= dt * 1000;
    if (spawnTimer <= 0) {
      spawnObstacle();
      const minGap = 550 + Math.random() * 250;
      spawnTimer = minGap;
    }

    obstacles.forEach((o) => {
      o.x -= speed * dt;
    });
    obstacles = obstacles.filter((o) => o.x + o.width > -20);

    const px1 = PLAYER_X + PLAYER_W * 0.18;
    const px2 = PLAYER_X + PLAYER_W * 0.92;
    const py2 = GROUND_Y + playerY;
    const py1 = py2 - PLAYER_H * 0.75;

    for (const o of obstacles) {
      const ox1 = o.x + o.width * 0.12;
      const ox2 = o.x + o.width * 0.88;
      const oy2 = GROUND_Y;
      const oy1 = GROUND_Y - o.height * 0.85;
      if (px1 < ox2 && px2 > ox1 && py1 < oy2 && py2 > oy1) {
        endGame();
        break;
      }
    }

    if (score > highScore) {
      highScore = score;
    }
  }

  function drawGround() {
    ctx.fillStyle = "#8a6a3f";
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "#6e5330";
    for (let x = -40 + Math.floor(groundScroll) * -1; x < W; x += 40) {
      ctx.fillRect(x, GROUND_Y, 22, 4);
    }
    ctx.fillStyle = "#5c421f";
    ctx.fillRect(0, GROUND_Y, W, 3);
  }

  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    grad.addColorStop(0, "#bfe3f0");
    grad.addColorStop(1, "#eadfc4");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, GROUND_Y);

    ctx.fillStyle = "rgba(160, 140, 100, 0.35)";
    const hillOffset = (groundScroll * 0.3) % 160;
    for (let x = -160 + Math.floor(-hillOffset); x < W + 160; x += 160) {
      ctx.beginPath();
      ctx.ellipse(x + 80, GROUND_Y, 90, 34, 0, Math.PI, 0, true);
      ctx.fill();
    }
  }

  function drawScore() {
    ctx.textBaseline = "top";
    ctx.font = "600 15px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#3a3226";
    const scoreText = String(Math.floor(score)).padStart(5, "0");
    ctx.textAlign = "right";
    ctx.fillText(scoreText, W - 14, 12);
    ctx.font = "600 11px 'IBM Plex Mono', monospace";
    ctx.fillStyle = "#6e6350";
    ctx.fillText(`BEST ${String(Math.floor(highScore)).padStart(5, "0")}`, W - 14, 32);
  }

  function drawOverlayText(lines) {
    ctx.fillStyle = "rgba(232, 220, 196, 0.82)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#3a3226";
    ctx.font = "700 20px 'Space Grotesk', sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(lines[0], W / 2, H / 2 - 14);
    ctx.font = "500 13px 'Space Grotesk', sans-serif";
    ctx.fillStyle = "#6e6350";
    if (lines[1]) ctx.fillText(lines[1], W / 2, H / 2 + 14);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawSky();
    drawGround();

    obstacles.forEach((o) => {
      drawSprite(o.pixels, o.x, GROUND_Y - o.height, o.size, false);
    });

    drawSprite(DOZER, PLAYER_X, GROUND_Y + playerY - PLAYER_H + 4, PLAYER_SIZE, true, jumping ? 0 : treadShift);

    drawScore();

    if (state === "ready") {
      drawOverlayText(["🚜 BULLDOZER RUN", "Press SPACE, ↑, or click/tap to start"]);
    } else if (state === "gameover") {
      drawOverlayText(["GAME OVER", `Score ${Math.floor(score)} — press SPACE to try again`]);
    }
  }

  function loop(time) {
    if (lastTime == null) lastTime = time;
    const dt = Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    update(dt);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function startLoop() {
    if (rafId != null) return;
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  }

  function stopLoop() {
    if (rafId != null) cancelAnimationFrame(rafId);
    rafId = null;
  }

  canvas.addEventListener("mousedown", jump);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    jump();
  });

  window.__taskSheetGame = {
    handleKey(e) {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    },
    start() {
      reset();
      draw();
      startLoop();
    },
    stop() {
      stopLoop();
    },
  };
})();
