const store = require('./store');
const events = require('./events');
const cors = require('cors');
const router = require('./routes');
const formidableMiddleware = require('express-formidable');
const mongoose = require('mongoose');
const User = require('./models/User');
const passport = require('passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const { AsyncNedb } = require('nedb-async');
const mediasoup = require('./mediasoup');
const Meeting = require('./models/Meeting');
const jwt = require('jsonwebtoken');

module.exports = async () => {
  // ---------- basic in-memory / nedb stores ----------
  store.rooms = new AsyncNedb();
  store.peers = new AsyncNedb();
  store.onlineUsers = new Map();

  // Ensure common store containers exist
  store.socketIds = store.socketIds || [];
  store.sockets = store.sockets || {};
  store.socketsByUserID = store.socketsByUserID || {};
  store.userIDsBySocketID = store.userIDsBySocketID || {};
  store.roomIDs = store.roomIDs || {};
  store.consumerUserIDs = store.consumerUserIDs || {};

  // ---------- JWT Authentication Middleware for Socket.IO ----------
  store.io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      socket.request.headers['authorization']?.split(' ')[1];

    if (!token) {
      console.log('❌ No token provided for socket');
      return next(new Error('Authentication error: No token'));
    }

    jwt.verify(token, store.config.secret, (err, decoded) => {
      if (err) {
        console.log('❌ Invalid token:', err.message);
        return next(new Error('Authentication error: Invalid token'));
      }
      socket.user = decoded; // attach decoded user info
      next();
    });
  });

  // ---------- Socket.IO connection handling ----------
  store.io.on('connection', async (socket) => {
    const { id, email } = socket.user || {};
    console.log(`✅ Socket connected: ${email || id}`);

    try {
      if (typeof mediasoup.initSocket === 'function') {
        await mediasoup.initSocket(socket);
      }
    } catch (err) {
      console.error('mediasoup.initSocket error:', err);
    }

    // join personal room
    if (id) socket.join(id);

    // attach event handlers
    if (Array.isArray(events)) {
      events.forEach((event) => {
        if (event && event.tag && typeof event.callback === 'function') {
          socket.on(event.tag, (data) => event.callback(socket, data));
        }
      });
    }

    // store socket references
    store.socketIds.push(socket.id);
    store.sockets[socket.id] = socket;
    if (id) {
      store.socketsByUserID[id] = store.socketsByUserID[id] || [];
      store.socketsByUserID[id].push(socket);
      store.userIDsBySocketID[socket.id] = id;
    }

    // mark online
    store.onlineUsers.set(socket.id, { id, status: 'online' });
    store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));

    // disconnect handler
    socket.on('disconnect', async () => {
      console.log(`❌ Socket disconnected: ${email || id}`);
      try {
        const roomID = store.roomIDs[socket.id];
        if (roomID && store.consumerUserIDs[roomID]) {
          store.consumerUserIDs[roomID] = store.consumerUserIDs[roomID].filter((sid) => sid !== socket.id);
          socket.to(roomID).emit('consumers', {
            content: store.consumerUserIDs[roomID],
            timestamp: Date.now(),
          });
          socket.to(roomID).emit('leave', { socketID: socket.id });
        }

        await Meeting.updateMany({}, { $pull: { peers: socket.id } });
        await store.peers.remove({ socketID: socket.id }, { multi: true });

        store.socketIds = store.socketIds.filter((sid) => sid !== socket.id);
        delete store.sockets[socket.id];
        if (id && store.socketsByUserID[id]) {
          store.socketsByUserID[id] = store.socketsByUserID[id].filter((s) => s.id !== socket.id);
        }
        delete store.userIDsBySocketID[socket.id];

        if (id) {
          await User.findByIdAndUpdate(id, { $set: { lastOnline: Date.now() } });
        }

        store.onlineUsers.delete(socket.id);
        store.io.emit('onlineUsers', Array.from(store.onlineUsers.values()));
      } catch (err) {
        console.error('Disconnect cleanup error:', err);
      }
    });
  });

  // ---------- Express middlewares ----------
  store.app.use(cors());
  store.app.use(formidableMiddleware());
  store.app.use(passport.initialize());

  // ---------- Passport JWT strategy ----------
  passport.use(
    'jwt',
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: store.config.secret,
      },
      async (payload, done) => {
        try {
          const user = await User.findById(payload.id);
          if (!user) return done(null, false);
          return done(null, user);
        } catch (err) {
          console.error('Passport JWT error:', err);
          done(err, false);
        }
      },
    ),
  );

  // ---------- API Routes ----------
  store.app.use('/api', router);

  // ---------- MongoDB connection ----------
  const mongooseConnect = async () => {
    try {
      const uri = store.config.mongo.uri;
      mongoose.set('strictQuery', false);
      await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
      console.log('✅ Connected to DB'.green);
      store.connected = true;
    } catch (err) {
      console.log('❌ Unable to connect to DB'.red, err);
      store.connected = false;
      setTimeout(mongooseConnect, 10000);
    }
  };

  mongooseConnect();
};
