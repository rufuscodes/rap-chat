
const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const socket = io();



// Message from server
socket.on('message', message => {
    console.log(message);
    outputMessage(message);
})

// message submit
chatForm.addEventListener('submit', (e) => { 
    e.preventDefault();

    // Get message text
    const msg = e.target.elements.msg.value;

    // Emit message to server
    console.log(msg);
    socket.emit('chatMessage', msg);

});


// Output message to DOM
function outputMessage (message) {
    const div = document.createElement('div');
    div.classList.add('message');
    div.innerHTML = `<p class="meta">Rufus <span>13:37pm</span></p> <p class="text"> ${message} </p>`;
    document.querySelector('.chat-messages').appendChild(div);
}