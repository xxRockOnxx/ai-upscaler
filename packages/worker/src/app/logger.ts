import winston from 'winston';
import Transport from 'winston-transport';
import DiscordTransport from './discord-transport';

const transports: Transport[] = [
  new winston.transports.Console(),
];

if (process.env.DISCORD_LOGGER === 'true') {
  transports.push(new DiscordTransport({
    webhook: process.env.DISCORD_WEBHOOK,
    level: 'error',
  }));
}

export default winston.createLogger({
  transports,
});
