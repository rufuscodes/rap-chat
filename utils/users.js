const users = [];

// Join user to chat
function userJoin(userId, username, room) {
    const user = { userId, username, room };
    users.push(user);
    return user;
}

// Get the current user
function getCurrentUser(userId) {
    return users.find((user) => user.userId === userId);
}

// User leaves chat
function userLeave(userId) {
    const index = users.findIndex((user) => user.userId === userId);
    if (index !== -1) {
        // Remove the user
        return users.splice(index, 1)[0];
    }
}

// Get room users
function getRoomUsers(room) {
    return users.filter((user) => user.room === room);
}

module.exports = {
    userJoin,
    getCurrentUser,
    userLeave,
    getRoomUsers,
};
