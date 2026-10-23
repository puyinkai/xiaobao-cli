import os from 'node:os';
import { syncBuiltinESMExports } from 'node:module';

// Isolate the CLI's file stores without changing the shell's home directory.
os.homedir = () => process.env.STAFF_CLI_TEST_DIR;
syncBuiltinESMExports();
