// Making Connection
const PORT = 3001
const socket = io.connect(`http://localhost:${PORT}`);

function encryptMessage(message, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(message), key).toString();
}

function decryptMessage(encryptedMessage, key) {
 return JSON.parse(CryptoJS.AES.decrypt(encryptedMessage, key).toString(CryptoJS.enc.Utf8));
}

let players = []; // All players in the game
let room = '';
let currentPlayer; // Player object for individual players

let canvas = document.getElementById("canvas");
canvas.width = document.documentElement.clientHeight * 0.9;
canvas.height = document.documentElement.clientHeight * 0.9;
let ctx = canvas.getContext("2d");

const redPieceImg = "../images/red_piece.png";
const bluePieceImg = "../images/blue_piece.png";
const yellowPieceImg = "../images/yellow_piece.png";
const greenPieceImg = "../images/green_piece.png";

const side = canvas.width / 10;
const offsetX = side / 2;
const offsetY = side / 2 + 20;

const images = [redPieceImg, bluePieceImg, yellowPieceImg, greenPieceImg];

const ladders = [
  [2, 23],
  [4, 68],
  [6, 45],
  [20, 59],
  [30, 96],
  [52, 72],
  [57, 96],
  [71, 92],
];

const snakes = [
  [98, 40],
  [84, 58],
  [87, 49],
  [73, 15],
  [56, 8],
  [50, 5],
  [43, 17],
];

class Player {
  constructor(room, pos, id = null, name = null, img = null) {
    this.id = id;
    this.room = room;
    this.name = name;
    this.pos = pos;
    this.img = img;
  }

  draw() {
    let xPos =
      Math.floor(this.pos / 10) % 2 == 0
        ? (this.pos % 10) * side - 15 + offsetX
        : canvas.width - ((this.pos % 10) * side + offsetX + 15);
    let yPos = canvas.height - (Math.floor(this.pos / 10) * side + offsetY);

    let image = new Image();
    image.src = this.img;
    ctx.drawImage(image, xPos, yPos, 30, 40);
  }

  updatePos(num) {
    const newpos = this.pos + num;
    if (newpos <= 99) {
      return this.isLadderOrSnake(newpos + 1) - 1;
    }
    return this.pos
  }

  isLadderOrSnake(pos) {
    let newPos = pos;

    for (let i = 0; i < ladders.length; i++) {
      if (ladders[i][0] == pos) {
        newPos = ladders[i][1];
        break;
      }
    }

    for (let i = 0; i < snakes.length; i++) {
      if (snakes[i][0] == pos) {
        newPos = snakes[i][1];
        break;
      }
    }

    return newPos;
  }
}

document.getElementById("start-btn").addEventListener("click", () => {
  room = document.getElementById("room").value;
  if(!room) return
  document.getElementById("room").disabled = true;
  document.getElementById("start-btn").hidden = true;
  document.getElementById("roll-button").hidden = false;
  document.getElementById(
    "current-player"
  ).innerHTML = `<p>Anyone can roll</p>`;
  currentPlayer = new Player(room, 0,);
  socket.emit("joinRoom", encryptMessage(JSON.stringify({room, currentPlayer}), socket.id));
});

document.getElementById("roll-button").addEventListener("click", () => {
  const num = rollDice();
  const newPos = currentPlayer.updatePos(num);
  socket.emit("rollDice", encryptMessage(JSON.stringify({
    num: num,
    id: currentPlayer.id,
    pos: newPos,
    room: currentPlayer.room
  }), socket.id));
});

function rollDice() {
  const number = Math.ceil(Math.random() * 6);
  return number;
}

function drawPins() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  players.forEach((player) => {
    player.draw();
  });
}

// Listen for events
socket.on("joinRoom", (data) => {
  document.getElementById(
    "players-table"
  ).innerHTML = ``;
  players = []
  const {roomPlayers, length} = decryptMessage(data, room)
  if(currentPlayer.id == null) currentPlayer.id = length
  roomPlayers.forEach((player) => {
    const newPlayer = new Player(player.room, player.pos, player.id, `Player ${player.id + 1}`, images[player.id])
    players.push(newPlayer);
    document.getElementById(
      "players-table"
    ).innerHTML += `<tr><td>${newPlayer.name}</td><td><img src=${newPlayer.img} height=50 width=40></td></tr>`;
  });
  drawPins();
});

socket.on("rollDice", (data) => {
  const {num, pos, id, turn} = decryptMessage(data, room)
  players[id].pos = players[id].updatePos(num);
  document.getElementById("dice").src = `./images/dice/dice${num}.png`;
  drawPins();
  console.log(turn, players, currentPlayer.id)

  if (turn != currentPlayer.id) {
    document.getElementById("roll-button").hidden = true;
    document.getElementById(
      "current-player"
    ).innerHTML = `<p>It's ${players[turn].name}'s turn</p>`;
  } else {
    document.getElementById("roll-button").hidden = false;
    document.getElementById(
      "current-player"
    ).innerHTML = `<p>It's your turn</p>`;
  }

  let winner;
  for (let i = 0; i < players.length; i++) {
    if (players[i].pos == 99) {
      winner = players[i];
      break;
    }
  }

  if (winner) {
    document.getElementById(
      "current-player"
    ).innerHTML = `<p>${winner.name} has won!</p>`;
    document.getElementById("roll-button").hidden = true;
    document.getElementById("dice").hidden = true;
    document.getElementById("restart-btn").hidden = false;
  }
});

// Logic to restart the game
document.getElementById("restart-btn").addEventListener("click", () => {
  socket.emit("restart");
});

socket.on("restart", () => {
  window.location.reload();
});
