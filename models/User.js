const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        profilePictureUrl: {
            type: DataTypes.STRING,
        },
        room: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    });

    User.prototype.validPassword = async function (password) {
        try {
            return await bcrypt.compare(password, this.password);
        } catch (error) {
            throw error;
        }
    };


    User.addHook('beforeCreate', async (user) => {
        try {
            const salt = await bcrypt.genSalt(10);
            user.password = await bcrypt.hash(user.password, salt);
        } catch (error) {
            throw error;
        }
    });

    // Add a custom class method for finding a user by username
    User.findByUsername = async function (username) {
        return await this.findOne({ where: { username } });
    };

    return User;
};
