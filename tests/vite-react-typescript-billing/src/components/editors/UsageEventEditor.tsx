import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { AlertCircleIcon } from "../../icons";
import { Loader2Icon } from "../../icons";
import { SaveIcon } from "../../icons";
import { Trash2Icon } from "../../icons";
import type { UsageEvent } from "../../api";
import {
  listUsageEventsApiUsageEventsGetQueryKey,
  upsertUsageEventApiUsageEventsPostMutation,
} from "../../api/@tanstack/react-query.gen";
import { SubscriptionSelector } from "../selectors/SubscriptionSelector";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

function getDefaultUsageEvent(): UsageEvent {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    email: "",
    metric: "revisions_generated",
    subscription_id: "",
  };
}

export function UsageEventEditor({ isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultUsageEvent());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertUsageEventApiUsageEventsPostMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listUsageEventsApiUsageEventsGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(getDefaultUsageEvent());
      reset();
    }
  }, [isOpen, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutate({ body: draft });
    },
    [draft, mutate],
  );

  const canSubmit = Boolean(draft.subscription_id && draft.email);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>Create Usage Event</Dialog.Title>

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
                  Usage Event ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="subscription_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Subscription <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <SubscriptionSelector
                value={draft.subscription_id || undefined}
                onChange={(subscriptionId) =>
                  setDraft({ ...draft, subscription_id: subscriptionId })
                }
              />
            </Form.Field>

            <Form.Field name="email">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Email <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.email}
                  onChange={(e) =>
                    setDraft({ ...draft, email: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="metric">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Metric
                </Text>
              </Form.Label>
              <Select.Root
                value={draft.metric}
                onValueChange={(value) =>
                  setDraft({
                    ...draft,
                    metric: value as UsageEvent["metric"],
                  })
                }
              >
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content position="popper">
                  <Select.Item value="revisions_generated">
                    revisions_generated
                  </Select.Item>
                </Select.Content>
              </Select.Root>
            </Form.Field>
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
              <Button
                type="submit"
                disabled={!canSubmit || isPending}
                style={{ width: 100 }}
              >
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
