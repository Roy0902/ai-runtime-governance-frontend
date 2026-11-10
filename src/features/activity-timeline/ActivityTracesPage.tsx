import { Link } from 'react-router-dom';
import { Badge, Box, Button, Container, Flex, Heading, HStack, Link as ChakraLink, Stack, Text } from '@chakra-ui/react';
import { ApiError } from '../../ApplicationApiClient';
import {
  formatTime,
  outcomeLabel,
  statusLabel,
  StatusBadge,
} from './ActivityTimelinePresentation';
import { useTraceList } from './useActivityTimeline';

function failureCopy(error: unknown): { message: string; signIn: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return { message: 'Sign in to view activity.', signIn: true };
    }
    if (error.status === 404) {
      return { message: 'Trace is unavailable.', signIn: false };
    }
  }
  return { message: 'Activity could not be loaded.', signIn: false };
}

export function ActivityTracesPage() {
  const { items, nextCursor, loading, pending, error, live, refresh, loadMore } = useTraceList();
  const failure = error ? failureCopy(error) : null;

  return (
    <Container as="main" maxW="1440px" py={{ base: '6', md: '10' }} px={{ base: '4', md: '8' }}>
      <Flex justify="space-between" align="flex-end" gap="6" wrap="wrap" mb="6">
        <div>
          <Text mb="2" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Observability</Text>
          <Heading fontFamily="heading" fontSize={{ base: '3xl', md: '4xl' }}>Activity</Heading>
          <Text mt="2" maxW="44rem" color="governance.muted">
            Inspect reported agent, model, tool, guard, and approval activity without exposing payloads.
          </Text>
        </div>
        <HStack gap="2" align="center">
          <Badge colorPalette={live ? 'green' : 'gray'} variant="subtle">
            {live ? 'Live' : 'Manual refresh'}
          </Badge>
          <Button type="button" variant="outline" onClick={refresh} disabled={loading}>
            Refresh
          </Button>
        </HStack>
      </Flex>

      <Box as="section" aria-labelledby="traces-heading" p={{ base: '4', md: '6' }} borderWidth="1px" borderColor="governance.line" borderRadius="xl" bg="white">
        <Flex justify="space-between" align="center" gap="3" mb="5">
          <Box>
            <Text mb="1" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">Recent activity</Text>
            <Heading id="traces-heading" fontFamily="heading" fontSize="xl">Traces</Heading>
          </Box>
          <Badge colorPalette="gray" variant="subtle">{items.length} traces</Badge>
        </Flex>

        {loading ? <Text role="status" color="governance.muted">Loading activity…</Text> : null}

        {failure ? (
          <Flex role="alert" align="center" justify="space-between" gap="4" p="3" borderRadius="md" bg="red.50" color="red.800">
            {failure.message}{' '}
            {failure.signIn ? (
              <ChakraLink asChild><Link to="/sign-in">Sign in</Link></ChakraLink>
            ) : (
              <Button size="sm" variant="outline" onClick={refresh}>Try again</Button>
            )}
          </Flex>
        ) : null}

        {!loading && !failure && items.length === 0 ? (
          <Box role="status" py="12" textAlign="center">
            <Text fontWeight="semibold">No traces recorded</Text>
            <Text mt="1" color="governance.muted" fontSize="sm">Reported activity will appear here.</Text>
          </Box>
        ) : null}

        {!failure && items.length > 0 ? (
          <Stack as="ul" aria-label="Traces" listStyle="none" gap="2" p="0" m="0">
            {items.map((trace) =>
              'tombstone' in trace ? (
                <Box as="li" key={trace.traceId} p="4" borderWidth="1px" borderStyle="dashed" borderColor="governance.line" borderRadius="lg" color="governance.muted">
                  Trace unavailable
                </Box>
              ) : (
                <Box as="li" key={trace.traceId}>
                  <ChakraLink asChild color="inherit" _hover={{ textDecoration: 'none' }}>
                    <Link to={`/activity/${trace.traceId}`} aria-label={`Open trace ${trace.traceId}`}>
                      <Box p="4" borderWidth="1px" borderColor="governance.line" borderRadius="lg" transition="border-color 120ms ease, box-shadow 120ms ease" _hover={{ borderColor: 'governance.primary', boxShadow: 'sm' }}>
                        <Flex justify="space-between" align="center" gap="4" wrap="wrap">
                          <Text fontFamily="mono" fontSize="sm" fontWeight="semibold">Trace {trace.traceId.slice(-8)}</Text>
                          <StatusBadge value={trace.executionStatus} />
                        </Flex>
                        <Flex mt="2" justify="space-between" gap="3" wrap="wrap">
                          <Text color="governance.muted" fontSize="sm">{formatTime(trace.receivedAt)}</Text>
                          <HStack gap="2" flexWrap="wrap">
                            <Badge variant="outline">{outcomeLabel(trace.guardOutcome)}</Badge>
                            <Badge variant="outline">{statusLabel(trace.telemetryStatus)} telemetry</Badge>
                          </HStack>
                        </Flex>
                      </Box>
                    </Link>
                  </ChakraLink>
                </Box>
              ),
            )}
          </Stack>
        ) : null}

        {nextCursor ? (
          <Button mt="5" variant="outline" onClick={loadMore} disabled={pending}>
            {pending ? 'Loading more activity…' : 'Load more traces'}
          </Button>
        ) : null}
      </Box>
    </Container>
  );
}
