import { useState } from 'react';
import { Button, Dialog, Field, Input, Stack, Text } from '@chakra-ui/react';
import { X } from 'lucide-react';
import { ApiError } from '../../ApplicationApiClient';
import { useAuthentication } from '../../AuthenticationContext';
import { t } from '../../i18n';

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.fieldErrors.length > 0) {
      return error.fieldErrors[0].message;
    }
    if (error.code === 'RATE_LIMITED' && error.retryAfterSeconds) {
      return t('common.tooManyAttempts', { seconds: error.retryAfterSeconds });
    }
    return error.message;
  }
  return t('common.somethingWentWrong');
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
  const { context, send } = useAuthentication();
  const keycloak = context?.provider === 'keycloak';
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
                {t('stepUp.title')}
              </Dialog.Title>
              <Text color="governance.muted" fontSize="sm">
                {keycloak
                  ? t('stepUp.keycloakDescription')
                  : t('stepUp.nativeDescription')}
              </Text>
            </Stack>
            <Dialog.CloseTrigger asChild>
              <Button position="absolute" top="3" right="3" size="sm" variant="ghost" aria-label={t('stepUp.closeDialog')}>
                <X size={16} aria-hidden="true" />
              </Button>
            </Dialog.CloseTrigger>
          </Dialog.Header>
          {keycloak ? (
            <Dialog.Footer>
              <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
              <Button
                type="button"
                colorPalette="green"
                onClick={() => { window.location.assign('/api/v1/keycloak/login?stepUp=1'); }}
              >
                {t('stepUp.continueWithKeycloak')}
              </Button>
            </Dialog.Footer>
          ) : (
            <>
              <Dialog.Body>
                <Stack as="form" id="step-up-form" gap="4" onSubmit={(event) => { event.preventDefault(); void confirm(); }}>
                  <Field.Root>
                    <Field.Label>{t('common.password')}</Field.Label>
                    <Input
                      id="step-up-password"
                      aria-label={t('common.password')}
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field.Root>
                  <Field.Root>
                    <Field.Label>{t('common.authenticatorOrRecoveryCode')}</Field.Label>
                    <Input
                      aria-label={t('common.authenticatorOrRecoveryCode')}
                      value={factor}
                      onChange={(event) => setFactor(event.target.value)}
                    />
                  </Field.Root>
                  {error ? <Text role="alert" p="3" borderRadius="md" bg="red.50" color="red.800">{error}</Text> : null}
                </Stack>
              </Dialog.Body>
              <Dialog.Footer>
                <Button type="button" variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
                <Button type="submit" form="step-up-form" colorPalette="green">{t('stepUp.confirm')}</Button>
              </Dialog.Footer>
            </>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
