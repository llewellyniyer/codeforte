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
let scoreboard = {};
let currentPlayer; // Player object for individual players
let showingScoreboard;
const components = {
  table: "players-table",
  labelTable: "players-label",
  buttonStart: "start-btn",
  inputForm: "form-input",
  buttonRoll: "roll-button",
  labelTurn: "current-player",
  imageDice: "dice",
  buttonRestart: "restart-btn",
};

Object.keys(components).forEach((key) => {components[key] = document.getElementById(components[key])});

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
  constructor(pos, name = null, id = null, img = null) {
    this.id = id;
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

function renderScoreboard() {
  renderTable(
    Object.entries(scoreboard).sort((a, b) => b[1] - a[1]).map(([name, score]) => `<tr><td>${name}</td><td>${score}</td></tr>`),
    false,
  );
}

function renderPlayers() {
  renderTable(
    players.map(({name, img}) => `<tr><td>${name}</td><td><img src=${img} height=50 width=40></td></tr>`),
    true,
  );
}

function renderTable(rows, showingPlayers) {
  components.table.innerHTML = '';
  components.labelTable.innerHTML = showingPlayers ? `Players currently online:` : `Scoreboard:`;
  rows.forEach((row) => {
    components.table.innerHTML += row;
  });
  components.buttonStart.innerText = showingPlayers ? 'Score' : 'Players';
  showingScoreboard = !showingPlayers;
}

components.buttonStart.addEventListener("click", () => {
  const {value} = components.inputForm;
  if(!value) return alert('Please enter something');
  if(!room) {
    room = value;   
    components.inputForm.placeholder = 'Name'
    components.inputForm.value = '';
    components.buttonStart.innerText = 'Join'
    return;
  }
  if(!currentPlayer) {
    components.inputForm.disabled = true;
    components.buttonRoll.hidden = false;
    components.labelTurn.innerHTML = `<p>Anyone can roll</p>`;
    currentPlayer = new Player(0, value);
    socket.emit("joinRoom", encryptMessage({room, currentPlayer}, socket.id));
    return;
  }
  if(!showingScoreboard) {
    return renderScoreboard(); 
  }
  renderPlayers();
})

components.buttonRoll.addEventListener("click", () => {
  const num = rollDice();
  const newPos = players[currentPlayer.id].updatePos(num);
  socket.emit("rollDice", encryptMessage({
    num: num,
    id: currentPlayer.id,
    pos: newPos,
    room
  }, socket.id));
});

function rollDice() {
  return Math.ceil(Math.random() * 6);
}

function drawPins() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  players.forEach((player) => player.draw());
}

// Listen for events
socket.on("joinRoom", (data) => {
  const {roomPlayers, length, roomScoreboard} = decryptMessage(data, room)
  scoreboard = roomScoreboard
  if(currentPlayer.id == null) currentPlayer.id = length
  players = roomPlayers.map((player) => new Player(player.pos, player.name,  player.id, images[player.id]))
  renderPlayers();
  drawPins();
});

socket.on("rollDice", (data) => {
  const {num, pos, id, turn, winner, roomScoreboard} = decryptMessage(data, room)
  players[id].pos = pos;
  components.imageDice.src = `./images/dice/dice${num}.png`;
  drawPins();

  const myTurn = turn == currentPlayer.id
  components.buttonRoll.hidden = !myTurn;
  components.labelTurn.innerHTML = !myTurn 
    ? `<p>It's ${players[turn].name}'s turn</p>`
    : `<p>It's your turn</p>`

  if (winner) {
    scoreboard = roomScoreboard
    components.labelTurn.innerHTML = `<p>${winner.name} has won!</p>`;
    renderScoreboard();
    components.buttonRoll.hidden = true;
    components.imageDice.hidden = true;
    components.buttonRestart.hidden = false;
  }
});

// Logic to restart the game
components.buttonRestart.addEventListener("click", () => {
  socket.emit("restart", encryptMessage({room}, socket.id));
});

socket.on("restart", (data) => {
  const {roomPlayers} = decryptMessage(data, room)
  players = roomPlayers.map((player) => new Player(player.pos, player.name,  player.id, images[player.id]))
  components.buttonRoll.hidden = false;
  components.buttonRestart.hidden = true;
  components.imageDice.hidden = false;
  components.labelTable.innerHTML = `<p>Anyone can roll</p>`;
  drawPins();
});
