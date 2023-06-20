const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');

if (chatForm && chatMessages && roomName && userList) {
    // Get username and room from URL
    const { username, room } = Qs.parse(location.search, {
        ignoreQueryPrefix: true
    });

    // Connect to socket.io
    const socket = io();

    // Join chatroom
    socket.emit('joinRoom', { username, room });

    // Get room and users
    socket.on('roomUsers', ({ room, users }) => {
        outputRoomName(room);
        outputUsers(users);
    });

    // Message from server
    socket.on('message', message => {
        outputMessage(message);

        // Scroll down
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    // Message submit
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const msg = e.target.elements.msg.value;

        // Emit a chatMessage event to the socket
        socket.emit('chatMessage', msg);

        e.target.elements.msg.value = '';
        e.target.elements.msg.focus();
    });


    // Output message to DOM
    function outputMessage(message) {
        console.log(message);
        const div = document.createElement('div');
        div.classList.add('message');
        div.innerHTML = `<p class="meta">${ message.username } <span>${ message.time }</span></p>
    <img src="${ message.profilePictureUrl }" alt="Profile Picture">
    <p class="text">${ message.userID }</p>`;
        if (chatMessages) {
            chatMessages.appendChild(div);
        }
    }

    // Add room name to DOM
    function outputRoomName(room) {
        if (roomName) {
            roomName.innerText = room;
        }
    }

    // Add users to DOM
    function outputUsers(users) {
        if (userList) {
            userList.innerHTML = users
                .map((user) => `<li>${ user.username }</li>`)
                .join('');
        }
    }
}