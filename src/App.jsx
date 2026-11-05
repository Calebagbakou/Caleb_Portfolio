import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom';

import PublicLayout from './layouts/PublicLayout';
import ProtectedRoute from './components/admin/ProtectedRoute';
import BuyerAuthGate from './components/shop/BuyerAuthGate';
import useSiteFavicon from './hooks/useSiteFavicon';
import ScrollToTop from './components/site/ScrollToTop';
import { OfflineBanner, PageSkeleton, RouteProgress } from './components/site/LoadingStates';

const ShopLayout = lazy(() => import('./layouts/ShopLayout'));
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const Home = lazy(() => import('./pages/Home/Home'));
const ShopHome = lazy(() => import('./pages/Boutique/ShopHome'));
const Catalogue = lazy(() => import('./pages/Boutique/Catalogue'));
const Produit = lazy(() => import('./pages/Boutique/Produit'));
const Commande = lazy(() => import('./pages/Boutique/Commande'));
const Confirmation = lazy(() => import('./pages/Boutique/Confirmation'));
const Login = lazy(() => import('./pages/admin/Login'));
const ForgotPassword = lazy(() => import('./pages/admin/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/admin/ResetPassword'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const Messages = lazy(() => import('./pages/admin/Messages'));
const Testimonials = lazy(() => import('./pages/admin/Testimonials'));
const Parametres = lazy(() => import('./pages/admin/Parametres'));
const Projects = lazy(() => import('./pages/admin/Projects'));
const Shop = lazy(() => import('./pages/admin/Shop'));
const Providers = lazy(() => import('./pages/admin/Providers'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const Clients = lazy(() => import('./pages/admin/Clients'));
const Media = lazy(() => import('./pages/admin/Media'));
const Competencies = lazy(() => import('./pages/admin/Competencies'));
const Services = lazy(() => import('./pages/admin/Services'));
const BuyerAuth = lazy(() => import('./pages/Boutique/BuyerAuth'));
const Account = lazy(() => import('./pages/Boutique/Account'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const Legal = lazy(() => import('./pages/Legal'));
const Gateway = lazy(() => import('./pages/Gateway'));
const SmmPanel = lazy(() => import('./pages/SmmPanel'));
const SmmAuth = lazy(() => import('./pages/SmmAuth'));
const SmmServices = lazy(() => import('./pages/admin/SmmServices'));
const SmmLayout = lazy(() => import('./layouts/SmmLayout'));

function LegacyProjectRedirect() {
  const { slug } = useParams();
  return <Navigate to={`/portfolio/projet/${slug}`} replace />;
}

export default function App() {
  useSiteFavicon();
  const { pathname } = useLocation();

  useEffect(() => {
    const robots = document.querySelector('meta[name="robots"]');
    if (!robots) return undefined;
    const previousContent = robots.content;
    if (pathname.startsWith('/admin')) robots.content = 'noindex, nofollow';
    return () => {
      robots.content = previousContent;
    };
  }, [pathname]);

  return (
    <>
    <RouteProgress />
    <OfflineBanner />
    <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route element={<ScrollToTop />}>
      {/* ================= SITE PUBLIC ================= */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Gateway />} />
        <Route path="/portfolio" element={<Home />} />
        <Route path="/portfolio/projet/:slug" element={<ProjectDetail />} />
        <Route path="/portfolio/confidentialite" element={<Legal pageKey="privacy" />} />
        <Route path="/portfolio/conditions" element={<Legal pageKey="terms" />} />
        <Route path="/portfolio/mentions-legales" element={<Legal pageKey="notices" />} />
      </Route>
      <Route element={<SmmLayout />}>
        <Route path="/smm/connexion" element={<SmmAuth />} />
        <Route path="/smm" element={<BuyerAuthGate><SmmPanel /></BuyerAuthGate>} />
      </Route>
      <Route path="/projet/:slug" element={<LegacyProjectRedirect />} />
      <Route path="/confidentialite" element={<Navigate to="/portfolio/confidentialite" replace />} />
      <Route path="/conditions" element={<Navigate to="/portfolio/conditions" replace />} />
      <Route path="/mentions-legales" element={<Navigate to="/portfolio/mentions-legales" replace />} />

      {/* ================= BOUTIQUE ================= */}
      <Route element={<ShopLayout showFullNav showMobileButton />}>
        <Route path="/boutique" element={<ShopHome />} />
        <Route path="/boutique/index.html" element={<ShopHome />} />
        <Route path="/boutique/catalogue" element={<Catalogue />} />
        <Route path="/boutique/produit/:id" element={<Produit />} />
        <Route path="/boutique/panier" element={<Navigate to="/boutique/catalogue" replace />} />
        <Route path="/boutique/connexion" element={<BuyerAuth />} />
        <Route path="/boutique/compte" element={<BuyerAuthGate><Account /></BuyerAuthGate>} />
      </Route>
      {/* commande.html / confirmation.html avaient une nav réduite (pas de menu mobile) */}
      <Route element={<ShopLayout showFullNav={false} showMobileButton />}>
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
        <Route path="portfolio/projects" element={<Projects />} />
        <Route path="portfolio/competences" element={<Competencies />} />
        <Route path="portfolio/services" element={<Services />} />
        <Route path="portfolio/temoignages" element={<Testimonials />} />
        <Route path="media/images" element={<Media />} />
        <Route path="shop" element={<Navigate to="/admin/shop/products" replace />} />
        <Route path="shop/products" element={<Shop shopSection="products" />} />
        <Route path="shop/fournisseurs" element={<Providers />} />
        <Route path="shop/categories" element={<Shop shopSection="categories" />} />
        <Route path="shop/promos" element={<Shop shopSection="promos" />} />
        <Route path="shop/content" element={<Shop shopSection="content" />} />
        <Route path="shop/prodseller" element={<Shop shopSection="prodseller" />} />
        <Route path="shop/zfourstore" element={<Shop shopSection="zfourstore" />} />
        <Route path="smm" element={<SmmServices />} />
        <Route path="orders" element={<Orders />} />
        <Route path="clients" element={<Clients />} />
        <Route path="messages" element={<Messages />} />
        <Route path="parametres" element={<Parametres />} />
        <Route path="projects" element={<Navigate to="/admin/portfolio/projects" replace />} />
        <Route path="competences" element={<Navigate to="/admin/portfolio/competences" replace />} />
        <Route path="services" element={<Navigate to="/admin/portfolio/services" replace />} />
        <Route path="temoignages" element={<Navigate to="/admin/portfolio/temoignages" replace />} />
        <Route path="media" element={<Navigate to="/admin/media/images" replace />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* ================= 404 ================= */}
      <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </Suspense>
    </>
  );
}
