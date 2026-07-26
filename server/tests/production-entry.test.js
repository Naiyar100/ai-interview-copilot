import { spawn } from "node:child_process";
import net from "node:net";
import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";

let child;
let baseUrl;
let startupOutput = "";

const reservePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });

const waitForProductionServer = (port) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      reject(new Error(`Production server did not become ready. Output: ${startupOutput}`));
    }, 20000);

    const inspectOutput = (chunk) => {
      startupOutput += chunk.toString();
    };

    child = spawn(process.execPath, ["server.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "test",
        PORT: String(port),
        STORAGE_PROVIDER: "local",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", inspectOutput);
    child.stderr.on("data", inspectOutput);
    child.once("error", (error) => {
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`Production server exited with code ${code}. Output: ${startupOutput}`));
      }
    });

    const probe = async () => {
      if (settled) return;
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.status === 200) {
          settled = true;
          clearTimeout(timeout);
          resolve();
          return;
        }
      } catch {
        // The listener is not accepting requests yet.
      }
      setTimeout(probe, 100);
    };
    void probe();
  });

beforeAll(async () => {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  await waitForProductionServer(port);
}, 30000);

afterAll(async () => {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await new Promise((resolve) => {
    child.once("exit", resolve);
    setTimeout(resolve, 3000).unref();
  });
});

describe("production server entry point", () => {
  test("GET / returns the API root response", async () => {
    const response = await fetch(`${baseUrl}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("AI Interview Copilot API is running");
  });

  test("GET /health returns the canonical health response", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/application\/json/);
    expect(await response.json()).toEqual({
      status: "ok",
      database: "connected",
      version: "1.0.0",
      uptime: expect.any(Number),
    });
  });

  test("GET /api/health retains the compatibility alias", async () => {
    const response = await fetch(`${baseUrl}/api/health`);
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("ok");
  });

  test("GET /unknown-route returns 404", async () => {
    const response = await fetch(`${baseUrl}/unknown-route`);
    expect(response.status).toBe(404);
  });
});
