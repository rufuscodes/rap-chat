const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const formatMessage = require('./utils/messages');
const app = express();
const Server = http.createServer(app);
const io = socketio(Server);


// Set static folder
app.use(express.static(path.join(__dirname, "public")));
const rapBot = 'RapBot';
// Run when client connects
io.on('connection', socket => { 
    console.log('New Web Socket Connection...') 
    socket.emit('message', formatMessage(rapBot, 'Welcome to RapChat!'));

    // Broadcast when a user connects
    socket.broadcast.emit('message', formatMessage(rapBot, 'A user has joined the chat'));
    console.log('A user has joined the chat');

    //Runs when client disconnects
    socket.on('disconnect', () => {
        io.emit('message',formatMessage(rapBot, 'A user has left the chat'));
        console.log('User has left the chat');
    });

    // listen for chatMessage
    socket.on('chatMessage', (msg) => { 
        console.log(msg);
        io.emit('message', formatMessage('USER', msg)); 
    });


});

const PORT = 3000 || process.env.PORT;
Server.listen(PORT, () => console.log(`Server running on port ${PORT}`));