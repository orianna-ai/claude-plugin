import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Checkbox,
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
import type { Upgrade } from "../../api";
import {
  listUpgradesApiUpgradesGetQueryKey,
  upsertUpgradeApiUpgradesPutMutation,
} from "../../api/@tanstack/react-query.gen";
import { PriceSelector } from "../selectors/PriceSelector";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  upgrade: Upgrade | null;
};

function getDefaultUpgrade(): Upgrade {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    current_price_id: null,
    upgrade_price_id: "",
    is_active: true,
  };
}

export function UpgradeEditor({ isOpen, onClose, upgrade }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultUpgrade());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertUpgradeApiUpgradesPutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listUpgradesApiUpgradesGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(upgrade ?? getDefaultUpgrade());
      reset();
    }
  }, [upgrade, isOpen, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutate({ body: draft });
    },
    [draft, mutate],
  );

  const canSubmit = Boolean(draft.upgrade_price_id);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>
          {upgrade ? "Edit Upgrade" : "Create Upgrade"}
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
                  Upgrade ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="current_price_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Current Price
                </Text>
              </Form.Label>
              <PriceSelector
                value={draft.current_price_id ?? undefined}
                onChange={(priceId) =>
                  setDraft({ ...draft, current_price_id: priceId })
                }
              />
            </Form.Field>

            <Form.Field name="upgrade_price_id">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Upgrade Price <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <PriceSelector
                value={draft.upgrade_price_id || undefined}
                onChange={(priceId) =>
                  setDraft({ ...draft, upgrade_price_id: priceId })
                }
              />
            </Form.Field>

            <Flex align="center" gap="2">
              <Checkbox
                checked={draft.is_active ?? true}
                onCheckedChange={(checked) =>
                  setDraft({ ...draft, is_active: checked === true })
                }
              />
              <Text size="2">Active</Text>
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
