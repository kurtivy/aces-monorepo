"use strict";var N=Object.create;var d=Object.defineProperty;var T=Object.getOwnPropertyDescriptor;var U=Object.getOwnPropertyNames;var _=Object.getPrototypeOf,V=Object.prototype.hasOwnProperty;var z=(e,t)=>{for(var r in t)d(e,r,{get:t[r],enumerable:!0})},R=(e,t,r,a)=>{if(t&&typeof t=="object"||typeof t=="function")for(let s of U(t))!V.call(e,s)&&s!==r&&d(e,s,{get:()=>t[s],enumerable:!(a=T(t,s))||a.enumerable});return e};var m=(e,t,r)=>(r=e!=null?N(_(e)):{},R(t||!e||!e.__esModule?d(r,"default",{value:e,enumerable:!0}):r,e)),H=e=>R(d({},"__esModule",{value:!0}),e);var W={};z(W,{default:()=>G});module.exports=H(W);var q=m(require("fastify")),D=require("crypto"),I=m(require("@fastify/helmet")),S=m(require("fastify-metrics"));var f=require("pino"),o=(0,f.pino)({level:process.env.LOG_LEVEL||"info",transport:process.env.NODE_ENV==="development"?{target:"pino-pretty",options:{colorize:!0,translateTime:"SYS:standard",ignore:"pid,hostname"}}:void 0,formatters:{level:e=>({level:e})},timestamp:f.pino.stdTimeFunctions.isoTime,base:{service:"aces-backend",version:process.env.npm_package_version||"1.0.0"}}),g={request:(e,t,r,a)=>o.info({type:"request",requestId:e,method:t,url:r,userAgent:a},"Request received"),response:(e,t,r,a,s)=>o.info({type:"response",requestId:e,method:t,url:r,statusCode:a,responseTime:s},"Request completed"),auth:(e,t,r)=>o.info({type:"auth",userId:e,walletAddress:t,action:r},`User ${r}`),blockchain:(e,t,r)=>o.info({type:"blockchain",txHash:e,action:t,contractAddress:r},`Blockchain ${t}`),database:(e,t,r,a)=>o.info({type:"database",operation:e,table:t,recordId:r,duration:a},`Database ${e}`),error:(e,t={})=>o.error({type:"error",error:{name:e.name,message:e.message,stack:e.stack},...t},e.message)};var x=require("@prisma/client"),M=()=>{let e=new x.PrismaClient({log:[{emit:"event",level:"query"},{emit:"event",level:"error"},{emit:"event",level:"info"},{emit:"event",level:"warn"}]});return process.env.NODE_ENV==="development"&&e.$on("query",t=>{o.debug({type:"database",query:t.query,params:t.params,duration:t.duration},"Database query executed")}),e.$on("error",t=>{o.error({type:"database",error:t},"Database error occurred")}),e.$use(async(t,r)=>{let a=Date.now(),s=await r(t),c=Date.now()-a;return c>1e3&&o.warn({type:"database",action:t.action,model:t.model,duration:c},"Slow database query detected"),s}),e},l,A=()=>(l||(l=M()),l);var F=async()=>{l&&(await l.$disconnect(),o.info("Database connection closed"))};var i=require("@hapi/boom"),h=class extends Error{constructor(r,a,s){super(r);this.code=a;this.meta=s;this.name="AppError"}};async function y(e,t){if(e instanceof h){await t.status(400).send({error:e.code,message:e.message,meta:e.meta});return}if(e instanceof i.Boom){await t.status(e.output.statusCode).send(e.output.payload);return}let r=(0,i.internal)("An unexpected error occurred");await t.status(r.output.statusCode).send(r.output.payload)}var E=m(require("fastify-plugin"));var b=require("@prisma/client");function C(e){let t=!!e&&e.isActive,r=e?.sellerStatus===b.SellerStatus.APPROVED,a=r&&!!e?.verifiedAt;return{user:e,isAuthenticated:t,hasRole:s=>e?(Array.isArray(s)?s:[s]).includes(e.role):!1,isSellerVerified:r,canAccessSellerDashboard:a}}var j=async e=>{e.decorateRequest("user",null),e.decorateRequest("auth",null),e.log.warn("Authentication disabled - Privy integration removed"),e.addHook("preHandler",async t=>{t.user=null,t.auth=C(null)})},P=(0,E.default)(j);var u=require("zod");var k=require("resend"),L=new k.Resend(process.env.RESEND_API_KEY),p=class{static async sendContactFormEmail(t){try{if(!process.env.RESEND_API_KEY)return console.error("RESEND_API_KEY environment variable is not set"),{success:!1,error:"Email service configuration error"};let a={watches:"Watches & Timepieces",jewelry:"Jewelry & Precious Stones",art:"Art & Collectibles",vehicles:"Luxury Vehicles",fashion:"Fashion & Accessories",spirits:"Fine Wines & Spirits","real-estate":"Real Estate",yachts:"Yachts & Boats","private-jets":"Private Jets",memorabilia:"Sports Memorabilia",other:"Other Luxury Items"}[t.category]||t.category,s=`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Contact Form Submission - ACES</title>
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .header {
              background: linear-gradient(135deg, #D0B264 0%, #231F20 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 10px 10px 0 0;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .field {
              margin-bottom: 20px;
              padding: 15px;
              background-color: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #D0B264;
            }
            .label {
              font-weight: bold;
              color: #231F20;
              margin-bottom: 5px;
              display: block;
            }
            .value {
              color: #555;
              font-size: 16px;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
            .logo {
              font-size: 24px;
              font-weight: bold;
              letter-spacing: 2px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ACES</div>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Contact Form Submission</p>
          </div>
          
          <div class="content">
            <h2 style="color: #231F20; margin-top: 0;">Contact Request Details</h2>
            
            <div class="field">
              <span class="label">Customer Email:</span>
              <span class="value">${t.email}</span>
            </div>
            
            <div class="field">
              <span class="label">Category:</span>
              <span class="value">${a}</span>
            </div>
            
            <div class="field">
              <span class="label">Item Requested:</span>
              <span class="value">${t.itemName}</span>
            </div>
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, my email is ${t.email} and I am looking for this item ${t.itemName}"</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES contact form.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${t.email}</strong></p>
          </div>
        </body>
        </html>
      `,c=`
New Contact Form Submission - ACES

Customer Email: ${t.email}
Category: ${a}
Item Requested: ${t.itemName}

Generated Message: "Hello, my email is ${t.email} and I am looking for this item ${t.itemName}"

Reply directly to this email to respond to the customer.
      `,n=await L.emails.send({from:"ACES Contact Form <noreply@aces.fun>",to:["pocket@aces.fun"],replyTo:t.email,subject:`New Contact Request: ${t.itemName} (${a})`,html:s,text:c});return n.error?(console.error("Resend API error:",n.error),{success:!1,error:"Failed to send email"}):(console.log("Contact form email sent successfully:",n.data?.id),{success:!0,messageId:n.data?.id})}catch(r){return console.error("Email service error:",r),{success:!1,error:"Internal email service error"}}}};var Y=u.z.object({category:u.z.string().min(1,"Category is required"),itemName:u.z.string().min(1,"Item name is required"),email:u.z.string().email("Valid email is required")});async function v(e){e.post("/contact",async(t,r)=>{try{let a=Y.safeParse(t.body);if(!a.success){let $=a.error.errors.map(w=>`${w.path.join(".")}: ${w.message}`);return r.status(400).send({success:!1,message:"Validation failed",errors:$})}let s=a.data;if(!["watches","jewelry","art","vehicles","fashion","spirits","real-estate","yachts","private-jets","memorabilia","other"].includes(s.category))return r.status(400).send({success:!1,message:"Invalid category selected"});let n=await p.sendContactFormEmail(s);return n.success?(console.log("Contact form submitted successfully:",{email:s.email,category:s.category,itemName:s.itemName,messageId:n.messageId}),r.status(200).send({success:!0,message:"Thank you for your inquiry! We will get back to you soon.",messageId:n.messageId})):(console.error("Failed to send contact form email:",n.error),r.status(500).send({success:!1,message:"Failed to send your message. Please try again later."}))}catch(a){return console.error("Contact form submission error:",a),r.status(500).send({success:!1,message:"Internal server error. Please try again later."})}})}var B=async()=>{let e=(0,q.default)({logger:!1,genReqId:()=>(0,D.randomUUID)()}),t=A();return e.decorate("prisma",t),e.register(I.default),e.register(S.default,{endpoint:"/metrics",routeMetrics:{enabled:!0}}),e.register(P),e.register(v),e.addHook("onRequest",async r=>{r.startTime=Date.now(),g.request(r.id,r.method,r.url,r.headers["user-agent"])}),e.addHook("onResponse",async(r,a)=>{let s=r.startTime?Date.now()-r.startTime:0;g.response(r.id,r.method,r.url,a.statusCode,s)}),e.setErrorHandler((r,a,s)=>{try{y(r,s)}catch(c){y(c,s)}}),e.addHook("onClose",async()=>{await F()}),e},O=async(e,t)=>{let r=await B();await r.ready(),e.url?.startsWith("/api/v1/contact")&&(e.url=e.url.replace("/api/v1/contact","")||"/"),r.server.emit("request",e,t)},G=O;
//# sourceMappingURL=contact.js.map