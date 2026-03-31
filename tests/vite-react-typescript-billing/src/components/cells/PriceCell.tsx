import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { listPricesApiPricesGetOptions } from "../../api/@tanstack/react-query.gen";

type Props = {
  priceId: string | null | undefined;
};

export function PriceCell({ priceId }: Props) {
  const { data: prices } = useSuspenseQuery(listPricesApiPricesGetOptions());

  const priceMap = useMemo(
    () => new Map(prices.map((p) => [p.id, p])),
    [prices],
  );

  if (!priceId) {
    return null;
  }

  const price = priceMap.get(priceId);

  if (!price) {
    return null;
  }

  return <span>{price.description}</span>;
}
