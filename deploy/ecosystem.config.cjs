// PM2 config for SnapGrab on the Contabo VPS (installed to /var/www/snapgrab/).
// Listens on localhost only (resolves to [::1]); Nginx proxies the public domain to it.
// "localhost" rather than 127.0.0.1 so Next's own absolute URLs match the bound host.
module.exports = {
  apps: [
    {
      name: "snapgrab",
      cwd: "/var/www/snapgrab/current",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3200 -H localhost",
      exec_mode: "fork",
      instances: 1,
      max_memory_restart: "1G", // safety net; the heap limit below keeps normal use well under it
      env: { NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", NODE_OPTIONS: "--max-old-space-size=768" },
      out_file: "/var/www/snapgrab/logs/app.out.log",
      error_file: "/var/www/snapgrab/logs/app.err.log",
      time: true,
    },
  ],
};
