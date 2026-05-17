module.exports = {
  apps: [
    {
      name: "talent-hub",
      cwd: "./apps/web",
      script: "npm",
      args: "start",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
