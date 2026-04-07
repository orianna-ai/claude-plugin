export const DRIVE_CLIENT = {
  upload: async (blob: Blob): Promise<string> => {
    return URL.createObjectURL(blob);
  },
};
