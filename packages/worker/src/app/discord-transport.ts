import Transport, { TransportStreamOptions } from 'winston-transport';
import { $fetch } from 'ohmyfetch';

const colorMap = new Map();

colorMap
  .set('error', 15680580)
  .set('warn', 15381256)
  .set('info', 959977);

export interface DiscordTransportOptions extends TransportStreamOptions {
  webhook: string;
}

export default class DiscordTransport extends Transport {
  webhook: string;

  constructor({ webhook, ...opts }: DiscordTransportOptions) {
    super(opts);
    this.webhook = webhook;
  }

  log(info, callback) {
    if (typeof info !== 'object') {
      // eslint-disable-next-line no-console
      console.warn('DiscordTransport: Unknown log format. Not sending to Discord.', info);
      return;
    }

    // These should exist according to:
    // https://github.com/winstonjs/winston#streams-objectmode-and-info-objects
    // eslint-disable-next-line prefer-const
    let { level, message, ...other } = info;

    if (Object.keys(other).length > 0) {
      message += '\n';
      message += '```\n';
      message += JSON.stringify(other, null, 2);
      message += '\n```';
    }

    const body = {
      embeds: [{
        title: level.slice(0, 1).toUpperCase() + level.slice(1),
        color: colorMap.get(level),
        description: message,
        timestamp: (new Date()).toISOString(),
      }],
    };

    $fetch(this.webhook, {
      method: 'POST',
      body,
    })
      .then(() => callback())
      .catch((err) => {
        console.error(new Error('Failed to send log to Discord', { cause: err }));
        console.error(err.data);
      });
  }
}
