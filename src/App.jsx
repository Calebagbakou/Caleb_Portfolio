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
import Testimonials from './pages/admin/Testimonials';
import Parametres from './pages/admin/Parametres';
import Projects from './pages/admin/Projects';
import Shop from './pages/admin/Shop';
import Orders from './pages/admin/Orders';
import Media from './pages/admin/Media';
import Competencies from './pages/admin/Competencies';
import Services from './pages/admin/Services';
import BuyerAuth from './pages/Boutique/BuyerAuth';
import Account from './pages/Boutique/Account';
import BuyerAuthGate from './components/shop/BuyerAuthGate';

import NotFound from './pages/NotFound';
import ProjectDetail from './pages/ProjectDetail';
import useSiteFavicon from './hooks/useSiteFavicon';
import ScrollToTop from './components/site/ScrollToTop';

export default function App() {
  useSiteFavicon();

  return (
    <Routes>
      <Route element={<ScrollToTop />}>
      {/* ================= SITE PUBLIC (portfolio one-page) ================= */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/projet/:slug" element={<ProjectDetail />} />
      </Route>

      {/* ================= BOUTIQUE ================= */}
      <Route element={<ShopLayout showFullNav showMobileButton />}>
        <Route path="/boutique" element={<ShopHome />} />
        <Route path="/boutique/index.html" element={<ShopHome />} />
        <Route path="/boutique/catalogue" element={<Catalogue />} />
        <Route path="/boutique/produit/:id" element={<Produit />} />
        <Route path="/boutique/panier" element={<Panier />} />
        <Route path="/boutique/connexion" element={<BuyerAuth />} />
        <Route path="/boutique/compte" element={<BuyerAuthGate><Account /></BuyerAuthGate>} />
      </Route>
      {/* commande.html / confirmation.html avaient une nav réduite (pas de menu mobile) */}
      <Route element={<ShopLayout showFullNav={false} showMobileButton={false} />}>
        <Route path="/boutique/commande" element={<BuyerAuthGate><Commande /></BuyerAuthGate>} />
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
        <Route path="competences" element={<Competencies />} />
        <Route path="services" element={<Services />} />
        <Route path="media" element={<Media />} />
        <Route path="shop" element={<Shop />} />
        <Route path="orders" element={<Orders />} />
        <Route path="messages" element={<Messages />} />
        <Route path="temoignages" element={<Testimonials />} />
        <Route path="parametres" element={<Parametres />} />
      </Route>

      {/* ================= 404 ================= */}
      <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
