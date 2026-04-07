import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import {
  listPricesApiPricesGetOptions,
  listQuotasApiQuotasGetOptions,
} from "../../api/@tanstack/react-query.gen";

type Props = {
  quotaId: string | null | undefined;
};

export function QuotaCell({ quotaId }: Props) {
  const { data: quotas } = useSuspenseQuery(listQuotasApiQuotasGetOptions());

  const { data: prices } = useSuspenseQuery(listPricesApiPricesGetOptions());

  const quotaMap = useMemo(
    () => new Map(quotas.map((q) => [q.id, q])),
    [quotas],
  );

  const priceMap = useMemo(
    () => new Map(prices.map((p) => [p.id, p])),
    [prices],
  );

  if (!quotaId) {
    return null;
  }

  const quota = quotaMap.get(quotaId);

  if (!quota) {
    return null;
  }

  const price = priceMap.get(quota.price_id);

  if (!price) {
    return null;
  }

  return <span>{`${price.description} - ${quota.metric}`}</span>;
}
