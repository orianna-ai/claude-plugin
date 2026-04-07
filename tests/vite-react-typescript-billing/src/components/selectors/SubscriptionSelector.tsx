import { Flex, Select, Text } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";

import { listSubscriptionsApiSubscriptionsGetOptions } from "../../api/@tanstack/react-query.gen";

type Props = {
  disabled?: boolean;
  onChange: (subscriptionId: string) => void;
  required?: boolean;
  value: string | undefined;
};

export function SubscriptionSelector({
  disabled = false,
  onChange,
  required = false,
  value,
}: Props) {
  const { data: subscriptions = [], isLoading } = useQuery({
    ...listSubscriptionsApiSubscriptionsGetOptions(),
    refetchOnMount: false,
  });

  const isEmpty = !isLoading && subscriptions.length === 0;

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
              ? "No subscriptions"
              : "Select a subscription"
        }
        style={{ width: "100%" }}
      />
      <Select.Content position="popper">
        {subscriptions
          .filter((subscription) => subscription.id)
          .map((subscription) => (
            <Select.Item key={subscription.id} value={subscription.id!}>
              <Flex gap="2" align="center" style={{ flex: 1 }}>
                <Text size="2" style={{ flex: 1 }}>
                  {subscription.id}
                </Text>
                <Text size="1" color="gray">
                  {subscription.status}
                </Text>
              </Flex>
            </Select.Item>
          ))}
      </Select.Content>
    </Select.Root>
  );
}
