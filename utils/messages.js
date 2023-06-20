const moment = require('moment');

function formatMessage(userId, username, text, profilePictureUrl) {
    return {
        userId,
        username,
        text,
        time: moment().format('h:mm a'),
        profilePictureUrl,
    };
}

module.exports = formatMessage;
