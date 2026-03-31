import { useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";

import { listAccountsApiAccountsGetOptions } from "../../api/@tanstack/react-query.gen";

type Props = {
  accountId: string | null | undefined;
};

export function AccountCell({ accountId }: Props) {
  const { data: accounts } = useSuspenseQuery(
    listAccountsApiAccountsGetOptions(),
  );

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  if (!accountId) {
    return null;
  }

  const account = accountMap.get(accountId);

  if (!account) {
    return null;
  }

  return <span>{account.name}</span>;
}
