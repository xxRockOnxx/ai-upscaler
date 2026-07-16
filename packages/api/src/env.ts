const requiredEnvVariables = [
  'APP_SECRET',

  'REDIS_HOST',
  'REDIS_PORT',

  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
];

export default function assertRequiredEnv(): void {
  // eslint-disable-next-line no-restricted-syntax
  for (const variable of requiredEnvVariables) {
    if (!process.env[variable]) {
      throw new Error(`missing \`${variable}\` env variable`);
    }
  }
}
