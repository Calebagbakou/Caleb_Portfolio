import { Routes, Route } from 'react-router-dom';

import PublicLayout from './layouts/PublicLayout';
import ShopLayout from './layouts/ShopLayout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/admin/ProtectedRoute';

import Home from './pages/Home/Home';

import ShopHome from './pages/Boutique/ShopHome';
import Catalogue from './pages/Boutique/Catalogue';
import Produit from './pages/Boutique/Produit';
import Panier from './pages/Boutique/Panier';
import Commande from './pages/Boutique/Commande';
import Confirmation from './pages/Boutique/Confirmation';

import Login from './pages/admin/Login';
import ForgotPassword from './pages/admin/ForgotPassword';
import ResetPassword from './pages/admin/ResetPassword';
import Dashboard from './pages/admin/Dashboard';
import Messages from './pages/admin/Messages';
import Parametres from './pages/admin/Parametres';
import Projects from './pages/admin/Projects';
import Shop from './pages/admin/Shop';
import Orders from './pages/admin/Orders';

import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* ================= SITE PUBLIC (portfolio one-page) ================= */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* ================= BOUTIQUE ================= */}
      <Route element={<ShopLayout showFullNav showMobileButton />}>
        <Route path="/boutique" element={<ShopHome />} />
        <Route path="/boutique/index.html" element={<ShopHome />} />
        <Route path="/boutique/catalogue" element={<Catalogue />} />
        <Route path="/boutique/produit/:id" element={<Produit />} />
        <Route path="/boutique/panier" element={<Panier />} />
      </Route>
      {/* commande.html / confirmation.html avaient une nav réduite (pas de menu mobile) */}
      <Route element={<ShopLayout showFullNav={false} showMobileButton={false} />}>
        <Route path="/boutique/commande" element={<Commande />} />
        <Route path="/boutique/confirmation" element={<Confirmation />} />
      </Route>

      {/* ================= ADMIN — connexion (pages publiques) ================= */}
      <Route path="/admin/login" element={<Login />} />
      <Route path="/admin/forgot-password" element={<ForgotPassword />} />
      <Route path="/admin/reset-password" element={<ResetPassword />} />

      {/* ================= ADMIN — pages protégées (une seule instance du layout,
          partagée entre Dashboard/Messages/Paramètres pour éviter de
          démonter/remonter la sidebar à chaque navigation) ================= */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="projects" element={<Projects />} />
        <Route path="shop" element={<Shop />} />
        <Route path="orders" element={<Orders />} />
        <Route path="messages" element={<Messages />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>

      {/* ================= 404 ================= */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
