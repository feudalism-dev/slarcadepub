/* SL Invaders — sprite regions on sprites.jpg (1024×1024) */
(function (global) {
  "use strict";

  var COLS = [34, 112, 190, 268, 346, 424, 502, 580];
  var ROW_Y = [108, 218, 316, 426];
  var ROW_H = [58, 72, 92, 92];
  var CELL_W = 70;

  var invaders = [];
  var row;
  var col;
  for (row = 0; row < 4; row++) {
    for (col = 0; col < 8; col++) {
      invaders.push({
        row: row,
        frame: col % 2,
        color: Math.floor(col / 2),
        x: COLS[col] + 4,
        y: ROW_Y[row] + 8,
        w: CELL_W,
        h: ROW_H[row],
      });
    }
  }

  global.InvadersSprites = {
    sheet: "sprites.jpg",
    invaders: invaders,
    player: [
      { x: 36, y: 552, w: 92, h: 86 },
      { x: 132, y: 552, w: 96, h: 86 },
    ],
    bullet: { x: 708, y: 502, w: 192, h: 12 },
    levelComplete: { x: 36, y: 782, w: 162, h: 176 },
    gameOver: { x: 204, y: 783, w: 154, h: 175 },
  };
})(typeof window !== "undefined" ? window : this);
