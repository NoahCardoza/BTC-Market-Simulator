const { createLogger, format, transports } = require('winston')
const { combine, timestamp, printf } = format

const level = process.env.LOG_LEVEL || 'debug';

const loggerFormat = printf(info => `[${info.timestamp}] (${info.level}) ${info.message}`);

const logger = createLogger({
  format: combine(
    format.splat(),
    format.simple(),
    timestamp(),
    loggerFormat
  ),
  transports: [
      new transports.Console({
          level: level,
          timestamp: function () {
              return (new Date()).toISOString();
          }
      })
  ]
});

module.exports = logger
