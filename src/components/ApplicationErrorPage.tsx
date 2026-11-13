import { Component, type ReactNode } from 'react';
import { Box, Button, Container, Flex, Heading, HStack, Text } from '@chakra-ui/react';
import { RotateCcw } from 'lucide-react';
import { t } from '../i18n';
import { ApplicationHeader } from './layout/ApplicationHeader';

type ApplicationErrorPageProps = {
  code: string;
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function ApplicationErrorPage({
  code,
  eyebrow,
  title,
  description,
  children,
}: ApplicationErrorPageProps) {
  return (
    <Box minH="100vh" bg="governance.canvas" bgImage="linear-gradient(rgba(20,107,89,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(20,107,89,0.045) 1px, transparent 1px)" bgSize="36px 36px">
      <ApplicationHeader variant="error" />
      <Container as="main" id="main-content" maxW="1440px" minH="calc(100vh - 76px)" py={{ base: '12', md: '20' }} display="flex" alignItems="center">
        <Flex align="center" gap={{ base: '8', md: '16' }} direction={{ base: 'column', md: 'row' }}>
          <Text aria-hidden="true" color="governance.primary" fontFamily="heading" fontSize={{ base: '5xl', md: '8xl' }} fontWeight="bold" lineHeight="0.9" overflowWrap="anywhere">
            {code}
          </Text>
          <Box maxW="44rem" pl={{ base: '4', md: '6' }} borderLeftWidth="3px" borderColor="governance.primary">
            <Text mb="3" color="governance.primary" fontSize="xs" fontWeight="bold" textTransform="uppercase">
              {eyebrow}
            </Text>
            <Heading id="application-error-title" fontSize={{ base: '2xl', md: '4xl' }} lineHeight="1.1">
              {title}
            </Heading>
            <Text mt="4" maxW="36rem" color="governance.muted">{description}</Text>
            {children ? <HStack mt="6" gap="3" flexWrap="wrap">{children}</HStack> : null}
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}

type ApplicationErrorBoundaryProps = {
  children: ReactNode;
};

type ApplicationErrorBoundaryState = {
  failed: boolean;
};

export class ApplicationErrorBoundary extends Component<
  ApplicationErrorBoundaryProps,
  ApplicationErrorBoundaryState
> {
  state: ApplicationErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ApplicationErrorBoundaryState {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <ApplicationErrorPage
        code="500"
        eyebrow={t('errors.applicationEyebrow')}
        title={t('errors.applicationTitle')}
        description={t('errors.applicationDescription')}
      >
        <Button type="button" onClick={() => window.location.reload()}>
          <RotateCcw size={16} aria-hidden="true" />
          {t('errors.reloadApplication')}
        </Button>
      </ApplicationErrorPage>
    );
  }
}