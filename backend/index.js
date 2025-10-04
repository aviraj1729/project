require('colors');

console.log(`${'Honeyside'.yellow} © ${'2022'.yellow}`);
console.log(`Welcome to ${'Clover'.cyan}`);

const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io');
const store = require('./src/store');
const init = require('./src/init');

const Config = require('./config');
if (Config.ip && Config.mediasoup && Config.mediasoup.webRtcTransport) {
  Config.mediasoup.webRtcTransport.listenIps[0].ip = Config.ip;
}

// Safe Mediasoup import with stub fallback
let mediasoup;
try {
  mediasoup = require('./src/mediasoup');

  if (process.env.DISABLE_MEDIASOUP === 'true') {
    console.log('Mediasoup disabled (stub mode)'.yellow);
    mediasoup = {
      init: () => console.log('Mediasoup stub init called'),
      createWorker: () => null,
      createTransport: () => null,
    };
  }
} catch (err) {
  console.log('Mediasoup not available, using stub'.yellow);
  mediasoup = {
    init: () => console.log('Mediasoup stub init called'),
    createWorker: () => null,
    createTransport: () => null,
  };
}

// Middleware to check DB connection
app.use((req, res, next) => (store.connected ? next() : res.status(500).send('Database not available.')));

// Serve frontend build
app.use(express.static(`${__dirname}/../frontend/dist`));
app.use(['/login', '/login/*', '/admin', '/room/*', '/meeting/*'], express.static(`${__dirname}/../frontend/dist`));

const server = http.createServer(app);

// Attach store for later use
store.app = app;
store.config = Config;

// Socket.IO setup
store.io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL], // frontend dev URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

init();
mediasoup.init(); // safe stub or real Mediasoup

// Start server
const listen = () => server.listen(Config.port, () => console.log(`Server listening on port ${Config.port}`.green));

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('Specified port unavailable, retrying in 10 seconds...'.red);
    setTimeout(() => {
      server.close();
      server.listen(Config.port);
    }, Config.retryAfter);
  }
});

listen();

// -------------------------------------------
// Cron job mail scheduler
// -------------------------------------------
const schedule = require('node-schedule');
const Email = require('./src/models/Email');
const sendMail = require('./src/utils/sendMail');
const { configDotenv } = require('dotenv');

let scheduler;
let schedulerDone = false;

if (Config.nodemailerEnabled) {
  if (!scheduler)
    scheduler = schedule.scheduleJob('*/5 * * * * *', async () => {
      if (schedulerDone) return;
      schedulerDone = true;

      try {
        const emails = await Email.find({ sent: false });
        for (let email of emails) {
          try {
            await sendMail({
              from: email.from,
              to: email.to,
              subject: email.subject,
              html: email.html,
            });
            email.sent = true;
            email.dateSent = Date.now();
            await email.save();
          } catch (e) {
            console.error('Error sending email:', e);
          }
        }
      } catch (err) {
        console.error('Error fetching unsent emails:', err);
      }

      schedulerDone = false;
    });
}

// -------------------------------------------
// Socket.IO safe event handling for Mediasoup
// -------------------------------------------
store.io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Safe Mediasoup event examples
  if (mediasoup) {
    socket.on('newProducer', (data) => {
      console.log('newProducer (stub safe):', data);
    });

    socket.on('removeProducer', (data) => {
      console.log('removeProducer (stub safe):', data);
    });
  }

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});
