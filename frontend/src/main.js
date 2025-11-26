import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// Note: Removed CSS imports to prevent errors if files are missing

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
