const moment = require('moment');

function formatMessage(userId, username, text, profilePictureUrl) {
    return {
        userId,
        username,
        time: moment().format('h:mm a'),
        text,
        profilePictureUrl,
    };
}

module.exports = formatMessage;
