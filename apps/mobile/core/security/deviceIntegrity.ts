export const deviceIntegrity = {
  async check(): Promise<{ compromised: boolean }> {
    return { compromised: false };
  },
};
