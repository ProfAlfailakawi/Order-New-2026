export const OLD_BACKEND_URL = process.env.OLD_BACKEND_URL || "https://order-119610604304.europe-west3.run.app";

export const backendService = {
  getOldBackendUrl: () => OLD_BACKEND_URL,
};
