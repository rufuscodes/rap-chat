const User = require('./models/User');

async function getAllUsers() {
    try {
        const users = await User.findAll();
        return users;
    } catch (error) {
        // Handle any errors that occur during the database operation
        console.error(error);
        throw error;
    }
}

module.exports = {
    getAllUsers,
};
