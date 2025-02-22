const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Game logic
const choices = ['rock', 'paper', 'scissors'];

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 'draw';
  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'scissors' && choice2 === 'paper') ||
    (choice1 === 'paper' && choice2 === 'rock')
  ) {
    return 'player1';
  }
  return 'player2';
}

let players = [];
let waitingPlayer = null;

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const data = JSON.parse(message);

    if (data.type === 'login') {
      if (waitingPlayer) {
        // Start the game with the waiting player
        const opponent = waitingPlayer;
        waitingPlayer = null;

        const player1 = { ws, username: data.username };
        const player2 = { ws: opponent.ws, username: opponent.username };

        player1.ws.send(JSON.stringify({ type: 'start', opponent: player2.username }));
        player2.ws.send(JSON.stringify({ type: 'start', opponent: player1.username }));

        players.push(player1, player2);
      } else {
        // Set this player as waiting
        waitingPlayer = { ws, username: data.username };
      }
    } else if (data.type === 'play') {
      const playerIndex = players.findIndex(p => p.ws === ws);
      const opponentIndex = playerIndex === 0 ? 1 : 0;

      ws.choice = data.choice; // Store the player's choice

      if (players[opponentIndex] && players[opponentIndex].choice) {
        const opponentChoice = players[opponentIndex].choice;
        const result = determineWinner(data.choice, opponentChoice);

        const playerMessage = result === 'draw' ? 'Draw!' : result === 'player1' ? 'You win!' : 'You lose!';
        const opponentMessage = result === 'draw' ? 'Draw!' : result === 'player2' ? 'You win!' : 'You lose!';

        ws.send(JSON.stringify({ type: 'result', result: playerMessage }));
        players[opponentIndex].ws.send(JSON.stringify({ type: 'result', result: opponentMessage }));

        // Reset choices
        players[playerIndex].choice = null;
        players[opponentIndex].choice = null;
      } else {
        players[playerIndex].choice = data.choice; // Store the choice for later
      }
    }
  });

  ws.on('close', () => {
    players = players.filter(player => player.ws !== ws);
    if (waitingPlayer && waitingPlayer.ws === ws) {
      waitingPlayer = null;
    }
  });

  ws.send('Welcome to Rock-Paper-Scissors!');
});

server.listen(8080, () => {
  console.log('Server is listening on port 8080');
}); 