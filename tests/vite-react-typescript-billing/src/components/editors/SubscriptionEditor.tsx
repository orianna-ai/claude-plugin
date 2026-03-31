import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Table,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { AlertCircleIcon } from "../../icons";
import { Loader2Icon } from "../../icons";
import { SaveIcon } from "../../icons";
import { Trash2Icon } from "../../icons";
import type { Subscription } from "../../api";
import {
  listSubscriptionsApiSubscriptionsGetQueryKey,
  upsertSubscriptionApiSubscriptionsPutMutation,
} from "../../api/@tanstack/react-query.gen";
import { AccountSelector } from "../selectors/AccountSelector";
import { PriceSelector } from "../selectors/PriceSelector";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
};

function getDefaultSubscription(): Subscription {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    account_id: "",
    price_id: "",
    stripe_subscription_id: "",
    stripe_subscription_item_id: "",
    billing_periods: [],
  };
}

export function SubscriptionEditor({ isOpen, onClose, subscription }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultSubscription());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertSubscriptionApiSubscriptionsPutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listSubscriptionsApiSubscriptionsGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(subscription ?? getDefaultSubscription());
      reset();
    }
  }, [subscription, isOpen, reset]);

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
        <Dialog.Title>
          {subscription ? "Edit Subscription" : "Create Subscription"}
        </Dialog.Title>

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
                  Subscription ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="account_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Account
                </Text>
              </Form.Label>
              <AccountSelector
                value={draft.account_id}
                onChange={() => {}}
                disabled
              />
            </Form.Field>

            <Form.Field name="price_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Price
                </Text>
              </Form.Label>
              <PriceSelector
                value={draft.price_id}
                onChange={() => {}}
                disabled
              />
            </Form.Field>

            <Form.Field name="stripe_subscription_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Stripe Subscription ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.stripe_subscription_id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="stripe_subscription_item_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Stripe Subscription Item ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.stripe_subscription_item_id}
                  disabled
                />
              </Form.Control>
            </Form.Field>

            {subscription?.status && (
              <Form.Field name="status">
                <Form.Label asChild>
                  <Text size="2" weight="medium" mb="1">
                    Status
                  </Text>
                </Form.Label>
                <Form.Control asChild>
                  <TextField.Root value={subscription.status} disabled />
                </Form.Control>
              </Form.Field>
            )}

            {subscription && subscription.billing_periods?.length > 0 && (
              <Flex direction="column" gap="1">
                <Text size="2" weight="medium">
                  Billing Periods
                </Text>
                <Table.Root size="1" variant="surface">
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Starts At</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Ends At</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {subscription.billing_periods.map((period, index) => (
                      <Table.Row key={index}>
                        <Table.Cell>
                          {new Date(period.starts_at).toLocaleString()}
                        </Table.Cell>
                        <Table.Cell>
                          {new Date(period.ends_at).toLocaleString()}
                        </Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              </Flex>
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
