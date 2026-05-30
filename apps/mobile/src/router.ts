import { Capacitor } from '@capacitor/core';
import { createRouter, createWebHashHistory, createWebHistory } from 'vue-router';
import MainLayout from './layouts/MainLayout.vue';
import SplashView from './views/SplashView.vue';
import LoginView from './views/LoginView.vue';
import SignupView from './views/SignupView.vue';
import FindIdView from './views/FindIdView.vue';
import ResetPasswordView from './views/ResetPasswordView.vue';
import PreferenceView from './views/PreferenceView.vue';
import HomeView from './views/HomeView.vue';
import SearchView from './views/SearchView.vue';
import AlbumDetailView from './views/AlbumDetailView.vue';
import FavoritesView from './views/FavoritesView.vue';
import NotificationsView from './views/NotificationsView.vue';
import ProfileView from './views/ProfileView.vue';
import SettingsView from './views/SettingsView.vue';
import SellView from './views/SellView.vue';
import CameraView from './views/CameraView.vue';
import AnalysisRequestView from './views/AnalysisRequestView.vue';
import AnalysisResultView from './views/AnalysisResultView.vue';
import SellReportView from './views/SellReportView.vue';
import ChatView from './views/ChatView.vue';
import CommentsView from './views/CommentsView.vue';
import PriceOfferView from './views/PriceOfferView.vue';
import OffersView from './views/OffersView.vue';
import OngoingTransactionView from './views/OngoingTransactionView.vue';
import TransactionLocationView from './views/TransactionLocationView.vue';
import CancelTransactionView from './views/CancelTransactionView.vue';
import ReviewView from './views/ReviewView.vue';
import ReportView from './views/ReportView.vue';

export const router = createRouter({
  history: Capacitor.isNativePlatform() ? createWebHashHistory() : createWebHistory(),
  routes: [
    { path: '/', component: SplashView },
    { path: '/auth/login', component: LoginView },
    { path: '/auth/signup', component: SignupView },
    { path: '/auth/find-id', component: FindIdView },
    { path: '/auth/reset-password', component: ResetPasswordView },
    { path: '/auth/preference', component: PreferenceView },
    {
      path: '/app',
      component: MainLayout,
      children: [
        { path: '', component: HomeView },
        { path: 'search', component: SearchView },
        { path: 'search/results', redirect: to => ({ path: '/app/search', query: to.query }) },
        { path: 'album/:id', component: AlbumDetailView },
        { path: 'favorites', component: FavoritesView },
        { path: 'notifications', component: NotificationsView },
        { path: 'profile', component: ProfileView },
        { path: 'profile/:userId', component: ProfileView },
        { path: 'settings', component: SettingsView },
      ],
    },
    { path: '/sell', component: SellView },
    { path: '/sell/:id/edit', component: SellView },
    { path: '/sell/camera', component: CameraView },
    { path: '/sell/analysis', component: AnalysisRequestView },
    { path: '/sell/analysis/result', component: AnalysisResultView },
    { path: '/sell/report', component: SellReportView },
    { path: '/transaction/chat/:chatId', component: ChatView },
    { path: '/transaction/comments/:albumId', component: CommentsView },
    { path: '/transaction/offer/:albumId', component: PriceOfferView },
    { path: '/transaction/offers/received', component: OffersView },
    { path: '/transaction/ongoing/:transactionId', component: OngoingTransactionView },
    { path: '/transaction/location/:transactionId', component: TransactionLocationView },
    { path: '/transaction/cancel/:transactionId', component: CancelTransactionView },
    { path: '/transaction/review/:transactionId', component: ReviewView },
    { path: '/report/:type/:id', component: ReportView },
  ],
});
