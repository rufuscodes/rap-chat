const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Message = sequelize.define('Message', {
        content: DataTypes.TEXT,
        userId: DataTypes.INTEGER,
    });

    return Message;
};
