// Shared naming for the crowd-magic Realtime channel, imported by BOTH the
// browser (JoinClient subscribes) and the server (contribute route broadcasts),
// so the two always agree. Client-safe: plain strings, no imports.

/** Broadcast event name for a newly added contribution. */
export const CROWD_CONTRIBUTION_EVENT = "contribution";

/** Realtime channel/topic for one gift's live contribution feed + presence. */
export function crowdChannelName(giftId: string): string {
  return `crowd:${giftId}`;
}
