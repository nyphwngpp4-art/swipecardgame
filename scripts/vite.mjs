import { build, createServer, preview } from 'vite';
import config from '../vite.config.mjs';

// Load the configuration directly so the CLI does not create a second bundled
// config or a second module cache. Both build and preview use the same config.
const command = process.argv[2] ?? 'dev';
const args = process.argv.slice(3);
const valueOf = (flag) => args[args.indexOf(flag) + 1];
const serverOptions = {
  ...config.server,
  ...(args.includes('--host') ? { host: valueOf('--host') || true } : {}),
  ...(args.includes('--port') ? { port: Number(valueOf('--port')) } : {}),
};
if (command === 'build') {
  await build({ ...config, configFile: false });
} else if (command === 'preview') {
  const server = await preview({ ...config, configFile: false, preview: serverOptions });
  server.printUrls();
} else {
  const server = await createServer({ ...config, configFile: false, server: serverOptions });
  await server.listen();
  server.printUrls();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(); });
}
