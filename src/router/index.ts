import { createRouter, createWebHashHistory } from 'vue-router';
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {path:'/demo-payment',component:()=>import('@/views/DemoPaymentView.vue'),meta:{title:'Demo payment link',subtitle:'Preview only; no real payments are processed.'}},
    { path: '/', redirect: '/dashboard' },
    { path: '/invoices', redirect: to => ({path:'/orders/invoices',query:to.query}) },
    {path:'/orders/quotations',name:'quotations',component:()=>import('@/views/QuotationsView.vue'),meta:{title:'Quotations',subtitle:'Review quotations across all orders.'}},
    {path:'/orders/invoices',name:'invoices',component:()=>import('@/views/InvoicesView.vue'),meta:{title:'Invoices',subtitle:'Search invoices and review balances, payments and follow-ups.'}},
    { path: '/customers/:id/:mode(view|edit)', name: 'customer-record', component:()=>import('@/views/CustomersView.vue'), meta: { title: 'Customer details', subtitle: 'View or edit a customer.' } },
    { path: '/orders/:id/:mode(view|edit)', name: 'order-record', component:()=>import('@/views/OrdersView.vue'), meta: { title: 'Order details', subtitle: 'Follow this order from quotation to delivery, invoice and payment.' } },
    { path: '/customers', name: 'customers', component:()=>import('@/views/CustomersView.vue'), meta: { title: 'Customers', subtitle: 'Review customer payment history and follow-up priorities.' } },
    { path: '/orders', name: 'orders', component:()=>import('@/views/OrdersView.vue'), meta: { title: 'Orders', subtitle: 'Track each sale from order and quotation to delivery, invoice and payment.' } },
    { path: '/dashboard', name: 'dashboard', component:()=>import('@/views/DashboardView.vue'), meta: { title: 'Dashboard', subtitle: "Here's your invoice collection overview." } },
    { path: '/action-center', name: 'action-center', component:()=>import('@/views/ActionCenterView.vue'), meta: { title: 'Action Center', subtitle: 'Review reminders, customer responses, and invoice issues requiring your attention.' } },
    { path:'/quick-sale',name:'quick-sale',component:()=>import('@/views/QuickSaleView.vue'),meta:{title:'Quick sale',subtitle:'Issue a direct invoice for a small B2B sale.'} },
    { path: '/settings', name:'settings', component:()=>import('@/views/SettingsView.vue'), meta:{title:'Settings',subtitle:'Seller contact details and document preparation.'} },
    { path: '/ai-assistant', name: 'ai-assistant', component:()=>import('@/views/AiAssistantView.vue'), meta: { title: 'NudgeWise AI Assistant', subtitle: 'Ask about orders, quotations, invoices, payments, and general topics.' } },
    { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
  ],
});
export default router;
