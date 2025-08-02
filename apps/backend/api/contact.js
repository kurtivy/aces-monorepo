'use strict';var _=require('fastify'),crypto=require('crypto'),U=require('@fastify/cors'),N=require('@fastify/helmet'),q=require('fastify-metrics'),pino=require('pino'),client=require('@prisma/client'),boom=require('@hapi/boom'),F=require('fastify-plugin'),serverAuth=require('@privy-io/server-auth'),zod=require('zod'),resend=require('resend');function _interopDefault(e){return e&&e.__esModule?e:{default:e}}var ___default=/*#__PURE__*/_interopDefault(_);var U__default=/*#__PURE__*/_interopDefault(U);var N__default=/*#__PURE__*/_interopDefault(N);var q__default=/*#__PURE__*/_interopDefault(q);var F__default=/*#__PURE__*/_interopDefault(F);var i=pino.pino({level:process.env.LOG_LEVEL||"info",transport:process.env.NODE_ENV==="development"?{target:"pino-pretty",options:{colorize:true,translateTime:"SYS:standard",ignore:"pid,hostname"}}:void 0,formatters:{level:e=>({level:e})},timestamp:pino.pino.stdTimeFunctions.isoTime,base:{service:"aces-backend",version:process.env.npm_package_version||"1.0.0"}}),l={request:(e,r,t,a)=>i.info({type:"request",requestId:e,method:r,url:t,userAgent:a},"Request received"),response:(e,r,t,a,s)=>i.info({type:"response",requestId:e,method:r,url:t,statusCode:a,responseTime:s},"Request completed"),auth:(e,r,t)=>i.info({type:"auth",userId:e,walletAddress:r,action:t},`User ${t}`),blockchain:(e,r,t)=>i.info({type:"blockchain",txHash:e,action:r,contractAddress:t},`Blockchain ${r}`),database:(e,r,t,a)=>i.info({type:"database",operation:e,table:r,recordId:t,duration:a},`Database ${e}`),error:(e,r={})=>i.error({type:"error",error:{name:e.name,message:e.message,stack:e.stack},...r},e.message)};var x=()=>{let e=new client.PrismaClient({log:[{emit:"event",level:"query"},{emit:"event",level:"error"},{emit:"event",level:"info"},{emit:"event",level:"warn"}]});return process.env.NODE_ENV==="development"&&e.$on("query",r=>{i.debug({type:"database",query:r.query,params:r.params,duration:r.duration},"Database query executed");}),e.$on("error",r=>{i.error({type:"database",error:r},"Database error occurred");}),e.$use(async(r,t)=>{let a=Date.now(),s=await t(r),o=Date.now()-a;return o>1e3&&i.warn({type:"database",action:r.action,model:r.model,duration:o},"Slow database query detected"),s}),e},d,w=()=>(d||(d=x()),d);var b=async()=>{d&&(await d.$disconnect(),i.info("Database connection closed"));};var h=class extends Error{constructor(t,a,s){super(t);this.code=a;this.meta=s;this.name="AppError";}};async function g(e,r){if(e instanceof h){await r.status(400).send({error:e.code,message:e.message,meta:e.meta});return}if(e instanceof boom.Boom){await r.status(e.output.statusCode).send(e.output.payload);return}let t=boom.internal("An unexpected error occurred");await r.status(t.output.statusCode).send(t.output.payload);}function u(e){let r=!!e&&e.isActive,t=e?.sellerStatus===client.SellerStatus.APPROVED,a=t&&!!e?.verifiedAt;return {user:e,isAuthenticated:r,hasRole:s=>e?(Array.isArray(s)?s:[s]).includes(e.role):false,isSellerVerified:t,canAccessSellerDashboard:a}}var D=async e=>{if(e.decorateRequest("user",null),e.decorateRequest("auth",null),!process.env.PRIVY_APP_ID||!process.env.PRIVY_APP_SECRET){e.log.warn({hasAppId:!!process.env.PRIVY_APP_ID,hasAppSecret:!!process.env.PRIVY_APP_SECRET},"Privy credentials missing - authentication disabled"),e.addHook("preHandler",async t=>{t.user=null,t.auth=u(null);});return}let r=new serverAuth.PrivyClient(process.env.PRIVY_APP_ID,process.env.PRIVY_APP_SECRET);e.addHook("preHandler",async t=>{let a=t.headers.authorization,s=t.headers["x-wallet-address"];if(a?.startsWith("Bearer "))try{let o=a.substring(7),n=await r.verifyAuthToken(o),c=await e.prisma.user.upsert({where:{privyDid:n.userId},update:{walletAddress:s||n.walletAddress||void 0,updatedAt:new Date},create:{privyDid:n.userId,walletAddress:s||n.walletAddress}});if(s&&c.walletAddress!==s){let m=await e.prisma.user.update({where:{id:c.id},data:{walletAddress:s}});t.user=m;}else t.user=c;t.auth=u(t.user),t.user&&l.auth(t.user.id,t.user.walletAddress,"authenticated");}catch(o){e.log.warn("Auth verification failed:",o),t.user=null,t.auth=u(null);}else t.user=null,t.auth=u(null);});},R=F__default.default(D);var S=new resend.Resend(process.env.RESEND_API_KEY),p=class{static async sendContactFormEmail(r){try{if(!process.env.RESEND_API_KEY)return console.error("RESEND_API_KEY environment variable is not set"),{success:!1,error:"Email service configuration error"};let a={watches:"Watches & Timepieces",jewelry:"Jewelry & Precious Stones",art:"Art & Collectibles",vehicles:"Luxury Vehicles",fashion:"Fashion & Accessories",spirits:"Fine Wines & Spirits","real-estate":"Real Estate",yachts:"Yachts & Boats","private-jets":"Private Jets",memorabilia:"Sports Memorabilia",other:"Other Luxury Items"}[r.category]||r.category,s=`
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
              <span class="value">${r.email}</span>
            </div>
            
            <div class="field">
              <span class="label">Category:</span>
              <span class="value">${a}</span>
            </div>
            
            <div class="field">
              <span class="label">Item Requested:</span>
              <span class="value">${r.itemName}</span>
            </div>
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, my email is ${r.email} and I am looking for this item ${r.itemName}"</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES contact form.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${r.email}</strong></p>
          </div>
        </body>
        </html>
      `,o=`
New Contact Form Submission - ACES

Customer Email: ${r.email}
Category: ${a}
Item Requested: ${r.itemName}

Generated Message: "Hello, my email is ${r.email} and I am looking for this item ${r.itemName}"

Reply directly to this email to respond to the customer.
      `,n=await S.emails.send({from:"ACES Contact Form <noreply@aces.fun>",to:["pocket@aces.fun"],replyTo:r.email,subject:`New Contact Request: ${r.itemName} (${a})`,html:s,text:o});return n.error?(console.error("Resend API error:",n.error),{success:!1,error:"Failed to send email"}):(console.log("Contact form email sent successfully:",n.data?.id),{success:!0,messageId:n.data?.id})}catch(t){return console.error("Email service error:",t),{success:false,error:"Internal email service error"}}}};var $=zod.z.object({category:zod.z.string().min(1,"Category is required"),itemName:zod.z.string().min(1,"Item name is required"),email:zod.z.string().email("Valid email is required")});async function y(e){e.post("/contact",async(r,t)=>{try{let a=$.safeParse(r.body);if(!a.success){let c=a.error.errors.map(m=>`${m.path.join(".")}: ${m.message}`);return t.status(400).send({success:!1,message:"Validation failed",errors:c})}let s=a.data;if(!["watches","jewelry","art","vehicles","fashion","spirits","real-estate","yachts","private-jets","memorabilia","other"].includes(s.category))return t.status(400).send({success:!1,message:"Invalid category selected"});let n=await p.sendContactFormEmail(s);return n.success?(console.log("Contact form submitted successfully:",{email:s.email,category:s.category,itemName:s.itemName,messageId:n.messageId}),t.status(200).send({success:!0,message:"Thank you for your inquiry! We will get back to you soon.",messageId:n.messageId})):(console.error("Failed to send contact form email:",n.error),t.status(500).send({success:!1,message:"Failed to send your message. Please try again later."}))}catch(a){return console.error("Contact form submission error:",a),t.status(500).send({success:false,message:"Internal server error. Please try again later."})}});}var V=async()=>{let e=___default.default({logger:false,genReqId:()=>crypto.randomUUID()}),r=w();return e.decorate("prisma",r),e.register(U__default.default,{origin:"*"}),e.register(N__default.default),e.register(q__default.default,{endpoint:"/metrics",routeMetrics:{enabled:true}}),e.register(R),e.register(y),e.addHook("onRequest",async t=>{t.startTime=Date.now(),l.request(t.id,t.method,t.url,t.headers["user-agent"]);}),e.addHook("onResponse",async(t,a)=>{let s=t.startTime?Date.now()-t.startTime:0;l.response(t.id,t.method,t.url,a.statusCode,s);}),e.setErrorHandler((t,a,s)=>{try{g(t,s);}catch(o){g(o,s);}}),e.addHook("onClose",async()=>{await b();}),e},z=async(e,r)=>{let t=await V();await t.ready(),e.url?.startsWith("/api/v1/contact")&&(e.url=e.url.replace("/api/v1/contact","")||"/"),t.server.emit("request",e,r);},Fe=z;if (module.exports.default) module.exports = module.exports.default;module.exports=Fe;
module.exports = exports.default;
