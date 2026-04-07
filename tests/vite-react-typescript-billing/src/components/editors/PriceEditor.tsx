import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { AlertCircleIcon } from "../../icons";
import { Loader2Icon } from "../../icons";
import { SaveIcon } from "../../icons";
import { Trash2Icon } from "../../icons";
import type { Price } from "../../api";
import {
  listPricesApiPricesGetQueryKey,
  upsertPriceApiPricesPutMutation,
} from "../../api/@tanstack/react-query.gen";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  price: Price | null;
};

function getDefaultPrice(): Price {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    stripe_price_id: "",
    stripe_product_id: "",
  };
}

export function PriceEditor({ isOpen, onClose, price }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultPrice());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertPriceApiPricesPutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listPricesApiPricesGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(price ?? getDefaultPrice());
      reset();
    }
  }, [isOpen, price, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutate({ body: draft });
    },
    [draft, mutate],
  );

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{price ? "Edit Price" : "Create Price"}</Dialog.Title>

        <Form.Root onSubmit={handleSubmit} onClearServerErrors={reset}>
          <Flex direction="column" gap="4" py="4">
            {error && (
              <Callout.Root color="red" size="1">
                <Callout.Icon>
                  <AlertCircleIcon size={16} />
                </Callout.Icon>
                <Callout.Text style={{ whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(error, null, 2)}
                </Callout.Text>
              </Callout.Root>
            )}

            <Form.Field name="created_at">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Created At
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.created_at} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Price ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="description">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Description
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.description ?? ""} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="stripe_price_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Stripe Price ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.stripe_price_id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="stripe_product_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Stripe Product ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.stripe_product_id ?? ""}
                  disabled
                />
              </Form.Control>
            </Form.Field>

            {price && (
              <Form.Field name="amount">
                <Form.Label asChild>
                  <Text size="2" weight="medium" mb="1">
                    Amount
                  </Text>
                </Form.Label>
                <Form.Control asChild>
                  <TextField.Root
                    value={new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: price.currency ?? "usd",
                    }).format((price.amount ?? 0) / 100)}
                    disabled
                  />
                </Form.Control>
              </Form.Field>
            )}

            {price && (
              <Form.Field name="currency">
                <Form.Label asChild>
                  <Text size="2" weight="medium" mb="1">
                    Currency
                  </Text>
                </Form.Label>
                <Form.Control asChild>
                  <TextField.Root value={price.currency ?? ""} disabled />
                </Form.Control>
              </Form.Field>
            )}
          </Flex>

          <Flex gap="3" justify="end" mt="4">
            <Dialog.Close>
              <Button
                variant="soft"
                color="gray"
                type="button"
                style={{ width: 100 }}
              >
                <Trash2Icon size={14} />
                Cancel
              </Button>
            </Dialog.Close>
            <Form.Submit asChild>
              <Button type="submit" disabled={isPending} style={{ width: 100 }}>
                {isPending ? (
                  <Loader2Icon size={16} className="animate-spin" />
                ) : (
                  <>
                    <SaveIcon size={14} />
                    Save
                  </>
                )}
              </Button>
            </Form.Submit>
          </Flex>
        </Form.Root>
      </Dialog.Content>
    </Dialog.Root>
  );
}
