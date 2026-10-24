import type { Business } from '@/types';
/** Fictional, editable starting details for the demo; not transaction sample data. */
export const DEMO_COMPANY_PROFILE = {
 name:'Kedai Maju Jaya Sdn Bhd',display_name:'Kedai Maju Jaya Sdn Bhd',
 address:'12 Jalan Demo, 50000 Kuala Lumpur, Malaysia',phone:'+60 3-0000 0000',
 email:'sales@kedaimaju.example',salesperson_name:'Demo Salesperson',
};
export function supplierFromCompany(business:Business|undefined){
 return {supplier_name:business?.display_name||business?.name||'',supplier_address:business?.address||'',
  supplier_phone:business?.phone||'',supplier_email:business?.email||''};
}
