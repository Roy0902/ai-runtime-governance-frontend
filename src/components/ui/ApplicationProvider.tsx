import { ChakraProvider } from '@chakra-ui/react';
import type { ReactNode } from 'react';
import '@fontsource-variable/ibm-plex-sans';
import '@fontsource-variable/space-grotesk';
import { system } from '../../theme';

export function ApplicationProvider({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}