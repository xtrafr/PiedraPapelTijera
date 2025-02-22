const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Store connected players
const waitingPlayers = new Set();
const playerSockets = new Map();
const playerMatches = new Map();

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        if (data.type === 'login') {
            handleLogin(ws, data.username);
        } else if (data.type === 'play') {
            handlePlay(ws, data.username, data.choice);
        }
    });

    ws.on('close', () => {
        handleDisconnect(ws);
    });
});

function handleLogin(ws, username) {
    // Store the player's socket
    playerSockets.set(username, ws);

    if (waitingPlayers.size > 0) {
        // Get the first waiting player
        const opponent = Array.from(waitingPlayers)[0];
        waitingPlayers.delete(opponent);

        // Create a match
        playerMatches.set(username, opponent);
        playerMatches.set(opponent, username);

        // Notify both players
        const opponentSocket = playerSockets.get(opponent);
        ws.send(JSON.stringify({ type: 'start', opponent }));
        opponentSocket.send(JSON.stringify({ type: 'start', opponent: username }));
    } else {
        // Add player to waiting list
        waitingPlayers.add(username);
    }
}

function handlePlay(ws, username, choice) {
    const opponent = playerMatches.get(username);
    if (!opponent) return;

    const opponentSocket = playerSockets.get(opponent);
    if (!opponentSocket) return;

    // Store the player's choice
    ws.choice = choice;
    
    // Check if both players have made their choices
    if (opponentSocket.choice) {
        const result = determineWinner(choice, opponentSocket.choice);
        ws.send(JSON.stringify({ type: 'result', result: result.player1 }));
        opponentSocket.send(JSON.stringify({ type: 'result', result: result.player2 }));
        
        // Reset choices
        ws.choice = null;
        opponentSocket.choice = null;
    }
}

function determineWinner(choice1, choice2) {
    if (choice1 === choice2) {
        return { player1: 'Draw!', player2: 'Draw!' };
    }

    const wins = {
        rock: 'scissors',
        paper: 'rock',
        scissors: 'paper'
    };

    if (wins[choice1] === choice2) {
        return { 
            player1: 'You win! ' + choice1 + ' beats ' + choice2,
            player2: 'You lose! ' + choice1 + ' beats ' + choice2
        };
    } else {
        return {
            player1: 'You lose! ' + choice2 + ' beats ' + choice1,
            player2: 'You win! ' + choice2 + ' beats ' + choice1
        };
    }
}

function handleDisconnect(ws) {
    // Find and remove the disconnected player
    for (const [username, socket] of playerSockets.entries()) {
        if (socket === ws) {
            playerSockets.delete(username);
            waitingPlayers.delete(username);
            
            // Notify opponent if in a match
            const opponent = playerMatches.get(username);
            if (opponent) {
                const opponentSocket = playerSockets.get(opponent);
                if (opponentSocket) {
                    opponentSocket.send(JSON.stringify({
                        type: 'result',
                        result: 'Opponent disconnected!'
                    }));
                }
                playerMatches.delete(username);
                playerMatches.delete(opponent);
            }
            break;
        }
    }
}

const port = process.env.PORT || 8080;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
}); 