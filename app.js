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
const { Sequelize } = require('sequelize');
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

// Define models
const userModel = User(sequelize);
const messageModel = Message(sequelize);

// Set up associations
userModel.hasMany(messageModel, { foreignKey: 'userId' });
messageModel.belongsTo(userModel, { foreignKey: 'userId' });

// Sync models with the database
sequelize.sync({ alter: true })
  .then(() => {
    console.log('Database connected');
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error);
  });

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
      const user = await userModel.findOne({ where: { username } });
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
    const user = await userModel.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

sessionStore.sync();

app.get('/', (req, res) => {
  res.render('index', { username: req.user ? req.user.username : '' });
});

app.get('/chat', async (req, res) => {
  const { username, room } = req.query;
  try {
    const roomUsers = await getRoomUsers(room); // Fetch room users from the database
    res.render('chat', { username, room, users: roomUsers });
  } catch (error) {
    console.error(error);
    res.render('chat', { username, room, users: [] }); // Handle error by passing an empty array of users
  }
});

app.post('/chat', async (req, res) => {
  const { username, room } = req.body;

  // Check if the username is empty
  if (!username) {
    return res.status(400).send('Username is required');
  }

  try {
    // Check if the username is already taken
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      return res.status(409).send('Username is already taken');
    }

    // Perform other necessary operations

    // Redirect the user to the chat page with the provided username and room as query parameters
    res.redirect(`/chat?username=${ encodeURIComponent(username) }&room=${ encodeURIComponent(room) }`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});





app.get('/signup', (req, res) => {
  res.render('signup');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await userModel.create({ username, password: hashedPassword });
    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.redirect('/signup');
  }
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/chat',
  failureRedirect: '/login',
}), (req, res) => {
  console.log('Login success:', req.user);
  console.log('Login session:', req.session);
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

io.on('connection', (socket) => {
  socket.on('joinRoom', async ({ userId, username, room }) => {
    try {
      const user = await userJoin(userId, username, room);
      socket.join(user.room);
      socket.emit('message', formatMessage(user.userId, user.username, 'Welcome to the chat!'));
      socket.broadcast.to(user.room).emit('message', formatMessage(user.userId, user.username, `${ user.username } has joined the chat`));

      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: await getRoomUsers(user.room),
      });
    } catch (error) {
      console.error(error);
    }
  });

  socket.on('chatMessage', async (msg) => {
    try {
      const user = getCurrentUser(socket.id);
      const message = await messageModel.create({ content: msg, userId: user.userId });
      io.to(user.room).emit('message', formatMessage(user.userId, user.username, message.content));
    } catch (error) {
      console.error(error);
    }
  });

  socket.on('disconnect', async () => {
    try {
      const user = userLeave(socket.id);
      if (user) {
        io.to(user.room).emit('message', formatMessage(user.userId, user.username, `${ user.username } has left the chat`));

        io.to(user.room).emit('roomUsers', {
          room: user.room,
          users: await getRoomUsers(user.room),
        });
      }
    } catch (error) {
      console.error(error);
    }
  });
});

const PORT = 3000 || process.env.PORT;

server.listen(PORT, () => console.log(`Server running on port ${ PORT }`));
