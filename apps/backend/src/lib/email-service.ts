import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface ContactFormData {
  category: string;
  itemName: string;
  email: string;
}

export interface PurchaseInquiryData {
  productTitle: string;
  productTicker: string;
  productPrice?: string;
  customerEmail: string;
  customerMessage?: string;
}

export interface EmailServiceResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EmailService {
  static async sendContactFormEmail(data: ContactFormData): Promise<EmailServiceResponse> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY environment variable is not set');
        return {
          success: false,
          error: 'Email service configuration error',
        };
      }

      // Get category display name
      const categoryMap: Record<string, string> = {
        watches: 'Watches & Timepieces',
        jewelry: 'Jewelry & Precious Stones',
        art: 'Art & Collectibles',
        vehicles: 'Luxury Vehicles',
        fashion: 'Fashion & Accessories',
        spirits: 'Fine Wines & Spirits',
        'real-estate': 'Real Estate',
        yachts: 'Yachts & Boats',
        'private-jets': 'Private Jets',
        memorabilia: 'Sports Memorabilia',
        other: 'Other Luxury Items',
      };

      const categoryDisplay = categoryMap[data.category] || data.category;

      const emailHtml = `
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
              <span class="value">${data.email}</span>
            </div>
            
            <div class="field">
              <span class="label">Category:</span>
              <span class="value">${categoryDisplay}</span>
            </div>
            
            <div class="field">
              <span class="label">Item Requested:</span>
              <span class="value">${data.itemName}</span>
            </div>
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, my email is ${data.email} and I am looking for this item ${data.itemName}"</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES contact form.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${data.email}</strong></p>
          </div>
        </body>
        </html>
      `;

      const emailText = `
New Contact Form Submission - ACES

Customer Email: ${data.email}
Category: ${categoryDisplay}
Item Requested: ${data.itemName}

Generated Message: "Hello, my email is ${data.email} and I am looking for this item ${data.itemName}"

Reply directly to this email to respond to the customer.
      `;

      const result = await resend.emails.send({
        from: 'ACES Contact Form <noreply@aces.fun>',
        to: ['pocket@aces.fun'],
        replyTo: data.email,
        subject: `New Contact Request: ${data.itemName} (${categoryDisplay})`,
        html: emailHtml,
        text: emailText,
      });

      if (result.error) {
        console.error('Resend API error:', result.error);
        return {
          success: false,
          error: 'Failed to send email',
        };
      }

      console.log('Contact form email sent successfully:', result.data?.id);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      console.error('Email service error:', error);
      return {
        success: false,
        error: 'Internal email service error',
      };
    }
  }

  static async sendPurchaseInquiryEmail(data: PurchaseInquiryData): Promise<EmailServiceResponse> {
    try {
      if (!process.env.RESEND_API_KEY) {
        console.error('RESEND_API_KEY environment variable is not set');
        return {
          success: false,
          error: 'Email service configuration error',
        };
      }

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Purchase Inquiry - ACES</title>
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
            .priority {
              background: linear-gradient(135deg, #ff6b6b, #ee5a24);
              color: white;
              padding: 10px 20px;
              border-radius: 20px;
              font-weight: bold;
              display: inline-block;
              margin-bottom: 20px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">ACES</div>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">New Purchase Inquiry</p>
          </div>
          
          <div class="content">
            <div class="priority">🔥 HIGH PRIORITY - PURCHASE INQUIRY</div>
            
            <h2 style="color: #231F20; margin-top: 0;">Purchase Request Details</h2>
            
            <div class="field">
              <span class="label">Customer Email:</span>
              <span class="value">${data.customerEmail}</span>
            </div>
            
            <div class="field">
              <span class="label">Product:</span>
              <span class="value">${data.productTitle}</span>
            </div>
            
            <div class="field">
              <span class="label">Token Symbol:</span>
              <span class="value">${data.productTicker}</span>
            </div>
            
            ${
              data.productPrice
                ? `
            <div class="field">
              <span class="label">Listed Price:</span>
              <span class="value">${data.productPrice}</span>
            </div>
            `
                : ''
            }
            
            ${
              data.customerMessage
                ? `
            <div class="field">
              <span class="label">Customer Message:</span>
              <span class="value">${data.customerMessage}</span>
            </div>
            `
                : ''
            }
            
            <div class="field">
              <span class="label">Generated Message:</span>
              <span class="value">"Hello, I am interested in purchasing ${data.productTitle} (${data.productTicker}). Please contact me at ${data.customerEmail} to discuss the purchase."</span>
            </div>
          </div>
          
          <div class="footer">
            <p>This email was automatically generated from the ACES purchase inquiry system.</p>
            <p>Reply directly to this email to respond to the customer at <strong>${data.customerEmail}</strong></p>
            <p><strong>⚡ This is a purchase inquiry - prioritize response!</strong></p>
          </div>
        </body>
        </html>
      `;

      const emailText = `
New Purchase Inquiry - ACES

🔥 HIGH PRIORITY - PURCHASE INQUIRY

Customer Email: ${data.customerEmail}
Product: ${data.productTitle}
Token Symbol: ${data.productTicker}
${data.productPrice ? `Listed Price: ${data.productPrice}` : ''}
${data.customerMessage ? `Customer Message: ${data.customerMessage}` : ''}

Generated Message: "Hello, I am interested in purchasing ${data.productTitle} (${data.productTicker}). Please contact me at ${data.customerEmail} to discuss the purchase."

⚡ This is a purchase inquiry - prioritize response!

Reply directly to this email to respond to the customer.
      `;

      const result = await resend.emails.send({
        from: 'ACES Purchase Inquiry <pocket@aces.fun>',
        to: ['pocket@aces.fun'],
        replyTo: data.customerEmail,
        subject: `🔥 Purchase Inquiry: ${data.productTitle} (${data.productTicker})`,
        html: emailHtml,
        text: emailText,
      });

      if (result.error) {
        console.error('Resend API error:', result.error);
        return {
          success: false,
          error: 'Failed to send email',
        };
      }

      console.log('Purchase inquiry email sent successfully:', result.data?.id);
      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      console.error('Purchase inquiry email service error:', error);
      return {
        success: false,
        error: 'Failed to send email',
      };
    }
  }
}
