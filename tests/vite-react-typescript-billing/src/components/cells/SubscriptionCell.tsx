import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  listAccountsApiAccountsGetOptions,
  listPricesApiPricesGetOptions,
  listSubscriptionsApiSubscriptionsGetOptions,
} from "../../api/@tanstack/react-query.gen";

type Props = {
  subscriptionId: string | null | undefined;
};

export function SubscriptionCell({ subscriptionId }: Props) {
  const { data: subscriptions } = useSuspenseQuery(
    listSubscriptionsApiSubscriptionsGetOptions(),
  );

  const { data: accounts } = useSuspenseQuery(
    listAccountsApiAccountsGetOptions(),
  );

  const { data: prices } = useSuspenseQuery(listPricesApiPricesGetOptions());

  const subscriptionMap = useMemo(
    () => new Map(subscriptions.map((s) => [s.id, s])),
    [subscriptions],
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  const priceMap = useMemo(
    () => new Map(prices.map((p) => [p.id, p])),
    [prices],
  );

  if (!subscriptionId) {
    return null;
  }

  const subscription = subscriptionMap.get(subscriptionId);

  if (!subscription) {
    return null;
  }

  const account = accountMap.get(subscription.account_id);

  if (!account) {
    return null;
  }

  const price = priceMap.get(subscription.price_id);

  if (!price) {
    return null;
  }

  return <span>{`${account.name} - ${price.description}`}</span>;
}
