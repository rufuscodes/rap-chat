const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');
const formatMessage = require('./utils/messages');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const multer = require('multer');
const AWS = require('aws-sdk');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Message = require('./models/Message');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Set up static folder
app.use(express.static(path.join(__dirname, 'public')));

const sequelize = new Sequelize('rapchat', 'postgres', 'null', {
  host: 'localhost',
  dialect: 'postgres',
});

User(sequelize, DataTypes);
Message(sequelize, DataTypes);

const sessionStore = new SequelizeStore({
  db: sequelize,
});

app.use(session({
  secret: 'sfdasdfasdfasdfasdfasdfwe245tgsfdg', // replace 'secret' with a random string
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
}));

app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
  async (username, password, done) => {
    try {
      const user = await sequelize.models.User.findOne({ where: { username } });
      if (!user) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      if (!await user.validPassword(password)) {
        return done(null, false, { message: 'Incorrect password.' });
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await sequelize.models.User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

sessionStore.sync();

app.get('/', (req, res) => {
  res.render('index', { username: req.user ? req.user.username : '' });
});

app.get('/chat', (req, res) => {
  const { username, room } = req.query;
  const roomUsers = getRoomUsers(room); // Assuming getRoomUsers returns the users in the room

  res.render('chat', { username, room, users: roomUsers });
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  await sequelize.models.User.create({ username, password });
  res.redirect('/login');
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
}), (req, res) => {
  req.session.username = req.user.username; // Store the username in the session
});

const upload = multer({ dest: 'uploads/' });

const s3 = new AWS.S3({
  accessKeyId: 'your-access-key-id', // replace with your access key id
  secretAccessKey: 'your-secret-access-key', // replace with your secret access key
  endpoint: 'your-digitalocean-spaces-endpoint', // replace with your DigitalOcean Spaces endpoint
  region: 'your-digitalocean-spaces-region', // replace with your DigitalOcean Spaces region
});

app.post('/upload-profile-picture', upload.single('profilePicture'), async (req, res) => {
  const file = req.file;

  const params = {
    Bucket: 'your-bucket-name', // replace with your bucket name
    Key: file.filename,
    Body: fs.createReadStream(file.path),
    ACL: 'public-read',
  };

  s3.upload(params, async (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).send(err);
    }

    const profilePictureUrl = data.Location;
    req.user.profilePictureUrl = profilePictureUrl;
    await req.user.save();

    res.redirect('/profile');
  });
});

io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);
    socket.join(user.room);
    socket.emit('message', formatMessage(user.username, 'Welcome to the chat!'));
    socket.broadcast
      .to(user.room)
      .emit('message', formatMessage(user.username, `${ user.username } has joined the chat`));

    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room),
    });
  });

  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });

  socket.on('disconnect', () => {
    const user = userLeave(socket.id);
    if (user) {
      io.to(user.room).emit('message', formatMessage(user.username, `${ user.username } has left the chat`));

      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room),
      });
    }
  });
});

app.post('/chat', (req, res) => {
  const { username, room } = req.query;

  // Emit the joinRoom event to the socket
  io.emit('joinRoom', { username, room });

  res.redirect(`/chat?username=${ username }&room=${ room }`); // Redirect to the chatroom page after joining the room
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => console.log(`Server running on port ${ PORT } `));
