require('dotenv').config();
const express = require("express");
const socket = require("socket.io");
const http = require("http");
const CryptoJS = require('crypto-js')

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Set static folder
app.use(express.static("public"));

// Socket setup
const io = socket(server);

// Players array
let users = {};

function encryptMessage(message, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(message), key).toString();
}

function decryptMessage(encryptedMessage, key) {
 return JSON.parse(CryptoJS.AES.decrypt(encryptedMessage, key).toString(CryptoJS.enc.Utf8));
}

io.on("connection", (socket) => {
  console.log("Made socket connection", socket.id);

  socket.on("joinRoom", (data) => {
    const {room, currentPlayer} = JSON.parse(decryptMessage(data, socket.id));
    socket.join(room);
    const players = users[room] || [];
    const {length} = players
    currentPlayer.id = length;
    players.push(currentPlayer);
    users[room] = players
    const encryptedMessage = encryptMessage({roomPlayers: players, length}, room);
    io.to(room).emit("joinRoom", encryptedMessage);
  });

  socket.on("rollDice", (data) => {
    const diceRoll = JSON.parse(decryptMessage(data, socket.id));
    const {room, num, pos, id} = diceRoll;
    const players = users[room]
    users[room][id].pos = pos;
    const turn = num != 6 ? (id + 1) % players.length : id;
    const encryptedMessage = encryptMessage({...diceRoll, turn}, room);
    io.to(room).emit("rollDice", encryptedMessage);
  });

  socket.on("restart", () => {
    users = [];
    io.sockets.emit("restart");
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
