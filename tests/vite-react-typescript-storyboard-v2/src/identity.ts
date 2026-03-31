export interface Identity {
  email: string;
  name: string;
  picture?: string;
}

export let currentIdentity: Identity | undefined = {
  name: "Local User",
  email: "localhost@orianna.ai",
  picture: "https://drive.orianna.ai/acfc8e0231f0490cd11f5f0858faeaaa.jpg",
};

export function useIdentity(): Identity {
  return currentIdentity!;
}
