require('colors');

console.log(`${'Honeyside'.yellow} © ${'2022'.yellow}`);
console.log(`Welcome to ${'Clover'.cyan}`);

const express = require('express');
const app = express();
const http = require('http');
const { Server } = require('socket.io'); // ✅ Correct import
const store = require('./src/store');
const init = require('./src/init');
const mediasoup = require('./src/mediasoup');

const Config = require('./config'); // ✅ use const, not global
if (Config.ip) Config.mediasoup.webRtcTransport.listenIps[0].ip = Config.ip;

// Middleware to check DB connection
app.use((req, res, next) => (store.connected ? next() : res.status(500).send('Database not available.')));

// Serve frontend build
app.use(express.static(`${__dirname}/../frontend/dist`));
app.use(['/login', '/login/*', '/admin', '/room/*', '/meeting/*'], express.static(`${__dirname}/../frontend/dist`));

const server = http.createServer(app);

// ✅ Attach to store for later use
store.app = app;
store.config = Config;

// ✅ Add proper Socket.IO CORS configuration
store.io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173'], // frontend dev URL
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

init();
mediasoup.init();

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
