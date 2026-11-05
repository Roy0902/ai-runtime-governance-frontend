import { useState } from 'react';
import { Button, Dialog, Field, Input, Stack, Text } from '@chakra-ui/react';
import { X } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return `Too many attempts. Try again in ${error.retryAfterSeconds} seconds.`;
    }
    return error.message;
  }
  return 'Something went wrong. Try again.';
}

export function StepUpDialog({
  open,
  onConfirmed,
  onCancel,
}: {
  open: boolean;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const { send } = useAuthentication();
  const [password, setPassword] = useState('');
  const [factor, setFactor] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    try {
      await send('/api/v1/auth/reauthentication', 'POST', {
        password,
        secondFactor: {
          kind: factor.replace(/-/g, '').length === 32 ? 'RECOVERY' : 'TOTP',
          code: factor,
        },
      });
      onConfirmed();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!details.open) {
          onCancel();
        }
      }}
      initialFocusEl={() => document.querySelector<HTMLInputElement>('#step-up-password')}
    >
      <Dialog.Backdrop bg="blackAlpha.600" />
      <Dialog.Positioner p="4">
        <Dialog.Content maxW="md" borderRadius="xl" bg="white" boxShadow="0 24px 80px rgba(18,34,40,0.24)">
          <Dialog.Header>
            <Stack gap="1">
              <Dialog.Title fontFamily="heading" fontSize="xl" fontWeight="700">
                Confirm your identity
              </Dialog.Title>
              <Text color="governance.muted" fontSize="sm">
                Enter your password and current authenticator code to continue.
              </Text>
            </Stack>
            <Dialog.CloseTrigger asChild>
              <Button position="absolute" top="3" right="3" size="sm" variant="ghost" aria-label="Close dialog">
                <X size={16} aria-hidden="true" />
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack as="form" id="step-up-form" gap="4" onSubmit={(event) => { event.preventDefault(); void confirm(); }}>
              <Field.Root>
                <Field.Label>Password</Field.Label>
                <Input
                  id="step-up-password"
                  aria-label="Password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field.Root>
              <Field.Root>
                <Field.Label>Authenticator or recovery code</Field.Label>
                <Input
                  aria-label="Authenticator or recovery code"
                  value={factor}
                  onChange={(event) => setFactor(event.target.value)}
                />
              </Field.Root>
              {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" form="step-up-form" colorPalette="green">Confirm</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
