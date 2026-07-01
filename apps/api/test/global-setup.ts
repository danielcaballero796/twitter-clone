import { config } from 'dotenv';
import { connect } from 'node:net';

config();

const url = new URL(
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/twitter_test',
);

// Preflight the DB port before any test runs: without this, a wrong port
// surfaces as a misleading Prisma authentication error instead of a
// connection failure.
export default async function globalSetup(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const port = Number(url.port) || 5432;
    const socket = connect({ host: url.hostname, port });
    const fail = (cause: string) => {
      socket.destroy();
      reject(
        new Error(
          `Cannot reach Postgres at ${url.hostname}:${port} (${cause}). ` +
            'Is the container running? Start it with "docker compose up -d". ' +
            'If your Postgres listens on another port, set TEST_DATABASE_URL.',
        ),
      );
    };
    socket.setTimeout(2000, () => fail('timeout'));
    socket.once('error', (err) =>
      fail((err as NodeJS.ErrnoException).code ?? err.message ?? 'connection failed'),
    );
    socket.once('connect', () => {
      socket.end();
      resolve();
    });
  });
}
