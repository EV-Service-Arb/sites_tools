import type { PlaceLive } from "@evinvest/sites-contract";
import type { Place } from "./types";

/**
 * The live fields (`checkPlaceLive`'s, what the panel's rules keep) over the
 * baked ones. A landmark counts only when it is given in every one of
 * `locales`. A service-area place takes none of the storefront's: an address,
 * a pin or a photo from the source would give it a front it does not have.
 */
export function mergeLive<L extends string>(baked: Place<L>, live: PlaceLive, locales: readonly L[]): Place<L> {
  const front = baked.presence;
  const booking = live.booking ?? baked.booking;
  const telegram = live.telegram ?? baked.channels.telegram;
  const switches = live.messengers ?? baked.messengers;
  const landmark = live.landmark;
  const fullLandmark = landmark && locales.every(l => Object.hasOwn(landmark, l)) ? (landmark as Readonly<Record<L, string>>) : undefined;
  return {
    ...baked,
    presence:
      front.kind === "storefront"
        ? {
            ...front,
            address: live.address ? { ...front.address, ...live.address } : front.address,
            geo: live.geo ?? front.geo,
            storefrontPhoto: live.storefrontPhoto ?? front.storefrontPhoto,
            landmark: fullLandmark ?? front.landmark,
          }
        : front,
    channels: { phone: live.phone ?? baked.channels.phone, whatsapp: live.whatsapp ?? baked.channels.whatsapp, ...(telegram !== undefined ? { telegram } : {}) },
    serviceArea: live.serviceArea ? [{ kind: "localities", names: live.serviceArea }] : baked.serviceArea,
    hours: live.hours ?? baked.hours,
    rating: live.rating ?? baked.rating,
    ...(booking ? { booking } : {}),
    ...(switches ? { messengers: switches } : {}),
    ...(live.reviewUrl ? { reviewUrl: live.reviewUrl } : {}),
  };
}
