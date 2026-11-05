import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApplicationErrorBoundary } from './components/ApplicationErrorPage';
import { ApplicationProvider } from './components/ui/ApplicationProvider';
import { ApplicationRoutes } from './ApplicationRoutes';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <ApplicationProvider>
    <BrowserRouter>
      <ApplicationErrorBoundary>
        <ApplicationRoutes />
      </ApplicationErrorBoundary>
    </BrowserRouter>
  </ApplicationProvider>,
);
