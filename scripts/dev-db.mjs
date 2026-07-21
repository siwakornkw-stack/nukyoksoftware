// Local dev Postgres with zero system install.
// The project path contains non-ASCII (Thai) characters, which the Postgres
// Windows binaries cannot execute from. So we copy the binaries downloaded by
// `embedded-postgres` to an ASCII path (C:\dhevakij-pg) and drive them with
// pg_ctl. Run `npm run db:dev` once; the server then stays up (detached).
import { execFileSync } from "child_process";
import { existsSync, cpSync } from "fs";
import path from "path";
import { Client } from "pg";

const HOME = process.env.PG_HOME || "C:\\dhevakij-pg";
const BIN = path.join(HOME, "native", "bin");
const DATA = path.join(HOME, "data");
const PORT = 5433;
const SRC = path.resolve("node_modules/@embedded-postgres/windows-x64/native");

// 1) Copy PG binaries to an ASCII path (they can't run from the Thai project dir).
if (!existsSync(BIN)) {
  console.log("[dev-db] copying postgres binaries to", HOME);
  cpSync(SRC, path.join(HOME, "native"), { recursive: true });
}

// 2) Initialise the cluster once.
if (!existsSync(path.join(DATA, "PG_VERSION"))) {
  console.log("[dev-db] initdb...");
  execFileSync(path.join(BIN, "initdb.exe"), ["-D", DATA, "-U", "dev", "--auth=trust", "-E", "UTF8"], {
    stdio: "inherit",
    cwd: HOME,
  });
}

// 3) Start the server (idempotent; pg_ctl returns nonzero if already running).
try {
  execFileSync(
    path.join(BIN, "pg_ctl.exe"),
    ["-D", DATA, "-l", path.join(HOME, "pg.log"), "-o", `-p ${PORT}`, "start"],
    { stdio: "inherit", cwd: HOME }
  );
} catch {
  console.log("[dev-db] server already running");
}

// 4) Ensure the database exists (embedded-postgres ships no createdb/psql).
const c = new Client({ host: "127.0.0.1", port: PORT, user: "dev", database: "postgres" });
await c.connect();
const { rowCount } = await c.query("SELECT 1 FROM pg_database WHERE datname='dhevakij'");
if (!rowCount) {
  await c.query("CREATE DATABASE dhevakij");
  console.log("[dev-db] created database 'dhevakij'");
}
await c.end();

console.log(`[dev-db] READY  postgresql://dev:dev@localhost:${PORT}/dhevakij`);
console.log("[dev-db] server runs detached; stop with:");
console.log(`         "${path.join(BIN, "pg_ctl.exe")}" -D "${DATA}" stop`);
