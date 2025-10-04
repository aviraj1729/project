require('dotenv').config();

module.exports = {
  // App version info
  appVersion: process.env.APP_VERSION || '2.9.1',
  appBuild: process.env.APP_BUILD || '100',

  // Server settings
  port: process.env.PORT || 4000,
  secret: process.env.AUTH_SECRET || 'jwt-default-secret',

  // MongoDB configuration
  mongo: {
    uri: process.env.MONGO_URI || '',
    srv: (process.env.MONGO_SRV || 'false') === 'true',
    username: process.env.MONGO_USERNAME || '',
    password: process.env.MONGO_PASSWORD || '',
    authenticationDatabase: process.env.MONGO_AUTHENTICATION_DATABASE || '',
    hostname: process.env.MONGO_HOSTNAME || 'localhost',
    port: process.env.MONGO_PORT || 27017,
    database: process.env.MONGO_DATABASE_NAME || 'clover',
  },

  // Data folder
  dataFolder: './data',

  // Root/admin user credentials
  rootUser: {
    username: process.env.ROOT_USER_USERNAME || 'admin',
    email: process.env.ROOT_USER_EMAIL || 'admin@example.com',
    password: process.env.ROOT_USER_PASSWORD || 'admin123',
    firstName: process.env.ROOT_USER_FIRST_NAME || 'Admin',
    lastName: process.env.ROOT_USER_LAST_NAME || 'User',
  },

  // IP Address for WebRTC
  ipAddress: {
    ip: process.env.MAPPED_IP === 'true' ? '0.0.0.0' : process.env.PUBLIC_IP_ADDRESS || '127.0.0.1',
    announcedIp: process.env.MAPPED_IP === 'true' ? process.env.PUBLIC_IP_ADDRESS || null : null,
  },

  // Nodemailer
  nodemailerEnabled: process.env.NODEMAILER_ENABLED === 'true' || false,
  nodemailer: {
    from: process.env.NODEMAILER_FROM || 'admin@example.com',
  },
  nodemailerTransport: {
    service: process.env.NODEMAILER_SERVICE || undefined,
    host: process.env.NODEMAILER_HOST || 'smtp.yourdomain.tld',
    port: process.env.NODEMAILER_PORT || 587,
    secure: process.env.NODEMAILER_SECURE === 'true',
    auth: {
      user: process.env.NODEMAILER_USER || '',
      pass: process.env.NODEMAILER_PASS || '',
    },
  },

  // Retry & media settings
  retryAfter: 10000,
  sizes: [256, 512, 1024, 2048],
  mediaCodecs: [
    { kind: 'audio', mimeType: 'audio/opus', clockRate: 48000, channels: 2 },
    { kind: 'video', mimeType: 'video/VP8', clockRate: 90000, parameters: { 'x-google-start-bitrate': 1000 } },
  ],
  rtcMinPort: 10000,
  rtcMaxPort: 12000,
  mediasoupLogLevel: 'warn', // keep if you still use mediasoup locally
};
