/* ═══════════════════════════════════════════════════════════════════════════
   PM2 Ecosystem — AI Ethics Pledge
   Usage:
     pm2 start ecosystem.config.js          # start
     pm2 reload ecosystem.config.js         # zero-downtime reload
     pm2 stop ai-pledge                      # stop
     pm2 logs ai-pledge                      # live logs
     pm2 save && pm2 startup                 # survive reboots
   ═══════════════════════════════════════════════════════════════════════════ */

const path = require("path");

module.exports = {
  apps: [
    {
      name:          "ai-pledge",
      script:        "server.js",
      cwd:           __dirname,   // Automatically uses current project directory

      // Keep one instance — change to "cluster" + instances: "max" for multi-core
      instances:     1,
      exec_mode:     "fork",

      // Restart policy
      autorestart:   true,
      watch:         false,          // don't watch files in production
      max_memory_restart: "300M",

      // Environment
      env: {
        NODE_ENV: "production",
        PORT:     "6003"
      },

      // Log files
      out_file:   path.join(__dirname, "logs/out.log"),
      error_file: path.join(__dirname, "logs/error.log"),
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z"
    }
  ]
};
