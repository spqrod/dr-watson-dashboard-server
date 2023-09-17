const winston = require("winston");

const logger = winston.createLogger({
    level: "info",
    level: "error",
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss Z',
      }),
      winston.format.printf(
        (info) => `${info.timestamp}. ${info.level}: ${info.message}`
      ),
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          level: "info",
          filename: 'logs/info.log'
        }),
        new winston.transports.File({
          level: "error",
          filename: 'logs/error.log'
        }),
        // fileRotateTransport
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
});

exports.logger = logger;