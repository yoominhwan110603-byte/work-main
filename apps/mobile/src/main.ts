import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles.css';
import { useAppStore } from '@/shared/stores/appStore';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia);
const store = useAppStore();
store.loadPersistedPreferences();
void store.loadUserProfileFromServer();
app.use(router).mount('#app');
