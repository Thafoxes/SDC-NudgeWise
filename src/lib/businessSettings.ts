import { getStore, update, DEMO_BUSINESS_ID, DEMO_SELLER_ID } from './store';
export interface BusinessSettings { name:string; address:string; phone:string; email:string; salesperson_name:string; payment_terms?:string; quotation_validity_days?:number }
export function saveBusinessSettings(input:BusinessSettings,actor:string,role:string,businessId=DEMO_BUSINESS_ID) {
 const user=getStore().users.find(u=>u.id===DEMO_SELLER_ID && u.business_id===businessId && u.name===actor && u.role===role);
 if(!user || role!=='seller')throw Error('Only the seller can update business settings');
 if(!input || typeof input!=='object' || Array.isArray(input))throw Error('Invalid business settings');
 const fields={name:160,address:2000,phone:40,email:254,salesperson_name:160};
 for(const [key,max] of Object.entries(fields)){
  const value=input[key as keyof BusinessSettings];
  if(typeof value!=='string' || value.length>max || /[\x00-\x08\x0b-\x1f\x7f]/.test(value) || (key!=='address' && /[\r\n]/.test(value)))
   throw Error(`Check seller ${key.replace('_',' ')}`);
 }
 if(input.payment_terms!==undefined&&(typeof input.payment_terms!=='string'||input.payment_terms.length>500||/[\x00-\x1f\x7f]/.test(input.payment_terms)))throw Error('Check payment terms');
 if(input.quotation_validity_days!==undefined&&(!Number.isInteger(input.quotation_validity_days)||input.quotation_validity_days<1||input.quotation_validity_days>365))throw Error('Quotation validity must be 1 to 365 days');
 if(!input.name.trim())throw Error('Enter the supplier / seller name');
 if(input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))throw Error('Enter a valid seller email');
 if(!getStore().businesses.some(b=>b.id===businessId))throw Error('Business not found');
 update(d=>{
  const business=d.businesses.find(b=>b.id===businessId)!;
  Object.assign(business,Object.fromEntries(Object.keys(fields).map(key=>[key,(input[key as keyof typeof fields] as string).trim()])));
  if(input.payment_terms!==undefined)business.payment_terms=input.payment_terms.trim();
  if(input.quotation_validity_days!==undefined)business.quotation_validity_days=input.quotation_validity_days;
  business.display_name=business.name;
  business.settings_initialized=true;
  d.activityEvents.unshift({id:crypto.randomUUID(),business_id:businessId,invoice_id:null,event_type:'business_settings_updated',actor,actor_role:'seller',description:'Seller contact and document settings updated',metadata:{},created_at:new Date().toISOString()});
 });
 return {success:true};
}

export function quotationDefaults(businessId=DEMO_BUSINESS_ID){
 const data=getStore(),business=data.businesses.find(b=>b.id===businessId);
 const date=new Date(data.demoState.simulated_date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+(business?.quotation_validity_days||7));
 return {payment_terms:business?.payment_terms||'Payment within 7 days of invoice date.',valid_until:date.toISOString().slice(0,10)};
}
