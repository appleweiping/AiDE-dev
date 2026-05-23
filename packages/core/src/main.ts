#!/usr/bin/env node
import { startIpcServer } from './ipc-server.js';

startIpcServer().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
