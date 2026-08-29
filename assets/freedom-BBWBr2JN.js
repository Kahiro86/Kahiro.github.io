import{c as p,cA as T,ca as g,cb as w}from"./index.dev-DEGthUIS.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const F=p("CalendarClock",[["path",{d:"M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",key:"1osxxc"}],["path",{d:"M16 2v4",key:"4m81vk"}],["path",{d:"M8 2v4",key:"1cmpym"}],["path",{d:"M3 10h5",key:"r794hk"}],["path",{d:"M17.5 17.5 16 16.3V14",key:"akvzfd"}],["circle",{cx:"16",cy:"16",r:"6",key:"qoo3c4"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const P=p("HeartPulse",[["path",{d:"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z",key:"c3ymky"}],["path",{d:"M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27",key:"1uw2ng"}]]);/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const V=p("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);function H(t,m,o,u,e=720){if(t>=m)return 0;const l=(o||0)/12;let c=t,a=0;for(;c<m&&a<e;)c=c*(1+l)+u,a++;return a>=e?null:Math.round(a/12*10)/10}function q(t,m){const o=T(m),u=g(t),e=o.freedomNumberKsh,l=Math.max(0,u.monthlyPassive||0),c=Math.min(100,Math.round(l/e*100)),a=Math.max(0,u.totalInvested||0),n=o.vaultTargetKsh,v=Math.min(100,Math.round(a/n*100)),y=Array.isArray(t==null?void 0:t.mmfs)?t.mmfs.filter(Boolean):[],M=y.reduce((h,r)=>h+(+r.balance||0),0),f=y.reduce((h,r)=>h+(+r.balance||0)*(+r.yield||0),0),s=(M>0?f/M:10)/100,x=H(a,n,s,o.monthlyVaultKsh),A=Number.isFinite(+(t==null?void 0:t.xRate))&&+t.xRate>0?+t.xRate:w,C=s>0?Math.round(e*12/s):null,b=n>0?e*12/n:null,d=(h,r,k)=>{const i=s>0?Math.round(k*12/s):null;return{key:h,label:r,monthly:k,cap:i,pct:i?Math.min(100,Math.round(a/i*100)):0}},R=[d("survival","Survival",o.lifeCostKsh),d("half","Half free",e/2),d("freedom","Freedom",e)];return{freedomNumber:e,passiveMonthly:l,freedomPct:c,capital:a,target:n,capitalPct:v,lifeCost:o.lifeCostKsh,surplusToFreedom:Math.max(0,e-l),annualYield:s,monthlyDeposit:o.monthlyVaultKsh,yearsOut:x,xRate:A,capitalRequired:C,impliedWithdrawalRate:b,milestones:R}}export{F as C,P as H,V as T,q as f};
