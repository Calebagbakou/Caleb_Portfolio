import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import ShopHeader from '../components/shop/ShopHeader';
import ShopFooter from '../components/shop/ShopFooter';
import '../styles/shop.css';

export default function ShopLayout({ showFullNav, showMobileButton }) {
  useLayoutEffect(() => {
    document.body.classList.add('shop-theme');
    return () => document.body.classList.remove('shop-theme');
  }, []);

  return (
    <>
      <ShopHeader showFullNav={showFullNav} showMobileButton={showMobileButton} />
      <Outlet />
      <ShopFooter />
    </>
  );
}
