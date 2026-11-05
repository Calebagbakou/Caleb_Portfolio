import { useLayoutEffect } from 'react';
import { Outlet } from 'react-router-dom';
import ShopHeader from '../components/shop/ShopHeader';
import '../styles/shop.css';
import '../styles/shop-trust.css';

export default function SmmLayout() {
  useLayoutEffect(() => {
    document.body.classList.add('shop-theme');
    document.documentElement.classList.add('shop-active');
    return () => {
      document.body.classList.remove('shop-theme');
      document.documentElement.classList.remove('shop-active');
    };
  }, []);

  return (
    <>
      <ShopHeader showFullNav showMobileButton />
      <Outlet />
    </>
  );
}
