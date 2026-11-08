import type { Role } from "@/server/contract";

export const routes = {
  login: "/login",
  shop: { home: "/shop", newRequest: "/shop/new", request: (id: string) => `/shop/requests/${id}`, history: "/shop/history" },
  collector: { today: "/collector", trip: (id: string) => `/collector/trips/${id}`, stop: (id: string) => `/collector/stops/${id}` },
  operator: {
    queue: "/operator",
    trips: "/operator/trips",
    newTrip: (ids: string[]) => `/operator/trips/new?ids=${ids.map(encodeURIComponent).join(",")}`,
    trip: (id: string) => `/operator/trips/${id}`,
    directory: "/operator/directory",
    audit: "/operator/audit",
  },
} as const;

export function homeFor(role: Role): string {
  switch (role) {
    case "SHOP":
      return routes.shop.home;
    case "COLLECTOR":
      return routes.collector.today;
    case "OPERATOR":
      return routes.operator.queue;
  }
}
