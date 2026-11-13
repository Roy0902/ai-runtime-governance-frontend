import { Button } from '@chakra-ui/react';

export function LoadMoreButton({
  hasMore,
  loading = false,
  label,
  loadingLabel,
  onClick,
}: {
  hasMore: boolean;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
  onClick: () => void;
}) {
  if (!hasMore) {
    return null;
  }

  return (
    <Button
      type="button"
      mt="4"
      w="full"
      size="sm"
      variant="outline"
      borderStyle="dashed"
      onClick={onClick}
      disabled={loading}
    >
      {loading ? (loadingLabel ?? label) : label}
    </Button>
  );
}
