import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Checkbox,
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
import type { Quota } from "../../api";
import {
  listQuotasApiQuotasGetQueryKey,
  upsertQuotaApiQuotasPutMutation,
} from "../../api/@tanstack/react-query.gen";
import { PriceSelector } from "../selectors/PriceSelector";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  quota: Quota | null;
};

function getDefaultQuota(): Quota {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    price_id: "",
    metric: "revisions_generated",
    soft_limit: null,
    hard_limit: null,
    is_active: true,
  };
}

export function QuotaEditor({ isOpen, onClose, quota }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultQuota());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertQuotaApiQuotasPutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listQuotasApiQuotasGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(quota ?? getDefaultQuota());
      reset();
    }
  }, [quota, isOpen, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutate({ body: draft });
    },
    [draft, mutate],
  );

  const canSubmit = Boolean(draft.price_id);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>{quota ? "Edit Quota" : "Create Quota"}</Dialog.Title>

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
                  Quota ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="price_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Price <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <PriceSelector
                value={draft.price_id || undefined}
                onChange={(priceId) =>
                  setDraft({ ...draft, price_id: priceId })
                }
              />
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
                    metric: value as Quota["metric"],
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

            <Form.Field name="soft_limit">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Soft Limit
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.soft_limit?.toString() ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      soft_limit: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  type="number"
                  placeholder="Optional"
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="hard_limit">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Hard Limit
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.hard_limit?.toString() ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      hard_limit: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  type="number"
                  placeholder="Optional"
                />
              </Form.Control>
            </Form.Field>

            <Flex align="center" gap="2">
              <Checkbox
                checked={draft.is_active}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, is_active: checked === true })
                }
              />
              <Text size="2" weight="medium">
                Active
              </Text>
            </Flex>
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
