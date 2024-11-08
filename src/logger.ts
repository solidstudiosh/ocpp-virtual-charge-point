import { createLogger, format, transports } from "winston";

export const logger = createLogger({
  transports: [
    new transports.Console({
      format: format.combine(
        format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        format.colorize(),
        format.simple(),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`,
        ),
      ),
      level: process.env["LOG_LEVEL"] ?? "info",
    }),
  ],
});
