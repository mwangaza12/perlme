module.exports = {
    apps: [
        {
            name: "perlme_api",
            script: "dist/server.js",
            interpreter: "node",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            env_production: {
                NODE_ENV: "production",
                PORT: 4000,
            },
            out_file: "/root/perlme/logs/pm2-out.log",
            error_file: "/root/perlme/logs/pm2-error.log",
            merge_logs: true,
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
        },
    ],
};
