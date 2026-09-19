import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Gold code reconciliation service listening on :${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
