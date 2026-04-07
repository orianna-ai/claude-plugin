import { Select } from "@radix-ui/themes";
import { useQuery } from "@tanstack/react-query";

import { listPricesApiPricesGetOptions } from "../../api/@tanstack/react-query.gen";

type Props = {
  disabled?: boolean;
  onChange: (priceId: string) => void;
  required?: boolean;
  value: string | undefined;
};

export function PriceSelector({
  disabled = false,
  onChange,
  required = false,
  value,
}: Props) {
  const { data: prices = [], isLoading } = useQuery({
    ...listPricesApiPricesGetOptions(),
    refetchOnMount: false,
  });

  const isEmpty = !isLoading && prices.length === 0;

  return (
    <Select.Root
      value={value}
      onValueChange={onChange}
      disabled={disabled || isLoading || isEmpty}
      required={required}
    >
      <Select.Trigger
        placeholder={
          isLoading ? "Loading..." : isEmpty ? "No prices" : "Select a price"
        }
        style={{ width: "100%" }}
      />
      <Select.Content position="popper">
        {prices
          .filter((price) => price.id)
          .map((price) => (
            <Select.Item key={price.id} value={price.id!}>
              {price.description}
            </Select.Item>
          ))}
      </Select.Content>
    </Select.Root>
  );
}
