import { Outlet } from 'react-router-dom';
import ShopHeader from '../components/shop/ShopHeader';
import ShopFooter from '../components/shop/ShopFooter';
import '../styles/shop.css';

export default function ShopLayout({ showFullNav, showMobileButton }) {
  return (
    <>
      <ShopHeader showFullNav={showFullNav} showMobileButton={showMobileButton} />
      <Outlet />
      <ShopFooter />
    </>
  );
}
