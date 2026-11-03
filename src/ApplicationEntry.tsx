import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApplicationRoutes } from './ApplicationRoutes';
import './ApplicationStyles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <BrowserRouter>
    <ApplicationRoutes />
  </BrowserRouter>,
);
