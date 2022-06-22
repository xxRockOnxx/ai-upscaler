module.exports = {
  apps: [
    {
      name: 'http',
      script: 'yarn',
      args: 'start-http',
      interpreter: '/bin/bash',
    },
    {
      name: 'worker',
      script: 'yarn',
      args: 'start-worker',
      interpreter: '/bin/bash',
    },
  ],
};
