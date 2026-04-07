import type { Plugin } from "vite";

interface Period {
  id: string;
  starts_at: string;
  ends_at: string;
}

interface Account {
  id: string;
  name: string;
  owner: string;
  priority: number;
  domains: string[];
  members: string[];
  stripe_customer_id?: string;
  created_at: string;
}

interface Price {
  id: string;
  description: string;
  stripe_price_id?: string;
  stripe_product_id?: string;
  amount?: number;
  currency?: string;
  created_at: string;
}

interface Subscription {
  id: string;
  account_id: string;
  price_id: string;
  status: string;
  stripe_subscription_id?: string;
  stripe_subscription_item_id?: string;
  billing_periods: Period[];
  created_at: string;
}

interface Quota {
  id: string;
  price_id: string;
  metric: string;
  soft_limit: number;
  hard_limit: number;
  is_active: boolean;
  created_at: string;
}

interface Upgrade {
  id: string;
  current_price_id: string;
  upgrade_price_id: string;
  is_active: boolean;
  created_at: string;
}

interface UsageEvent {
  id: string;
  subscription_id: string;
  email: string;
  metric: string;
  created_at: string;
}

interface Usage {
  account: Account;
  subscription: Subscription;
  price: Price;
  quota: Quota;
  metric: string;
  usage: number;
  starts_at: string;
  ends_at: string;
}

const accounts: Account[] = [
  {
    id: "account-1",
    name: "Acme Corp",
    owner: "alice@acme.com",
    priority: 1,
    domains: ["acme.com"],
    members: ["alice@acme.com", "bob@acme.com"],
    stripe_customer_id: "cus_mock_acme",
    created_at: "2025-01-15T00:00:00Z",
  },
  {
    id: "account-2",
    name: "Globex Inc",
    owner: "hank@globex.com",
    priority: 2,
    domains: ["globex.com"],
    members: ["hank@globex.com"],
    stripe_customer_id: "cus_mock_globex",
    created_at: "2025-03-01T00:00:00Z",
  },
];

const prices: Price[] = [
  {
    id: "price-1",
    description: "Pro Plan — Monthly",
    stripe_price_id: "price_mock_pro",
    stripe_product_id: "prod_mock_pro",
    amount: 4900,
    currency: "usd",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "price-2",
    description: "Enterprise Plan — Monthly",
    stripe_price_id: "price_mock_enterprise",
    stripe_product_id: "prod_mock_enterprise",
    amount: 19900,
    currency: "usd",
    created_at: "2025-01-01T00:00:00Z",
  },
];

const subscriptions: Subscription[] = [
  {
    id: "subscription-1",
    account_id: "account-1",
    price_id: "price-1",
    status: "active",
    stripe_subscription_id: "sub_mock_1",
    stripe_subscription_item_id: "si_mock_1",
    billing_periods: [
      {
        id: "period-1a",
        starts_at: "2025-03-01T00:00:00Z",
        ends_at: "2025-04-01T00:00:00Z",
      },
      {
        id: "period-1b",
        starts_at: "2025-04-01T00:00:00Z",
        ends_at: "2025-05-01T00:00:00Z",
      },
    ],
    created_at: "2025-02-01T00:00:00Z",
  },
  {
    id: "subscription-2",
    account_id: "account-2",
    price_id: "price-2",
    status: "active",
    stripe_subscription_id: "sub_mock_2",
    stripe_subscription_item_id: "si_mock_2",
    billing_periods: [
      {
        id: "period-2a",
        starts_at: "2025-03-01T00:00:00Z",
        ends_at: "2025-04-01T00:00:00Z",
      },
    ],
    created_at: "2025-03-10T00:00:00Z",
  },
];

const quotas: Quota[] = [
  {
    id: "quota-1",
    price_id: "price-1",
    metric: "api_calls",
    soft_limit: 8000,
    hard_limit: 10000,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "quota-2",
    price_id: "price-2",
    metric: "api_calls",
    soft_limit: 80000,
    hard_limit: 100000,
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
  },
];

const upgrades: Upgrade[] = [
  {
    id: "upgrade-1",
    current_price_id: "price-1",
    upgrade_price_id: "price-2",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
  },
];

const usageEvents: UsageEvent[] = [
  {
    id: "usage-event-1",
    subscription_id: "subscription-1",
    email: "alice@acme.com",
    metric: "api_calls",
    created_at: "2025-03-18T10:30:00Z",
  },
  {
    id: "usage-event-2",
    subscription_id: "subscription-1",
    email: "bob@acme.com",
    metric: "api_calls",
    created_at: "2025-03-18T14:15:00Z",
  },
];

function buildUsages(): Usage[] {
  return subscriptions.map((sub) => {
    const account = accounts.find((a) => a.id === sub.account_id)!;
    const price = prices.find((p) => p.id === sub.price_id)!;
    const quota = quotas.find((q) => q.price_id === sub.price_id)!;
    const currentPeriod = sub.billing_periods[sub.billing_periods.length - 1];
    const usage = usageEvents.filter(
      (e) => e.subscription_id === sub.id,
    ).length;

    return {
      account,
      subscription: sub,
      price,
      quota,
      metric: quota.metric,
      usage,
      starts_at: currentPeriod.starts_at,
      ends_at: currentPeriod.ends_at,
    };
  });
}

function upsert<T extends { id: string }>(collection: T[], item: T): T {
  const idx = collection.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    collection[idx] = item;
  } else {
    collection.push(item);
  }
  return item;
}

async function readBody(req: import("http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function mockApiPlugin(): Plugin {
  return {
    name: "mock-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? "";
        if (!url.startsWith("/api/")) {
          return next();
        }

        const path = url.split("?")[0];
        const method = req.method ?? "GET";

        const json = (data: unknown, status = 200) => {
          res.statusCode = status;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(data));
        };

        const redirect = (location: string) => {
          res.statusCode = 302;
          res.setHeader("Location", location);
          res.end();
        };

        try {
          if (path === "/api/accounts") {
            if (method === "GET") return json(accounts);
            if (method === "PUT") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(accounts, body));
            }
          }

          if (path === "/api/prices") {
            if (method === "GET") return json(prices);
            if (method === "PUT") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(prices, body));
            }
          }

          if (path === "/api/subscriptions") {
            if (method === "GET") return json(subscriptions);
            if (method === "PUT") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(subscriptions, body));
            }
          }

          if (path === "/api/quotas") {
            if (method === "GET") return json(quotas);
            if (method === "PUT") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(quotas, body));
            }
          }

          if (path === "/api/upgrades") {
            if (method === "GET") return json(upgrades);
            if (method === "PUT") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(upgrades, body));
            }
          }

          if (path === "/api/usage-events") {
            if (method === "GET") return json(usageEvents);
            if (method === "POST") {
              const body = JSON.parse(await readBody(req));
              return json(upsert(usageEvents, body));
            }
          }

          if (path === "/api/usages") {
            if (method === "GET") return json(buildUsages());
          }

          if (path === "/api/meter-events") {
            if (method === "POST") {
              await readBody(req);
              return json({});
            }
          }

          if (path === "/api/paywall") {
            if (method === "GET") return json(null);
          }

          if (path === "/api/checkout") {
            if (method === "GET")
              return redirect("https://checkout.stripe.com/mock-session");
          }

          if (path === "/api/customer-portal") {
            if (method === "GET")
              return redirect(
                "https://billing.stripe.com/mock-portal-session",
              );
          }

          json({ error: "Not found" }, 404);
        } catch (err) {
          json({ error: String(err) }, 500);
        }
      });
    },
  };
}
