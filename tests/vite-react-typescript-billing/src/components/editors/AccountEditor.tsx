import { useCallback, useEffect, useState } from "react";
import * as Form from "@radix-ui/react-form";
import {
  Button,
  Callout,
  Dialog,
  Flex,
  IconButton,
  Text,
  TextField,
} from "@radix-ui/themes";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { v4 as uuidv4 } from "uuid";

import { AlertCircleIcon } from "../../icons";
import { Loader2Icon } from "../../icons";
import { PlusIcon } from "../../icons";
import { SaveIcon } from "../../icons";
import { Trash2Icon } from "../../icons";
import { XIcon } from "../../icons";
import type { Account } from "../../api";
import {
  listAccountsApiAccountsGetQueryKey,
  upsertAccountApiAccountsPutMutation,
} from "../../api/@tanstack/react-query.gen";

type Props = {
  account: Account | null;
  isOpen: boolean;
  onClose: () => void;
};

function getDefaultAccount(): Account {
  return {
    created_at: new Date().toISOString(),
    id: uuidv4(),
    name: "",
    owner: "",
    priority: 0,
    domains: [],
    members: [],
  };
}

export function AccountEditor({ account, isOpen, onClose }: Props) {
  const queryClient = useQueryClient();

  const [draft, setDraft] = useState(getDefaultAccount());

  const { mutate, reset, isPending, error } = useMutation({
    ...upsertAccountApiAccountsPutMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: listAccountsApiAccountsGetQueryKey(),
      });
      onClose();
    },
  });

  useEffect(() => {
    if (isOpen) {
      setDraft(account ?? getDefaultAccount());
      reset();
    }
  }, [account, isOpen, reset]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      mutate({
        body: {
          ...draft,
          domains: draft.domains?.filter(Boolean) ?? [],
          members: draft.members?.filter(Boolean) ?? [],
        },
      });
    },
    [draft, mutate],
  );

  const canSubmit = Boolean(draft.name && draft.owner);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="480px">
        <Dialog.Title>
          {account ? "Edit Account" : "Create Account"}
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
                  Account ID
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root value={draft.id} disabled />
              </Form.Control>
            </Form.Field>

            <Form.Field name="name">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Name <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.name ?? ""}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  disabled={!!account}
                  placeholder="Example, Inc."
                />
              </Form.Control>
            </Form.Field>

            {account?.stripe_customer_id && (
              <Form.Field name="stripe_customer_id">
                <Form.Label asChild>
                  <Text size="2" weight="medium" mb="1">
                    Stripe Customer ID
                  </Text>
                </Form.Label>
                <Form.Control asChild>
                  <TextField.Root value={account.stripe_customer_id} disabled />
                </Form.Control>
              </Form.Field>
            )}

            <Form.Field name="owner">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Owner <Text color="red">*</Text>
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  value={draft.owner}
                  onChange={(e) =>
                    setDraft({ ...draft, owner: e.target.value })
                  }
                  placeholder="user@example.com"
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="priority">
              <Form.Label asChild>
                <Text size="2" weight="medium" mb="1">
                  Priority
                </Text>
              </Form.Label>
              <Form.Control asChild>
                <TextField.Root
                  defaultValue={draft.priority?.toString() ?? "0"}
                  key={draft.id}
                  onBlur={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    setDraft({
                      ...draft,
                      priority: Number.isNaN(parsed) ? 0 : parsed,
                    });
                  }}
                  type="number"
                />
              </Form.Control>
            </Form.Field>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Domains
              </Text>
              {(draft.domains ?? []).map((value, index) => (
                <Flex key={index} gap="2" align="center">
                  <TextField.Root
                    value={value}
                    onChange={(e) => {
                      const updated = [...(draft.domains ?? [])];
                      updated[index] = e.target.value;
                      setDraft({ ...draft, domains: updated });
                    }}
                    placeholder="example.com"
                    style={{ flex: 1 }}
                  />
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        domains: (draft.domains ?? []).filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <XIcon size={16} />
                  </IconButton>
                </Flex>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="1"
                style={{ alignSelf: "flex-start" }}
                onClick={() =>
                  setDraft({
                    ...draft,
                    domains: [...(draft.domains ?? []), ""],
                  })
                }
              >
                <PlusIcon size={14} /> Add domain
              </Button>
            </Flex>

            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                Members
              </Text>
              {(draft.members ?? []).map((value, index) => (
                <Flex key={index} gap="2" align="center">
                  <TextField.Root
                    value={value}
                    onChange={(e) => {
                      const updated = [...(draft.members ?? [])];
                      updated[index] = e.target.value;
                      setDraft({ ...draft, members: updated });
                    }}
                    placeholder="user@example.com"
                    style={{ flex: 1 }}
                  />
                  <IconButton
                    type="button"
                    variant="ghost"
                    color="gray"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        members: (draft.members ?? []).filter(
                          (_, i) => i !== index,
                        ),
                      })
                    }
                  >
                    <XIcon size={16} />
                  </IconButton>
                </Flex>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="1"
                style={{ alignSelf: "flex-start" }}
                onClick={() =>
                  setDraft({
                    ...draft,
                    members: [...(draft.members ?? []), ""],
                  })
                }
              >
                <PlusIcon size={14} /> Add member
              </Button>
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
