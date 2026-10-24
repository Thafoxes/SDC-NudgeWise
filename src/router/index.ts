import { createRouter, createWebHashHistory } from 'vue-router';
import DashboardView from '@/views/DashboardView.vue';
import ActionCenterView from '@/views/ActionCenterView.vue';
import AiAssistantView from '@/views/AiAssistantView.vue';
import InvoicesView from '@/views/InvoicesView.vue';
import CustomersView from '@/views/CustomersView.vue';
import OrdersView from '@/views/OrdersView.vue';
import QuickSaleView from '@/views/QuickSaleView.vue';
import SettingsView from '@/views/SettingsView.vue';
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {path:'/demo-payment',component:()=>import('@/views/DemoPaymentView.vue'),meta:{title:'Demo payment link',subtitle:'Preview only; no real payments are processed.'}},
    { path: '/', redirect: '/dashboard' },
    { path: '/invoices', name: 'invoices', component: InvoicesView, meta: { title: 'Invoices', subtitle: 'Search invoices and review balances, payments and follow-ups.' } },
    { path: '/customers/:id/:mode(view|edit)', name: 'customer-record', component: CustomersView, meta: { title: 'Customer details', subtitle: 'View or edit a customer.' } },
    { path: '/orders/:id/:mode(view|edit)', name: 'order-record', component: OrdersView, meta: { title: 'Order details', subtitle: 'Follow this order from quotation to delivery, invoice and payment.' } },
    { path: '/customers', name: 'customers', component: CustomersView, meta: { title: 'Customers', subtitle: 'Review customer payment history and follow-up priorities.' } },
    { path: '/orders', name: 'orders', component: OrdersView, meta: { title: 'Orders', subtitle: 'Track each sale from order and quotation to delivery, invoice and payment.' } },
    { path: '/dashboard', name: 'dashboard', component: DashboardView, meta: { title: 'Dashboard', subtitle: "Here's your invoice collection overview." } },
    { path: '/action-center', name: 'action-center', component: ActionCenterView, meta: { title: 'Action Center', subtitle: 'Review reminders, customer responses, and invoice issues requiring your attention.' } },
    { path:'/quick-sale',name:'quick-sale',component:QuickSaleView,meta:{title:'Quick sale',subtitle:'Issue a direct invoice for a small B2B sale.'} },
    { path: '/settings', name:'settings', component:SettingsView, meta:{title:'Settings',subtitle:'Seller contact details and document preparation.'} },
    { path: '/ai-assistant', name: 'ai-assistant', component: AiAssistantView, meta: { title: 'NudgeWise AI Assistant', subtitle: 'Ask about orders, quotations, invoices, payments, and general topics.' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});
export default router;
