require('dotenv').config()
const express = require('express')
const socket = require('socket.io')
const http = require('http')
const CryptoJS = require('crypto-js')
const { MongoClient, ServerApiVersion } = require('mongodb')

const app = express()
const PORT = process.env.PORT || 3000
const server = http.createServer(app)

// Set static folder
app.use(express.static('public'))

// Socket setup
const io = socket(server)

// Players array
let users = {}
const client = new MongoClient(
  `mongodb+srv://root:${process.env.MONGO_PASSWORD ?? ''}@cluster0.grge97u.mongodb.net/?retryWrites=true&w=majority`
)
const database = client.db('codeforte')
const scoreboards = database.collection('scoreboards')

function encryptMessage (message, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(message), key).toString()
}

function decryptMessage (encryptedMessage, key) {
  return JSON.parse(
    CryptoJS.AES.decrypt(encryptedMessage, key).toString(CryptoJS.enc.Utf8)
  )
}

function getScoreboard (room) {
  return scoreboards.findOne({ room })
}

io.on('connection', socket => {
  console.log('Made socket connection', socket.id)

  socket.on('joinRoom', async data => {
    const { room, currentPlayer } = decryptMessage(data, socket.id)
    socket.join(room)
    const players = users[room] || []
    const { length } = players
    currentPlayer.id = length
    players.push(currentPlayer)
    users[room] = players
    const scoreboard = await getScoreboard(room)
    const roomScoreboard = scoreboard ? scoreboard.scoreboard : {}
    const encryptedMessage = encryptMessage(
      { roomPlayers: players, length, roomScoreboard },
      room
    )
    io.to(room).emit('joinRoom', encryptedMessage)
  })

  socket.on('rollDice', async data => {
    const diceRoll = decryptMessage(data, socket.id)
    const { room, num, pos, id } = diceRoll
    users[room][id].pos = pos
    const players = users[room]
    const winner = players.find(({ pos }) => pos == 99)
    const turn = num != 6 ? (id + 1) % players.length : id
    let scoreboard;
    if (winner) {
      const roomScoreboard = await getScoreboard(room);
      scoreboard = roomScoreboard ? roomScoreboard.scoreboard : {}
      let score = scoreboard[winner.name] ?? 0
      score++
      scoreboard[winner.name] = score
      await scoreboards.updateOne({ room }, { $set: {scoreboard} }, {upsert: true})
    }
    const encryptedMessage = encryptMessage({ ...diceRoll, turn, winner, roomScoreboard: scoreboard }, room)
    io.to(room).emit('rollDice', encryptedMessage)
  })

  socket.on('restart', data => {
    const { room } = decryptMessage(data, socket.id)
    for (let index = 0; index < users[room].length; index++) {
      users[room][index].pos = 0;
    }
    const encryptedMessage = encryptMessage(
      { roomPlayers: users[room] },
      room
    )
    io.to(room).emit('restart', encryptedMessage)
  })
})

server.listen(PORT, () => console.log(`Server running on port ${PORT}`))
