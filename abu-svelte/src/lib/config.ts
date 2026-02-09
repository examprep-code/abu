export type RuntimeConfig = {
  apiBaseUrl: string;
};

let configPromise: Promise<RuntimeConfig> | null = null;

export function loadConfig(): Promise<RuntimeConfig> {
  if (!configPromise) {
    configPromise = fetch('/config.json', { cache: 'no-store' }).then(
      async (res) => {
        if (!res.ok) {
          throw new Error('config.json missing');
        }
        return res.json() as Promise<RuntimeConfig>;
      }
    );
  }

  return configPromise;
}
