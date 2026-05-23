export const config = {
  port: Number(process.env.PORT ?? 2567),
  env: process.env.NODE_ENV ?? 'development',
  monitorPath: process.env.MONITOR_PATH ?? '/colyseus',
};
