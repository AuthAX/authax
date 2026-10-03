/** For demos only. Stands in for an analytics service and only logs. */
export const analytics = {
  track: (event: "sign_up" | "sign_in", userId: string) => {
    console.log(`[analytics] ${event}: ${userId}`);
  },
};
