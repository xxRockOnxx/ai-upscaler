import path from 'path';
import fs from 'fs';
import os from 'os';
import { BucketItem, Client } from 'minio';
import type { Storage } from './storage';
import { createStorage } from './minio';

describe('minio.ts', () => {
  let client: Client;
  let storage: Storage;

  beforeAll(async () => {
    client = new Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: Number(process.env.MINIO_PORT),
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      useSSL: process.env.MINIO_USE_SSL === 'true',
    });

    storage = createStorage(client, 'test-bucket');
  });

  beforeEach(async () => {
    if (await client.bucketExists('test-bucket')) {
      return;
    }

    await client.makeBucket('test-bucket', 'us-east-1');
  });

  afterEach(async () => {
    const objects: string[] = await new Promise((resolve, reject) => {
      const returnvalue = [];
      client
        .listObjects('test-bucket', '', true)
        .on('data', (data) => {
          returnvalue.push(data.name);
        })
        .on('end', () => resolve(returnvalue))
        .on('error', reject);
    });

    await client.removeObjects('test-bucket', objects);
    await client.removeBucket('test-bucket');
  });

  it('should delete file if exact match', async () => {
    // Arrange
    const filePath = path.join(os.tmpdir(), 'empty.txt');
    await fs.promises.writeFile(filePath, 'w');
    await storage.store('folder/subfolder/test-a', fs.createReadStream(filePath));
    await storage.store('folder/subfolder/test-b', fs.createReadStream(filePath));

    // Act
    await storage.delete('folder/subfolder/test-a');

    // Assert
    const objects: string[] = await new Promise((resolve, reject) => {
      const returnvalue = [];
      client
        .listObjects('test-bucket', '', true)
        .on('data', (data) => {
          returnvalue.push(data.name);
        })
        .on('end', () => resolve(returnvalue))
        .on('error', reject);
    });

    expect(objects).toHaveLength(1);
    expect(objects[0]).toBe('folder/subfolder/test-b');
  });

  it('should delete folder', async () => {
    // Arrange
    const filePath = path.join(os.tmpdir(), 'empty.txt');
    await fs.promises.writeFile(filePath, 'w');
    await storage.store('folder/subfolder-a/test', fs.createReadStream(filePath));
    await storage.store('folder/subfolder-b/test', fs.createReadStream(filePath));

    // Act
    await storage.delete('folder/subfolder-a');

    // Assert
    const objects: string[] = await new Promise((resolve, reject) => {
      const returnvalue = [];
      client
        .listObjects('test-bucket', '', true)
        .on('data', (data) => {
          returnvalue.push(data.name);
        })
        .on('end', () => resolve(returnvalue))
        .on('error', reject);
    });

    expect(objects).toHaveLength(1);
    expect(objects[0]).toBe('folder/subfolder-b/test');
  });

  it('should not delete anything if not file or folder', async () => {
    // Arrange
    const filePath = path.join(os.tmpdir(), 'empty.txt');
    await fs.promises.writeFile(filePath, 'w');
    await storage.store('folder/subfolder/test', fs.createReadStream(filePath));

    // Act
    await storage.delete('folder/sub');

    // Assert
    const objects: BucketItem[] = await new Promise((resolve, reject) => {
      const returnvalue = [];
      client
        .listObjects('test-bucket', '', true)
        .on('data', (data) => {
          returnvalue.push(data);
        })
        .on('end', () => resolve(returnvalue))
        .on('error', reject);
    });

    expect(objects).toHaveLength(1);
  });
});
