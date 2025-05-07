import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Stripe from 'stripe';
import sgMail from '@sendgrid/mail';

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('Environment variables loaded:');
console.log('CLIENT_URL:', process.env.CLIENT_URL);
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY ? 'Set' : 'Not set');
console.log('SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Set' : 'Not set');

// Initialize Express app
const app = express();
const port = process.env.PORT || 4000;

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for file uploads

// Set the recipient email for all form submissions
const RECIPIENT_EMAIL = 'wayne@uplinq.digital';

// Routes
app.get('/', (req, res) => {
  res.send('Uplinq API Server is running');
});

// Create a Stripe checkout session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { priceId, productName, productDescription, mode } = req.body;

    console.log('Stripe Secret Key (first 10):', process.env.STRIPE_SECRET_KEY.slice(0, 10));
    console.log('Price ID received:', priceId);
    console.log('Stripe Account Mode:', process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') ? 'LIVE' : 'TEST');
    console.log('Checkout mode:', mode);

    // Validate required fields
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Default to 'payment' if mode is not provided
    const checkoutMode = mode === 'subscription' ? 'subscription' : 'payment';

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        }
      ],
      mode: checkoutMode,
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/pricing`,
      metadata: {
        productName,
        productDescription
      }
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a payment intent
app.post('/api/create-payment-intent', async (req, res) => {
  try {
    const { amount, currency = 'usd', description } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Webhook to handle Stripe events
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        // Handle successful payment
        console.log('Payment successful for session:', session.id);
        // Here you would typically:
        // 1. Update your database
        // 2. Send confirmation email
        // 3. Provision the product/service
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Handle contact form submissions
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, details, file } = req.body;
    
    // Log the submission
    console.log('Contact form submission received:', { 
      name, email, details, 
      // Don't log the entire file for privacy reasons
      hasFile: !!file,
      // Always sent to our designated recipient
      sentTo: RECIPIENT_EMAIL
    });
    
    // Send email using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        const msg = {
          to: RECIPIENT_EMAIL,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@uplinq.digital',
          subject: `New Contact Form Submission from ${name}`,
          text: `Contact details:
  Name: ${name}
  Email: ${email}
  Details: ${details}`,
          html: `
  <h2>New Contact Form Submission</h2>
  <p><strong>Name:</strong> ${name}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Details:</strong></p>
  <p>${details.replace(/\n/g, '<br>')}</p>
  `,
        };
        
        // Add attachment if file is provided
        if (file) {
          // Remove the data:image/... prefix to get just the base64 content
          const fileContent = file.split(',')[1];
          const fileType = file.match(/data:(.*);base64/)?.[1] || 'application/octet-stream';
          const fileName = 'attachment' + (fileType.includes('image') ? '.jpg' : '.pdf');
          
          msg.attachments = [
            {
              content: fileContent,
              filename: fileName,
              type: fileType,
              disposition: 'attachment'
            }
          ];
        }
        
        await sgMail.send(msg);
        console.log('Email sent to', RECIPIENT_EMAIL);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Continue with response even if email fails
      }
    } else {
      console.log('SendGrid API key not set - email not sent');
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Contact form submitted successfully',
      recipient: RECIPIENT_EMAIL // Confirm where it would be sent
    });
    
  } catch (error) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process contact form submission. Please try again later.' 
    });
  }
});

// Handle quote form submissions
app.post('/api/quote', async (req, res) => {
  try {
    const { name, company, email, website, projectType, budget, timeline, goals } = req.body;
    
    // Log the submission
    console.log('Quote form submission received:', { 
      name, company, email, website, projectType, budget, timeline, goals,
      // Always sent to our designated recipient
      sentTo: RECIPIENT_EMAIL
    });
    
    // Send email using SendGrid
    if (process.env.SENDGRID_API_KEY) {
      try {
        const msg = {
          to: RECIPIENT_EMAIL,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@uplinq.digital',
          subject: `New Quote Request from ${name}${company ? ` at ${company}` : ''}`,
          text: `Quote request details:
  Name: ${name}
  Company: ${company || 'N/A'}
  Email: ${email}
  Website: ${website || 'N/A'}
  Project Type: ${projectType}
  Budget: ${budget}
  Timeline: ${timeline}
  Goals: ${goals}`,
          html: `
  <h2>New Quote Request</h2>
  <p><strong>Name:</strong> ${name}</p>
  <p><strong>Company:</strong> ${company || 'N/A'}</p>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Website:</strong> ${website || 'N/A'}</p>
  <p><strong>Project Type:</strong> ${projectType}</p>
  <p><strong>Budget:</strong> ${budget}</p>
  <p><strong>Timeline:</strong> ${timeline}</p>
  <p><strong>Goals:</strong></p>
  <p>${goals.replace(/\n/g, '<br>')}</p>
  `,
        };
        
        await sgMail.send(msg);
        console.log('Email sent to', RECIPIENT_EMAIL);
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Continue with response even if email fails
      }
    } else {
      console.log('SendGrid API key not set - email not sent');
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Quote request submitted successfully',
      recipient: RECIPIENT_EMAIL // Confirm where it would be sent
    });
    
  } catch (error) {
    console.error('Error processing quote request:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process quote request. Please try again later.' 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 