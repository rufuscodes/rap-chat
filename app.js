const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');

const app = express();
const Server = http.createServer(app);
const io = socketio(Server);


// Set static folder
app.use(express.static(path.join(__dirname, "public")));

// Run when client connects
io.on('connection', socket => { console.log('New Web Socket Connection...') });

const PORT = 3000 || process.env.PORT;
Server.listen(PORT, () => console.log(`Server running on port ${PORT}`));