import { createBrowserRouter } from "react-router";
import MainLayout from "./layouts/MainLayout";
import AuthLayout from "./layouts/AuthLayout";

import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import PreferenceScreen from "./screens/PreferenceScreen";

import HomeScreen from "./screens/HomeScreen";
import SearchScreen from "./screens/SearchScreen";
import SearchResultScreen from "./screens/SearchResultScreen";
import AlbumDetailScreen from "./screens/AlbumDetailScreen";
import CreateListingScreen from "./screens/CreateListingScreen";
import CameraScreen from "./screens/CameraScreen";
import AnalysisRequestScreen from "./screens/AnalysisRequestScreen";
import AnalysisResultScreen from "./screens/AnalysisResultScreen";
import SalesReportScreen from "./screens/SalesReportScreen";
import FavoritesScreen from "./screens/FavoritesScreen";
import NotificationsScreen from "./screens/NotificationsScreen";
import ChatScreen from "./screens/ChatScreen";
import CommentsScreen from "./screens/CommentsScreen";
import PriceOfferScreen from "./screens/PriceOfferScreen";
import ReceivedOffersScreen from "./screens/ReceivedOffersScreen";
import OngoingTransactionScreen from "./screens/OngoingTransactionScreen";
import TransactionLocationScreen from "./screens/TransactionLocationScreen";
import CancelTransactionScreen from "./screens/CancelTransactionScreen";
import ReviewScreen from "./screens/ReviewScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ReportScreen from "./screens/ReportScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SplashScreen />,
  },
  {
    path: "/auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: <LoginScreen /> },
      { path: "signup", element: <SignupScreen /> },
      { path: "preference", element: <PreferenceScreen /> },
    ],
  },
  {
    path: "/app",
    element: <MainLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: "search", element: <SearchScreen /> },
      { path: "search/results", element: <SearchResultScreen /> },
      { path: "album/:id", element: <AlbumDetailScreen /> },
      { path: "favorites", element: <FavoritesScreen /> },
      { path: "notifications", element: <NotificationsScreen /> },
      { path: "profile", element: <ProfileScreen /> },
      { path: "profile/:userId", element: <ProfileScreen /> },
    ],
  },
  {
    path: "/sell",
    children: [
      { index: true, element: <CreateListingScreen /> },
      { path: "camera", element: <CameraScreen /> },
      { path: "analysis", element: <AnalysisRequestScreen /> },
      { path: "analysis/result", element: <AnalysisResultScreen /> },
      { path: "report", element: <SalesReportScreen /> },
    ],
  },
  {
    path: "/transaction",
    children: [
      { path: "chat/:chatId", element: <ChatScreen /> },
      { path: "comments/:albumId", element: <CommentsScreen /> },
      { path: "offer/:albumId", element: <PriceOfferScreen /> },
      { path: "offers/received", element: <ReceivedOffersScreen /> },
      { path: "ongoing/:transactionId", element: <OngoingTransactionScreen /> },
      { path: "location/:transactionId", element: <TransactionLocationScreen /> },
      { path: "cancel/:transactionId", element: <CancelTransactionScreen /> },
      { path: "review/:transactionId", element: <ReviewScreen /> },
    ],
  },
  {
    path: "/report/:type/:id",
    element: <ReportScreen />,
  },
]);
