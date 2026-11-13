import { Center, Spinner, Stack, Text } from '@chakra-ui/react';
import { t } from '../../i18n';

export function PageLoading({ label = t('loading.page') }: { label?: string }) {
  return (
    <Center minH="40vh" px="4">
      <Stack align="center" gap="3">
        <Spinner colorPalette="green" size="lg" />
        <Text role="status" color="governance.muted" fontSize="sm">{label}</Text>
      </Stack>
    </Center>
  );
}