import { Outlet } from 'react-router-dom';
import Header from '../components/site/Header';
import Footer from '../components/site/Footer';
import ScrollProgress from '../components/site/ScrollProgress';
import { PresentationProvider } from '../context/PresentationContext';
import '../styles/global.css';

export default function PublicLayout() {
  return (
    <PresentationProvider>
      <ScrollProgress />
      <Header />
      <Outlet />
      <Footer />
    </PresentationProvider>
  );
}
