import { Capacitor } from '@capacitor/core';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';

const MainLayout = () => import('@/shared/layouts/MainLayout.vue');
const SplashView = () => import('@/features/auth/views/SplashView.vue');
const LoginView = () => import('@/features/auth/views/LoginView.vue');
const SignupView = () => import('@/features/auth/views/SignupView.vue');
const FindIdView = () => import('@/features/auth/views/FindIdView.vue');
const ResetPasswordView = () => import('@/features/auth/views/ResetPasswordView.vue');
const PreferenceView = () => import('@/features/auth/views/PreferenceView.vue');
const HomeView = () => import('@/features/buyer/views/HomeView.vue');
const FrequencyAnalyzerView = () => import('@/features/audio/views/FrequencyAnalyzerView.vue');
const SearchView = () => import('@/features/buyer/views/SearchView.vue');
const PressingListingsView = () => import('@/features/buyer/views/PressingListingsView.vue');
const AlbumDetailView = () => import('@/features/buyer/views/AlbumDetailView.vue');
const FavoritesView = () => import('@/features/buyer/views/FavoritesView.vue');
const SellView = () => import('@/features/seller/views/SellView.vue');
const CameraView = () => import('@/features/seller/views/CameraView.vue');
const AnalysisRequestView = () => import('@/features/seller/views/AnalysisRequestView.vue');
const AnalysisResultView = () => import('@/features/seller/views/AnalysisResultView.vue');
const CollectionLibraryView = () => import('@/features/collection/views/CollectionLibraryView.vue');
const CollectionCreateView = () => import('@/features/collection/views/CollectionCreateView.vue');
const CollectionDetailView = () => import('@/features/collection/views/CollectionDetailView.vue');
const CollectionOfferView = () => import('@/features/collection/views/CollectionOfferView.vue');
const ChatView = () => import('@/features/transaction/views/ChatView.vue');
const PriceOfferView = () => import('@/features/buyer/views/PriceOfferView.vue');
const BuyOrderView = () => import('@/features/buyer/views/BuyOrderView.vue');
const OffersView = () => import('@/features/seller/views/OffersView.vue');
const OngoingTransactionView = () => import('@/features/transaction/views/OngoingTransactionView.vue');
const TransactionLocationView = () => import('@/features/transaction/views/TransactionLocationView.vue');
const CancelTransactionView = () => import('@/features/transaction/views/CancelTransactionView.vue');
const ReviewView = () => import('@/features/transaction/views/ReviewView.vue');
const NotificationsView = () => import('@/features/account/views/NotificationsView.vue');
const ProfileView = () => import('@/features/account/views/ProfileView.vue');
const SettingsView = () => import('@/features/account/views/SettingsView.vue');

export const router = createRouter({
  history: Capacitor.isNativePlatform() ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: '/', component: SplashView },
    { path: '/auth/login', component: LoginView },
    { path: '/auth/signup', component: SignupView },
    { path: '/auth/find-id', component: FindIdView },
    { path: '/auth/reset-password', component: ResetPasswordView },
    { path: '/auth/preference', component: PreferenceView },
    { path: '/frequency', component: FrequencyAnalyzerView },
    {
      path: '/app',
      component: MainLayout,
      children: [
        { path: '', component: HomeView },
        { path: 'search', component: SearchView },
        { path: 'search/results', redirect: to => ({ path: '/app/search', query: to.query }) },
        { path: 'pressing', component: PressingListingsView },
        { path: 'album/:id', component: AlbumDetailView },
        { path: 'favorites', component: FavoritesView },
        { path: 'sell', component: SellView },
        { path: 'sell/:id/edit', component: SellView },
        { path: 'collection', component: CollectionLibraryView },
        { path: 'collection/new', component: CollectionCreateView },
        { path: 'collection/:id/edit', component: CollectionCreateView },
        { path: 'collection/:id/offer', component: CollectionOfferView },
        { path: 'collection/:id', component: CollectionDetailView },
        { path: 'notifications', component: NotificationsView },
        { path: 'profile', component: ProfileView },
        { path: 'profile/:userId', component: ProfileView },
        { path: 'settings', component: SettingsView },
      ],
    },
    { path: '/sell', redirect: to => ({ path: '/app/sell', query: to.query }) },
    { path: '/sell/:id/edit', redirect: to => ({ path: `/app/sell/${String(to.params.id)}/edit`, query: to.query }) },
    { path: '/sell/camera', component: CameraView },
    { path: '/sell/analysis', component: AnalysisRequestView },
    { path: '/sell/analysis/result', component: AnalysisResultView },
    { path: '/collection/new', redirect: to => ({ path: '/app/collection/new', query: to.query }) },
    { path: '/collection/:id/edit', redirect: to => ({ path: `/app/collection/${String(to.params.id)}/edit`, query: to.query }) },
    { path: '/collection/:id/offer', redirect: to => ({ path: `/app/collection/${String(to.params.id)}/offer`, query: to.query }) },
    { path: '/collection/:id', redirect: to => ({ path: `/app/collection/${String(to.params.id)}`, query: to.query }) },
    { path: '/transaction/chat/:chatId', component: ChatView },
    { path: '/transaction/offer/:albumId', component: PriceOfferView },
    { path: '/market/buy-order/:listingId', component: BuyOrderView },
    { path: '/transaction/offers/received', component: OffersView },
    { path: '/transaction/ongoing/:transactionId', component: OngoingTransactionView },
    { path: '/transaction/location/:transactionId', component: TransactionLocationView },
    { path: '/transaction/cancel/:transactionId', component: CancelTransactionView },
    { path: '/transaction/review/:transactionId', component: ReviewView },
    { path: '/:pathMatch(.*)*', redirect: '/app' },
  ],
});
