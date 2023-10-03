const winston = require("winston");
const WinstonDailyRotateFile = require("winston-daily-rotate-file");

const logger = winston.createLogger({
    level: "info",
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
        new WinstonDailyRotateFile({
          dirname: 'logs/',
          filename: 'info-%DATE%.log',
          datePattern: "DD-MM-YYYY",
          level: "info",
          maxFiles: "60d",
        }),
        new WinstonDailyRotateFile({
          dirname: 'logs/',
          filename: 'error-%DATE%.log',
          datePattern: "DD-MM-YYYY",
          level: "error",
          maxFiles: "60d",
        }),
    ],
    exceptionHandlers: [
      new winston.transports.File({ filename: 'logs/exceptions.log' }),
    ],
    rejectionHandlers: [
      new winston.transports.File({ filename: 'logs/rejections.log' }),
    ],
});

exports.logger = logger;