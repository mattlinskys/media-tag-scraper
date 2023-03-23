import fs from 'fs';

export const readEnvOrFileSync = (name: string) => {
  const path = process.env[`${name}_FILE`];
  if (path) {
    return fs.readFileSync(path).toString('utf8');
  }

  return process.env[name];
};
