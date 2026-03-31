import { Select } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";

import { listAccountsApiAccountsGetOptions } from "../../api/@tanstack/react-query.gen";

type Props = {
  disabled?: boolean;
  onChange: (accountId: string) => void;
  required?: boolean;
  value: string | undefined;
};

export function AccountSelector({
  disabled = false,
  onChange,
  required = false,
  value,
}: Props) {
  const { data: accounts = [], isLoading } = useQuery({
    ...listAccountsApiAccountsGetOptions(),
    refetchOnMount: false,
  });

  const isEmpty = !isLoading && accounts.length === 0;

  return (
    <Select.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading || isEmpty}
      required={required}
    >
      <Select.Trigger
        placeholder={
          isLoading
            ? "Loading..."
            : isEmpty
              ? "No accounts"
              : "Select an account"
        }
        style={{ width: "100%" }}
      />
      <Select.Content position="popper">
        {accounts
          .filter((account) => account.id)
          .map((account) => (
            <Select.Item key={account.id} value={account.id!}>
              {account.name}
            </Select.Item>
          ))}
      </Select.Content>
    </Select.Root>
  );
}
